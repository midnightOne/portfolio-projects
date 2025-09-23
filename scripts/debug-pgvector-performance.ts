#!/usr/bin/env tsx

/**
 * Debug pgvector Performance
 * 
 * This script analyzes pgvector setup and performance to identify
 * why vector searches are taking 700-1200ms instead of sub-100ms.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugPgVectorPerformance() {
  console.log('🔍 Debugging pgvector Performance\n');

  try {
    // 1. Check database and pgvector version
    console.log('1. Database and pgvector Information:');
    
    const versionResult = await prisma.$queryRaw<Array<{version: string}>>`SELECT version()`;
    console.log(`   PostgreSQL Version: ${versionResult[0]?.version?.split(' ')[1] || 'Unknown'}`);
    
    try {
      const pgvectorResult = await prisma.$queryRaw<Array<{version: string}>>`SELECT extversion FROM pg_extension WHERE extname = 'vector'`;
      console.log(`   pgvector Version: ${pgvectorResult[0]?.version || 'Not installed'}`);
    } catch (error) {
      console.log('   pgvector: Not installed or not accessible');
    }

    // 2. Check dataset size
    console.log('\n2. Dataset Analysis:');
    
    const totalChunks = await prisma.contextChunk.count();
    const chunksWithEmbeddings = await prisma.contextChunk.count({
      where: {
        embeddingVector: { not: null }
      }
    });
    
    console.log(`   Total context chunks: ${totalChunks}`);
    console.log(`   Chunks with embeddings: ${chunksWithEmbeddings}`);
    console.log(`   Embedding coverage: ${Math.round((chunksWithEmbeddings / totalChunks) * 100)}%`);

    // 3. Check indexes
    console.log('\n3. Index Analysis:');
    
    const indexes = await prisma.$queryRaw<Array<{
      indexname: string;
      tablename: string;
      indexdef: string;
    }>>`
      SELECT indexname, tablename, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks' 
      AND indexname LIKE '%embedding%'
    `;
    
    if (indexes.length === 0) {
      console.log('   ❌ NO VECTOR INDEXES FOUND!');
      console.log('   This is likely the main performance issue.');
    } else {
      console.log(`   ✅ Found ${indexes.length} embedding index(es):`);
      indexes.forEach(idx => {
        console.log(`      - ${idx.indexname}`);
        console.log(`        ${idx.indexdef}`);
      });
    }

    // 4. Check table statistics
    console.log('\n4. Table Statistics:');
    
    const tableStats = await prisma.$queryRaw<Array<{
      schemaname: string;
      tablename: string;
      n_tup_ins: number;
      n_tup_upd: number;
      n_tup_del: number;
      n_live_tup: number;
      n_dead_tup: number;
      last_vacuum: Date | null;
      last_autovacuum: Date | null;
      last_analyze: Date | null;
      last_autoanalyze: Date | null;
    }>>`
      SELECT * FROM pg_stat_user_tables 
      WHERE relname = 'context_chunks'
    `;
    
    if (tableStats.length > 0) {
      const stats = tableStats[0];
      console.log(`   Live tuples: ${stats.n_live_tup}`);
      console.log(`   Dead tuples: ${stats.n_dead_tup}`);
      console.log(`   Last analyze: ${stats.last_analyze || stats.last_autoanalyze || 'Never'}`);
      console.log(`   Last vacuum: ${stats.last_vacuum || stats.last_autovacuum || 'Never'}`);
      
      if (stats.n_dead_tup > stats.n_live_tup * 0.1) {
        console.log('   ⚠️  High dead tuple ratio - table needs VACUUM');
      }
    }

    // 5. Test raw vector search performance
    console.log('\n5. Raw Vector Search Performance Test:');
    
    // Get a sample embedding for testing
    const sampleChunk = await prisma.contextChunk.findFirst({
      where: { embeddingVector: { not: null } },
      select: { embeddingVector: true }
    });
    
    if (sampleChunk?.embeddingVector) {
      console.log('   Testing with sample embedding...');
      
      // Test 1: Raw vector search without index hint
      const rawStart = Date.now();
      const rawResults = await prisma.$queryRaw<Array<{
        id: string;
        similarity: number;
      }>>`
        SELECT 
          id,
          (1 - (embedding_vector <=> ${sampleChunk.embeddingVector}::vector(1536))) as similarity
        FROM context_chunks 
        WHERE embedding_vector IS NOT NULL
        ORDER BY embedding_vector <=> ${sampleChunk.embeddingVector}::vector(1536)
        LIMIT 5
      `;
      const rawDuration = Date.now() - rawStart;
      
      console.log(`   Raw vector search: ${rawDuration}ms`);
      console.log(`   Results returned: ${rawResults.length}`);
      
      // Test 2: Check if query planner is using index
      const explainResult = await prisma.$queryRaw<Array<{
        'QUERY PLAN': string;
      }>>`
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT id, (1 - (embedding_vector <=> ${sampleChunk.embeddingVector}::vector(1536))) as similarity
        FROM context_chunks 
        WHERE embedding_vector IS NOT NULL
        ORDER BY embedding_vector <=> ${sampleChunk.embeddingVector}::vector(1536)
        LIMIT 5
      `;
      
      console.log('\n6. Query Execution Plan:');
      explainResult.forEach(row => {
        console.log(`   ${row['QUERY PLAN']}`);
      });
      
      // Check if using index scan vs sequential scan
      const planText = explainResult.map(r => r['QUERY PLAN']).join(' ');
      if (planText.includes('Index Scan')) {
        console.log('   ✅ Using index scan');
      } else if (planText.includes('Seq Scan')) {
        console.log('   ❌ Using sequential scan (very slow!)');
      }
      
    } else {
      console.log('   ❌ No embeddings found to test with');
    }

    // 7. Memory and configuration check
    console.log('\n7. PostgreSQL Configuration:');
    
    const configParams = [
      'shared_buffers',
      'effective_cache_size', 
      'work_mem',
      'maintenance_work_mem',
      'random_page_cost'
    ];
    
    for (const param of configParams) {
      try {
        const result = await prisma.$queryRaw<Array<{setting: string}>>`
          SELECT setting FROM pg_settings WHERE name = ${param}
        `;
        console.log(`   ${param}: ${result[0]?.setting || 'Unknown'}`);
      } catch (error) {
        console.log(`   ${param}: Unable to check`);
      }
    }

    // 8. Recommendations
    console.log('\n📋 Performance Recommendations:');
    
    if (indexes.length === 0) {
      console.log('   🚨 CRITICAL: Create vector index!');
      console.log('      CREATE INDEX CONCURRENTLY idx_context_chunks_embedding');
      console.log('      ON context_chunks USING ivfflat (embedding_vector vector_cosine_ops)');
      console.log('      WITH (lists = 100);');
      console.log('');
      console.log('   Alternative (HNSW - better performance):');
      console.log('      CREATE INDEX CONCURRENTLY idx_context_chunks_embedding_hnsw');
      console.log('      ON context_chunks USING hnsw (embedding_vector vector_cosine_ops)');
      console.log('      WITH (m = 16, ef_construction = 64);');
    }
    
    if (tableStats.length > 0 && tableStats[0].n_dead_tup > tableStats[0].n_live_tup * 0.1) {
      console.log('   🔧 Run VACUUM ANALYZE on context_chunks table');
    }
    
    console.log('   💡 Consider these optimizations:');
    console.log('      - Increase shared_buffers to 25% of RAM');
    console.log('      - Set effective_cache_size to 75% of RAM');
    console.log('      - Increase work_mem for vector operations');
    console.log('      - Use HNSW index for better performance than IVFFlat');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  debugPgVectorPerformance().catch(console.error);
}