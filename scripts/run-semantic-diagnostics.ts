#!/usr/bin/env tsx
/**
 * Semantic System Diagnostics CLI
 * 
 * Command-line interface for running semantic system diagnostics.
 * 
 * Usage:
 *   npm run diagnostics                    # Quick health check
 *   npm run diagnostics -- --suite=T3_FOCUS --project=PROJECT_ID
 *   npm run diagnostics -- --comprehensive --verbose
 *   npm run diagnostics -- --t3-only --project=PROJECT_ID
 *   npm run diagnostics -- --custom --tests=t3_generation,chunk_persistence
 */

import { getDiagnosticTestSuite, TEST_SUITES } from '../src/lib/content/DiagnosticTestSuite';
import { DiagnosticConfig, DiagnosticTestType } from '../src/lib/content/SemanticDiagnosticService';
import { getSemanticLogger } from '../src/lib/content/SemanticLogger';

// Parse command line arguments
function parseArgs(): {
  suite?: keyof typeof TEST_SUITES;
  projectId?: string;
  verbose?: boolean;
  comprehensive?: boolean;
  t3Only?: boolean;
  sseOnly?: boolean;
  custom?: boolean;
  tests?: DiagnosticTestType[];
  quick?: boolean;
  help?: boolean;
} {
  const args = process.argv.slice(2);
  const parsed: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg.startsWith('--suite=')) {
      parsed.suite = arg.split('=')[1];
    } else if (arg.startsWith('--project=')) {
      parsed.projectId = arg.split('=')[1];
    } else if (arg.startsWith('--tests=')) {
      parsed.tests = arg.split('=')[1].split(',') as DiagnosticTestType[];
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--comprehensive') {
      parsed.comprehensive = true;
    } else if (arg === '--t3-only') {
      parsed.t3Only = true;
    } else if (arg === '--sse-only') {
      parsed.sseOnly = true;
    } else if (arg === '--custom') {
      parsed.custom = true;
    } else if (arg === '--quick' || arg === '-q') {
      parsed.quick = true;
    }
  }

  return parsed;
}

// Print help information
function printHelp(): void {
  console.log(`
Semantic System Diagnostics CLI

Usage:
  npm run diagnostics [options]

Options:
  --help, -h              Show this help message
  --quick, -q             Run quick health check only
  --suite=SUITE_NAME      Run specific test suite (${Object.keys(TEST_SUITES).join(', ')})
  --project=PROJECT_ID    Run tests for specific project
  --verbose, -v           Enable verbose logging
  --comprehensive         Run comprehensive diagnostic (all tests)
  --t3-only              Run T3 generation diagnostics only
  --sse-only             Run SSE and queue diagnostics only
  --custom               Run custom test configuration
  --tests=TEST1,TEST2    Specify custom tests (use with --custom)

Examples:
  npm run diagnostics                                    # Quick health check
  npm run diagnostics -- --suite=T3_FOCUS --verbose     # T3 diagnostic with verbose output
  npm run diagnostics -- --comprehensive --project=abc  # Full diagnostic for project
  npm run diagnostics -- --t3-only --project=xyz        # T3 diagnostic for specific project
  npm run diagnostics -- --custom --tests=t3_generation,chunk_persistence

Available Test Suites:
${Object.entries(TEST_SUITES).map(([key, suite]) => 
  `  ${key.padEnd(20)} - ${suite.description}`
).join('\n')}

Available Individual Tests:
  t3_generation          - Test T3 chunk generation
  sse_stability          - Test SSE connection stability
  queue_display          - Test queue display functionality
  chunk_persistence      - Test chunk persistence and storage
  system_health          - Test overall system health
  performance_benchmark  - Run performance benchmarks
  foreign_key_validation - Test foreign key constraints
  operation_lifecycle    - Test operation lifecycle management
`);
}

// Format and print diagnostic result
function printDiagnosticResult(result: any, verbose: boolean = false): void {
  console.log('\n' + '='.repeat(80));
  console.log(`DIAGNOSTIC RESULT: ${result.suiteName || 'Custom Diagnostic'}`);
  console.log('='.repeat(80));

  if (result.suiteDescription) {
    console.log(`Description: ${result.suiteDescription}`);
  }

  console.log(`Execution Time: ${result.executionTime || result.report?.duration || 0}ms`);
  console.log(`Overall Status: ${(result.summary?.overallHealth || result.report?.summary?.overallStatus || 'unknown').toUpperCase()}`);

  if (result.summary) {
    console.log(`Tests Passed: ${result.summary.testsPassedPercent.toFixed(1)}% (${result.report.summary.passed}/${result.report.summary.totalTests})`);
  } else if (result.report) {
    const passPercent = result.report.summary.totalTests > 0 
      ? (result.report.summary.passed / result.report.summary.totalTests) * 100 
      : 0;
    console.log(`Tests Passed: ${passPercent.toFixed(1)}% (${result.report.summary.passed}/${result.report.summary.totalTests})`);
  }

  console.log('\n' + '-'.repeat(40));
  console.log('TEST RESULTS:');
  console.log('-'.repeat(40));

  const results = result.report?.results || [];
  results.forEach((test: any) => {
    const status = test.status.toUpperCase();
    const statusColor = test.status === 'passed' ? '\x1b[32m' : 
                       test.status === 'warning' ? '\x1b[33m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(`${statusColor}${status.padEnd(8)}${resetColor} ${test.testName} ${test.duration ? `(${test.duration}ms)` : ''}`);
    
    if (test.status !== 'passed' && test.message) {
      console.log(`         ${test.message}`);
    }

    if (verbose && test.details && Object.keys(test.details).length > 0) {
      console.log(`         Details: ${JSON.stringify(test.details, null, 2).replace(/\n/g, '\n         ')}`);
    }
  });

  // Print critical issues
  const criticalIssues = result.report?.summary?.criticalIssues || [];
  if (criticalIssues.length > 0) {
    console.log('\n' + '-'.repeat(40));
    console.log('CRITICAL ISSUES:');
    console.log('-'.repeat(40));
    criticalIssues.forEach((issue: string) => {
      console.log(`\x1b[31m• ${issue}\x1b[0m`);
    });
  }

  // Print recommendations
  const recommendations = result.report?.summary?.recommendations || [];
  if (recommendations.length > 0) {
    console.log('\n' + '-'.repeat(40));
    console.log('RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    const uniqueRecommendations = [...new Set(recommendations)] as string[];
    uniqueRecommendations.slice(0, 10).forEach((rec: string) => {
      console.log(`• ${rec}`);
    });
  }

  // Print performance benchmarks
  const benchmarks = result.report?.benchmarks || [];
  if (benchmarks.length > 0) {
    console.log('\n' + '-'.repeat(40));
    console.log('PERFORMANCE BENCHMARKS:');
    console.log('-'.repeat(40));
    benchmarks.forEach((benchmark: any) => {
      console.log(`${benchmark.operation.padEnd(25)} ${benchmark.averageTime.toFixed(1)}ms avg, ${benchmark.throughput.toFixed(2)} ops/sec`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

// Print quick health check result
function printQuickHealthResult(result: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('QUICK HEALTH CHECK');
  console.log('='.repeat(60));

  const statusColor = result.healthy ? '\x1b[32m' : '\x1b[31m';
  const resetColor = '\x1b[0m';
  
  console.log(`Status: ${statusColor}${result.healthy ? 'HEALTHY' : 'UNHEALTHY'}${resetColor}`);
  console.log(`Execution Time: ${result.executionTime}ms`);

  if (result.issues.length > 0) {
    console.log('\nIssues Found:');
    result.issues.forEach((issue: string) => {
      console.log(`\x1b[31m• ${issue}\x1b[0m`);
    });
  }

  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    result.recommendations.forEach((rec: string) => {
      console.log(`• ${rec}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

// Print T3 diagnostic result
function printT3DiagnosticResult(result: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('T3 GENERATION DIAGNOSTIC');
  console.log('='.repeat(60));

  const statusColor = result.t3Working ? '\x1b[32m' : '\x1b[31m';
  const resetColor = '\x1b[0m';
  
  console.log(`T3 Generation: ${statusColor}${result.t3Working ? 'WORKING' : 'FAILED'}${resetColor}`);
  console.log(`Sections Analyzed: ${result.sectionsAnalyzed}`);
  console.log(`Chunks Generated: ${result.chunksGenerated}`);

  if (result.persistenceIssues.length > 0) {
    console.log('\nPersistence Issues:');
    result.persistenceIssues.forEach((issue: string) => {
      console.log(`\x1b[31m• ${issue}\x1b[0m`);
    });
  }

  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    result.recommendations.forEach((rec: string) => {
      console.log(`• ${rec}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

// Main execution function
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  console.log('Starting Semantic System Diagnostics...\n');

  try {
    const diagnosticSuite = getDiagnosticTestSuite();
    const logger = getSemanticLogger();

    // Enable debug logging if verbose
    if (args.verbose) {
      logger.enableDebugMode();
      console.log('Debug logging enabled\n');
    }

    let result: any;

    if (args.quick) {
      // Quick health check
      console.log('Running quick health check...');
      result = await diagnosticSuite.quickHealthCheck(args.projectId);
      printQuickHealthResult(result);

    } else if (args.t3Only) {
      // T3-specific diagnostic
      console.log('Running T3 generation diagnostic...');
      result = await diagnosticSuite.diagnoseT3Issues(args.projectId);
      printT3DiagnosticResult(result);

    } else if (args.sseOnly) {
      // SSE and queue diagnostic
      console.log('Running SSE and queue diagnostic...');
      result = await diagnosticSuite.diagnoseConnectionIssues();
      console.log('\n' + '='.repeat(60));
      console.log('SSE & QUEUE DIAGNOSTIC');
      console.log('='.repeat(60));
      console.log(`SSE Working: ${result.sseWorking ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO\x1b[0m'}`);
      console.log(`Queue Working: ${result.queueWorking ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO\x1b[0m'}`);
      console.log(`Connection Errors: ${result.connectionErrors}`);
      console.log(`Operation Persistence: ${result.operationPersistence ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO\x1b[0m'}`);
      
      if (result.recommendations.length > 0) {
        console.log('\nRecommendations:');
        result.recommendations.forEach((rec: string) => {
          console.log(`• ${rec}`);
        });
      }
      console.log('\n' + '='.repeat(60));

    } else if (args.comprehensive) {
      // Comprehensive diagnostic
      console.log('Running comprehensive diagnostic...');
      result = await diagnosticSuite.runTestSuite('COMPREHENSIVE', args.projectId, args.verbose);
      printDiagnosticResult(result, args.verbose);

    } else if (args.suite) {
      // Specific test suite
      if (!TEST_SUITES[args.suite as keyof typeof TEST_SUITES]) {
        console.error(`Invalid test suite: ${args.suite}`);
        console.error(`Available suites: ${Object.keys(TEST_SUITES).join(', ')}`);
        process.exit(1);
      }

      console.log(`Running test suite: ${args.suite}...`);
      result = await diagnosticSuite.runTestSuite(args.suite as keyof typeof TEST_SUITES, args.projectId, args.verbose);
      printDiagnosticResult(result, args.verbose);

    } else if (args.custom && args.tests) {
      // Custom diagnostic
      console.log(`Running custom diagnostic with tests: ${args.tests.join(', ')}...`);
      
      const config: DiagnosticConfig = {
        tests: args.tests,
        projectId: args.projectId,
        includePerformanceBenchmarks: true,
        includeSystemHealth: true,
        verbose: args.verbose,
        timeoutMs: 120000
      };

      const report = await diagnosticSuite.runCustomDiagnostic(config);
      result = { report, executionTime: report.duration };
      printDiagnosticResult(result, args.verbose);

    } else {
      // Default: quick health check
      console.log('Running default quick health check...');
      result = await diagnosticSuite.quickHealthCheck(args.projectId);
      printQuickHealthResult(result);
    }

    // Disable debug logging if it was enabled
    if (args.verbose) {
      logger.disableDebugMode();
    }

    // Exit with appropriate code
    const success = result.healthy !== undefined ? result.healthy : 
                   result.success !== undefined ? result.success :
                   result.t3Working !== undefined ? result.t3Working :
                   true;

    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n\x1b[31mDiagnostic execution failed:\x1b[0m');
    console.error(error instanceof Error ? error.message : String(error));
    
    if (args.verbose && error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}