import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API route to verify if embeddings/vectors are actually present in the database
 * GET /api/admin/semantic/projects/[id]/verify-vectors
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Get project and content entity
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true, title: true }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const entity = await prisma.contentEntity.findFirst({
      where: { 
        entityType: 'PROJECT',
        slug: project.slug 
      }
    });

    if (!entity) {
      return NextResponse.json({
        projectSlug: project.slug,
        totalChunks: 0,
        chunksWithVectors: 0,
        chunksWithoutVectors: 0,
        percentageWithVectors: 0,
        chunks: []
      });
    }

    // Query chunks with raw SQL to check for actual vector presence
    const result = await prisma.$queryRaw<Array<{
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
      WHERE entity_id = ${entity.id}
      ORDER BY tier ASC, chunk_id ASC
    `;

    const totalChunks = result.length;
    const chunksWithVectors = result.filter(r => r.has_vector).length;
    const chunksWithoutVectors = totalChunks - chunksWithVectors;
    const percentageWithVectors = totalChunks > 0 
      ? Math.round((chunksWithVectors / totalChunks) * 100) 
      : 0;

    return NextResponse.json({
      projectSlug: project.slug,
      totalChunks,
      chunksWithVectors,
      chunksWithoutVectors,
      percentageWithVectors,
      chunks: result.map(r => ({
        id: r.id,
        chunkId: r.chunk_id,
        tier: r.tier,
        title: r.title,
        hasVector: r.has_vector,
        embeddingGeneratedAt: r.embedding_generated_at,
        embeddingModel: r.embedding_model
      }))
    });

  } catch (error) {
    console.error('[VerifyVectors] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify vectors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

