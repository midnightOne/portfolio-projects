#!/usr/bin/env tsx

/**
 * Vector Index Maintenance Script
 * 
 * This script provides comprehensive index maintenance for the vector search system.
 * It can be run manually or scheduled as a cron job for automated maintenance.
 * 
 * Usage:
 *   npx tsx scripts/maintain-vector-indexes.ts [action]
 * 
 * Actions:
 *   check    - Check index health and get recommendations (default)
 *   analyze  - Update table statistics (lightweight)
 *   reindex  - Rebuild vector indexes (heavy operation)
 *   auto     - Perform automatic maintenance based on current state
 *   force    - Force both analyze and reindex regardless of thresholds
 */

import { PrismaClient } from '@prisma/client';
import { IndexMaintenanceService } from '../src/lib/database/IndexMaintenanceService';

const prisma = new PrismaClient();

async function main() {
  const action = process.argv[2] || 'check';
  
  console.log('🔧 Vector Index Maintenance Tool\n');
  
  const indexMaintenance = IndexMaintenanceService.getInstance(prisma);
  
  try {
    switch (action) {
      case 'check':
        await checkIndexHealth(indexMaintenance);
        break;
        
      case 'analyze':
        await runAnalyze(indexMaintenance);
        break;
        
      case 'reindex':
        await runReindex(indexMaintenance);
        break;
        
      case 'auto':
        await runAutoMaintenance(indexMaintenance);
        break;
        
      case 'force':
        await runForceMaintenance(indexMaintenance);
        break;
        
      default:
        console.log('❌ Unknown action:', action);
        console.log('Available actions: check, analyze, reindex, auto, force');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Maintenance failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkIndexHealth(indexMaintenance: IndexMaintenanceService) {
  console.log('📊 Checking index health...\n');
  
  // Verify indexes exist
  const indexCheck = await indexMaintenance.verifyIndexes();
  
  console.log('🔍 Index Status:');
  console.log(`   Vector index: ${indexCheck.vectorIndexExists ? '✅ Exists' : '❌ Missing'}`);
  console.log(`   Supporting indexes: ${indexCheck.supportingIndexesExist ? '✅ Exists' : '❌ Missing'}`);
  
  if (indexCheck.recommendations.length > 0) {
    console.log('\n⚠️  Recommendations:');
    indexCheck.recommendations.forEach(rec => {
      console.log(`   - ${rec}`);
    });
  }
  
  // Get current statistics
  const stats = await indexMaintenance.getIndexStats();
  
  console.log('\n📈 Current Statistics:');
  console.log(`   Total rows: ${stats.totalRows}`);
  console.log(`   Rows with embeddings: ${stats.rowsWithEmbeddings}`);
  console.log(`   Index size: ${stats.indexSize}`);
  console.log(`   Last analyzed: ${stats.lastAnalyzed ? stats.lastAnalyzed.toISOString() : 'Never'}`);
  console.log(`   Last vacuumed: ${stats.lastVacuumed ? stats.lastVacuumed.toISOString() : 'Never'}`);
  console.log(`   Changes since analyze: ${stats.changesSinceAnalyze}`);
  
  // Get maintenance recommendations
  const recommendations = await indexMaintenance.getMaintenanceRecommendations();
  
  console.log(`\n🎯 Maintenance Recommendations (${recommendations.urgency.toUpperCase()} priority):`);
  recommendations.recommendations.forEach(rec => {
    console.log(`   - ${rec}`);
  });
  
  // Show configuration
  const config = indexMaintenance.getConfig();
  console.log('\n⚙️  Current Configuration:');
  console.log(`   Auto-analyze threshold: ${config.autoAnalyzeThreshold} changes`);
  console.log(`   Reindex threshold: ${config.reindexThreshold} changes`);
  console.log(`   Performance threshold: ${config.performanceThreshold}ms`);
  console.log(`   Auto-maintenance: ${config.enableAutoMaintenance ? 'Enabled' : 'Disabled'}`);
}

async function runAnalyze(indexMaintenance: IndexMaintenanceService) {
  console.log('📊 Running table analysis...\n');
  
  const result = await indexMaintenance.analyzeTable();
  
  if (result.success) {
    console.log(`✅ Analysis completed in ${result.duration}ms`);
    console.log(`   ${result.message}`);
    
    if (result.stats) {
      console.log(`\n📈 Updated Statistics:`);
      console.log(`   Total rows: ${result.stats.totalRows}`);
      console.log(`   Rows with embeddings: ${result.stats.rowsWithEmbeddings}`);
      console.log(`   Index size: ${result.stats.indexSize}`);
    }
  } else {
    console.log(`❌ Analysis failed: ${result.message}`);
  }
}

async function runReindex(indexMaintenance: IndexMaintenanceService) {
  console.log('🔄 Rebuilding vector indexes...\n');
  console.log('⚠️  This operation may take several minutes for large datasets.');
  
  const result = await indexMaintenance.reindexVectorIndex();
  
  if (result.success) {
    console.log(`✅ Reindex completed in ${result.duration}ms`);
    console.log(`   ${result.message}`);
    
    if (result.stats) {
      console.log(`\n📈 Updated Statistics:`);
      console.log(`   Total rows: ${result.stats.totalRows}`);
      console.log(`   Rows with embeddings: ${result.stats.rowsWithEmbeddings}`);
      console.log(`   Index size: ${result.stats.indexSize}`);
    }
  } else {
    console.log(`❌ Reindex failed: ${result.message}`);
  }
}

async function runAutoMaintenance(indexMaintenance: IndexMaintenanceService) {
  console.log('🤖 Running automatic maintenance...\n');
  
  const result = await indexMaintenance.performMaintenance();
  
  if (result.success) {
    console.log(`✅ Auto-maintenance completed: ${result.action}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   ${result.message}`);
    
    if (result.stats) {
      console.log(`\n📈 Current Statistics:`);
      console.log(`   Total rows: ${result.stats.totalRows}`);
      console.log(`   Rows with embeddings: ${result.stats.rowsWithEmbeddings}`);
      console.log(`   Index size: ${result.stats.indexSize}`);
    }
  } else {
    console.log(`❌ Auto-maintenance failed: ${result.message}`);
  }
}

async function runForceMaintenance(indexMaintenance: IndexMaintenanceService) {
  console.log('💪 Running forced maintenance (analyze + reindex)...\n');
  console.log('⚠️  This operation may take several minutes for large datasets.');
  
  const results = await indexMaintenance.forceMaintenance('both');
  
  results.forEach((result, index) => {
    const actionName = result.action === 'analyze' ? 'Analysis' : 'Reindex';
    
    if (result.success) {
      console.log(`✅ ${actionName} completed in ${result.duration}ms`);
      console.log(`   ${result.message}`);
    } else {
      console.log(`❌ ${actionName} failed: ${result.message}`);
    }
    
    if (index < results.length - 1) {
      console.log(''); // Add spacing between results
    }
  });
  
  // Show final statistics
  const finalStats = await indexMaintenance.getIndexStats();
  console.log(`\n📈 Final Statistics:`);
  console.log(`   Total rows: ${finalStats.totalRows}`);
  console.log(`   Rows with embeddings: ${finalStats.rowsWithEmbeddings}`);
  console.log(`   Index size: ${finalStats.indexSize}`);
  console.log(`   Last analyzed: ${finalStats.lastAnalyzed ? finalStats.lastAnalyzed.toISOString() : 'Never'}`);
}

// Performance test after maintenance
async function testPerformanceAfterMaintenance() {
  console.log('\n🚀 Testing search performance...');
  
  try {
    // Create a test vector for performance testing
    const testVector = Array(1536).fill(0.1);
    
    const searchStart = Date.now();
    const searchResults = await prisma.$queryRaw<Array<{
      id: string;
      title: string;
      distance: number;
    }>>`
      SELECT 
        id,
        title,
        (embedding_vector <=> ${testVector}::vector) as distance
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_vector <=> ${testVector}::vector
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
      console.log('   ❌ Poor performance (>500ms) - consider reindexing');
    }
  } catch (error) {
    console.log('   ❌ Performance test failed:', error);
  }
}

// Add performance test for analyze and reindex actions
if (require.main === module) {
  main().then(async () => {
    const action = process.argv[2] || 'check';
    if (['analyze', 'reindex', 'auto', 'force'].includes(action)) {
      await testPerformanceAfterMaintenance();
    }
  }).catch(console.error);
}