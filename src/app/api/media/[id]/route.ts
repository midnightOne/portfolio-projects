import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';
import { getMediaProvider } from '@/lib/media';

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

    // Find the media item
    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id }
    });

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
    }

    // Delete from media provider (cloud storage)
    // Note: For Cloudinary, we can extract the publicId from the URL
    try {
      const mediaProvider = getMediaProvider();
      // Extract publicId from Cloudinary URL for deletion
      const urlParts = mediaItem.url.split('/');
      const fileNameWithExt = urlParts[urlParts.length - 1];
      const publicId = fileNameWithExt.split('.')[0]; // Remove extension
      await mediaProvider.delete(publicId);
    } catch (providerError) {
      console.warn('Failed to delete from media provider:', providerError);
      // Continue with database deletion even if cloud deletion fails
    }

    // Delete from database
    await prisma.mediaItem.delete({
      where: { id }
    });

    return NextResponse.json({ 
      message: 'Media item deleted successfully',
      deletedId: id 
    });
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