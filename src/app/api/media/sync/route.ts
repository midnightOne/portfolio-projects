import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMediaProvider } from '@/lib/media';
import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

interface CloudinaryResource {
  public_id: string;
  format: string;
  version: number;
  resource_type: string;
  type: string;
  created_at: string;
  bytes: number;
  width?: number;
  height?: number;
  folder?: string;
  filename?: string;
  original_filename?: string;
  secure_url: string;
  url: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication - admin only
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action = 'preview', resourceTypes = ['image', 'video', 'raw'] } = body;

    // Verify Cloudinary configuration
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };

    if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CLOUDINARY_CONFIG_MISSING',
          message: 'Cloudinary configuration is incomplete',
          details: {
            hasCloudName: !!cloudinaryConfig.cloud_name,
            hasApiKey: !!cloudinaryConfig.api_key,
            hasApiSecret: !!cloudinaryConfig.api_secret
          }
        }
      }, { status: 500 });
    }

    // Get all resources from Cloudinary
    const cloudinaryResources: CloudinaryResource[] = [];
    const cloudinaryErrors: string[] = [];

    for (const resourceType of resourceTypes) {
      try {
        console.log(`Fetching ${resourceType} resources from Cloudinary...`);
        let nextCursor: string | undefined;
        let pageCount = 0;

        do {
          const result = await cloudinary.api.resources({
            resource_type: resourceType,
            type: 'upload',
            max_results: 500,
            next_cursor: nextCursor
          });

          console.log(`Fetched page ${++pageCount} for ${resourceType}: ${result.resources.length} items`);
          cloudinaryResources.push(...result.resources);
          nextCursor = result.next_cursor;
        } while (nextCursor);

        console.log(`Total ${resourceType} resources fetched: ${cloudinaryResources.filter(r => r.resource_type === resourceType).length}`);

      } catch (error) {
        const errorMessage = `Failed to fetch ${resourceType} resources from Cloudinary: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
        console.error(errorMessage);
        cloudinaryErrors.push(errorMessage);
      }
    }

    console.log(`Total Cloudinary resources fetched: ${cloudinaryResources.length}`);

    // If we have errors but no resources, return the errors for debugging
    if (cloudinaryResources.length === 0 && cloudinaryErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CLOUDINARY_FETCH_FAILED',
          message: 'Failed to fetch resources from Cloudinary',
          details: cloudinaryErrors,
          config: {
            cloud_name: cloudinaryConfig.cloud_name,
            api_key_present: !!cloudinaryConfig.api_key,
            api_secret_present: !!cloudinaryConfig.api_secret
          }
        }
      }, { status: 500 });
    }

    // Get existing media items from database
    const existingMediaItems = await prisma.mediaItem.findMany({
      select: {
        id: true,
        url: true,
        type: true,
        createdAt: true
      }
    });

    // Create a map of existing URLs for quick lookup
    const existingUrls = new Set(existingMediaItems.map(item => item.url));

    // Find missing resources (in Cloudinary but not in database)
    const missingResources = cloudinaryResources.filter(resource =>
      !existingUrls.has(resource.secure_url) && !existingUrls.has(resource.url)
    );

    // Find orphaned database records (in database but not in Cloudinary)
    const cloudinaryUrls = new Set([
      ...cloudinaryResources.map(r => r.secure_url),
      ...cloudinaryResources.map(r => r.url)
    ]);

    const orphanedRecords = existingMediaItems.filter(item =>
      !cloudinaryUrls.has(item.url)
    );

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            cloudinaryTotal: cloudinaryResources.length,
            databaseTotal: existingMediaItems.length,
            missingInDatabase: missingResources.length,
            orphanedInDatabase: orphanedRecords.length
          },
          missingResources: missingResources.slice(0, 10), // Preview first 10
          orphanedRecords: orphanedRecords.slice(0, 10), // Preview first 10
          hasMore: {
            missing: missingResources.length > 10,
            orphaned: orphanedRecords.length > 10
          }
        }
      });
    }

    if (action === 'restore') {
      const restoredItems = [];

      for (const resource of missingResources) {
        try {
          const mediaType = mapResourceTypeToDbType(resource.resource_type);

          const mediaItem = await prisma.mediaItem.create({
            data: {
              type: mediaType,
              url: resource.secure_url,
              thumbnailUrl: resource.secure_url,
              altText: resource.original_filename || resource.filename || resource.public_id,
              description: `Restored from Cloudinary: ${resource.public_id}`,
              width: resource.width || null,
              height: resource.height || null,
              fileSize: BigInt(resource.bytes),
              displayOrder: 0,
              projectId: null, // Can be assigned later
              createdAt: new Date(resource.created_at)
            }
          });

          restoredItems.push({
            id: mediaItem.id,
            publicId: resource.public_id,
            url: resource.secure_url,
            type: mediaType,
            bytes: resource.bytes
          });
        } catch (error) {
          console.error(`Failed to restore resource ${resource.public_id}:`, error);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          restored: restoredItems.length,
          restoredItems,
          summary: {
            cloudinaryTotal: cloudinaryResources.length,
            databaseTotal: existingMediaItems.length + restoredItems.length,
            missingInDatabase: missingResources.length - restoredItems.length,
            orphanedInDatabase: orphanedRecords.length
          }
        }
      });
    }

    if (action === 'cleanup') {
      const deletedIds = [];

      for (const record of orphanedRecords) {
        try {
          await prisma.mediaItem.delete({
            where: { id: record.id }
          });
          deletedIds.push(record.id);
        } catch (error) {
          console.error(`Failed to delete orphaned record ${record.id}:`, error);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          deleted: deletedIds.length,
          deletedIds,
          summary: {
            cloudinaryTotal: cloudinaryResources.length,
            databaseTotal: existingMediaItems.length - deletedIds.length,
            missingInDatabase: missingResources.length,
            orphanedInDatabase: orphanedRecords.length - deletedIds.length
          }
        }
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action. Use preview, restore, or cleanup' } },
      { status: 400 }
    );

  } catch (error) {
    console.error('Media sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: 'Failed to sync media',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    );
  }
}

function mapResourceTypeToDbType(resourceType: string): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
  switch (resourceType) {
    case 'image':
      return 'IMAGE';
    case 'video':
      return 'VIDEO';
    default:
      return 'DOCUMENT';
  }
}