import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMediaProvider } from '@/lib/media';

/**
 * Extract public ID from Cloudinary URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    const cleanUrl = url.split('?')[0];
    
    const patterns = [
      /\/(?:image|video|raw)\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/,
      /\/(?:image|video|raw)\/upload\/(.+?)(?:\.[^.]+)?$/,
      /\/([^\/]+\/[^\/]+)(?:\.[^.]+)?$/
    ];
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    const urlParts = cleanUrl.split('/');
    if (urlParts.length >= 2) {
      const fileNameWithExt = urlParts[urlParts.length - 1];
      const fileName = fileNameWithExt.split('.')[0];
      
      if (urlParts.length >= 3) {
        const folder = urlParts[urlParts.length - 2];
        return `${folder}/${fileName}`;
      }
      
      return fileName;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication for admin-only operations
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { mediaIds, deleteFromCloudinary = true } = body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json({ error: 'Invalid media IDs array' }, { status: 400 });
    }

    // Find all media items
    const mediaItems = await prisma.mediaItem.findMany({
      where: { id: { in: mediaIds } }
    });

    if (mediaItems.length === 0) {
      return NextResponse.json({ error: 'No media items found' }, { status: 404 });
    }

    const results = {
      deletedFromDatabase: [] as string[],
      deletedFromCloudinary: [] as string[],
      notFoundInCloudinary: [] as string[],
      errors: [] as string[],
      cloudinaryErrors: [] as string[]
    };

    // Delete from Cloudinary if requested
    if (deleteFromCloudinary && mediaItems.length > 0) {
      try {
        const mediaProvider = getMediaProvider();
        
        // Extract public IDs from URLs
        const publicIds: string[] = [];
        const publicIdToMediaId: Record<string, string> = {};
        
        for (const item of mediaItems) {
          const publicId = extractPublicIdFromUrl(item.url);
          if (publicId) {
            publicIds.push(publicId);
            publicIdToMediaId[publicId] = item.id;
          } else {
            results.errors.push(`Could not extract public ID from URL for media ${item.id}`);
          }
        }

        if (publicIds.length > 0) {
          // Use batch delete if available, otherwise delete individually
          if (mediaProvider.deleteMultiple) {
            const batchResult = await mediaProvider.deleteMultiple(publicIds);
            results.deletedFromCloudinary.push(...batchResult.deleted);
            results.notFoundInCloudinary.push(...batchResult.notFound);
            results.cloudinaryErrors.push(...batchResult.errors);
          } else {
            // Fallback to individual deletions
            for (const publicId of publicIds) {
              try {
                const deleteResult = await mediaProvider.delete(publicId);
                if (deleteResult.result === 'ok') {
                  results.deletedFromCloudinary.push(publicId);
                } else {
                  results.notFoundInCloudinary.push(publicId);
                }
              } catch (error) {
                results.cloudinaryErrors.push(`${publicId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }
        }
      } catch (error) {
        results.cloudinaryErrors.push(`Batch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Delete from database
    try {
      const deleteResult = await prisma.mediaItem.deleteMany({
        where: { id: { in: mediaIds } }
      });
      
      results.deletedFromDatabase = mediaIds;
    } catch (error) {
      results.errors.push(`Database deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Prepare response message
    let message = `Successfully deleted ${results.deletedFromDatabase.length} items from database`;
    
    if (deleteFromCloudinary) {
      message += `, ${results.deletedFromCloudinary.length} from Cloudinary`;
      
      if (results.notFoundInCloudinary.length > 0) {
        message += ` (${results.notFoundInCloudinary.length} not found in Cloudinary)`;
      }
      
      if (results.cloudinaryErrors.length > 0) {
        message += ` (${results.cloudinaryErrors.length} Cloudinary errors)`;
      }
    }

    const response: any = {
      message,
      results,
      summary: {
        totalRequested: mediaIds.length,
        deletedFromDatabase: results.deletedFromDatabase.length,
        deletedFromCloudinary: results.deletedFromCloudinary.length,
        notFoundInCloudinary: results.notFoundInCloudinary.length,
        errors: results.errors.length + results.cloudinaryErrors.length
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete media items' },
      { status: 500 }
    );
  }
}