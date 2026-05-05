import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Inspect the actual embedding vector for a chunk
 * GET /api/admin/semantic/inspect-vector?chunkId=cmgga9oyh001kw5r88btz0ksl
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chunkId = searchParams.get('chunkId');

    if (!chunkId) {
      return NextResponse.json({ error: 'chunkId parameter required' }, { status: 400 });
    }

    // Get chunk info
    const chunk = await prisma.contextChunk.findUnique({
      where: { id: chunkId },
      select: {
        id: true,
        chunkId: true,
        tier: true,
        title: true,
        content: true,
        embeddingModel: true,
        embeddingGeneratedAt: true,
        createdAt: true,
        updatedAt: true,
        entity: {
          select: {
            slug: true,
            title: true
          }
        }
      }
    });

    if (!chunk) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
    }

    // Get the raw vector using queryRaw
    const vectorResult = await prisma.$queryRaw<Array<{
      embedding_vector: number[] | null;
    }>>`
      SELECT embedding_vector::text as embedding_vector
      FROM context_chunks
      WHERE id = ${chunkId}
    `;

    if (!vectorResult || vectorResult.length === 0) {
      return NextResponse.json({ error: 'Vector query failed' }, { status: 500 });
    }

    const vectorText = vectorResult[0].embedding_vector as any;
    
    // Parse the vector (it comes as a PostgreSQL array string like "[0.1,0.2,0.3]")
    let vector: number[] = [];
    let vectorExists = false;
    
    if (vectorText) {
      vectorExists = true;
      // Remove brackets and parse
      const cleanText = vectorText.toString().replace(/^\[|\]$/g, '');
      vector = cleanText.split(',').map((v: string) => parseFloat(v.trim()));
    }

    // Analyze the vector
    const analysis = {
      exists: vectorExists,
      dimensions: vector.length,
      isAllZeros: vector.every(v => v === 0),
      isAllSame: vector.length > 0 && vector.every(v => v === vector[0]),
      hasNaN: vector.some(v => isNaN(v)),
      hasInfinity: vector.some(v => !isFinite(v)),
      stats: vector.length > 0 ? {
        min: Math.min(...vector),
        max: Math.max(...vector),
        mean: vector.reduce((a, b) => a + b, 0) / vector.length,
        nonZeroCount: vector.filter(v => v !== 0).length,
        positiveCount: vector.filter(v => v > 0).length,
        negativeCount: vector.filter(v => v < 0).length
      } : null,
      sample: {
        first10: vector.slice(0, 10),
        last10: vector.slice(-10),
        random10: Array.from({ length: 10 }, () => 
          vector[Math.floor(Math.random() * vector.length)]
        )
      }
    };

    return NextResponse.json({
      success: true,
      chunk: {
        id: chunk.id,
        chunkId: chunk.chunkId,
        tier: chunk.tier,
        title: chunk.title,
        contentPreview: chunk.content.substring(0, 200),
        entitySlug: chunk.entity?.slug,
        entityTitle: chunk.entity?.title,
        embeddingModel: chunk.embeddingModel,
        embeddingGeneratedAt: chunk.embeddingGeneratedAt,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt
      },
      vector: {
        exists: vectorExists,
        rawVectorPreview: vectorExists ? vectorText.toString().substring(0, 200) + '...' : null
      },
      analysis,
      diagnosis: vectorExists ? (
        analysis.isAllZeros ? '❌ CORRUPTED: Vector is all zeros!' :
        analysis.isAllSame ? '❌ CORRUPTED: All values are identical!' :
        analysis.hasNaN ? '❌ CORRUPTED: Contains NaN values!' :
        analysis.hasInfinity ? '❌ CORRUPTED: Contains infinity values!' :
        analysis.dimensions !== 1536 ? `❌ WRONG DIMENSIONS: Expected 1536, got ${analysis.dimensions}` :
        analysis.stats && Math.abs(analysis.stats.mean) < 0.001 && analysis.nonZeroCount < 100 ? 
          '⚠️ SUSPICIOUS: Very few non-zero values, may be corrupted' :
        '✅ VALID: Vector looks healthy'
      ) : '❌ NO VECTOR: Embedding vector is NULL'
    });

  } catch (error) {
    console.error('[InspectVector] Error:', error);
    return NextResponse.json(
      { error: 'Failed to inspect vector', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



