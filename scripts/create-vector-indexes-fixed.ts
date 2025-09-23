#!/usr/bin/env tsx

/**
 * Create Vector Indexes for pgvector Performance (Fixed)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createVectorIndexes() {
  console.log('🔧 Creating Vector Indexes for Performance\n');

  try {
    // 1. Get a real embedding for testing
    console.log('1. Getting sample embedding for testing...');
    
    const sampleChunk = await prisma.$queryRaw<Array<{embedding_vector: any}>>`
      SELECT embedding_vector FROM context_chunks 
      WHERE embedding_vector IS NOT NULL 
      LIMIT 1
    `;
    
    if (sampleChunk.length === 0) {
      console.log('   ❌ No embeddings found to test with');
      return;
    }
    
    const testEmbedding = sampleChunk[0].embedding_vector;
    console.log('   ✅ Got sample embedding for testing');

    // 2. Test performance BEFORE creating indexes
    console.log('\n2. Testing performance BEFORE creating indexes...');
    
    const testStart = Date.now();
    const testQuery = await prisma.$queryRaw<Array<{id: string, similarity: number}>>`
      SELECT id, (1 - (embedding_vector <=> ${testEmbedding}::vector(1536))) as similarity
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> ${testEmbedding}::vector(1536)
      LIMIT 5
    `;
    const beforeTime = Date.now() - testStart;
    console.log(`   Performance before indexes: ${beforeTime}ms`);
    console.log(`   Results found: ${testQuery.length}`);

    // 3. Create HNSW index (best performance)
    console.log('\n3. Creating HNSW vector index...');
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY idx_context_chunks_embedding_hnsw
        ON context_chunks USING hnsw (embedding_vector vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
      console.log('   ✅ HNSW index created successfully');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('   ℹ️  HNSW index already exists');
      } else {
        console.log('   ❌ HNSW index creation failed:', error.message);
        
        // Fallback to IVFFlat
        console.log('\n   Trying IVFFlat index as fallback...');
        try {
          await prisma.$executeRaw`
            CREATE INDEX CONCURRENTLY idx_context_chunks_embedding_ivfflat
            ON context_chunks USING ivfflat (embedding_vector vector_cosine_ops)
            WITH (lists = 100)
          `;
          console.log('   ✅ IVFFlat index created successfully');
        } catch (fallbackError) {
          if (fallbackError.message?.includes('already exists')) {
            console.log('   ℹ️  IVFFlat index already exists');
          } else {
            console.log('   ❌ IVFFlat index creation also failed:', fallbackError.message);
          }
        }
      }
    }

    // 4. Wait for index to be ready
    console.log('\n4. Waiting for index to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Test performance AFTER index creation
    console.log('\n5. Testing performance AFTER creating indexes...');
    
    const afterStart = Date.now();
    const afterQuery = await prisma.$queryRaw<Array<{id: string, similarity: number}>>`
      SELECT id, (1 - (embedding_vector <=> ${testEmbedding}::vector(1536))) as similarity
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> ${testEmbedding}::vector(1536)
      LIMIT 5
    `;
    const afterTime = Date.now() - afterStart;
    console.log(`   Performance after indexes: ${afterTime}ms`);
    console.log(`   Results found: ${afterQuery.length}`);

    // 6. Check execution plan
    console.log('\n6. Checking query execution plan...');
    
    const explainResult = await prisma.$queryRaw<Array<{'QUERY PLAN': string}>>`
      EXPLAIN (ANALYZE, BUFFERS) 
      SELECT id, (1 - (embedding_vector <=> ${testEmbedding}::vector(1536))) as similarity
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> ${testEmbedding}::vector(1536)
      LIMIT 5
    `;
    
    explainResult.forEach(row => {
      const plan = row['QUERY PLAN'];
      console.log(`   ${plan}`);
      
      // Highlight important parts
      if (plan.includes('Index Scan')) {
        console.log('   🎯 USING INDEX SCAN - Good!');
      } else if (plan.includes('Seq Scan')) {
        console.log('   ⚠️  USING SEQUENTIAL SCAN - Index not being used!');
      }
    });

    // 7. Performance analysis
    console.log('\n📊 Performance Analysis:');
    console.log(`   Before indexes: ${beforeTime}ms`);
    console.log(`   After indexes: ${afterTime}ms`);
    
    if (beforeTime > afterTime) {
      const improvement = ((beforeTime - afterTime) / beforeTime) * 100;
      console.log(`   Performance improvement: ${Math.round(improvement)}%`);
    } else {
      console.log(`   Performance change: ${afterTime - beforeTime}ms slower (index may still be building)`);
    }
    
    if (afterTime < 100) {
      console.log('   🎉 Excellent! Sub-100ms performance achieved');
    } else if (afterTime < 200) {
      console.log('   ✅ Good performance achieved');
    } else if (afterTime < 500) {
      console.log('   ⚠️  Moderate performance - may need tuning');
    } else {
      console.log('   ❌ Still slow - index may not be working properly');
    }

    // 8. List all vector indexes
    console.log('\n7. Current vector indexes:');
    
    const indexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks' 
      AND (indexname LIKE '%embedding%' OR indexdef LIKE '%embedding_vector%')
    `;
    
    if (indexes.length === 0) {
      console.log('   ❌ No vector indexes found!');
    } else {
      console.log(`   Found ${indexes.length} vector index(es):`);
      indexes.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
        if (idx.indexdef.includes('hnsw')) {
          console.log('      Type: HNSW (best performance)');
        } else if (idx.indexdef.includes('ivfflat')) {
          console.log('      Type: IVFFlat (good performance)');
        }
      });
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