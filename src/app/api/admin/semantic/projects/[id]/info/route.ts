/**
 * API Route: Project Semantic Info
 * GET /api/admin/semantic/projects/[id]/info
 * 
 * Returns detailed information about a project's semantic content status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Fetch project information
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get semantic content statistics
    // First find the content entity for this project
    const contentEntity = await prisma.contentEntity.findFirst({
      where: {
        entityType: 'PROJECT',
        slug: project.slug
      }
    });

    const chunks = contentEntity ? await prisma.contextChunk.findMany({
      where: { entityId: contentEntity.id },
      select: {
        tier: true,
        lastModified: true,
        embeddingGeneratedAt: true
      }
    }) : [];

    // Calculate tier distribution
    const tierDistribution: Record<number, number> = {};
    let lastProcessed: Date | null = null;

    for (const chunk of chunks) {
      tierDistribution[chunk.tier] = (tierDistribution[chunk.tier] || 0) + 1;
      
      if (chunk.lastModified && (!lastProcessed || chunk.lastModified > lastProcessed)) {
        lastProcessed = chunk.lastModified;
      }
    }

    const projectInfo = {
      id: project.id,
      title: project.title,
      slug: project.slug,
      hasSemanticContent: chunks.length > 0,
      lastProcessed,
      chunkCount: chunks.length,
      tierDistribution,
      hasContentEntity: !!contentEntity,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };

    return NextResponse.json(projectInfo);

  } catch (error) {
    console.error('Error fetching project semantic info:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch project info',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}