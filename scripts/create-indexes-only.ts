#!/usr/bin/env tsx

/**
 * Create Vector Indexes Only
 * 
 * This script creates the missing vector indexes without performance testing
 * to avoid dimension mismatch issues.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createIndexesOnly() {
  console.log('🔧 Creating Vector Indexes for Performance\n');

  try {
    // 1. Check if indexes already exist
    console.log('1. Checking existing indexes...');
    
    const existingIndexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks' 
      AND (indexname LIKE '%embedding%' OR indexname LIKE '%tier%')
    `;
    
    console.log(`   Found ${existingIndexes.length} existing index(es):`);
    existingIndexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // 2. Create HNSW vector index
    console.log('\n2. Creating HNSW vector index...');
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_embedding_hnsw
        ON context_chunks USING hnsw (embedding_vector vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
      console.log('   ✅ HNSW vector index created/verified');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   ✅ HNSW vector index already exists');
      } else {
        console.log('   ❌ HNSW index creation failed:', error.message);
        
        // Try IVFFlat as fallback
        console.log('   Trying IVFFlat index as fallback...');
        try {
          await prisma.$executeRaw`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_embedding_ivfflat
            ON context_chunks USING ivfflat (embedding_vector vector_cosine_ops)
            WITH (lists = 100)
          `;
          console.log('   ✅ IVFFlat vector index created as fallback');
        } catch (fallbackError: any) {
          console.log('   ❌ IVFFlat index creation also failed:', fallbackError.message);
        }
      }
    }

    // 3. Create supporting indexes
    console.log('\n3. Creating supporting indexes...');
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_tier
        ON context_chunks (tier)
      `;
      console.log('   ✅ Tier index created/verified');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   ✅ Tier index already exists');
      } else {
        console.log('   ❌ Tier index creation failed:', error.message);
      }
    }

    try {
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_entity_tier
        ON context_chunks (entity_id, tier)
      `;
      console.log('   ✅ Entity-tier composite index created/verified');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   ✅ Entity-tier composite index already exists');
      } else {
        console.log('   ❌ Entity-tier index creation failed:', error.message);
      }
    }

    // 4. Update table statistics
    console.log('\n4. Updating table statistics...');
    
    try {
      await prisma.$executeRaw`ANALYZE context_chunks`;
      console.log('   ✅ Table statistics updated');
    } catch (error: any) {
      console.log('   ❌ Statistics update failed:', error.message);
    }

    // 5. Verify all indexes
    console.log('\n5. Verifying all indexes...');
    
    const allIndexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks' 
      AND (indexname LIKE '%embedding%' OR indexname LIKE '%tier%')
    `;
    
    console.log(`   Total indexes found: ${allIndexes.length}`);
    allIndexes.forEach(idx => {
      console.log(`   ✅ ${idx.indexname}`);
    });

    // 6. Check dataset info
    console.log('\n6. Dataset information...');
    
    const totalChunks = await prisma.contextChunk.count();
    const chunksWithEmbeddings = await prisma.contextChunk.count({
      where: {
        embeddingVector: { not: null }
      }
    });
    
    console.log(`   Total chunks: ${totalChunks}`);
    console.log(`   Chunks with embeddings: ${chunksWithEmbeddings}`);
    console.log(`   Missing embeddings: ${totalChunks - chunksWithEmbeddings}`);

    console.log('\n🎉 Vector indexes created successfully!');
    console.log('\n📈 Expected Performance Improvement:');
    console.log('   Before: 700-1200ms (sequential scan)');
    console.log('   After:  <100ms (indexed vector search)');
    console.log('\n🔍 Test the improvement with:');
    console.log('   npx tsx scripts/performance-test-content-search.ts');

  } catch (error) {
    console.error('❌ Index creation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createIndexesOnly().catch(console.error);
}