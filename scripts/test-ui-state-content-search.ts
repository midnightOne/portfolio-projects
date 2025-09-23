#!/usr/bin/env tsx

/**
 * Test script for UI State-aware Content Search and Get tools
 * 
 * This script tests the enhanced content.search and content.get tools
 * with UI state context awareness, stateless caching, and navigation target generation.
 */

import { BackendToolService } from '../src/lib/ai/tools/BackendToolService';
import { UIState } from '../src/lib/ai/tools/types';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

class UIStateContentSearchTester {
  private backendService: BackendToolService;
  private results: TestResult[] = [];

  constructor() {
    this.backendService = BackendToolService.getInstance();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting UI State-aware Content Search Tests\n');

    const tests = [
      () => this.testBasicContentSearchWithUIState(),
      () => this.testUIStateAwareRanking(),
      () => this.testContentGetWithNavigationTargets(),
      () => this.testRequestScopedCaching(),
      () => this.testUIStateEnhancedFiltering(),
      () => this.testErrorHandlingWithUIContext(),
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error(`Test failed: ${error}`);
      }
    }

    this.printResults();
  }

  private async testBasicContentSearchWithUIState(): Promise<void> {
    const testName = 'Basic Content Search with UI State';
    const startTime = Date.now();

    try {
      const uiState: UIState = {
        breadcrumbPath: 'home.projects.aurora-avatar',
        visibleAnchors: ['technical-details', 'implementation'],
        currentRoute: 'projects',
        currentProject: 'aurora-avatar',
        activeFilters: {
          tags: ['frontend', 'react'],
          techStack: ['React', 'TypeScript']
        },
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const result = await this.backendService.executeTool(
        'content_search',
        {
          query: 'avatar system implementation',
          uiState,
          k: 5,
          maxTier: 3
        },
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiState
      );

      if (result.success && result.data?.items?.length > 0) {
        const hasUIContext = result.data.searchMetadata?.uiStateEnhanced === true;
        const hasNavigationTargets = result.data.items.every((item: any) => item.navTarget);
        
        this.results.push({
          name: testName,
          success: hasUIContext && hasNavigationTargets,
          duration: Date.now() - startTime,
          data: {
            itemCount: result.data.items.length,
            uiStateEnhanced: hasUIContext,
            navigationTargetsPresent: hasNavigationTargets,
            uiContext: result.data.searchMetadata?.uiContext,
            sampleNavTarget: result.data.items[0]?.navTarget
          }
        });
      } else {
        throw new Error('No search results returned');
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

  private async testUIStateAwareRanking(): Promise<void> {
    const testName = 'UI State-aware Result Ranking';
    const startTime = Date.now();

    try {
      // Test with current project context
      const uiStateWithProject: UIState = {
        breadcrumbPath: 'home.projects.e-commerce-platform',
        currentRoute: 'projects',
        currentProject: 'e-commerce-platform',
        visibleAnchors: ['shopping-cart', 'payment-system'],
        activeFilters: {
          tags: ['ecommerce', 'backend']
        },
        lastUserAction: {
          type: 'scroll',
          timestamp: Date.now()
        }
      };

      const resultWithProject = await this.backendService.executeTool(
        'content_search',
        {
          query: 'shopping cart implementation',
          uiState: uiStateWithProject,
          k: 5
        },
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiStateWithProject
      );

      // Test without project context
      const uiStateWithoutProject: UIState = {
        breadcrumbPath: 'home',
        currentRoute: 'home',
        visibleAnchors: [],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const resultWithoutProject = await this.backendService.executeTool(
        'content_search',
        {
          query: 'shopping cart implementation',
          uiState: uiStateWithoutProject,
          k: 5
        },
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiStateWithoutProject
      );

      if (resultWithProject.success && resultWithoutProject.success) {
        const projectResults = resultWithProject.data?.items || [];
        const generalResults = resultWithoutProject.data?.items || [];
        
        // Check if project-specific results are ranked higher when in project context
        const hasProjectBoost = projectResults.some((item: any) => 
          item.project === 'e-commerce-platform' && item.score > 0.5
        );

        this.results.push({
          name: testName,
          success: hasProjectBoost,
          duration: Date.now() - startTime,
          data: {
            projectResultsCount: projectResults.length,
            generalResultsCount: generalResults.length,
            projectBoostDetected: hasProjectBoost,
            topProjectResult: projectResults[0]?.project,
            topProjectScore: projectResults[0]?.score
          }
        });
      } else {
        throw new Error('Failed to get ranking comparison results');
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
    const testName = 'Content Get with Navigation Targets';
    const startTime = Date.now();

    try {
      // First get some content IDs from search
      const searchResult = await this.backendService.executeTool(
        'content_search',
        {
          query: 'portfolio project',
          k: 3
        },
        'test-session',
        'premium'
      );

      if (!searchResult.success || !searchResult.data?.items?.length) {
        throw new Error('No content IDs available for testing');
      }

      const contentIds = searchResult.data.items.slice(0, 2).map((item: any) => item.id);

      const uiState: UIState = {
        breadcrumbPath: 'home.projects',
        currentRoute: 'projects',
        visibleAnchors: ['overview'],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const result = await this.backendService.executeTool(
        'content_get',
        {
          ids: contentIds,
          uiState,
          maxTokens: 500
        },
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiState
      );

      if (result.success && result.data?.items?.length > 0) {
        const hasNavigationTargets = result.data.items.every((item: any) => item.navTarget);
        const hasUIContext = result.data.uiStateContext !== undefined;
        
        this.results.push({
          name: testName,
          success: hasNavigationTargets && hasUIContext,
          duration: Date.now() - startTime,
          data: {
            itemCount: result.data.items.length,
            navigationTargetsPresent: hasNavigationTargets,
            uiContextPresent: hasUIContext,
            uiContext: result.data.uiStateContext,
            sampleNavTarget: result.data.items[0]?.navTarget
          }
        });
      } else {
        throw new Error('No content items returned');
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

  private async testRequestScopedCaching(): Promise<void> {
    const testName = 'Request-scoped Caching';
    const startTime = Date.now();

    try {
      const uiState: UIState = {
        breadcrumbPath: 'home.projects',
        currentRoute: 'projects',
        visibleAnchors: [],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      const searchParams = {
        query: 'test caching query',
        uiState,
        k: 3
      };

      // First request
      const firstResult = await this.backendService.executeTool(
        'content_search',
        searchParams,
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiState
      );

      const firstTime = Date.now() - startTime;

      // Second identical request (should be cached)
      const secondStartTime = Date.now();
      const secondResult = await this.backendService.executeTool(
        'content_search',
        searchParams,
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiState
      );

      const secondTime = Date.now() - secondStartTime;

      if (firstResult.success && secondResult.success) {
        // Cache hit should be significantly faster
        const cacheHitDetected = secondTime < firstTime * 0.5;
        
        this.results.push({
          name: testName,
          success: cacheHitDetected,
          duration: Date.now() - startTime,
          data: {
            firstRequestTime: firstTime,
            secondRequestTime: secondTime,
            cacheHitDetected,
            speedImprovement: `${Math.round((1 - secondTime / firstTime) * 100)}%`
          }
        });
      } else {
        throw new Error('Caching test requests failed');
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

  private async testUIStateEnhancedFiltering(): Promise<void> {
    const testName = 'UI State Enhanced Filtering';
    const startTime = Date.now();

    try {
      const uiState: UIState = {
        breadcrumbPath: 'home.projects.task-management-app',
        currentRoute: 'projects',
        currentProject: 'task-management-app',
        activeFilters: {
          tags: ['productivity', 'web'],
          techStack: ['React', 'Node.js']
        },
        visibleAnchors: ['features'],
        lastUserAction: {
          type: 'filter',
          timestamp: Date.now()
        }
      };

      const result = await this.backendService.executeTool(
        'content_search',
        {
          query: 'task management features',
          uiState,
          k: 5,
          filters: {
            tags: ['frontend'] // This should be merged with UI state tags
          }
        },
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiState
      );

      if (result.success && result.data?.searchMetadata?.uiStateEnhanced) {
        const hasEnhancedFiltering = result.data.searchMetadata.uiStateEnhanced === true;
        
        this.results.push({
          name: testName,
          success: hasEnhancedFiltering,
          duration: Date.now() - startTime,
          data: {
            itemCount: result.data.items.length,
            uiStateEnhanced: hasEnhancedFiltering,
            uiContext: result.data.searchMetadata.uiContext,
            originalResults: result.data.searchMetadata.originalResults,
            rankedResults: result.data.searchMetadata.rankedResults
          }
        });
      } else {
        throw new Error('UI state enhanced filtering not detected');
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
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      };

      // Test with invalid content IDs
      const result = await this.backendService.executeTool(
        'content_get',
        {
          ids: ['invalid-id-1', 'invalid-id-2'],
          uiState,
          maxTokens: 500
        },
        'test-session',
        'premium',
        'test-reflink',
        'test-user',
        uiState
      );

      // Should succeed but return empty results
      const hasGracefulHandling = result.success && result.data?.items?.length === 0;
      
      this.results.push({
        name: testName,
        success: hasGracefulHandling,
        duration: Date.now() - startTime,
        data: {
          gracefulHandling: hasGracefulHandling,
          resultSuccess: result.success,
          itemCount: result.data?.items?.length || 0,
          hasUIContext: result.data?.uiStateContext !== undefined
        }
      });
    } catch (error) {
      // Error handling should be graceful, so this is actually a failure
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 UI State-aware Content Search Test Results\n');
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
      
      if (result.success && result.data) {
        console.log(`   ${this.formatSuccessMessage(result.name, result.data)}`);
        if (result.data && typeof result.data === 'object') {
          console.log(`   Data: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
        }
      } else if (result.error) {
        console.log(`   Error: ${result.error}`);
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
      console.log('🎉 All tests passed! UI State-aware content search is working correctly.\n');
    } else {
      console.log(`⚠️  ${failed} test(s) failed. Please review the implementation.\n`);
    }
  }

  private formatSuccessMessage(testName: string, data: any): string {
    switch (testName) {
      case 'Basic Content Search with UI State':
        return `Found ${data.itemCount} results with UI state enhancement and navigation targets`;
      case 'UI State-aware Result Ranking':
        return `Project boost detected: ${data.projectBoostDetected}, top score: ${data.topProjectScore?.toFixed(2)}`;
      case 'Content Get with Navigation Targets':
        return `Retrieved ${data.itemCount} items with navigation targets and UI context`;
      case 'Request-scoped Caching':
        return `Cache hit detected with ${data.speedImprovement} speed improvement`;
      case 'UI State Enhanced Filtering':
        return `Enhanced filtering applied with ${data.rankedResults} ranked results`;
      case 'Error Handling with UI Context':
        return `Graceful error handling with UI context preservation`;
      default:
        return 'Test completed successfully';
    }
  }
}

async function main() {
  const tester = new UIStateContentSearchTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}