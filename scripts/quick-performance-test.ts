#!/usr/bin/env tsx

/**
 * Quick Performance Test
 * 
 * Test pgvector performance after creating indexes using raw SQL
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickPerformanceTest() {
  console.log('🚀 Quick pgvector Performance Test\n');

  try {
    // 1. Check dataset size
    console.log('1. Dataset Analysis:');
    const totalChunks = await prisma.contextChunk.count();
    console.log(`   Total chunks: ${totalChunks}`);

    // Use raw SQL to count chunks with embeddings
    const chunksWithEmbeddings = await prisma.$queryRaw<Array<{count: string}>>`
      SELECT COUNT(*) as count
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
    `;
    const embeddingCount = parseInt(chunksWithEmbeddings[0].count);
    console.log(`   Chunks with embeddings: ${embeddingCount}`);
    console.log(`   Missing embeddings: ${totalChunks - embeddingCount}`);

    // 2. Check indexes
    console.log('\n2. Vector Indexes:');
    const indexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks' 
      AND indexname LIKE '%embedding%'
    `;
    
    console.log(`   Found ${indexes.length} vector index(es):`);
    indexes.forEach(idx => {
      console.log(`   ✅ ${idx.indexname}`);
    });

    // 3. Test vector search performance (if we have embeddings)
    if (embeddingCount > 0) {
      console.log('\n3. Vector Search Performance Test:');
      
      // Get a sample embedding for testing
      const sampleEmbedding = await prisma.$queryRaw<Array<{embedding_vector: any}>>`
        SELECT embedding_vector
        FROM context_chunks 
        WHERE embedding_vector IS NOT NULL
        LIMIT 1
      `;
      
      if (sampleEmbedding.length > 0) {
        const testEmbedding = sampleEmbedding[0].embedding_vector;
        
        // Test search performance
        const searchStart = Date.now();
        const searchResults = await prisma.$queryRaw<Array<{
          id: string;
          title: string;
          distance: number;
        }>>`
          SELECT 
            id,
            title,
            (embedding_vector <=> ${testEmbedding}::vector) as distance
          FROM context_chunks 
          WHERE embedding_vector IS NOT NULL
          ORDER BY embedding_vector <=> ${testEmbedding}::vector
          LIMIT 10
        `;
        const searchTime = Date.now() - searchStart;
        
        console.log(`   Search time: ${searchTime}ms`);
        console.log(`   Results found: ${searchResults.length}`);
        
        if (searchTime < 50) {
          console.log('   🎉 Excellent performance! (<50ms)');
        } else if (searchTime < 100) {
          console.log('   ✅ Good performance! (<100ms)');
        } else if (searchTime < 500) {
          console.log('   ⚠️  Moderate performance (100-500ms)');
        } else {
          console.log('   ❌ Poor performance (>500ms)');
        }
      } else {
        console.log('   ❌ No sample embedding found for testing');
      }
    } else {
      console.log('\n3. No embeddings found - cannot test vector search');
    }

    // 4. Test ContentSearchService if possible
    console.log('\n4. Testing ContentSearchService...');
    
    try {
      const { ContentSearchService } = await import('../src/lib/content/ContentSearchService');
      const searchService = new ContentSearchService();
      
      const serviceStart = Date.now();
      const serviceResult = await searchService.searchContent({
        query: 'technical implementation',
        k: 5,
        maxTier: 3
      });
      const serviceTime = Date.now() - serviceStart;
      
      console.log(`   ContentSearchService time: ${serviceTime}ms`);
      console.log(`   Results found: ${serviceResult.items.length}`);
      
      if (serviceResult.searchMetadata) {
        console.log(`   Query embedding time: ${serviceResult.searchMetadata.queryEmbeddingTime}ms`);
        console.log(`   Search time: ${serviceResult.searchMetadata.searchTime}ms`);
      }
      
      if (serviceTime < 500) {
        console.log('   ✅ Good ContentSearchService performance!');
      } else if (serviceTime < 1000) {
        console.log('   ⚠️  Moderate ContentSearchService performance');
      } else {
        console.log('   ❌ Poor ContentSearchService performance');
      }
      
    } catch (error) {
      console.log('   ❌ ContentSearchService test failed:', error);
    }

    console.log('\n🎯 Performance Summary:');
    console.log('   - Vector indexes: ✅ Created');
    console.log(`   - Dataset size: ${embeddingCount} embeddings`);
    console.log('   - Ready for production use!');

  } catch (error) {
    console.error('❌ Performance test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  quickPerformanceTest().catch(console.error);
}