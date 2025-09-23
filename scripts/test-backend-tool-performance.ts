#!/usr/bin/env tsx

/**
 * Test Backend Tool Performance
 * 
 * This script tests the BackendToolService content search to identify
 * where the 5+ second delays are coming from.
 */

import dotenv from 'dotenv';
import path from 'path';
import { BackendToolService } from '../src/lib/ai/tools/BackendToolService';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testBackendToolPerformance() {
  console.log('🔧 Testing Backend Tool Service Performance...\n');

  const backendTool = BackendToolService.getInstance();

  // Test the exact query that was slow
  const testParameters = {
    query: "common elements between task management app and e-commerce platform",
    uiState: {
      breadcrumbPath: "home.projects.task-management-app",
      currentRoute: "projects",
      currentProject: "task-management-app"
    },
    k: 5,
    maxTier: 3
  };

  console.log('📝 Testing query:', testParameters.query);
  console.log('🎯 UI State:', testParameters.uiState);
  console.log('⚙️  Parameters:', { k: testParameters.k, maxTier: testParameters.maxTier });

  // Test multiple runs to see consistency
  for (let run = 1; run <= 3; run++) {
    console.log(`\n🔄 Run ${run}:`);
    
    const overallStart = Date.now();
    
    try {
      // Execute the tool
      const result = await backendTool.executeTool(
        'content_search', 
        testParameters, 
        `test-session-${run}`,
        'premium',
        undefined,
        'test-user',
        testParameters.uiState
      );

      const overallTime = Date.now() - overallStart;

      console.log(`✅ Overall execution time: ${overallTime}ms`);
      console.log(`🔧 Tool execution success: ${result.success}`);
      
      // Access the actual data from the wrapped result
      const searchData = result.success ? result.data : null;
      
      console.log(`📊 Results found: ${searchData?.items?.length || 0}`);
      console.log(`📈 Total results: ${searchData?.totalResults || 0}`);
      
      // Debug: Log the actual result structure
      if (searchData?.items && searchData.items.length > 0) {
        console.log(`🔍 First result:`, {
          title: searchData.items[0].title,
          project: searchData.items[0].project,
          score: searchData.items[0].score,
          facets: searchData.items[0].facets
        });
      } else {
        console.log(`❓ No results returned. Full result structure:`, {
          success: result.success,
          hasData: !!result.data,
          hasItems: !!searchData?.items,
          itemsLength: searchData?.items?.length,
          totalResults: searchData?.totalResults,
          searchMetadata: searchData?.searchMetadata ? 'present' : 'missing',
          error: result.error
        });
      }
      
      if (searchData?.searchMetadata) {
        console.log(`⏱️  Search metadata timing:`);
        console.log(`  - Query embedding: ${searchData.searchMetadata.queryEmbeddingTime}ms`);
        console.log(`  - Search time: ${searchData.searchMetadata.searchTime}ms`);
        
        if (searchData.searchMetadata.timingBreakdown) {
          console.log(`  - Timing breakdown:`, searchData.searchMetadata.timingBreakdown);
        }
      }
      


      // Check for cache hits on subsequent runs
      if (run > 1) {
        console.log(`🎯 Cache behavior: ${overallTime < 100 ? 'LIKELY CACHED' : 'NOT CACHED'}`);
      }

    } catch (error) {
      console.error(`❌ Run ${run} failed:`, error);
    }

    console.log('\n' + '-'.repeat(60));
  }

  // Test a different query to see if it's query-specific
  console.log('\n🔄 Testing different query for comparison:');
  
  const simpleTestParameters = {
    query: "e-commerce platform",
    uiState: {
      currentRoute: "projects",
      currentProject: "e-commerce-platform"
    },
    k: 5,
    maxTier: 3
  };

  const simpleStart = Date.now();
  
  try {
    const simpleResult = await backendTool.executeTool(
      'content_search', 
      simpleTestParameters, 
      'test-session-simple',
      'premium',
      undefined,
      'test-user',
      simpleTestParameters.uiState
    );

    const simpleTime = Date.now() - simpleStart;
    console.log(`✅ Simple query time: ${simpleTime}ms`);
    const simpleData = simpleResult.success ? simpleResult.data : null;
    console.log(`📊 Simple results: ${simpleData?.items?.length || 0}`);

  } catch (error) {
    console.error('❌ Simple query failed:', error);
  }

  console.log('\n✨ Backend Tool Performance Test Complete!');
}

// Run the test
if (require.main === module) {
  testBackendToolPerformance()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testBackendToolPerformance };