import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Check which entities have chunks with embedding_generated_at timestamps
 * GET /api/admin/semantic/which-entities-have-embeddings
 */
export async function GET(request: NextRequest) {
  try {
    // Get all entities with chunk counts
    const entitiesWithEmbeddings = await prisma.$queryRaw<Array<{
      entity_id: string;
      entity_slug: string;
      entity_title: string;
      total_chunks: bigint;
      chunks_with_vectors: bigint;
      chunks_with_timestamps: bigint;
      newest_embedding: Date | null;
    }>>`
      SELECT 
        e.id as entity_id,
        e.slug as entity_slug,
        e.title as entity_title,
        COUNT(c.id)::bigint as total_chunks,
        COUNT(CASE WHEN c.embedding_vector IS NOT NULL THEN 1 END)::bigint as chunks_with_vectors,
        COUNT(CASE WHEN c.embedding_generated_at IS NOT NULL THEN 1 END)::bigint as chunks_with_timestamps,
        MAX(c.embedding_generated_at) as newest_embedding
      FROM content_entities e
      LEFT JOIN context_chunks c ON c.entity_id = e.id
      WHERE e."entityType" = 'PROJECT'
      GROUP BY e.id, e.slug, e.title
      HAVING COUNT(c.id) > 0
      ORDER BY e.slug
    `;

    // Get sample chunks from vr-bathroom-designer specifically
    const vrEntity = entitiesWithEmbeddings.find(e => e.entity_slug === 'vr-bathroom-designer');
    
    let vrSamples: any[] = [];
    if (vrEntity) {
      vrSamples = await prisma.$queryRaw<Array<{
        id: string;
        chunk_id: string;
        tier: number;
        title: string | null;
        has_vector: boolean;
        embedding_generated_at: Date | null;
        embedding_model: string | null;
      }>>`
        SELECT 
          id,
          chunk_id,
          tier,
          title,
          embedding_vector IS NOT NULL as has_vector,
          embedding_generated_at,
          embedding_model
        FROM context_chunks
        WHERE entity_id = ${vrEntity.entity_id}
        ORDER BY tier ASC, chunk_id ASC
        LIMIT 10
      `;
    }

    return NextResponse.json({
      success: true,
      totalEntities: entitiesWithEmbeddings.length,
      entities: entitiesWithEmbeddings.map(e => ({
        entityId: e.entity_id,
        slug: e.entity_slug,
        title: e.entity_title,
        totalChunks: Number(e.total_chunks),
        chunksWithVectors: Number(e.chunks_with_vectors),
        chunksWithTimestamps: Number(e.chunks_with_timestamps),
        newestEmbedding: e.newest_embedding,
        hasNewEmbeddings: e.chunks_with_timestamps > 0
      })),
      vrBathroomDesigner: vrEntity ? {
        entityId: vrEntity.entity_id,
        totalChunks: Number(vrEntity.total_chunks),
        chunksWithVectors: Number(vrEntity.chunks_with_vectors),
        chunksWithTimestamps: Number(vrEntity.chunks_with_timestamps),
        newestEmbedding: vrEntity.newest_embedding,
        sampleChunks: vrSamples
      } : null,
      analysis: {
        entitiesWithOldEmbeddings: entitiesWithEmbeddings.filter(e => 
          Number(e.chunks_with_vectors) > 0 && Number(e.chunks_with_timestamps) === 0
        ).length,
        entitiesWithNewEmbeddings: entitiesWithEmbeddings.filter(e => 
          Number(e.chunks_with_timestamps) > 0
        ).length
      }
    });

  } catch (error) {
    console.error('[WhichEntitiesHaveEmbeddings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



