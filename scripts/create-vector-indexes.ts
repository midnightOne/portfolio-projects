#!/usr/bin/env tsx

/**
 * Create Vector Indexes for pgvector Performance
 * 
 * This script creates the missing vector indexes that are causing
 * the 700-1200ms search performance instead of sub-100ms.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createVectorIndexes() {
  console.log('🔧 Creating Vector Indexes for Performance\n');

  try {
    // 1. Check current performance (before indexes)
    console.log('1. Testing performance BEFORE creating indexes...');
    
    const testStart = Date.now();
    const testQuery = await prisma.$queryRaw<Array<{id: string, similarity: number}>>`
      SELECT id, (1 - (embedding_vector <=> '[0.1,0.2,0.3]'::vector(1536))) as similarity
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> '[0.1,0.2,0.3]'::vector(1536)
      LIMIT 5
    `;
    const beforeTime = Date.now() - testStart;
    console.log(`   Performance before indexes: ${beforeTime}ms`);

    // 2. Create HNSW index (best performance)
    console.log('\n2. Creating HNSW vector index (recommended)...');
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY idx_context_chunks_embedding_hnsw
        ON context_chunks USING hnsw (embedding_vector vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
      console.log('   ✅ HNSW index created successfully');
    } catch (error) {
      console.log('   ❌ HNSW index creation failed:', error);
      
      // Fallback to IVFFlat if HNSW fails
      console.log('\n   Trying IVFFlat index as fallback...');
      try {
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY idx_context_chunks_embedding_ivfflat
          ON context_chunks USING ivfflat (embedding_vector vector_cosine_ops)
          WITH (lists = 100)
        `;
        console.log('   ✅ IVFFlat index created successfully');
      } catch (fallbackError) {
        console.log('   ❌ IVFFlat index creation also failed:', fallbackError);
      }
    }

    // 3. Wait a moment for index to be ready
    console.log('\n3. Waiting for index to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Test performance after index creation
    console.log('\n4. Testing performance AFTER creating indexes...');
    
    const afterStart = Date.now();
    const afterQuery = await prisma.$queryRaw<Array<{id: string, similarity: number}>>`
      SELECT id, (1 - (embedding_vector <=> '[0.1,0.2,0.3]'::vector(1536))) as similarity
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> '[0.1,0.2,0.3]'::vector(1536)
      LIMIT 5
    `;
    const afterTime = Date.now() - afterStart;
    console.log(`   Performance after indexes: ${afterTime}ms`);

    // 5. Check if query planner is using the index
    console.log('\n5. Checking query execution plan...');
    
    const explainResult = await prisma.$queryRaw<Array<{'QUERY PLAN': string}>>`
      EXPLAIN (ANALYZE, BUFFERS) 
      SELECT id, (1 - (embedding_vector <=> '[0.1,0.2,0.3]'::vector(1536))) as similarity
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> '[0.1,0.2,0.3]'::vector(1536)
      LIMIT 5
    `;
    
    explainResult.forEach(row => {
      console.log(`   ${row['QUERY PLAN']}`);
    });

    // 6. Performance analysis
    console.log('\n📊 Performance Analysis:');
    console.log(`   Before indexes: ${beforeTime}ms`);
    console.log(`   After indexes: ${afterTime}ms`);
    
    const improvement = ((beforeTime - afterTime) / beforeTime) * 100;
    console.log(`   Performance improvement: ${Math.round(improvement)}%`);
    
    if (afterTime < 100) {
      console.log('   🎉 Excellent! Sub-100ms performance achieved');
    } else if (afterTime < 200) {
      console.log('   ✅ Good performance achieved');
    } else {
      console.log('   ⚠️  Still slow - may need index tuning');
    }

    // 7. Verify indexes were created
    console.log('\n6. Verifying created indexes...');
    
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
      console.log(`      ${idx.indexdef}`);
    });

    // 8. Test with ContentSearchService
    console.log('\n7. Testing with ContentSearchService...');
    
    try {
      const { default: ContentSearchService } = await import('../src/lib/content/ContentSearchService');
      const searchService = new ContentSearchService();
      
      const searchStart = Date.now();
      const searchResult = await searchService.searchContent({
        query: 'technical implementation',
        k: 5
      });
      const searchTime = Date.now() - searchStart;
      
      console.log(`   ContentSearchService performance: ${searchTime}ms`);
      console.log(`   Results found: ${searchResult.items.length}`);
      console.log(`   Search metadata:`, searchResult.searchMetadata);
      
    } catch (error) {
      console.log('   ❌ ContentSearchService test failed:', error);
    }

  } catch (error) {
    console.error('❌ Index creation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createVectorIndexes().catch(console.error);
}