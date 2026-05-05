import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

/**
 * Trace the complete search flow with detailed logging
 * GET /api/admin/semantic/trace-search-flow?query=VR%20experience
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'VR experience that would enable users to play with different materials';

    const trace: any = {
      query,
      steps: []
    };

    // Step 1: Generate query embedding
    trace.steps.push({ step: 1, description: 'Generate query embedding' });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    trace.steps.push({ 
      step: 1, 
      result: 'OK',
      embeddingDimensions: queryEmbedding.length,
      embeddingSample: queryEmbedding.slice(0, 5)
    });

    // Step 2: Run raw vector search
    trace.steps.push({ step: 2, description: 'Raw vector search (no filters)' });
    const rawSearchResults = await prisma.$queryRaw<Array<{
      id: string;
      chunk_id: string;
      title: string | null;
      tier: number;
      entity_id: string;
      entity_slug: string;
      entity_title: string;
      similarity_score: number;
      embedding_model: string | null;
      embedding_generated_at: Date | null;
    }>>`
      SELECT 
        c.id,
        c.chunk_id,
        c.title,
        c.tier,
        c.entity_id,
        e.slug as entity_slug,
        e.title as entity_title,
        (1 - (c.embedding_vector <=> ${embeddingString}::vector(1536))) as similarity_score,
        c.embedding_model,
        c.embedding_generated_at
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
      ORDER BY c.embedding_vector <=> ${embeddingString}::vector(1536)
      LIMIT 50
    `;

    trace.steps.push({
      step: 2,
      result: 'OK',
      totalResults: rawSearchResults.length,
      topResults: rawSearchResults.slice(0, 10).map(r => ({
        rank: rawSearchResults.indexOf(r) + 1,
        chunkId: r.chunk_id,
        title: r.title?.substring(0, 40),
        entitySlug: r.entity_slug,
        tier: r.tier,
        similarityScore: Number(r.similarity_score).toFixed(4),
        embeddingModel: r.embedding_model,
        embeddingGeneratedAt: r.embedding_generated_at
      }))
    });

    // Step 3: Analyze by entity
    trace.steps.push({ step: 3, description: 'Analyze results by entity' });
    const byEntity = rawSearchResults.reduce((acc, r) => {
      if (!acc[r.entity_slug]) {
        acc[r.entity_slug] = {
          count: 0,
          avgScore: 0,
          topScore: 0,
          scores: []
        };
      }
      const score = Number(r.similarity_score);
      acc[r.entity_slug].count++;
      acc[r.entity_slug].scores.push(score);
      acc[r.entity_slug].topScore = Math.max(acc[r.entity_slug].topScore, score);
      return acc;
    }, {} as Record<string, any>);

    Object.keys(byEntity).forEach(slug => {
      const stats = byEntity[slug];
      stats.avgScore = stats.scores.reduce((a: number, b: number) => a + b, 0) / stats.scores.length;
      delete stats.scores; // Remove raw scores to reduce payload
    });

    trace.steps.push({
      step: 3,
      result: 'OK',
      entitiesFound: Object.keys(byEntity).length,
      breakdown: byEntity
    });

    // Step 4: Check vr-bathroom-designer specifically
    trace.steps.push({ step: 4, description: 'Check vr-bathroom-designer chunks' });
    const vrChunks = rawSearchResults.filter(r => r.entity_slug === 'vr-bathroom-designer');
    const vrBestRank = vrChunks.length > 0 ? rawSearchResults.findIndex(r => r.entity_slug === 'vr-bathroom-designer') + 1 : -1;

    trace.steps.push({
      step: 4,
      result: vrChunks.length > 0 ? 'FOUND' : 'NOT_FOUND',
      vrChunksInTop50: vrChunks.length,
      bestRank: vrBestRank,
      topVrChunk: vrChunks[0] ? {
        chunkId: vrChunks[0].chunk_id,
        title: vrChunks[0].title?.substring(0, 40),
        tier: vrChunks[0].tier,
        similarityScore: Number(vrChunks[0].similarity_score).toFixed(4),
        embeddingModel: vrChunks[0].embedding_model,
        embeddingGeneratedAt: vrChunks[0].embedding_generated_at
      } : null
    });

    // Step 5: Compare embedding models
    trace.steps.push({ step: 5, description: 'Compare embedding models across entities' });
    const modelsByEntity = await prisma.$queryRaw<Array<{
      entity_slug: string;
      embedding_model: string | null;
      count: bigint;
    }>>`
      SELECT 
        e.slug as entity_slug,
        c.embedding_model,
        COUNT(*)::bigint as count
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
      GROUP BY e.slug, c.embedding_model
      ORDER BY e.slug
    `;

    trace.steps.push({
      step: 5,
      result: 'OK',
      modelBreakdown: modelsByEntity.map(m => ({
        entity: m.entity_slug,
        model: m.embedding_model || 'NO_MODEL_SET',
        count: Number(m.count)
      }))
    });

    // Summary
    trace.summary = {
      issue: vrBestRank > 10 || vrBestRank === -1 ? 
        'vr-bathroom-designer chunks rank too low or not found in top 50' :
        'vr-bathroom-designer chunks found in top 10',
      vrBestRank,
      vrChunksInTop50: vrChunks.length,
      topEntityByScore: Object.entries(byEntity).sort((a: any, b: any) => b[1].topScore - a[1].topScore)[0],
      recommendation: vrBestRank > 10 || vrBestRank === -1 ?
        'The embeddings for vr-bathroom-designer may have been generated differently or the content is semantically distant from the query' :
        'Search is working correctly'
    };

    return NextResponse.json(trace);

  } catch (error) {
    console.error('[TraceSearchFlow] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trace search', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



