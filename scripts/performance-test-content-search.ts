#!/usr/bin/env tsx

/**
 * Performance Test for Content Search
 * 
 * This script analyzes the performance breakdown of content search
 * to identify bottlenecks and ensure vector search is working properly.
 */

import { BackendToolService } from '../src/lib/ai/tools/BackendToolService';
import { UIState } from '../src/lib/ai/tools/types';

async function performanceTest() {
  console.log('🔍 Content Search Performance Analysis\n');

  const backendService = BackendToolService.getInstance();

  // Test 1: Basic search without UI state
  console.log('1. Testing basic search (no UI state)...');
  const basicStart = Date.now();
  
  const basicResult = await backendService.executeTool(
    'content_search',
    {
      query: 'technical implementation',
      k: 3,
      maxTier: 3
    },
    'test-session',
    'premium'
  );
  
  const basicDuration = Date.now() - basicStart;
  
  console.log(`   Total Time: ${basicDuration}ms`);
  if (basicResult.success && basicResult.data?.searchMetadata) {
    const meta = basicResult.data.searchMetadata;
    console.log(`   Query Embedding: ${meta.queryEmbeddingTime}ms`);
    console.log(`   Search Time: ${meta.searchTime}ms`);
    console.log(`   Semantic Results: ${meta.semanticResults}`);
    console.log(`   Vector Search: ${meta.semanticResults > 0 ? 'YES' : 'NO'}`);
  }
  console.log('');

  // Test 2: Search with UI state
  console.log('2. Testing search with UI state...');
  const uiState: UIState = {
    breadcrumbPath: 'home.projects.portfolio-website',
    currentRoute: 'projects',
    currentProject: 'portfolio-website',
    visibleAnchors: ['overview'],
    lastUserAction: {
      type: 'navigate',
      timestamp: Date.now()
    }
  };

  const uiStart = Date.now();
  
  const uiResult = await backendService.executeTool(
    'content_search',
    {
      query: 'technical implementation',
      uiState,
      k: 3,
      maxTier: 3
    },
    'test-session',
    'premium'
  );
  
  const uiDuration = Date.now() - uiStart;
  
  console.log(`   Total Time: ${uiDuration}ms`);
  if (uiResult.success && uiResult.data?.searchMetadata) {
    const meta = uiResult.data.searchMetadata;
    console.log(`   Query Embedding: ${meta.queryEmbeddingTime}ms`);
    console.log(`   Search Time: ${meta.searchTime}ms`);
    console.log(`   Semantic Results: ${meta.semanticResults}`);
    console.log(`   Original Results: ${meta.originalResults}`);
    console.log(`   Ranked Results: ${meta.rankedResults}`);
    console.log(`   UI State Enhanced: ${meta.uiStateEnhanced}`);
    console.log(`   Vector Search: ${meta.semanticResults > 0 ? 'YES' : 'NO'}`);
  }
  console.log('');

  // Test 3: Multiple runs to check consistency
  console.log('3. Testing consistency (5 runs)...');
  const times = [];
  
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await backendService.executeTool(
      'content_search',
      {
        query: `test query ${i}`,
        k: 3
      },
      'test-session',
      'premium'
    );
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`   Times: ${times.join('ms, ')}ms`);
  console.log(`   Average: ${Math.round(avgTime)}ms`);
  console.log(`   Min: ${minTime}ms, Max: ${maxTime}ms`);
  console.log('');

  // Analysis
  console.log('📊 Performance Analysis:');
  console.log(`   Basic Search: ${basicDuration}ms`);
  console.log(`   UI State Search: ${uiDuration}ms`);
  console.log(`   UI State Overhead: ${uiDuration - basicDuration}ms`);
  console.log(`   Average Consistency: ${Math.round(avgTime)}ms`);
  
  if (basicResult.data?.searchMetadata?.semanticResults > 0) {
    console.log('   ✅ Vector search is working');
  } else {
    console.log('   ❌ Vector search may not be working');
  }
  
  if (uiDuration > 2000) {
    console.log('   ⚠️  Performance issue detected (>2s)');
    console.log('   Possible causes:');
    console.log('   - Network latency to OpenAI API');
    console.log('   - Database query performance');
    console.log('   - UI state processing overhead');
    console.log('   - k*2 result multiplication');
  } else if (uiDuration > 1000) {
    console.log('   ⚠️  Moderate performance concern (>1s)');
  } else {
    console.log('   ✅ Performance looks good (<1s)');
  }

  // Test 4: Check if k*2 is the issue
  console.log('\n4. Testing k*2 impact...');
  
  // Simulate what happens inside with k*2
  const k2Start = Date.now();
  const k2Result = await backendService.executeTool(
    'content_search',
    {
      query: 'technical implementation',
      k: 6, // This is what k*2 becomes internally
      maxTier: 3
    },
    'test-session',
    'premium'
  );
  const k2Duration = Date.now() - k2Start;
  
  console.log(`   k=6 search time: ${k2Duration}ms`);
  console.log(`   k=3 search time: ${basicDuration}ms`);
  console.log(`   k*2 overhead: ${k2Duration - basicDuration}ms`);
}

if (require.main === module) {
  performanceTest().catch(console.error);
}