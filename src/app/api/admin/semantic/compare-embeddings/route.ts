import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway } from '@/lib/ai/gateway';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

/**
 * Compare freshly generated embedding vs stored embedding for a chunk
 * GET /api/admin/semantic/compare-embeddings?chunkId=cmgga9oyh001kw5r88btz0ksl
 */
async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chunkId = searchParams.get('chunkId');

    if (!chunkId) {
      return NextResponse.json({ error: 'chunkId parameter required' }, { status: 400 });
    }

    // Get chunk content
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

    // Generate fresh embedding
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    
    console.log(`[CompareEmbeddings] Generating fresh embedding for chunk ${chunk.chunkId}`);
    console.log(`[CompareEmbeddings] Content length: ${chunk.content.length} chars`);
    console.log(`[CompareEmbeddings] Content preview: ${chunk.content.substring(0, 100)}...`);
    
    const startTime = Date.now();
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk.content,
      dimensions: 1536
    });
    const generationTime = Date.now() - startTime;
    
    const freshEmbedding = response.data[0].embedding;
    console.log(`[CompareEmbeddings] Fresh embedding generated in ${generationTime}ms, dimensions: ${freshEmbedding.length}`);

    // Get stored embedding
    const storedResult = await prisma.$queryRaw<Array<{
      embedding_vector: number[] | null;
    }>>`
      SELECT embedding_vector::text as embedding_vector
      FROM context_chunks
      WHERE id = ${chunkId}
    `;

    if (!storedResult || storedResult.length === 0) {
      return NextResponse.json({ error: 'Failed to retrieve stored embedding' }, { status: 500 });
    }

    const vectorText = storedResult[0].embedding_vector as any;
    let storedEmbedding: number[] = [];
    let storedExists = false;
    
    if (vectorText) {
      storedExists = true;
      const cleanText = vectorText.toString().replace(/^\[|\]$/g, '');
      storedEmbedding = cleanText.split(',').map((v: string) => parseFloat(v.trim()));
      console.log(`[CompareEmbeddings] Stored embedding retrieved, dimensions: ${storedEmbedding.length}`);
    } else {
      console.log(`[CompareEmbeddings] No stored embedding found`);
    }

    // Calculate cosine similarity if both exist
    let cosineSimilarity: number | null = null;
    let diagnosis = '';

    if (storedExists && storedEmbedding.length === freshEmbedding.length) {
      // Cosine similarity = (A · B) / (||A|| * ||B||)
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (let i = 0; i < freshEmbedding.length; i++) {
        dotProduct += freshEmbedding[i] * storedEmbedding[i];
        normA += freshEmbedding[i] * freshEmbedding[i];
        normB += storedEmbedding[i] * storedEmbedding[i];
      }
      
      normA = Math.sqrt(normA);
      normB = Math.sqrt(normB);
      
      cosineSimilarity = dotProduct / (normA * normB);
      
      console.log(`[CompareEmbeddings] Cosine similarity: ${cosineSimilarity}`);
      
      // Diagnose
      if (cosineSimilarity > 0.99) {
        diagnosis = '✅ IDENTICAL: Stored embedding matches fresh generation (likely same content)';
      } else if (cosineSimilarity > 0.9) {
        diagnosis = '✅ VERY SIMILAR: Minor differences (could be due to slight content variations)';
      } else if (cosineSimilarity > 0.7) {
        diagnosis = '⚠️ SIMILAR: Stored embedding is related but noticeably different';
      } else if (cosineSimilarity > 0.3) {
        diagnosis = '⚠️ WEAK SIMILARITY: Stored embedding may be from different content or model';
      } else if (cosineSimilarity > -0.3) {
        diagnosis = '❌ RANDOM: Stored embedding appears to be random noise, not real embedding';
      } else {
        diagnosis = '❌ INVERTED/CORRUPTED: Stored embedding is negatively correlated (corrupted)';
      }
    } else if (!storedExists) {
      diagnosis = '❌ NO STORED EMBEDDING: Database has NULL for embedding_vector';
    } else {
      diagnosis = `❌ DIMENSION MISMATCH: Fresh (${freshEmbedding.length}) vs Stored (${storedEmbedding.length})`;
    }

    // Compare sample values
    const comparison = {
      freshSample: freshEmbedding.slice(0, 10),
      storedSample: storedExists ? storedEmbedding.slice(0, 10) : null,
      freshStats: {
        min: Math.min(...freshEmbedding),
        max: Math.max(...freshEmbedding),
        mean: freshEmbedding.reduce((a, b) => a + b, 0) / freshEmbedding.length,
        positiveCount: freshEmbedding.filter(v => v > 0).length,
        negativeCount: freshEmbedding.filter(v => v < 0).length
      },
      storedStats: storedExists ? {
        min: Math.min(...storedEmbedding),
        max: Math.max(...storedEmbedding),
        mean: storedEmbedding.reduce((a, b) => a + b, 0) / storedEmbedding.length,
        positiveCount: storedEmbedding.filter(v => v > 0).length,
        negativeCount: storedEmbedding.filter(v => v < 0).length
      } : null
    };

    return NextResponse.json({
      success: true,
      chunk: {
        id: chunk.id,
        chunkId: chunk.chunkId,
        tier: chunk.tier,
        title: chunk.title,
        contentLength: chunk.content.length,
        contentPreview: chunk.content.substring(0, 200),
        entitySlug: chunk.entity?.slug,
        embeddingModel: chunk.embeddingModel,
        embeddingGeneratedAt: chunk.embeddingGeneratedAt
      },
      embeddings: {
        fresh: {
          exists: true,
          dimensions: freshEmbedding.length,
          generationTime: `${generationTime}ms`,
          model: 'text-embedding-3-small'
        },
        stored: {
          exists: storedExists,
          dimensions: storedExists ? storedEmbedding.length : 0,
          model: chunk.embeddingModel,
          generatedAt: chunk.embeddingGeneratedAt
        }
      },
      similarity: {
        cosineSimilarity,
        diagnosis
      },
      comparison
    });

  } catch (error) {
    console.error('[CompareEmbeddings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compare embeddings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const GET = withAIGateway({ feature: 'semantic', publicAllowed: false }, handleGET);
