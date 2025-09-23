#!/usr/bin/env tsx

/**
 * Test Vector Performance
 * 
 * Isolate and test the vector search performance to identify bottlenecks
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testVectorPerformance() {
  console.log('🔍 Testing Vector Search Performance\n');

  try {
    // 1. Generate a test embedding
    console.log('1. Generating test embedding...');
    const embeddingStart = Date.now();
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'technical implementation details',
      dimensions: 1536
    });
    const embeddingTime = Date.now() - embeddingStart;
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    console.log(`   Embedding generation: ${embeddingTime}ms`);

    // 2. Test raw vector search performance
    console.log('\n2. Testing raw vector search...');
    
    const vectorSearchStart = Date.now();
    const vectorResults = await prisma.$queryRaw<Array<{
      id: string;
      title: string;
      tier: number;
      distance: number;
    }>>`
      SELECT 
        id,
        title,
        tier,
        (embedding_vector <=> ${queryEmbedding}::vector) as distance
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      AND tier <= 3
      ORDER BY embedding_vector <=> ${queryEmbedding}::vector
      LIMIT 10
    `;
    const vectorSearchTime = Date.now() - vectorSearchStart;
    
    console.log(`   Raw vector search: ${vectorSearchTime}ms`);
    console.log(`   Results found: ${vectorResults.length}`);

    // 3. Test vector search with JOIN
    console.log('\n3. Testing vector search with JOIN...');
    
    const joinSearchStart = Date.now();
    const joinResults = await prisma.$queryRaw<Array<{
      id: string;
      title: string;
      tier: number;
      entity_title: string;
      distance: number;
    }>>`
      SELECT 
        c.id,
        c.title,
        c.tier,
        e.title as entity_title,
        (c.embedding_vector <=> ${queryEmbedding}::vector) as distance
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
      AND c.tier <= 3
      ORDER BY c.embedding_vector <=> ${queryEmbedding}::vector
      LIMIT 10
    `;
    const joinSearchTime = Date.now() - joinSearchStart;
    
    console.log(`   Vector search with JOIN: ${joinSearchTime}ms`);
    console.log(`   Results found: ${joinResults.length}`);

    // 4. Test VectorOperations class
    console.log('\n4. Testing VectorOperations class...');
    
    try {
      const { VectorOperations } = await import('../src/lib/content/VectorOperations');
      const vectorOps = new VectorOperations();
      
      const vectorOpsStart = Date.now();
      const vectorOpsResults = await vectorOps.semanticSearch(queryEmbedding, 10, 3);
      const vectorOpsTime = Date.now() - vectorOpsStart;
      
      console.log(`   VectorOperations search: ${vectorOpsTime}ms`);
      console.log(`   Results found: ${vectorOpsResults.length}`);
    } catch (error) {
      console.log(`   ❌ VectorOperations test failed:`, error);
    }

    // 5. Test ContentSearchService
    console.log('\n5. Testing ContentSearchService...');
    
    try {
      const { ContentSearchService } = await import('../src/lib/content/ContentSearchService');
      const searchService = new ContentSearchService();
      
      const serviceStart = Date.now();
      const serviceResult = await searchService.searchContent({
        query: 'technical implementation details',
        k: 10,
        maxTier: 3
      });
      const serviceTime = Date.now() - serviceStart;
      
      console.log(`   ContentSearchService: ${serviceTime}ms`);
      console.log(`   Results found: ${serviceResult.items.length}`);
      
      if (serviceResult.searchMetadata) {
        console.log(`   - Query embedding: ${serviceResult.searchMetadata.queryEmbeddingTime}ms`);
        console.log(`   - Search time: ${serviceResult.searchMetadata.searchTime}ms`);
        console.log(`   - Semantic results: ${serviceResult.searchMetadata.semanticResults}`);
      }
    } catch (error) {
      console.log(`   ❌ ContentSearchService test failed:`, error);
    }

    // 6. Performance analysis
    console.log('\n📊 Performance Analysis:');
    console.log(`   Embedding generation: ${embeddingTime}ms`);
    console.log(`   Raw vector search: ${vectorSearchTime}ms`);
    console.log(`   Vector search with JOIN: ${joinSearchTime}ms`);
    
    if (vectorSearchTime < 50) {
      console.log('   ✅ Raw vector search is excellent (<50ms)');
    } else if (vectorSearchTime < 100) {
      console.log('   ✅ Raw vector search is good (<100ms)');
    } else {
      console.log('   ⚠️  Raw vector search is slow (>100ms)');
    }

    if (joinSearchTime < 100) {
      console.log('   ✅ JOIN search is good (<100ms)');
    } else if (joinSearchTime < 500) {
      console.log('   ⚠️  JOIN search is moderate (100-500ms)');
    } else {
      console.log('   ❌ JOIN search is slow (>500ms)');
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testVectorPerformance().catch(console.error);
}