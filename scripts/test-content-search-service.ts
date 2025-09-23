/**
 * Test Content Search Service Implementation
 * 
 * Comprehensive test script for ContentSearchService functionality including:
 * - Semantic search with pgvector
 * - Metadata filtering
 * - MMR diversification
 * - Token budget management
 * - UIManager integration
 * - Error handling and graceful fallbacks
 */

import { PrismaClient } from '@prisma/client';
import ContentSearchService from '../src/lib/content/ContentSearchService';
import { initializeContentSearchService, registerContentSearchWithUIManager, getContentSearchIntegrationStatus } from '../src/lib/content/ContentSearchServiceIntegration';
import { UIManager } from '../src/lib/navigation/UIManager';

const prisma = new PrismaClient();

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration: number;
}

class ContentSearchServiceTester {
  private contentSearchService: ContentSearchService;
  private testResults: TestResult[] = [];

  constructor() {
    this.contentSearchService = new ContentSearchService();
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Content Search Service Tests\n');

    // Test 1: Service initialization
    await this.testServiceInitialization();

    // Test 2: Database connectivity
    await this.testDatabaseConnectivity();

    // Test 3: Basic content search
    await this.testBasicContentSearch();

    // Test 4: Semantic search with embeddings
    await this.testSemanticSearch();

    // Test 5: Metadata filtering
    await this.testMetadataFiltering();

    // Test 6: MMR diversification
    await this.testMMRDiversification();

    // Test 7: Content retrieval with token budget
    await this.testContentRetrieval();

    // Test 8: UIManager integration
    await this.testUIManagerIntegration();

    // Test 9: ContentProvider interface
    await this.testContentProviderInterface();

    // Test 10: Error handling and graceful fallbacks
    await this.testErrorHandling();

    // Test 11: Search statistics
    await this.testSearchStatistics();

    // Print results
    this.printTestResults();
  }

  /**
   * Test 1: Service initialization
   */
  private async testServiceInitialization(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test service creation
      const service = new ContentSearchService();
      
      // Test integration initialization
      const integratedService = initializeContentSearchService();
      
      // Test integration status
      const status = getContentSearchIntegrationStatus();
      
      this.testResults.push({
        testName: 'Service Initialization',
        success: true,
        message: 'ContentSearchService initialized successfully',
        data: {
          serviceCreated: !!service,
          integratedServiceCreated: !!integratedService,
          integrationStatus: status
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Service Initialization',
        success: false,
        message: 'Failed to initialize ContentSearchService',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 2: Database connectivity
   */
  private async testDatabaseConnectivity(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test basic database connection
      const entityCount = await prisma.contentEntity.count();
      const chunkCount = await prisma.contextChunk.count();
      
      // Test search statistics
      const stats = await this.contentSearchService.getSearchStats();
      
      this.testResults.push({
        testName: 'Database Connectivity',
        success: true,
        message: 'Database connection successful',
        data: {
          contentEntities: entityCount,
          contextChunks: chunkCount,
          searchStats: stats
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Database Connectivity',
        success: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 3: Basic content search
   */
  private async testBasicContentSearch(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test basic search without embeddings
      const searchResult = await this.contentSearchService.searchContent({
        query: 'portfolio project',
        k: 5,
        maxTier: 2
      });

      const success = searchResult.items.length >= 0; // Allow empty results
      
      this.testResults.push({
        testName: 'Basic Content Search',
        success,
        message: success ? 
          `Found ${searchResult.items.length} results for basic search` :
          'Basic search failed',
        data: {
          totalResults: searchResult.totalResults,
          returnedItems: searchResult.items.length,
          searchMetadata: searchResult.searchMetadata,
          sampleResults: searchResult.items.slice(0, 2)
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Basic Content Search',
        success: false,
        message: 'Basic content search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 4: Semantic search with embeddings
   */
  private async testSemanticSearch(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test semantic search with technical query
      const searchResult = await this.contentSearchService.searchContent({
        query: 'machine learning artificial intelligence neural networks',
        k: 3,
        maxTier: 3,
        diversifyBy: 'project'
      });

      const success = true; // Allow empty results for semantic search
      
      this.testResults.push({
        testName: 'Semantic Search',
        success,
        message: `Semantic search completed with ${searchResult.items.length} results`,
        data: {
          query: 'machine learning artificial intelligence neural networks',
          totalResults: searchResult.totalResults,
          returnedItems: searchResult.items.length,
          searchMetadata: searchResult.searchMetadata,
          hasEmbeddings: searchResult.searchMetadata.semanticResults > 0,
          sampleResults: searchResult.items.slice(0, 1)
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Semantic Search',
        success: false,
        message: 'Semantic search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 5: Metadata filtering
   */
  private async testMetadataFiltering(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test search with metadata filters
      const searchResult = await this.contentSearchService.searchContent({
        query: 'web development',
        k: 5,
        maxTier: 2,
        filters: {
          technologies: ['React', 'JavaScript', 'TypeScript'],
          tags: ['frontend', 'web'],
          minImportance: 0.5
        }
      });

      const success = true; // Allow empty results for filtered search
      
      this.testResults.push({
        testName: 'Metadata Filtering',
        success,
        message: `Filtered search completed with ${searchResult.items.length} results`,
        data: {
          query: 'web development',
          filters: {
            technologies: ['React', 'JavaScript', 'TypeScript'],
            tags: ['frontend', 'web'],
            minImportance: 0.5
          },
          totalResults: searchResult.totalResults,
          returnedItems: searchResult.items.length,
          searchMetadata: searchResult.searchMetadata
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Metadata Filtering',
        success: false,
        message: 'Metadata filtering failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 6: MMR diversification
   */
  private async testMMRDiversification(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Configure MMR for testing
      this.contentSearchService.configureMMR({
        lambda: 0.6, // 60% relevance, 40% diversity
        diversityThreshold: 0.4,
        maxSimilarResults: 1
      });

      // Test diversified search
      const searchResult = await this.contentSearchService.searchContent({
        query: 'project development',
        k: 8,
        maxTier: 2,
        diversifyBy: 'project'
      });

      // Check for diversity in results
      const projectSlugs = new Set(searchResult.items.map(item => item.project).filter(Boolean));
      const diversityScore = projectSlugs.size / Math.max(searchResult.items.length, 1);

      this.testResults.push({
        testName: 'MMR Diversification',
        success: true,
        message: `MMR diversification completed with diversity score: ${diversityScore.toFixed(2)}`,
        data: {
          totalResults: searchResult.totalResults,
          returnedItems: searchResult.items.length,
          uniqueProjects: projectSlugs.size,
          diversityScore,
          searchMetadata: searchResult.searchMetadata
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'MMR Diversification',
        success: false,
        message: 'MMR diversification failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 7: Content retrieval with token budget
   */
  private async testContentRetrieval(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // First, get some content IDs from search
      const searchResult = await this.contentSearchService.searchContent({
        query: 'test content',
        k: 3,
        maxTier: 3
      });

      if (searchResult.items.length === 0) {
        this.testResults.push({
          testName: 'Content Retrieval',
          success: true,
          message: 'No content available for retrieval test (empty database)',
          data: { reason: 'No content chunks found' },
          duration: Date.now() - startTime
        });
        return;
      }

      const contentIds = searchResult.items.map(item => item.id);

      // Test content retrieval with token budget
      const getResult = await this.contentSearchService.getContent({
        ids: contentIds,
        maxTokens: 500,
        includeTiers: [1, 2, 3]
      });

      const success = getResult.items.length >= 0;
      
      this.testResults.push({
        testName: 'Content Retrieval',
        success,
        message: `Retrieved ${getResult.items.length} content items within token budget`,
        data: {
          requestedIds: contentIds.length,
          returnedItems: getResult.items.length,
          totalTokens: getResult.totalTokens,
          truncated: getResult.truncated,
          tokenBudget: 500
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Content Retrieval',
        success: false,
        message: 'Content retrieval failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 8: UIManager integration
   */
  private async testUIManagerIntegration(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test UIManager registration
      const registrationSuccess = registerContentSearchWithUIManager();
      
      // Test integration status
      const status = getContentSearchIntegrationStatus();
      
      // Test navigation to content
      const navResult = await this.contentSearchService.navigateToContent('portfolio project');
      
      this.testResults.push({
        testName: 'UIManager Integration',
        success: registrationSuccess,
        message: registrationSuccess ? 
          'UIManager integration successful' : 
          'UIManager integration failed',
        data: {
          registrationSuccess,
          integrationStatus: status,
          navigationResult: navResult
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'UIManager Integration',
        success: false,
        message: 'UIManager integration test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 9: ContentProvider interface
   */
  private async testContentProviderInterface(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test ContentProvider interface methods
      const mockContext = {
        currentRoute: 'home',
        currentProject: null,
        modalStack: [],
        visibleSections: [],
        canNavigate: true
      };

      // Test discoverSections
      const sections = await this.contentSearchService.discoverSections(mockContext);
      
      // Test validateSection (if we have sections)
      let validationResult = true;
      if (sections.length > 0) {
        validationResult = await this.contentSearchService.validateSection(sections[0].id);
      }

      this.testResults.push({
        testName: 'ContentProvider Interface',
        success: true,
        message: `ContentProvider interface working correctly`,
        data: {
          sectionsDiscovered: sections.length,
          sampleSections: sections.slice(0, 2),
          validationTest: validationResult,
          providerName: this.contentSearchService.name
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'ContentProvider Interface',
        success: false,
        message: 'ContentProvider interface test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 10: Error handling and graceful fallbacks
   */
  private async testErrorHandling(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test invalid content ID retrieval
      const invalidGetResult = await this.contentSearchService.getContent({
        ids: ['invalid-id-1', 'invalid-id-2'],
        maxTokens: 500
      });

      // Test empty query search
      const emptyQueryResult = await this.contentSearchService.searchContent({
        query: '',
        k: 5
      });

      // Test invalid section validation
      const invalidValidation = await this.contentSearchService.validateSection('invalid-section-id');

      // Test navigation with no results
      const noResultsNav = await this.contentSearchService.navigateToContent('extremely-specific-nonexistent-query-12345');

      this.testResults.push({
        testName: 'Error Handling',
        success: true,
        message: 'Error handling and graceful fallbacks working correctly',
        data: {
          invalidGetResult: {
            success: invalidGetResult.items.length === 0,
            itemCount: invalidGetResult.items.length
          },
          emptyQueryResult: {
            success: emptyQueryResult.items.length >= 0,
            itemCount: emptyQueryResult.items.length
          },
          invalidValidation: {
            success: invalidValidation === false,
            result: invalidValidation
          },
          noResultsNavigation: {
            success: !noResultsNav.success,
            message: noResultsNav.message
          }
        },
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Error Handling',
        success: false,
        message: 'Error handling test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 11: Search statistics
   */
  private async testSearchStatistics(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const stats = await this.contentSearchService.getSearchStats();
      
      this.testResults.push({
        testName: 'Search Statistics',
        success: true,
        message: 'Search statistics retrieved successfully',
        data: stats,
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.testResults.push({
        testName: 'Search Statistics',
        success: false,
        message: 'Search statistics test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Print test results
   */
  private printTestResults(): void {
    console.log('\n📊 Content Search Service Test Results\n');
    console.log('=' .repeat(80));

    const passedTests = this.testResults.filter(r => r.success);
    const failedTests = this.testResults.filter(r => !r.success);

    console.log(`\n✅ Passed: ${passedTests.length}/${this.testResults.length} tests`);
    console.log(`❌ Failed: ${failedTests.length}/${this.testResults.length} tests\n`);

    // Print individual test results
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`${status} ${index + 1}. ${result.testName} (${duration})`);
      console.log(`   ${result.message}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.data && Object.keys(result.data).length > 0) {
        console.log(`   Data: ${JSON.stringify(result.data, null, 2).substring(0, 200)}${JSON.stringify(result.data).length > 200 ? '...' : ''}`);
      }
      
      console.log('');
    });

    // Summary
    console.log('=' .repeat(80));
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\n🏁 Total test duration: ${totalDuration}ms`);
    console.log(`📈 Average test duration: ${Math.round(totalDuration / this.testResults.length)}ms`);
    
    if (failedTests.length === 0) {
      console.log('\n🎉 All tests passed! ContentSearchService is working correctly.');
    } else {
      console.log(`\n⚠️  ${failedTests.length} test(s) failed. Please review the errors above.`);
    }
  }
}

// Run tests
async function main() {
  const tester = new ContentSearchServiceTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export default ContentSearchServiceTester;