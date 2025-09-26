#!/usr/bin/env tsx

/**
 * Integration Test for UI State-aware Content Search Tools
 * 
 * This script tests the complete integration flow:
 * 1. API endpoint accepts UI state
 * 2. BackendToolService processes UI state context
 * 3. Content search/get tools use UI state for ranking and navigation
 * 4. Results include proper navigation targets and context awareness
 */

import { UIState } from '../src/lib/ai/tools/types';

interface IntegrationTestResult {
  name: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
  details?: string;
}

class UIStateToolsIntegrationTester {
  private results: IntegrationTestResult[] = [];
  private baseUrl = 'http://localhost:3000';

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting UI State Tools Integration Tests\n');

    // Check if server is running
    const serverRunning = await this.checkServerHealth();
    if (!serverRunning) {
      console.log('❌ Server not running. Please start the development server first:');
      console.log('   npm run dev\n');
      return;
    }

    const tests = [
      () => this.testAPIEndpointAcceptsUIState(),
      () => this.testContentSearchWithUIStateRanking(),
      () => this.testContentGetWithNavigationTargets(),
      () => this.testUIStateContextAwareness(),
      () => this.testCachingBehavior(),
      () => this.testErrorHandlingWithUIContext(),
      () => this.testToolDefinitionsIncludeUIState(),
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error(`Integration test failed: ${error}`);
      }
    }

    this.printResults();
  }

  private async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async testAPIEndpointAcceptsUIState(): Promise<void> {
    const testName = 'API Endpoint Accepts UI State';
    const startTime = Date.now();

    try {
      const uiState: UIState = {
        breadcrumbPath: 'home.projects.test-project',
        visibleAnchors: ['overview', 'features'],
        currentRoute: 'projects',
        currentProject: 'test-project',
        activeFilters: {
          tags: ['web', 'frontend'],
          techStack: ['React', 'TypeScript']
        },
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const requestBody = {
        toolName: 'content_search',
        parameters: {
          query: 'test integration',
          uiState,
          k: 3
        },
        sessionId: 'integration-test',
        uiState // Also pass at top level
      };

      const response = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.results.push({
          name: testName,
          success: true,
          duration: Date.now() - startTime,
          data: {
            statusCode: response.status,
            hasUIStateEnhancement: result.data?.searchMetadata?.uiStateEnhanced === true,
            uiContext: result.data?.searchMetadata?.uiContext,
            executionTime: result.metadata?.executionTime
          },
          details: 'API successfully accepted UI state and processed content search'
        });
      } else {
        throw new Error(`API request failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testContentSearchWithUIStateRanking(): Promise<void> {
    const testName = 'Content Search UI State Ranking';
    const startTime = Date.now();

    try {
      // Test 1: Search with project context
      const projectUIState: UIState = {
        breadcrumbPath: 'home.projects.e-commerce-platform',
        currentRoute: 'projects',
        currentProject: 'e-commerce-platform',
        visibleAnchors: ['shopping-cart'],
        activeFilters: {
          tags: ['ecommerce']
        },
        lastUserAction: {
          type: 'scroll',
          timestamp: Date.now()
        }
      };

      const projectSearchResponse = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'content_search',
          parameters: {
            query: 'shopping cart',
            uiState: projectUIState,
            k: 5
          },
          sessionId: 'integration-test',
          uiState: projectUIState
        })
      });

      // Test 2: Same search without project context
      const generalUIState: UIState = {
        breadcrumbPath: 'home',
        currentRoute: 'home',
        visibleAnchors: [],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const generalSearchResponse = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'content_search',
          parameters: {
            query: 'shopping cart',
            uiState: generalUIState,
            k: 5
          },
          sessionId: 'integration-test',
          uiState: generalUIState
        })
      });

      const projectResult = await projectSearchResponse.json();
      const generalResult = await generalSearchResponse.json();

      if (projectResult.success && generalResult.success) {
        const projectItems = projectResult.data?.items || [];
        const generalItems = generalResult.data?.items || [];
        
        // Check if project-specific search has different ranking
        const hasContextualRanking = projectResult.data?.searchMetadata?.uiStateEnhanced === true;
        const hasDifferentResults = JSON.stringify(projectItems) !== JSON.stringify(generalItems);

        this.results.push({
          name: testName,
          success: hasContextualRanking,
          duration: Date.now() - startTime,
          data: {
            projectResultsCount: projectItems.length,
            generalResultsCount: generalItems.length,
            contextualRankingApplied: hasContextualRanking,
            resultsDiffer: hasDifferentResults,
            projectContext: projectResult.data?.searchMetadata?.uiContext,
            generalContext: generalResult.data?.searchMetadata?.uiContext
          },
          details: hasContextualRanking ? 
            'UI state-aware ranking successfully applied' : 
            'UI state ranking not detected'
        });
      } else {
        throw new Error('One or both search requests failed');
      }
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testContentGetWithNavigationTargets(): Promise<void> {
    const testName = 'Content Get Navigation Targets';
    const startTime = Date.now();

    try {
      // First get some content IDs
      const searchResponse = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'content_search',
          parameters: {
            query: 'portfolio',
            k: 2
          },
          sessionId: 'integration-test'
        })
      });

      const searchResult = await searchResponse.json();
      if (!searchResult.success || !searchResult.data?.items?.length) {
        throw new Error('Could not get content IDs for testing');
      }

      const contentIds = searchResult.data.items.slice(0, 2).map((item: any) => item.id);

      // Test content get with UI state
      const uiState: UIState = {
        breadcrumbPath: 'home.projects.portfolio-website',
        currentRoute: 'projects',
        currentProject: 'portfolio-website',
        visibleAnchors: ['about', 'skills'],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const getResponse = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'content_get',
          parameters: {
            ids: contentIds,
            uiState,
            maxTokens: 500
          },
          sessionId: 'integration-test',
          uiState
        })
      });

      const getResult = await getResponse.json();

      if (getResult.success && getResult.data?.items?.length > 0) {
        const hasNavigationTargets = getResult.data.items.every((item: any) => 
          item.navTarget && typeof item.navTarget === 'object'
        );
        const hasUIContext = getResult.data.uiStateContext !== undefined;

        this.results.push({
          name: testName,
          success: hasNavigationTargets && hasUIContext,
          duration: Date.now() - startTime,
          data: {
            itemCount: getResult.data.items.length,
            navigationTargetsPresent: hasNavigationTargets,
            uiContextPresent: hasUIContext,
            sampleNavTarget: getResult.data.items[0]?.navTarget,
            uiContext: getResult.data.uiStateContext
          },
          details: hasNavigationTargets && hasUIContext ? 
            'Navigation targets and UI context successfully generated' :
            'Missing navigation targets or UI context'
        });
      } else {
        throw new Error('Content get request failed or returned no items');
      }
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testUIStateContextAwareness(): Promise<void> {
    const testName = 'UI State Context Awareness';
    const startTime = Date.now();

    try {
      const scenarios = [
        {
          name: 'Home Route Context',
          uiState: {
            breadcrumbPath: 'home',
            currentRoute: 'home',
            visibleAnchors: ['hero', 'about'],
            lastUserAction: { type: 'navigate' as const, timestamp: Date.now() }
          }
        },
        {
          name: 'Project Route Context',
          uiState: {
            breadcrumbPath: 'home.projects.task-management-app',
            currentRoute: 'projects',
            currentProject: 'task-management-app',
            visibleAnchors: ['features', 'tech-stack'],
            activeFilters: { tags: ['productivity'], techStack: ['React'] },
            lastUserAction: { type: 'filter' as const, timestamp: Date.now() }
          }
        }
      ];

      const results = [];
      for (const scenario of scenarios) {
        const response = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: 'content_search',
            parameters: {
              query: 'features and functionality',
              uiState: scenario.uiState,
              k: 3
            },
            sessionId: 'integration-test',
            uiState: scenario.uiState
          })
        });

        const result = await response.json();
        results.push({
          scenario: scenario.name,
          success: result.success,
          uiStateEnhanced: result.data?.searchMetadata?.uiStateEnhanced,
          uiContext: result.data?.searchMetadata?.uiContext
        });
      }

      const allSuccessful = results.every(r => r.success && r.uiStateEnhanced);

      this.results.push({
        name: testName,
        success: allSuccessful,
        duration: Date.now() - startTime,
        data: {
          scenarios: results,
          contextAwarenessWorking: allSuccessful
        },
        details: allSuccessful ? 
          'UI state context awareness working across all scenarios' :
          'Some scenarios failed context awareness test'
      });
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testCachingBehavior(): Promise<void> {
    const testName = 'Request-scoped Caching';
    const startTime = Date.now();

    try {
      const uiState: UIState = {
        breadcrumbPath: 'home.projects',
        currentRoute: 'projects',
        visibleAnchors: [],
        lastUserAction: { type: 'navigate', timestamp: Date.now() }
      };

      const searchParams = {
        toolName: 'content_search',
        parameters: {
          query: 'caching test query unique',
          uiState,
          k: 3
        },
        sessionId: 'integration-test',
        uiState
      };

      // First request
      const firstStart = Date.now();
      const firstResponse = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
      });
      const firstDuration = Date.now() - firstStart;
      const firstResult = await firstResponse.json();

      // Second identical request (should hit cache)
      const secondStart = Date.now();
      const secondResponse = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
      });
      const secondDuration = Date.now() - secondStart;
      const secondResult = await secondResponse.json();

      if (firstResult.success && secondResult.success) {
        // Cache hit should be significantly faster
        const speedImprovement = (firstDuration - secondDuration) / firstDuration;
        const cacheHitDetected = speedImprovement > 0.3; // At least 30% faster

        this.results.push({
          name: testName,
          success: cacheHitDetected,
          duration: Date.now() - startTime,
          data: {
            firstRequestTime: firstDuration,
            secondRequestTime: secondDuration,
            speedImprovement: `${Math.round(speedImprovement * 100)}%`,
            cacheHitDetected,
            resultsIdentical: JSON.stringify(firstResult.data) === JSON.stringify(secondResult.data)
          },
          details: cacheHitDetected ? 
            `Caching working with ${Math.round(speedImprovement * 100)}% speed improvement` :
            'Caching not detected or insufficient speed improvement'
        });
      } else {
        throw new Error('One or both caching test requests failed');
      }
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testErrorHandlingWithUIContext(): Promise<void> {
    const testName = 'Error Handling with UI Context';
    const startTime = Date.now();

    try {
      const uiState: UIState = {
        breadcrumbPath: 'home.projects.invalid-project',
        currentRoute: 'projects',
        currentProject: 'invalid-project',
        visibleAnchors: [],
        lastUserAction: { type: 'navigate', timestamp: Date.now() }
      };

      // Test with invalid content IDs
      const response = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'content_get',
          parameters: {
            ids: ['invalid-id-1', 'invalid-id-2'],
            uiState,
            maxTokens: 500
          },
          sessionId: 'integration-test',
          uiState
        })
      });

      const result = await response.json();

      // Should succeed but return empty results gracefully
      const gracefulHandling = result.success && result.data?.items?.length === 0;
      const hasUIContext = result.data?.uiStateContext !== undefined;

      this.results.push({
        name: testName,
        success: gracefulHandling && hasUIContext,
        duration: Date.now() - startTime,
        data: {
          gracefulHandling,
          hasUIContext,
          itemCount: result.data?.items?.length || 0,
          uiContext: result.data?.uiStateContext
        },
        details: gracefulHandling && hasUIContext ? 
          'Error handling graceful with UI context preserved' :
          'Error handling or UI context preservation failed'
      });
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testToolDefinitionsIncludeUIState(): Promise<void> {
    const testName = 'Tool Definitions Include UI State';
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
        method: 'GET'
      });

      const result = await response.json();

      if (result.success && result.tools) {
        const contentSearchTool = result.tools.find((tool: any) => tool.name === 'content_search');
        const contentGetTool = result.tools.find((tool: any) => tool.name === 'content_get');

        const searchHasUIState = contentSearchTool?.parameters?.properties?.uiState !== undefined;
        const getHasUIState = contentGetTool?.parameters?.properties?.uiState !== undefined;

        this.results.push({
          name: testName,
          success: searchHasUIState && getHasUIState,
          duration: Date.now() - startTime,
          data: {
            contentSearchHasUIState: searchHasUIState,
            contentGetHasUIState: getHasUIState,
            toolCount: result.tools.length,
            contentSearchDescription: contentSearchTool?.description,
            contentGetDescription: contentGetTool?.description
          },
          details: searchHasUIState && getHasUIState ? 
            'Both tools correctly include uiState parameter in definitions' :
            'One or both tools missing uiState parameter'
        });
      } else {
        throw new Error('Failed to retrieve tool definitions');
      }
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 UI State Tools Integration Test Results\n');
    console.log('='.repeat(80));
    console.log('');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(`✅ Passed: ${passed}/${this.results.length} tests`);
    console.log(`❌ Failed: ${failed}/${this.results.length} tests\n`);

    this.results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      const duration = `(${result.duration}ms)`;
      
      console.log(`${icon} ${index + 1}. ${result.name} ${duration}`);
      
      if (result.success && result.details) {
        console.log(`   ${result.details}`);
      } else if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.data && Object.keys(result.data).length > 0) {
        const dataStr = JSON.stringify(result.data, null, 2);
        const truncatedData = dataStr.length > 300 ? 
          dataStr.substring(0, 300) + '...' : dataStr;
        console.log(`   Data: ${truncatedData}`);
      }
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('');

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = Math.round(totalDuration / this.results.length);

    console.log(`🏁 Total test duration: ${totalDuration}ms`);
    console.log(`📈 Average test duration: ${avgDuration}ms\n`);

    if (failed === 0) {
      console.log('🎉 All integration tests passed! UI State-aware tools are working correctly.\n');
      console.log('✨ Ready for agent testing. Try these questions:\n');
      this.printAgentTestQuestions();
    } else {
      console.log(`⚠️  ${failed} test(s) failed. Please review the implementation.\n`);
    }
  }

  private printAgentTestQuestions(): void {
    console.log('🤖 **Agent Test Questions:**\n');
    
    console.log('**1. Context-Aware Search:**');
    console.log('   "Search for shopping cart features while I\'m viewing the e-commerce project"');
    console.log('   (Should prioritize e-commerce project content)\n');
    
    console.log('**2. Navigation Target Generation:**');
    console.log('   "Find content about React components and show me how to navigate there"');
    console.log('   (Should return navigation targets compatible with current UI state)\n');
    
    console.log('**3. UI State Filtering:**');
    console.log('   "Search for frontend content while I have React and TypeScript filters active"');
    console.log('   (Should enhance search with active filters)\n');
    
    console.log('**4. Route Context Awareness:**');
    console.log('   "Find project documentation while I\'m on the home page vs projects page"');
    console.log('   (Should rank results differently based on current route)\n');
    
    console.log('**5. Anchor Context:**');
    console.log('   "Search for technical details while I\'m viewing the implementation section"');
    console.log('   (Should boost content matching visible anchors)\n');
    
    console.log('**6. Error Handling:**');
    console.log('   "Get content with invalid IDs while providing UI context"');
    console.log('   (Should handle gracefully with UI context preserved)\n');
  }
}

async function main() {
  const tester = new UIStateToolsIntegrationTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { UIStateToolsIntegrationTester };