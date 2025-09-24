#!/usr/bin/env tsx

/**
 * Complete Tool Call Timing Test
 * 
 * This script tests the complete tool call flow from the highest level
 * to identify where the 5+ second delays are occurring. It simulates
 * the exact same flow as the voice agent.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testCompleteToolCallTiming() {
  console.log('🔍 Testing Complete Tool Call Timing Flow...\n');

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

  // Test 1: Direct API call to /api/ai/tools/execute (simulating the fetch call)
  console.log('\n🔄 Test 1: Direct API call to /api/ai/tools/execute');
  
  const apiCallStart = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/ai/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'content_search',
        parameters: testParameters,
        sessionId: 'test-complete-timing',
        toolCallId: 'test-call-id',
        reflinkId: undefined
      }),
    });

    const apiCallTime = Date.now() - apiCallStart;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API call failed: ${response.status} - ${errorText}`);
      return;
    }

    const responseParseStart = Date.now();
    const result = await response.json();
    const responseParseTime = Date.now() - responseParseStart;

    console.log(`✅ API call completed in ${apiCallTime}ms`);
    console.log(`📊 Response parsing: ${responseParseTime}ms`);
    console.log(`🔧 Tool execution success: ${result.success}`);
    
    if (result.success && result.data) {
      console.log(`📈 Results found: ${result.data.items?.length || 0}`);
      console.log(`📊 Total results: ${result.data.totalResults || 0}`);
      
      if (result.data.searchMetadata) {
        console.log(`⏱️  Search metadata:`);
        console.log(`  - Query embedding: ${result.data.searchMetadata.queryEmbeddingTime}ms`);
        console.log(`  - Search time: ${result.data.searchMetadata.searchTime}ms`);
        
        if (result.data.searchMetadata.timingBreakdown) {
          console.log(`  - Detailed breakdown:`, result.data.searchMetadata.timingBreakdown);
        }
      }
    } else {
      console.log(`❌ Tool execution failed: ${result.error}`);
    }

    console.log(`🕐 API execution time from metadata: ${result.metadata?.executionTime}ms`);

  } catch (error) {
    console.error('❌ API call failed:', error);
  }

  // Test 2: Multiple consecutive calls to test consistency
  console.log('\n🔄 Test 2: Multiple consecutive calls for consistency');
  
  const times: number[] = [];
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n  Run ${i}:`);
    
    const runStart = Date.now();
    
    try {
      const response = await fetch('http://localhost:3000/api/ai/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'content_search',
          parameters: testParameters,
          sessionId: `test-consistency-${i}`,
          toolCallId: `test-call-${i}`,
          reflinkId: undefined
        }),
      });

      const runTime = Date.now() - runStart;
      times.push(runTime);

      if (response.ok) {
        const result = await response.json();
        console.log(`    ✅ Completed in ${runTime}ms (${result.success ? 'success' : 'failed'})`);
        console.log(`    📊 Results: ${result.data?.items?.length || 0}`);
        
        if (i > 1) {
          const cacheHit = runTime < 100;
          console.log(`    🎯 Cache behavior: ${cacheHit ? 'LIKELY CACHED' : 'NOT CACHED'}`);
        }
      } else {
        console.log(`    ❌ Failed in ${runTime}ms (${response.status})`);
      }

    } catch (error) {
      const runTime = Date.now() - runStart;
      times.push(runTime);
      console.log(`    ❌ Error in ${runTime}ms:`, error);
    }
  }

  // Test 3: Cold start simulation (different query to avoid cache)
  console.log('\n🔄 Test 3: Cold start simulation with different query');
  
  const coldStartParameters = {
    query: "machine learning and artificial intelligence projects",
    uiState: {
      currentRoute: "projects"
    },
    k: 5,
    maxTier: 3
  };

  const coldStartTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/ai/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'content_search',
        parameters: coldStartParameters,
        sessionId: 'test-cold-start',
        toolCallId: 'test-cold-call',
        reflinkId: undefined
      }),
    });

    const coldTime = Date.now() - coldStartTime;
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Cold start completed in ${coldTime}ms`);
      console.log(`📊 Results: ${result.data?.items?.length || 0}`);
    } else {
      console.log(`❌ Cold start failed in ${coldTime}ms`);
    }

  } catch (error) {
    const coldTime = Date.now() - coldStartTime;
    console.log(`❌ Cold start error in ${coldTime}ms:`, error);
  }

  // Summary
  console.log('\n📊 Performance Summary:');
  console.log(`Average time across ${times.length} runs: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)}ms`);
  console.log(`Min time: ${Math.min(...times)}ms`);
  console.log(`Max time: ${Math.max(...times)}ms`);
  
  if (Math.max(...times) > 3000) {
    console.log('⚠️  WARNING: Detected slow performance (>3s). Check console logs for detailed timing breakdowns.');
  } else if (Math.max(...times) > 1000) {
    console.log('⚠️  NOTICE: Performance could be improved (>1s). Check console logs for optimization opportunities.');
  } else {
    console.log('✅ Performance looks good (<1s average).');
  }

  console.log('\n✨ Complete Tool Call Timing Test Complete!');
  console.log('\n💡 Check the console output above for detailed timing breakdowns from each layer:');
  console.log('   - [APIRoute] - API endpoint timing');
  console.log('   - [BackendTool] - Backend service timing');
  console.log('   - [ContentSearch] - Search service timing');
  console.log('   - [HybridSearch] - Database operation timing');
  console.log('   - [VectorOps] - Vector search timing');
}

// Run the test
if (require.main === module) {
  testCompleteToolCallTiming()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testCompleteToolCallTiming };