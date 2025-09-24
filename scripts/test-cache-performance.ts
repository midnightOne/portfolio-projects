#!/usr/bin/env tsx

/**
 * Test Embedding Cache Performance
 * 
 * This script tests the same queries multiple times to demonstrate
 * the performance improvement from embedding caching.
 */

import { ContentSearchService } from '../src/lib/content/ContentSearchService';

async function testCachePerformance() {
  console.log('🚀 Testing Embedding Cache Performance...\n');

  const searchService = new ContentSearchService();

  const testQuery = {
    query: 'impact of the E-commerce Platform project',
    scope: {
      route: 'projects',
      projectId: 'e-commerce-platform'
    },
    k: 5,
    maxTier: 3 as const
  };

  console.log(`Query: "${testQuery.query}"`);
  console.log('Running the same query 3 times to test cache performance...\n');

  for (let i = 1; i <= 3; i++) {
    console.log(`\n🔄 Run ${i}:`);
    
    const startTime = Date.now();
    const result = await searchService.searchContent(testQuery);
    const totalTime = Date.now() - startTime;

    console.log(`Total time: ${totalTime}ms`);
    console.log(`Embedding time: ${result.searchMetadata.queryEmbeddingTime}ms`);
    
    if (result.searchMetadata.timingBreakdown) {
      const cacheHit = result.searchMetadata.timingBreakdown.embeddingCacheHit;
      console.log(`Cache hit: ${cacheHit ? 'YES' : 'NO'}`);
    }
    
    console.log(`Results found: ${result.items.length}`);
  }

  // Get final cache stats
  console.log('\n📊 Final Cache Statistics:');
  const stats = await searchService.getSearchStats();
  console.log('Cache Stats:', JSON.stringify(stats.embeddingCache, null, 2));

  console.log('\n✨ Cache Performance Test Complete!');
}

// Run the test
if (require.main === module) {
  testCachePerformance()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testCachePerformance };