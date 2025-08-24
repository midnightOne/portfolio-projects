import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMediaProvider } from '@/lib/media';

/**
 * Extract public ID from Cloudinary URL
 * Handles various Cloudinary URL formats including versioned URLs
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    // Remove query parameters
    const cleanUrl = url.split('?')[0];
    
    // Match Cloudinary URL patterns:
    // https://res.cloudinary.com/cloud/image/upload/v1234567890/folder/filename.ext
    // https://res.cloudinary.com/cloud/image/upload/folder/filename.ext
    const patterns = [
      // With version
      /\/(?:image|video|raw)\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/,
      // Without version
      /\/(?:image|video|raw)\/upload\/(.+?)(?:\.[^.]+)?$/,
      // Generic pattern for other formats
      /\/([^\/]+\/[^\/]+)(?:\.[^.]+)?$/
    ];
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Fallback: try to extract from the end of URL
    const urlParts = cleanUrl.split('/');
    if (urlParts.length >= 2) {
      const fileNameWithExt = urlParts[urlParts.length - 1];
      const fileName = fileNameWithExt.split('.')[0];
      
      // If we have a folder structure, include it
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id } = await params;

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id },
      include: {
        project: true
      }
    });

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
    }

    return NextResponse.json({ mediaItem });
  } catch (error) {
    console.error('Get media item error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication for admin-only operations
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    // Parse request body to get deletion options
    let deleteFromCloudinary = true; // Default behavior for backward compatibility
    try {
      const body = await request.json();
      deleteFromCloudinary = body.deleteFromCloudinary !== false;
    } catch {
      // If no body or invalid JSON, use default behavior
    }

    // Find the media item
    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id }
    });

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
    }

    let cloudinaryDeleted = false;
    let cloudinaryError = null;

    // Delete from media provider (cloud storage) if requested
    if (deleteFromCloudinary) {
      try {
        const mediaProvider = getMediaProvider();
        // Extract publicId from Cloudinary URL for deletion
        const publicId = extractPublicIdFromUrl(mediaItem.url);
        
        if (!publicId) {
          throw new Error('Could not extract public ID from media URL');
        }
        
        const deleteResult = await mediaProvider.delete(publicId);
        
        if (deleteResult.result === 'ok') {
          cloudinaryDeleted = true;
        } else {
          cloudinaryError = `File not found in Cloudinary (${deleteResult.result})`;
          if (deleteResult.details?.fallback) {
            cloudinaryError += ` - Used fallback method due to: ${deleteResult.details.originalError}`;
          }
        }
      } catch (providerError) {
        console.warn('Failed to delete from media provider:', providerError);
        cloudinaryError = providerError instanceof Error ? providerError.message : 'Unknown error';
        // Continue with database deletion even if cloud deletion fails
      }
    }

    // Delete from database
    await prisma.mediaItem.delete({
      where: { id }
    });

    const response: any = { 
      message: deleteFromCloudinary 
        ? (cloudinaryDeleted 
          ? 'Media item deleted from both database and Cloudinary'
          : 'Media item deleted from database, but Cloudinary deletion failed')
        : 'Media item deleted from database only',
      deletedId: id,
      deletedFromDatabase: true,
      deletedFromCloudinary: cloudinaryDeleted
    };

    if (cloudinaryError) {
      response.cloudinaryError = cloudinaryError;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Delete media item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete media item' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication for admin-only operations
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    const body = await request.json();
    const { altText, description } = body;

    // Find the media item
    const existingMedia = await prisma.mediaItem.findUnique({
      where: { id }
    });

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
    }

    // Update the media item
    const updatedMedia = await prisma.mediaItem.update({
      where: { id },
      data: {
        altText: altText || existingMedia.altText,
        description: description !== undefined ? description : existingMedia.description
      },
      include: {
        project: true
      }
    });

    return NextResponse.json({ 
      message: 'Media item updated successfully',
      mediaItem: updatedMedia 
    });
  } catch (error) {
    console.error('Update media item error:', error);
    return NextResponse.json(
      { error: 'Failed to update media item' },
      { status: 500 }
    );
  }
} 