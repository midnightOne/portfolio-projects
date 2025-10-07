import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Check if newly generated embeddings are in the database
 * GET /api/admin/semantic/check-new-embeddings?projectSlug=vr-bathroom-designer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug') || 'vr-bathroom-designer';

    // Get the entity for this project
    const entity = await prisma.contentEntity.findFirst({
      where: { 
        entityType: 'PROJECT',
        slug: projectSlug 
      }
    });

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found for project' },
        { status: 404 }
      );
    }

    // Get all chunks for this entity with embedding info
    const chunks = await prisma.$queryRaw<Array<{
      id: string;
      chunk_id: string;
      tier: number;
      title: string | null;
      has_vector: boolean;
      embedding_generated_at: Date | null;
      embedding_model: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT 
        id,
        chunk_id,
        tier,
        title,
        embedding_vector IS NOT NULL as has_vector,
        embedding_generated_at,
        embedding_model,
        created_at,
        updated_at
      FROM context_chunks
      WHERE entity_id = ${entity.id}
      ORDER BY tier ASC, chunk_id ASC
    `;

    const totalChunks = chunks.length;
    const chunksWithVectors = chunks.filter(c => c.has_vector).length;
    const recentlyGenerated = chunks.filter(c => 
      c.embedding_generated_at && 
      new Date(c.embedding_generated_at).getTime() > Date.now() - 3600000 // Last hour
    );

    // Sample a few chunks to show details
    const sampleChunks = chunks.slice(0, 10).map(c => ({
      chunkId: c.chunk_id,
      tier: c.tier,
      title: c.title?.substring(0, 50),
      hasVector: c.has_vector,
      embeddingGeneratedAt: c.embedding_generated_at,
      embeddingModel: c.embedding_model,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      isRecent: c.embedding_generated_at ? 
        new Date(c.embedding_generated_at).getTime() > Date.now() - 3600000 : 
        false
    }));

    return NextResponse.json({
      success: true,
      projectSlug,
      entityId: entity.id,
      summary: {
        totalChunks,
        chunksWithVectors,
        recentlyGeneratedCount: recentlyGenerated.length,
        percentWithVectors: totalChunks > 0 ? Math.round((chunksWithVectors / totalChunks) * 100) : 0
      },
      recentlyGenerated: recentlyGenerated.map(c => ({
        chunkId: c.chunk_id,
        tier: c.tier,
        title: c.title?.substring(0, 50),
        embeddingGeneratedAt: c.embedding_generated_at,
        embeddingModel: c.embedding_model
      })),
      sampleChunks
    });

  } catch (error) {
    console.error('[CheckNewEmbeddings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check embeddings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

