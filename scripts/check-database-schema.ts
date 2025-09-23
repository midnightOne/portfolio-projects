#!/usr/bin/env tsx

/**
 * Check Database Schema and Index Usage
 * 
 * Verify that indexes are properly created and being used by the query planner
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema and Index Usage\n');

  try {
    // 1. Check all indexes on context_chunks table
    console.log('1. All indexes on context_chunks table:');
    const allIndexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks'
      ORDER BY indexname
    `;
    
    allIndexes.forEach(idx => {
      console.log(`   ✅ ${idx.indexname}`);
      console.log(`      ${idx.indexdef}`);
    });

    // 2. Check vector-specific indexes
    console.log('\n2. Vector-specific indexes:');
    const vectorIndexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'context_chunks' 
      AND indexdef LIKE '%embedding_vector%'
    `;
    
    if (vectorIndexes.length > 0) {
      vectorIndexes.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
        console.log(`      ${idx.indexdef}`);
      });
    } else {
      console.log('   ❌ No vector indexes found!');
    }

    // 3. Check table statistics
    console.log('\n3. Table statistics:');
    const tableStats = await prisma.$queryRaw<Array<{
      schemaname: string;
      tablename: string;
      n_live_tup: number;
      n_dead_tup: number;
      last_vacuum: Date | null;
      last_autovacuum: Date | null;
      last_analyze: Date | null;
      last_autoanalyze: Date | null;
    }>>`
      SELECT 
        schemaname,
        tablename,
        n_live_tup,
        n_dead_tup,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE tablename = 'context_chunks'
    `;
    
    if (tableStats.length > 0) {
      const stats = tableStats[0];
      console.log(`   Live tuples: ${stats.n_live_tup}`);
      console.log(`   Dead tuples: ${stats.n_dead_tup}`);
      console.log(`   Last vacuum: ${stats.last_vacuum || 'Never'}`);
      console.log(`   Last autovacuum: ${stats.last_autovacuum || 'Never'}`);
      console.log(`   Last analyze: ${stats.last_analyze || 'Never'}`);
      console.log(`   Last autoanalyze: ${stats.last_autoanalyze || 'Never'}`);
    }

    // 4. Check PostgreSQL configuration
    console.log('\n4. PostgreSQL configuration:');
    const pgConfig = await prisma.$queryRaw<Array<{
      name: string;
      setting: string;
      unit: string | null;
    }>>`
      SELECT name, setting, unit 
      FROM pg_settings 
      WHERE name IN (
        'shared_buffers',
        'effective_cache_size',
        'work_mem',
        'maintenance_work_mem',
        'random_page_cost',
        'seq_page_cost'
      )
    `;
    
    pgConfig.forEach(config => {
      console.log(`   ${config.name}: ${config.setting}${config.unit || ''}`);
    });

    // 5. Test query execution plan
    console.log('\n5. Query execution plan analysis:');
    
    // Create a simple test vector for EXPLAIN
    const testVector = Array(1536).fill(0.1).join(',');
    
    try {
      const explainResult = await prisma.$queryRaw<Array<{'QUERY PLAN': string}>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT 
          id,
          title,
          (embedding_vector <=> '[${testVector}]'::vector) as distance
        FROM context_chunks 
        WHERE embedding_vector IS NOT NULL
        ORDER BY embedding_vector <=> '[${testVector}]'::vector
        LIMIT 10
      `;
      
      console.log('   Query execution plan:');
      explainResult.forEach(row => {
        console.log(`   ${row['QUERY PLAN']}`);
      });
    } catch (error) {
      console.log('   ❌ Could not get execution plan:', error);
    }

    // 6. Check pgvector extension
    console.log('\n6. pgvector extension info:');
    const extensionInfo = await prisma.$queryRaw<Array<{
      extname: string;
      extversion: string;
    }>>`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `;
    
    if (extensionInfo.length > 0) {
      console.log(`   ✅ pgvector version: ${extensionInfo[0].extversion}`);
    } else {
      console.log('   ❌ pgvector extension not found');
    }

    // 7. Check data distribution
    console.log('\n7. Data distribution:');
    const dataDistribution = await prisma.$queryRaw<Array<{
      tier: number;
      count: string;
      with_embeddings: string;
    }>>`
      SELECT 
        tier,
        COUNT(*) as count,
        COUNT(embedding_vector) as with_embeddings
      FROM context_chunks 
      GROUP BY tier 
      ORDER BY tier
    `;
    
    console.log('   Tier distribution:');
    dataDistribution.forEach(dist => {
      console.log(`   Tier ${dist.tier}: ${dist.count} total, ${dist.with_embeddings} with embeddings`);
    });

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  checkDatabaseSchema().catch(console.error);
}