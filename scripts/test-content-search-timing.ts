#!/usr/bin/env tsx

/**
 * Test Content Search Service with Enhanced Timing
 * 
 * This script tests the ContentSearchService with the new detailed timing
 * measurements to identify performance bottlenecks.
 */

import { ContentSearchService } from '../src/lib/content/ContentSearchService';

async function testContentSearchTiming() {
  console.log('🔍 Testing Content Search Service with Enhanced Timing...\n');

  const searchService = new ContentSearchService();

  // Test cases with different complexity levels
  const testCases = [
    {
      name: 'Simple project search',
      params: {
        query: 'e-commerce platform',
        k: 5,
        maxTier: 3 as const
      }
    },
    {
      name: 'Complex search with filters',
      params: {
        query: 'impact of the E-commerce Platform project',
        scope: {
          route: 'projects',
          projectId: 'e-commerce-platform'
        },
        k: 5,
        maxTier: 3 as const,
        filters: {
          technologies: ['redis']
        }
      }
    },
    {
      name: 'Broad semantic search',
      params: {
        query: 'machine learning artificial intelligence',
        k: 10,
        maxTier: 2 as const
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📊 Testing: ${testCase.name}`);
    console.log(`Query: "${testCase.params.query}"`);
    console.log('Parameters:', JSON.stringify(testCase.params, null, 2));
    
    try {
      const startTime = Date.now();
      const result = await searchService.searchContent(testCase.params);
      const totalTime = Date.now() - startTime;

      console.log(`\n✅ Results (${totalTime}ms total):`);
      console.log(`- Found ${result.items.length} items`);
      console.log(`- Total results: ${result.totalResults}`);
      console.log(`- More available: ${result.more}`);
      
      if (result.searchMetadata.timingBreakdown) {
        console.log('\n⏱️  Detailed Timing Breakdown:');
        Object.entries(result.searchMetadata.timingBreakdown).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}ms`);
        });
      }

      console.log('\n📋 Search Metadata:');
      console.log(`- Semantic results: ${result.searchMetadata.semanticResults}`);
      console.log(`- Filtered results: ${result.searchMetadata.filteredResults}`);
      console.log(`- Diversified results: ${result.searchMetadata.diversifiedResults}`);
      console.log(`- Query embedding time: ${result.searchMetadata.queryEmbeddingTime}ms`);
      console.log(`- Total search time: ${result.searchMetadata.searchTime}ms`);

      if (result.items.length > 0) {
        console.log('\n🎯 Top Result:');
        const topResult = result.items[0];
        console.log(`- Title: ${topResult.title}`);
        console.log(`- Score: ${topResult.score.toFixed(4)}`);
        console.log(`- Project: ${topResult.project || 'N/A'}`);
        console.log(`- Type: ${topResult.facets.type}`);
        console.log(`- Tier: ${topResult.facets.tier}`);
      }

    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }

    console.log('\n' + '='.repeat(80));
  }

  // Test search stats
  console.log('\n📈 Getting Search Statistics...');
  try {
    const stats = await searchService.getSearchStats();
    console.log('Search Stats:', JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Failed to get search stats:', error);
  }

  console.log('\n✨ Content Search Timing Test Complete!');
}

// Run the test
if (require.main === module) {
  testContentSearchTiming()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testContentSearchTiming };