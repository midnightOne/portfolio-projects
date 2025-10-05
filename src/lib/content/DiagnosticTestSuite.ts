/**
 * Diagnostic Test Suite Runner
 * 
 * Provides a comprehensive test suite for the semantic system with
 * predefined test configurations and easy-to-use runner methods.
 */

import { 
  SemanticDiagnosticService, 
  DiagnosticConfig, 
  DiagnosticReport, 
  DiagnosticTestType,
  getSemanticDiagnosticService 
} from './SemanticDiagnosticService';
import { getSemanticLogger, logger } from './SemanticLogger';

// Predefined test suites
export const TEST_SUITES = {
  // Quick health check - essential tests only
  QUICK: {
    name: 'Quick Health Check',
    description: 'Essential system health tests (< 30 seconds)',
    tests: ['system_health', 'chunk_persistence'] as DiagnosticTestType[],
    includePerformanceBenchmarks: false,
    includeSystemHealth: true,
    timeoutMs: 30000
  },

  // T3 generation focus - specifically for T3 chunk issues
  T3_FOCUS: {
    name: 'T3 Generation Diagnostic',
    description: 'Comprehensive T3 chunk generation testing',
    tests: ['t3_generation', 'chunk_persistence', 'foreign_key_validation'] as DiagnosticTestType[],
    includePerformanceBenchmarks: true,
    includeSystemHealth: false,
    timeoutMs: 120000
  },

  // SSE and queue focus - for connection and UI issues
  CONNECTION_FOCUS: {
    name: 'Connection & Queue Diagnostic',
    description: 'SSE stability and queue display testing',
    tests: ['sse_stability', 'queue_display', 'operation_lifecycle'] as DiagnosticTestType[],
    includePerformanceBenchmarks: false,
    includeSystemHealth: false,
    timeoutMs: 60000
  },

  // Full comprehensive test - all tests
  COMPREHENSIVE: {
    name: 'Comprehensive System Diagnostic',
    description: 'Complete system diagnostic with all tests',
    tests: [
      't3_generation',
      'sse_stability', 
      'queue_display',
      'chunk_persistence',
      'system_health',
      'performance_benchmark',
      'foreign_key_validation',
      'operation_lifecycle'
    ] as DiagnosticTestType[],
    includePerformanceBenchmarks: true,
    includeSystemHealth: true,
    timeoutMs: 300000
  },

  // Performance focus - benchmarking and optimization
  PERFORMANCE_FOCUS: {
    name: 'Performance Diagnostic',
    description: 'Performance benchmarking and optimization analysis',
    tests: ['performance_benchmark', 'system_health'] as DiagnosticTestType[],
    includePerformanceBenchmarks: true,
    includeSystemHealth: true,
    timeoutMs: 180000
  }
};

// Test suite result
export interface TestSuiteResult {
  suiteName: string;
  suiteDescription: string;
  report: DiagnosticReport;
  executionTime: number;
  success: boolean;
  summary: {
    overallHealth: 'healthy' | 'warning' | 'critical' | 'error';
    criticalIssuesCount: number;
    recommendationsCount: number;
    testsPassedPercent: number;
  };
}

/**
 * Diagnostic Test Suite Runner
 */
export class DiagnosticTestSuite {
  private diagnosticService: SemanticDiagnosticService;
  private logger = getSemanticLogger();

  constructor() {
    this.diagnosticService = getSemanticDiagnosticService();
  }

  /**
   * Run a predefined test suite
   */
  async runTestSuite(
    suiteName: keyof typeof TEST_SUITES,
    projectId?: string,
    verbose: boolean = false
  ): Promise<TestSuiteResult> {
    const suite = TEST_SUITES[suiteName];
    const startTime = Date.now();

    logger.info('DiagnosticTestSuite', 'runTestSuite', `Starting test suite: ${suite.name}`, {
      suiteName,
      projectId,
      testsCount: suite.tests.length,
      verbose
    });

    try {
      // Enable debug logging if verbose
      if (verbose) {
        this.logger.enableDebugMode([
          'SemanticDiagnosticService',
          'T3Generation',
          'SSEConnection',
          'ChunkPersistence',
          'QueueDisplay'
        ]);
      }

      // Configure diagnostic test
      const config: DiagnosticConfig = {
        tests: suite.tests,
        projectId,
        includePerformanceBenchmarks: suite.includePerformanceBenchmarks,
        includeSystemHealth: suite.includeSystemHealth,
        verbose,
        timeoutMs: suite.timeoutMs
      };

      // Run diagnostic suite
      const report = await this.diagnosticService.runDiagnosticSuite(config);
      const executionTime = Date.now() - startTime;

      // Generate summary
      const summary = this.generateSuiteSummary(report);

      const result: TestSuiteResult = {
        suiteName: suite.name,
        suiteDescription: suite.description,
        report,
        executionTime,
        success: summary.overallHealth !== 'error',
        summary
      };

      logger.info('DiagnosticTestSuite', 'runTestSuite', `Test suite completed: ${suite.name}`, {
        suiteName,
        executionTime,
        overallHealth: summary.overallHealth,
        testsPassedPercent: summary.testsPassedPercent,
        criticalIssues: summary.criticalIssuesCount
      });

      // Disable debug logging if it was enabled
      if (verbose) {
        this.logger.disableDebugMode();
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('DiagnosticTestSuite', 'runTestSuite', `Test suite failed: ${suite.name}`, {
        suiteName,
        executionTime,
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : undefined);

      // Disable debug logging if it was enabled
      if (verbose) {
        this.logger.disableDebugMode();
      }

      return {
        suiteName: suite.name,
        suiteDescription: suite.description,
        report: {
          reportId: `failed-${Date.now()}`,
          timestamp: new Date(),
          duration: executionTime,
          config: {
            tests: suite.tests,
            projectId,
            includePerformanceBenchmarks: suite.includePerformanceBenchmarks,
            includeSystemHealth: suite.includeSystemHealth,
            verbose
          },
          results: [],
          benchmarks: [],
          summary: {
            totalTests: 0,
            passed: 0,
            failed: 1,
            warnings: 0,
            skipped: 0,
            overallStatus: 'error',
            criticalIssues: [`Test suite execution failed: ${error instanceof Error ? error.message : String(error)}`],
            recommendations: ['Check system logs', 'Verify system connectivity']
          }
        },
        executionTime,
        success: false,
        summary: {
          overallHealth: 'error',
          criticalIssuesCount: 1,
          recommendationsCount: 2,
          testsPassedPercent: 0
        }
      };
    }
  }

  /**
   * Run custom diagnostic configuration
   */
  async runCustomDiagnostic(config: DiagnosticConfig): Promise<DiagnosticReport> {
    logger.info('DiagnosticTestSuite', 'runCustomDiagnostic', 'Starting custom diagnostic', {
      testsCount: config.tests.length,
      projectId: config.projectId,
      verbose: config.verbose
    });

    try {
      const report = await this.diagnosticService.runDiagnosticSuite(config);

      logger.info('DiagnosticTestSuite', 'runCustomDiagnostic', 'Custom diagnostic completed', {
        reportId: report.reportId,
        duration: report.duration,
        overallStatus: report.summary.overallStatus,
        testsTotal: report.summary.totalTests,
        testsPassed: report.summary.passed
      });

      return report;

    } catch (error) {
      logger.error('DiagnosticTestSuite', 'runCustomDiagnostic', 'Custom diagnostic failed', {
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : undefined);

      throw error;
    }
  }

  /**
   * Run quick system health check
   */
  async quickHealthCheck(projectId?: string): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
    executionTime: number;
  }> {
    const startTime = Date.now();

    try {
      const result = await this.runTestSuite('QUICK', projectId, false);
      
      return {
        healthy: result.summary.overallHealth === 'healthy',
        issues: result.report.summary.criticalIssues,
        recommendations: result.report.summary.recommendations.slice(0, 5), // Top 5 recommendations
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`],
        recommendations: ['Check system logs', 'Verify system connectivity', 'Restart services'],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Diagnose specific T3 generation issues
   */
  async diagnoseT3Issues(projectId?: string): Promise<{
    t3Working: boolean;
    sectionsAnalyzed: number;
    chunksGenerated: number;
    persistenceIssues: string[];
    recommendations: string[];
  }> {
    try {
      const result = await this.runTestSuite('T3_FOCUS', projectId, true);
      
      // Extract T3-specific information from results
      const t3Test = result.report.results.find(r => r.testType === 't3_generation');
      const persistenceTest = result.report.results.find(r => r.testType === 'chunk_persistence');

      const sectionsAnalyzed = t3Test?.details?.sectionAnalysis?.totalSections || 0;
      const chunksGenerated = t3Test?.details?.t3ChunksGenerated || 0;
      const persistenceIssues: string[] = [];

      if (persistenceTest?.status === 'failed') {
        persistenceIssues.push('Chunk persistence failed');
      }

      if (t3Test?.details?.persistedT3Chunks < chunksGenerated) {
        persistenceIssues.push(`Only ${t3Test.details.persistedT3Chunks}/${chunksGenerated} chunks persisted`);
      }

      return {
        t3Working: t3Test?.status === 'passed',
        sectionsAnalyzed,
        chunksGenerated,
        persistenceIssues,
        recommendations: result.report.summary.recommendations.filter(r => 
          r.toLowerCase().includes('t3') || 
          r.toLowerCase().includes('chunk') || 
          r.toLowerCase().includes('section')
        )
      };

    } catch (error) {
      return {
        t3Working: false,
        sectionsAnalyzed: 0,
        chunksGenerated: 0,
        persistenceIssues: [`T3 diagnosis failed: ${error instanceof Error ? error.message : String(error)}`],
        recommendations: ['Check T3 generation implementation', 'Verify section filtering logic']
      };
    }
  }

  /**
   * Diagnose SSE and queue issues
   */
  async diagnoseConnectionIssues(): Promise<{
    sseWorking: boolean;
    queueWorking: boolean;
    connectionErrors: number;
    operationPersistence: boolean;
    recommendations: string[];
  }> {
    try {
      const result = await this.runTestSuite('CONNECTION_FOCUS', undefined, true);
      
      const sseTest = result.report.results.find(r => r.testType === 'sse_stability');
      const queueTest = result.report.results.find(r => r.testType === 'queue_display');
      const lifecycleTest = result.report.results.find(r => r.testType === 'operation_lifecycle');

      return {
        sseWorking: sseTest?.status === 'passed',
        queueWorking: queueTest?.status === 'passed',
        connectionErrors: sseTest?.details?.monitoringResults?.connectionErrors || 0,
        operationPersistence: lifecycleTest?.details?.persistenceTest?.status === 'passed',
        recommendations: result.report.summary.recommendations.filter(r => 
          r.toLowerCase().includes('sse') || 
          r.toLowerCase().includes('queue') || 
          r.toLowerCase().includes('connection') ||
          r.toLowerCase().includes('operation')
        )
      };

    } catch (error) {
      return {
        sseWorking: false,
        queueWorking: false,
        connectionErrors: 999,
        operationPersistence: false,
        recommendations: ['Check SSE endpoint implementation', 'Verify queue API functionality', 'Review operation lifecycle management']
      };
    }
  }

  /**
   * Generate formatted diagnostic report
   */
  generateFormattedReport(result: TestSuiteResult): string {
    const { report, summary } = result;
    
    let output = '';
    output += `\n=== ${result.suiteName} ===\n`;
    output += `Description: ${result.suiteDescription}\n`;
    output += `Execution Time: ${result.executionTime}ms\n`;
    output += `Overall Health: ${summary.overallHealth.toUpperCase()}\n`;
    output += `Tests Passed: ${summary.testsPassedPercent.toFixed(1)}%\n`;
    output += `\n`;

    // Test Results Summary
    output += `Test Results:\n`;
    output += `- Total Tests: ${report.summary.totalTests}\n`;
    output += `- Passed: ${report.summary.passed}\n`;
    output += `- Failed: ${report.summary.failed}\n`;
    output += `- Warnings: ${report.summary.warnings}\n`;
    output += `- Skipped: ${report.summary.skipped}\n`;
    output += `\n`;

    // Individual Test Results
    output += `Individual Test Details:\n`;
    report.results.forEach(test => {
      const status = test.status.toUpperCase();
      const duration = test.duration ? ` (${test.duration}ms)` : '';
      output += `- ${test.testName}: ${status}${duration}\n`;
      
      if (test.status === 'failed' || test.status === 'warning') {
        output += `  Message: ${test.message}\n`;
        if (test.recommendations.length > 0) {
          output += `  Recommendations: ${test.recommendations.slice(0, 2).join(', ')}\n`;
        }
      }
    });
    output += `\n`;

    // Critical Issues
    if (report.summary.criticalIssues.length > 0) {
      output += `Critical Issues:\n`;
      report.summary.criticalIssues.forEach(issue => {
        output += `- ${issue}\n`;
      });
      output += `\n`;
    }

    // Top Recommendations
    if (report.summary.recommendations.length > 0) {
      output += `Top Recommendations:\n`;
      const uniqueRecommendations = [...new Set(report.summary.recommendations)];
      uniqueRecommendations.slice(0, 5).forEach(rec => {
        output += `- ${rec}\n`;
      });
      output += `\n`;
    }

    // Performance Benchmarks
    if (report.benchmarks.length > 0) {
      output += `Performance Benchmarks:\n`;
      report.benchmarks.forEach(benchmark => {
        output += `- ${benchmark.operation}: ${benchmark.averageTime.toFixed(1)}ms avg, ${benchmark.throughput.toFixed(2)} ops/sec\n`;
      });
      output += `\n`;
    }

    return output;
  }

  /**
   * Generate suite summary
   */
  private generateSuiteSummary(report: DiagnosticReport): TestSuiteResult['summary'] {
    const testsPassedPercent = report.summary.totalTests > 0 
      ? (report.summary.passed / report.summary.totalTests) * 100 
      : 0;

    return {
      overallHealth: report.summary.overallStatus,
      criticalIssuesCount: report.summary.criticalIssues.length,
      recommendationsCount: report.summary.recommendations.length,
      testsPassedPercent
    };
  }

  /**
   * Get available test suites
   */
  getAvailableTestSuites(): Array<{
    name: string;
    key: keyof typeof TEST_SUITES;
    description: string;
    testsCount: number;
    estimatedDuration: string;
  }> {
    return Object.entries(TEST_SUITES).map(([key, suite]) => ({
      name: suite.name,
      key: key as keyof typeof TEST_SUITES,
      description: suite.description,
      testsCount: suite.tests.length,
      estimatedDuration: this.estimateDuration(suite.timeoutMs)
    }));
  }

  /**
   * Estimate duration string from timeout
   */
  private estimateDuration(timeoutMs: number): string {
    const seconds = Math.floor(timeoutMs / 1000);
    if (seconds < 60) {
      return `~${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `~${minutes}m`;
    }
  }
}

// Export singleton instance
let diagnosticTestSuite: DiagnosticTestSuite | null = null;

export function getDiagnosticTestSuite(): DiagnosticTestSuite {
  if (!diagnosticTestSuite) {
    diagnosticTestSuite = new DiagnosticTestSuite();
  }
  return diagnosticTestSuite;
}