/**
 * Integration test for navigation system with detailed case studies
 */

import { ContentSearchService } from '../src/lib/content/ContentSearchService';
import { UINavigationTools } from '../src/lib/voice/UINavigationTools';

async function testNavigationIntegration() {
  console.log('🧪 Testing Navigation Integration with Detailed Case Studies');
  console.log('=' .repeat(60));

  const searchService = new ContentSearchService();
  const navigationTools = new UINavigationTools();

  // Test cases that should work with our detailed content
  const testCases = [
    {
      query: "show me the impact of the portfolio website project",
      expectedProject: "portfolio-website",
      expectedSection: "impact"
    },
    {
      query: "navigate to the technical architecture section in the task management app",
      expectedProject: "task-management-app", 
      expectedSection: "technical architecture"
    },
    {
      query: "take me to the business results section of the e-commerce platform",
      expectedProject: "e-commerce-platform",
      expectedSection: "business results"
    },
    {
      query: "show me the performance optimization details in the portfolio project",
      expectedProject: "portfolio-website",
      expectedSection: "performance optimization"
    },
    {
      query: "find the security implementation in the task management system",
      expectedProject: "task-management-app",
      expectedSection: "security"
    },
    {
      query: "show me the AI features in the portfolio website",
      expectedProject: "portfolio-website", 
      expectedSection: "ai integration"
    },
    {
      query: "navigate to the payment processing section in the e-commerce project",
      expectedProject: "e-commerce-platform",
      expectedSection: "payment processing"
    },
    {
      query: "show me the lessons learned from the task management app",
      expectedProject: "task-management-app",
      expectedSection: "lessons learned"
    }
  ];

  console.log(`\n🔍 Testing ${testCases.length} navigation scenarios...\n`);

  let successCount = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}/${totalTests}: "${testCase.query}"`);
    
    try {
      // Step 1: Test semantic search
      console.log('  🔍 Performing semantic search...');
      const searchResults = await searchService.searchContent(testCase.query, {
        limit: 5,
        includeContent: true,
        minRelevanceScore: 0.1
      });

      if (searchResults.results.length === 0) {
        console.log('  ❌ No search results found');
        continue;
      }

      console.log(`  📊 Found ${searchResults.results.length} results`);
      
      // Check if we found the expected project
      const projectMatch = searchResults.results.find(result => 
        result.entityId.includes(testCase.expectedProject)
      );

      if (!projectMatch) {
        console.log(`  ❌ Expected project "${testCase.expectedProject}" not found in results`);
        console.log('  📋 Found projects:', searchResults.results.map(r => r.entityId).slice(0, 3));
        continue;
      }

      console.log(`  ✅ Found expected project: ${projectMatch.entityId}`);
      console.log(`  📍 Section: ${projectMatch.chunkId} (relevance: ${projectMatch.relevanceScore.toFixed(3)})`);
      console.log(`  📝 Content preview: ${projectMatch.content?.substring(0, 100)}...`);

      // Step 2: Test navigation tool execution
      console.log('  🧭 Testing navigation tool...');
      
      // Simulate the navigation tool call that would happen in voice interaction
      const navigationResult = await navigationTools.navigateToContent({
        query: testCase.query,
        searchResults: searchResults.results.slice(0, 3) // Pass top 3 results
      });

      if (navigationResult.success) {
        console.log(`  ✅ Navigation successful`);
        console.log(`  🎯 Target: ${navigationResult.target?.entityId} -> ${navigationResult.target?.chunkId}`);
        successCount++;
      } else {
        console.log(`  ❌ Navigation failed: ${navigationResult.error}`);
      }

    } catch (error) {
      console.log(`  ❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(''); // Empty line between tests
  }

  // Summary
  console.log('=' .repeat(60));
  console.log(`📊 Navigation Integration Test Results:`);
  console.log(`   ✅ Successful: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
  console.log(`   ❌ Failed: ${totalTests - successCount}/${totalTests}`);
  
  if (successCount === totalTests) {
    console.log('🎉 All navigation tests passed! The system is ready for voice interaction.');
  } else if (successCount > totalTests * 0.7) {
    console.log('⚠️  Most tests passed, but some issues need attention.');
  } else {
    console.log('🚨 Multiple navigation issues detected. System needs debugging.');
  }

  // Additional diagnostic information
  console.log('\n🔧 Diagnostic Information:');
  
  try {
    // Test basic search functionality
    const basicSearch = await searchService.searchContent("portfolio website", { limit: 3 });
    console.log(`   📊 Basic search test: ${basicSearch.results.length} results found`);
    
    // Test content availability
    const allProjects = ['portfolio-website', 'task-management-app', 'e-commerce-platform'];
    for (const project of allProjects) {
      const projectSearch = await searchService.searchContent(project, { limit: 1 });
      console.log(`   📁 Project "${project}": ${projectSearch.results.length > 0 ? '✅ Found' : '❌ Missing'}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Diagnostic error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n🎯 Next Steps:');
  console.log('   1. If tests are passing, try voice commands like:');
  console.log('      "Show me the impact of the portfolio website project"');
  console.log('      "Navigate to the technical architecture in the task management app"');
  console.log('   2. If tests are failing, check:');
  console.log('      - Database connection and content ingestion');
  console.log('      - Vector embeddings are properly generated');
  console.log('      - Navigation tools are properly configured');
}

// Run the test
testNavigationIntegration().catch(console.error);