import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Compare old vs new chunk structure
 * GET /api/admin/semantic/compare-chunk-structure?oldProject=aurora-avatar&newProject=vr-bathroom-designer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oldProject = searchParams.get('oldProject') || 'aurora-avatar';
    const newProject = searchParams.get('newProject') || 'vr-bathroom-designer';

    // Get entities
    const oldEntity = await prisma.contentEntity.findFirst({
      where: { entityType: 'PROJECT', slug: oldProject }
    });
    
    const newEntity = await prisma.contentEntity.findFirst({
      where: { entityType: 'PROJECT', slug: newProject }
    });

    if (!oldEntity || !newEntity) {
      return NextResponse.json({ error: 'Entities not found' }, { status: 404 });
    }

    // Get T0 chunks
    const oldT0 = await prisma.contextChunk.findFirst({
      where: { entityId: oldEntity.id, tier: 0 }
    });
    
    const newT0 = await prisma.contextChunk.findFirst({
      where: { entityId: newEntity.id, tier: 0 }
    });

    // Get sample chunks from each
    const oldSamples = await prisma.contextChunk.findMany({
      where: { entityId: oldEntity.id },
      select: {
        id: true,
        chunkId: true,
        tier: true,
        title: true,
        parentChunkId: true,
        rootChunkId: true
      },
      take: 10,
      orderBy: { tier: 'asc' }
    });

    const newSamples = await prisma.contextChunk.findMany({
      where: { entityId: newEntity.id },
      select: {
        id: true,
        chunkId: true,
        tier: true,
        title: true,
        parentChunkId: true,
        rootChunkId: true
      },
      take: 10,
      orderBy: { tier: 'asc' }
    });

    return NextResponse.json({
      success: true,
      comparison: {
        old: {
          project: oldProject,
          entityId: oldEntity.id,
          t0: oldT0 ? {
            dbId: oldT0.id,
            chunkId: oldT0.chunkId,
            rootChunkId: oldT0.rootChunkId
          } : null,
          samples: oldSamples.map(c => ({
            dbId: c.id,
            chunkId: c.chunkId,
            tier: c.tier,
            title: c.title?.substring(0, 40),
            parentChunkId: c.parentChunkId,
            rootChunkId: c.rootChunkId,
            rootMatchesT0: c.rootChunkId === oldT0?.id
          }))
        },
        new: {
          project: newProject,
          entityId: newEntity.id,
          t0: newT0 ? {
            dbId: newT0.id,
            chunkId: newT0.chunkId,
            rootChunkId: newT0.rootChunkId
          } : null,
          samples: newSamples.map(c => ({
            dbId: c.id,
            chunkId: c.chunkId,
            tier: c.tier,
            title: c.title?.substring(0, 40),
            parentChunkId: c.parentChunkId,
            rootChunkId: c.rootChunkId,
            rootMatchesT0: c.rootChunkId === newT0?.id,
            isLogicalId: c.rootChunkId === 'metadata'
          }))
        }
      },
      analysis: {
        oldUsesDbIds: oldSamples.every(c => c.rootChunkId === oldT0?.id || c.tier === 0),
        newUsesLogicalIds: newSamples.some(c => c.rootChunkId === 'metadata'),
        issue: 'New chunks use logical ID "metadata" instead of T0 database UUID'
      }
    });

  } catch (error) {
    console.error('[CompareChunkStructure] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compare', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

