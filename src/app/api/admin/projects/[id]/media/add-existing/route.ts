import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
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
    const { id: projectId } = await params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { mediaIds } = body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json({ error: 'Media IDs are required' }, { status: 400 });
    }

    // Verify all media items exist and are not already in this project
    const existingMedia = await prisma.mediaItem.findMany({
      where: {
        id: { in: mediaIds }
      }
    });

    if (existingMedia.length !== mediaIds.length) {
      return NextResponse.json({ error: 'Some media items not found' }, { status: 404 });
    }

    // Check which media items are already in this project
    const alreadyInProject = existingMedia.filter(media => media.projectId === projectId);
    const toAdd = existingMedia.filter(media => media.projectId !== projectId);

    if (toAdd.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'All media items are already in this project',
        alreadyInProject: alreadyInProject.length,
        added: 0
      });
    }

    // Update media items to associate them with this project
    // Note: This creates a copy relationship rather than moving the media
    const updatedMedia = await Promise.all(
      toAdd.map(async (media) => {
        // Create a new media item record for this project
        return await prisma.mediaItem.create({
          data: {
            url: media.url,
            type: media.type,
            altText: media.altText,
            description: media.description,
            fileSize: media.fileSize,
            width: media.width,
            height: media.height,
            thumbnailUrl: media.thumbnailUrl,
            projectId: projectId,
            displayOrder: media.displayOrder || 0
          }
        });
      })
    );

    // Handle BigInt serialization
    const serializedMedia = JSON.parse(JSON.stringify(updatedMedia, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    return NextResponse.json({
      success: true,
      message: `Added ${updatedMedia.length} media items to project`,
      addedMedia: serializedMedia,
      alreadyInProject: alreadyInProject.length,
      added: updatedMedia.length
    });

  } catch (error) {
    console.error('Add existing media to project error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to add media to project',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}