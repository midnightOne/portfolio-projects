import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

/**
 * Test if new chunks appear in vector search results
 * GET /api/admin/semantic/test-search-newchunks?query=VR%20experience
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'VR experience that would enable users to play with different materials';

    // Generate query embedding
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Run vector search
    const searchResults = await prisma.$queryRaw<Array<{
      id: string;
      chunk_id: string;
      title: string | null;
      tier: number;
      entity_slug: string;
      entity_title: string;
      similarity_score: number;
      embedding_generated_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT 
        c.id,
        c.chunk_id,
        c.title,
        c.tier,
        e.slug as entity_slug,
        e.title as entity_title,
        (1 - (c.embedding_vector <=> ${embeddingString}::vector(1536))) as similarity_score,
        c.embedding_generated_at,
        c.created_at,
        c.updated_at
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
      ORDER BY c.embedding_vector <=> ${embeddingString}::vector(1536)
      LIMIT 30
    `;

    // Categorize results
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const oldChunks = searchResults.filter(r => 
      r.embedding_generated_at && new Date(r.embedding_generated_at).getTime() < oneHourAgo
    );
    
    const newChunks = searchResults.filter(r => 
      r.embedding_generated_at && new Date(r.embedding_generated_at).getTime() >= oneHourAgo
    );
    
    const noTimestamp = searchResults.filter(r => !r.embedding_generated_at);

    return NextResponse.json({
      success: true,
      query,
      totalResults: searchResults.length,
      breakdown: {
        oldChunks: oldChunks.length,
        newChunks: newChunks.length,
        noTimestamp: noTimestamp.length
      },
      topResults: searchResults.slice(0, 10).map(r => ({
        chunkId: r.chunk_id,
        title: r.title?.substring(0, 50),
        tier: r.tier,
        entitySlug: r.entity_slug,
        similarityScore: r.similarity_score,
        embeddingGeneratedAt: r.embedding_generated_at,
        ageCategory: r.embedding_generated_at ? 
          (new Date(r.embedding_generated_at).getTime() >= oneHourAgo ? 'NEW (<1hr)' : 'OLD (>1hr)') :
          'NO_TIMESTAMP',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      newChunksDetails: newChunks.map(r => ({
        chunkId: r.chunk_id,
        title: r.title?.substring(0, 50),
        tier: r.tier,
        entitySlug: r.entity_slug,
        similarityScore: r.similarity_score,
        embeddingGeneratedAt: r.embedding_generated_at
      })),
      analysis: {
        newChunksInTop10: searchResults.slice(0, 10).filter(r => 
          r.embedding_generated_at && new Date(r.embedding_generated_at).getTime() >= oneHourAgo
        ).length,
        avgSimilarityOld: oldChunks.length > 0 ? 
          (oldChunks.reduce((sum, r) => sum + Number(r.similarity_score), 0) / oldChunks.length).toFixed(3) : 
          'N/A',
        avgSimilarityNew: newChunks.length > 0 ? 
          (newChunks.reduce((sum, r) => sum + Number(r.similarity_score), 0) / newChunks.length).toFixed(3) : 
          'N/A'
      }
    });

  } catch (error) {
    console.error('[TestSearchNewChunks] Error:', error);
    return NextResponse.json(
      { error: 'Failed to test search', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



