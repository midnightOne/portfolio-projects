/**
 * Test to reproduce the project scoping issue
 */

import { BackendToolService } from '../src/lib/ai/tools/BackendToolService';

async function testProjectScopingIssue() {
  console.log('🧪 Testing Project Scoping Issue');
  console.log('=' .repeat(60));

  const backendService = BackendToolService.getInstance();

  // Test case 1: Query for e-commerce content while viewing portfolio project
  const portfolioUIState = {
    currentRoute: 'projects',
    currentProject: 'portfolio-website',
    breadcrumbPath: 'home.projects.portfolio-website',
    visibleAnchors: ['project-header', 'project-content'],
    currentModal: null,
    lastUserAction: {
      type: 'navigate',
      timestamp: Date.now()
    }
  };

  console.log('Test 1: Query for e-commerce content while viewing portfolio project');

  try {
    const result = await backendService.executeTool(
      'content_search',
      {
        query: 'impact section in the e-commerce website',
        uiState: portfolioUIState,
        scope: {}, // Empty scope - should not filter
        k: 5
      },
      'test-session',
      'premium'
    );

    console.log('\nResults with UI state:');
    console.log('Success:', result.success);
    console.log('Total results:', result.data?.items?.length || 0);
    
    if (result.data?.items?.length > 0) {
      console.log('Projects found:', [...new Set(result.data.items.map((item: any) => item.project))]);
      result.data.items.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. ${item.project} -> ${item.title} (${item.score?.toFixed(3)})`);
      });
    }

  } catch (error) {
    console.log('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n' + '='.repeat(60));

  // Test case 2: Same query without UI state
  console.log('Test 2: Same query without UI state');

  try {
    const result = await backendService.executeTool(
      'content_search',
      {
        query: 'impact section in the e-commerce website',
        scope: {},
        k: 5
      },
      'test-session',
      'premium'
    );

    console.log('\nResults without UI state:');
    console.log('Success:', result.success);
    console.log('Total results:', result.data?.items?.length || 0);
    
    if (result.data?.items?.length > 0) {
      console.log('Projects found:', [...new Set(result.data.items.map((item: any) => item.project))]);
      result.data.items.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. ${item.project} -> ${item.title} (${item.score?.toFixed(3)})`);
      });
    }

  } catch (error) {
    console.log('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n🎯 Analysis:');
  console.log('Both tests should return similar results.');
  console.log('The search should be a pure RAG system that always finds relevant content.');
}

testProjectScopingIssue().catch(console.error);