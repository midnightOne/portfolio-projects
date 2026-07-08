import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/semantic/chunks/[id]
 * Get detailed information about a specific semantic chunk
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: chunkId } = await params;

    // Fetch chunk with relationships
    const chunk = await prisma.contextChunk.findUnique({
      where: { id: chunkId },
      include: {
        parentChunk: {
          select: {
            id: true,
            tier: true,
            title: true,
            chunkId: true
          }
        },
        childChunks: {
          select: {
            id: true,
            tier: true,
            title: true,
            chunkId: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!chunk) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    // Fetch siblings (chunks with same parent)
    let siblings: Array<{ id: string; tier: number; title: string | null; chunkId: string }> = [];
    if (chunk.parentChunkId) {
      siblings = await prisma.contextChunk.findMany({
        where: {
          parentChunkId: chunk.parentChunkId,
          id: { not: chunk.id }
        },
        select: {
          id: true,
          tier: true,
          title: true,
          chunkId: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
    }

    // Return chunk data with relationships (rename fields for consistency)
    return NextResponse.json({
      ...chunk,
      parent: chunk.parentChunk,
      children: chunk.childChunks,
      siblings,
      // Remove the Prisma relation names
      parentChunk: undefined,
      childChunks: undefined
    });

  } catch (error) {
    console.error('Error fetching chunk details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chunk details' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/semantic/chunks/[id]
 * Update a semantic chunk
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: chunkId } = await params;
    const body = await request.json();

    const {
      title,
      content,
      importance,
      manuallyEdited,
      metadata
    } = body;

    // Validate required fields
    if (content === undefined) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Validate importance score
    if (importance !== undefined && (importance < 0 || importance > 1)) {
      return NextResponse.json(
        { error: 'Importance must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Calculate token count (rough estimate: 1 token ≈ 4 characters)
    const tokenCount = Math.ceil(content.length / 4);

    // Prepare update data
    const updateData: any = {
      content,
      tokenCount,
      lastModified: new Date(),
      modifiedBy: 'user',
      updatedAt: new Date()
    };

    // Update optional fields if provided
    if (title !== undefined) {
      updateData.title = title || null;
    }

    if (importance !== undefined) {
      updateData.importance = importance;
      updateData.importanceSource = 'manual';
    }

    if (manuallyEdited !== undefined) {
      updateData.manuallyEdited = manuallyEdited;
    }

    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }

    // Update the chunk
    const updatedChunk = await prisma.contextChunk.update({
      where: { id: chunkId },
      data: updateData,
      include: {
        parentChunk: {
          select: {
            id: true,
            tier: true,
            title: true,
            chunkId: true
          }
        },
        childChunks: {
          select: {
            id: true,
            tier: true,
            title: true,
            chunkId: true
          }
        }
      }
    });

    // Fetch siblings
    let siblings: Array<{ id: string; tier: number; title: string | null; chunkId: string }> = [];
    if (updatedChunk.parentChunkId) {
      siblings = await prisma.contextChunk.findMany({
        where: {
          parentChunkId: updatedChunk.parentChunkId,
          id: { not: updatedChunk.id }
        },
        select: {
          id: true,
          tier: true,
          title: true,
          chunkId: true
        }
      });
    }

    return NextResponse.json({
      ...updatedChunk,
      parent: updatedChunk.parentChunk,
      children: updatedChunk.childChunks,
      siblings,
      // Remove the Prisma relation names
      parentChunk: undefined,
      childChunks: undefined
    });

  } catch (error) {
    console.error('Error updating chunk:', error);
    return NextResponse.json(
      { error: 'Failed to update chunk' },
      { status: 500 }
    );
  }
}
