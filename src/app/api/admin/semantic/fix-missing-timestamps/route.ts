import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Fix chunks that have embeddings but missing embedding_generated_at timestamps
 * POST /api/admin/semantic/fix-missing-timestamps
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug') || 'vr-bathroom-designer';
    const dryRun = searchParams.get('dryRun') === 'true';

    // Get entity
    const entity = await prisma.contentEntity.findFirst({
      where: { entityType: 'PROJECT', slug: projectSlug }
    });

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Find chunks with embeddings but no timestamp
    const chunksNeedingFix = await prisma.$queryRaw<Array<{
      id: string;
      chunk_id: string;
      tier: number;
      title: string | null;
    }>>`
      SELECT id, chunk_id, tier, title
      FROM context_chunks
      WHERE entity_id = ${entity.id}
        AND embedding_vector IS NOT NULL
        AND embedding_generated_at IS NULL
    `;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        projectSlug,
        entityId: entity.id,
        chunksNeedingFix: chunksNeedingFix.length,
        samples: chunksNeedingFix.slice(0, 10).map(c => ({
          chunkId: c.chunk_id,
          tier: c.tier,
          title: c.title?.substring(0, 50)
        }))
      });
    }

    // Fix the timestamps
    const updateResult = await prisma.$executeRaw`
      UPDATE context_chunks
      SET 
        embedding_generated_at = NOW(),
        embedding_model = 'text-embedding-3-small'
      WHERE entity_id = ${entity.id}
        AND embedding_vector IS NOT NULL
        AND embedding_generated_at IS NULL
    `;

    return NextResponse.json({
      success: true,
      projectSlug,
      entityId: entity.id,
      chunksFixed: updateResult,
      message: `Fixed ${updateResult} chunks with missing timestamps`
    });

  } catch (error) {
    console.error('[FixMissingTimestamps] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fix timestamps', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET to check status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug') || 'vr-bathroom-designer';

    const entity = await prisma.contentEntity.findFirst({
      where: { entityType: 'PROJECT', slug: projectSlug }
    });

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const stats = await prisma.$queryRaw<Array<{
      total_chunks: bigint;
      chunks_with_vectors: bigint;
      chunks_with_timestamps: bigint;
      chunks_needing_fix: bigint;
    }>>`
      SELECT 
        COUNT(*)::bigint as total_chunks,
        COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END)::bigint as chunks_with_vectors,
        COUNT(CASE WHEN embedding_generated_at IS NOT NULL THEN 1 END)::bigint as chunks_with_timestamps,
        COUNT(CASE WHEN embedding_vector IS NOT NULL AND embedding_generated_at IS NULL THEN 1 END)::bigint as chunks_needing_fix
      FROM context_chunks
      WHERE entity_id = ${entity.id}
    `;

    return NextResponse.json({
      success: true,
      projectSlug,
      entityId: entity.id,
      stats: {
        totalChunks: Number(stats[0].total_chunks),
        chunksWithVectors: Number(stats[0].chunks_with_vectors),
        chunksWithTimestamps: Number(stats[0].chunks_with_timestamps),
        chunksNeedingFix: Number(stats[0].chunks_needing_fix)
      },
      needsFix: Number(stats[0].chunks_needing_fix) > 0,
      instructions: Number(stats[0].chunks_needing_fix) > 0 ?
        'Call POST /api/admin/semantic/fix-missing-timestamps to fix' :
        'No chunks need fixing'
    });

  } catch (error) {
    console.error('[FixMissingTimestamps] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



