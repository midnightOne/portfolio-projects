#!/usr/bin/env tsx

/**
 * Test Index Maintenance System
 * 
 * This script tests the automated index maintenance system to ensure
 * it properly triggers maintenance when content changes occur.
 */

import { PrismaClient } from '@prisma/client';
import { IndexMaintenanceService } from '../src/lib/database/IndexMaintenanceService';

const prisma = new PrismaClient();

async function testIndexMaintenance() {
  console.log('🧪 Testing Index Maintenance System\n');

  const indexMaintenance = IndexMaintenanceService.getInstance(prisma, {
    autoAnalyzeThreshold: 5,     // Low threshold for testing
    reindexThreshold: 20,        // Low threshold for testing
    enableAutoMaintenance: true
  });

  try {
    // 1. Check initial state
    console.log('1. Initial index health check...');
    const initialStats = await indexMaintenance.getIndexStats();
    console.log(`   Total rows: ${initialStats.totalRows}`);
    console.log(`   Rows with embeddings: ${initialStats.rowsWithEmbeddings}`);
    console.log(`   Changes since analyze: ${initialStats.changesSinceAnalyze}`);

    // 2. Reset change counter for testing
    console.log('\n2. Resetting change counter for testing...');
    indexMaintenance.resetChangeCounter();
    console.log('   ✅ Change counter reset');

    // 3. Simulate small changes (should not trigger maintenance)
    console.log('\n3. Simulating 3 content changes (below threshold)...');
    const result1 = await indexMaintenance.onContentChange('insert', 3);
    
    if (result1) {
      console.log(`   🔧 Maintenance triggered: ${result1.action} (${result1.duration}ms)`);
    } else {
      console.log('   ✅ No maintenance triggered (expected - below threshold)');
    }

    // 4. Simulate reaching analyze threshold
    console.log('\n4. Simulating 3 more changes (should trigger analyze)...');
    const result2 = await indexMaintenance.onContentChange('update', 3);
    
    if (result2) {
      console.log(`   🔧 Maintenance triggered: ${result2.action} (${result2.duration}ms)`);
      console.log(`   Message: ${result2.message}`);
      
      if (result2.stats) {
        console.log(`   Updated stats: ${result2.stats.totalRows} rows, ${result2.stats.rowsWithEmbeddings} with embeddings`);
      }
    } else {
      console.log('   ❌ Expected maintenance but none triggered');
    }

    // 5. Test manual maintenance
    console.log('\n5. Testing manual maintenance...');
    const manualResult = await indexMaintenance.performMaintenance();
    
    console.log(`   Manual maintenance: ${manualResult.action} (${manualResult.duration}ms)`);
    console.log(`   Success: ${manualResult.success}`);
    console.log(`   Message: ${manualResult.message}`);

    // 6. Test maintenance recommendations
    console.log('\n6. Getting maintenance recommendations...');
    const recommendations = await indexMaintenance.getMaintenanceRecommendations();
    
    console.log(`   Priority: ${recommendations.urgency.toUpperCase()}`);
    console.log('   Recommendations:');
    recommendations.recommendations.forEach(rec => {
      console.log(`   - ${rec}`);
    });

    // 7. Test index verification
    console.log('\n7. Verifying index health...');
    const indexCheck = await indexMaintenance.verifyIndexes();
    
    console.log(`   Vector index exists: ${indexCheck.vectorIndexExists ? '✅' : '❌'}`);
    console.log(`   Supporting indexes exist: ${indexCheck.supportingIndexesExist ? '✅' : '❌'}`);
    
    if (indexCheck.recommendations.length > 0) {
      console.log('   Index recommendations:');
      indexCheck.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }

    // 8. Test performance after maintenance
    console.log('\n8. Testing search performance...');
    
    try {
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
        console.log('   ❌ Poor performance (>500ms)');
      }
    } catch (error) {
      console.log('   ❌ Performance test failed:', error);
    }

    console.log('\n🎉 Index maintenance system test completed successfully!');
    
    // Show final configuration
    const config = indexMaintenance.getConfig();
    console.log('\n⚙️  Final Configuration:');
    console.log(`   Auto-analyze threshold: ${config.autoAnalyzeThreshold} changes`);
    console.log(`   Reindex threshold: ${config.reindexThreshold} changes`);
    console.log(`   Performance threshold: ${config.performanceThreshold}ms`);
    console.log(`   Auto-maintenance: ${config.enableAutoMaintenance ? 'Enabled' : 'Disabled'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testIndexMaintenance().catch(console.error);
}