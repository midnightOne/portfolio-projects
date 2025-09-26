/**
 * Test semantic search functionality for navigation
 */

import { ContentSearchService } from '../src/lib/content/ContentSearchService';

async function testSemanticSearchNavigation() {
  console.log('🧪 Testing Semantic Search for Navigation');
  console.log('=' .repeat(60));

  const searchService = new ContentSearchService();

  // Test cases that should work with our detailed content
  const testCases = [
    {
      query: "show me the impact of the portfolio website project",
      expectedProject: "portfolio-website",
      expectedKeywords: ["impact", "results", "business"]
    },
    {
      query: "navigate to the technical architecture section in the task management app",
      expectedProject: "task-management-app", 
      expectedKeywords: ["technical", "architecture", "system"]
    },
    {
      query: "take me to the business results section of the e-commerce platform",
      expectedProject: "e-commerce-platform",
      expectedKeywords: ["business", "results", "impact", "performance"]
    },
    {
      query: "show me the performance optimization details in the portfolio project",
      expectedProject: "portfolio-website",
      expectedKeywords: ["performance", "optimization", "speed"]
    },
    {
      query: "find the security implementation in the task management system",
      expectedProject: "task-management-app",
      expectedKeywords: ["security", "authentication", "authorization"]
    },
    {
      query: "show me the AI features in the portfolio website",
      expectedProject: "portfolio-website", 
      expectedKeywords: ["ai", "artificial intelligence", "voice", "semantic"]
    },
    {
      query: "navigate to the payment processing section in the e-commerce project",
      expectedProject: "e-commerce-platform",
      expectedKeywords: ["payment", "processing", "gateway"]
    },
    {
      query: "show me the lessons learned from the task management app",
      expectedProject: "task-management-app",
      expectedKeywords: ["lessons", "learned", "insights"]
    }
  ];

  console.log(`\n🔍 Testing ${testCases.length} search scenarios...\n`);

  let successCount = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}/${totalTests}: "${testCase.query}"`);
    
    try {
      // Perform semantic search
      console.log('  🔍 Performing semantic search...');
      const searchResults = await searchService.searchContent({
        query: testCase.query,
        k: 5
      });

      if (!searchResults.items || searchResults.items.length === 0) {
        console.log('  ❌ No search results found');
        continue;
      }

      console.log(`  📊 Found ${searchResults.items.length} results`);
      
      // Check if we found the expected project
      const projectMatch = searchResults.items.find((result: any) => 
        result.project && result.project.includes(testCase.expectedProject)
      );

      if (!projectMatch) {
        console.log(`  ❌ Expected project "${testCase.expectedProject}" not found in results`);
        console.log('  📋 Found projects:', searchResults.items.map((r: any) => r.project).slice(0, 3));
        continue;
      }

      console.log(`  ✅ Found expected project: ${projectMatch.project}`);
      console.log(`  📍 Section: ${projectMatch.title} (relevance: ${projectMatch.score.toFixed(3)})`);
      console.log(`  📝 Section ID: ${projectMatch.navTarget?.sectionId || 'N/A'}`);
      console.log(`  🎯 Why relevant: ${projectMatch.why}`);

      // Check if title or description contains expected keywords
      const searchableText = `${projectMatch.title} ${projectMatch.oneLiner} ${projectMatch.why}`.toLowerCase();
      const matchedKeywords = testCase.expectedKeywords.filter(keyword => 
        searchableText.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        console.log(`  🎯 Matched keywords: ${matchedKeywords.join(', ')}`);
        successCount++;
      } else {
        console.log(`  ⚠️  No expected keywords found in searchable text`);
        console.log(`  🔍 Expected: ${testCase.expectedKeywords.join(', ')}`);
        console.log(`  📝 Searchable text: ${searchableText}`);
      }

      // Show top 3 results for context
      console.log('  📋 Top results:');
      searchResults.items.slice(0, 3).forEach((result: any, idx: number) => {
        console.log(`     ${idx + 1}. ${result.project} -> ${result.title} (${result.score.toFixed(3)})`);
      });

    } catch (error) {
      console.log(`  ❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(''); // Empty line between tests
  }

  // Summary
  console.log('=' .repeat(60));
  console.log(`📊 Semantic Search Test Results:`);
  console.log(`   ✅ Successful: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
  console.log(`   ❌ Failed: ${totalTests - successCount}/${totalTests}`);
  
  if (successCount === totalTests) {
    console.log('🎉 All search tests passed! The semantic search is working correctly.');
  } else if (successCount > totalTests * 0.7) {
    console.log('⚠️  Most tests passed, but some queries need refinement.');
  } else {
    console.log('🚨 Multiple search issues detected. Content indexing may need attention.');
  }

  // Additional diagnostic information
  console.log('\n🔧 Diagnostic Information:');
  
  try {
    // Test basic search functionality
    const basicSearch = await searchService.searchContent({ query: "portfolio website", k: 3 });
    console.log(`   📊 Basic search test: ${basicSearch.items.length} results found`);
    
    // Test content availability for each project
    const allProjects = ['portfolio-website', 'task-management-app', 'e-commerce-platform'];
    for (const project of allProjects) {
      const projectSearch = await searchService.searchContent({ query: project, k: 1 });
      if (projectSearch.items.length > 0) {
        console.log(`   📁 Project "${project}": ✅ Found (${(projectSearch.items[0] as any).title})`);
      } else {
        console.log(`   📁 Project "${project}": ❌ Missing`);
      }
    }

    // Test section-specific searches
    const sectionTests = [
      { term: "technical architecture", expected: "architecture" },
      { term: "business impact", expected: "impact" },
      { term: "performance optimization", expected: "performance" },
      { term: "security implementation", expected: "security" }
    ];

    console.log('\n   🎯 Section-specific search tests:');
    for (const sectionTest of sectionTests) {
      const sectionSearch = await searchService.searchContent({ query: sectionTest.term, k: 3 });
      const hasRelevantResults = sectionSearch.items.some((result: any) => 
        result.title?.toLowerCase().includes(sectionTest.expected) ||
        result.oneLiner?.toLowerCase().includes(sectionTest.expected) ||
        result.why?.toLowerCase().includes(sectionTest.expected)
      );
      console.log(`      "${sectionTest.term}": ${hasRelevantResults ? '✅' : '❌'} (${sectionSearch.items.length} results)`);
    }
    
  } catch (error) {
    console.log(`   ❌ Diagnostic error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n🎯 Next Steps for Voice Integration:');
  console.log('   1. If search tests are passing, the voice agent should be able to:');
  console.log('      - Find relevant content sections based on natural language queries');
  console.log('      - Identify the correct project and section to navigate to');
  console.log('      - Provide context about what was found');
  console.log('   2. Voice commands to test:');
  console.log('      "Show me the impact of the portfolio website project"');
  console.log('      "Navigate to the technical architecture in the task management app"');
  console.log('      "Take me to the business results of the e-commerce platform"');
  console.log('   3. The UI navigation tools will handle:');
  console.log('      - Opening the correct project modal');
  console.log('      - Scrolling to the identified section');
  console.log('      - Highlighting the relevant content');
}

// Run the test
testSemanticSearchNavigation().catch(console.error);