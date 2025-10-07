import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Check for duplicate or multiple entities for the same project
 * GET /api/admin/semantic/check-entities?projectSlug=vr-bathroom-designer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug') || 'vr-bathroom-designer';

    // Get ALL entities for this project (there might be duplicates)
    const entities = await prisma.contentEntity.findMany({
      where: { 
        entityType: 'PROJECT',
        slug: projectSlug 
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // For each entity, get chunk stats
    const entitiesWithStats = await Promise.all(
      entities.map(async (entity) => {
        const chunkStats = await prisma.$queryRaw<Array<{
          total_chunks: bigint;
          chunks_with_vectors: bigint;
          tiers: string;
          oldest_chunk: Date | null;
          newest_chunk: Date | null;
          newest_embedding: Date | null;
        }>>`
          SELECT 
            COUNT(*)::bigint as total_chunks,
            COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END)::bigint as chunks_with_vectors,
            STRING_AGG(DISTINCT tier::text, ', ' ORDER BY tier::text) as tiers,
            MIN(created_at) as oldest_chunk,
            MAX(updated_at) as newest_chunk,
            MAX(embedding_generated_at) as newest_embedding
          FROM context_chunks
          WHERE entity_id = ${entity.id}
        `;

        const stats = chunkStats[0];
        
        // Get sample chunk IDs from this entity
        const sampleChunks = await prisma.contextChunk.findMany({
          where: { entityId: entity.id },
          select: {
            id: true,
            chunkId: true,
            tier: true,
            title: true,
            embeddingGeneratedAt: true
          },
          take: 5,
          orderBy: { tier: 'asc' }
        });

        return {
          entityId: entity.id,
          slug: entity.slug,
          title: entity.title,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          stats: {
            totalChunks: Number(stats.total_chunks),
            chunksWithVectors: Number(stats.chunks_with_vectors),
            tiers: stats.tiers,
            oldestChunk: stats.oldest_chunk,
            newestChunk: stats.newest_chunk,
            newestEmbedding: stats.newest_embedding
          },
          sampleChunks: sampleChunks.map(c => ({
            dbId: c.id,
            chunkId: c.chunkId,
            tier: c.tier,
            title: c.title?.substring(0, 50),
            embeddingGeneratedAt: c.embeddingGeneratedAt
          }))
        };
      })
    );

    // Check which entity the search service would use
    const searchServiceEntity = await prisma.contentEntity.findFirst({
      where: { 
        entityType: 'PROJECT',
        slug: projectSlug 
      }
    });

    return NextResponse.json({
      success: true,
      projectSlug,
      totalEntities: entities.length,
      searchServiceUsesEntityId: searchServiceEntity?.id,
      isDuplicate: entities.length > 1,
      warning: entities.length > 1 ? 
        '⚠️ Multiple entities found for same project! Search might be using the wrong one.' : 
        null,
      entities: entitiesWithStats
    });

  } catch (error) {
    console.error('[CheckEntities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check entities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

