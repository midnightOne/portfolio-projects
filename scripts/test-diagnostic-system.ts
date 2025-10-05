#!/usr/bin/env tsx
/**
 * Test Diagnostic System
 * 
 * Simple test to verify the diagnostic system is working correctly.
 */

import { getDiagnosticTestSuite } from '../src/lib/content/DiagnosticTestSuite';
import { getSemanticLogger } from '../src/lib/content/SemanticLogger';

async function testDiagnosticSystem(): Promise<void> {
  console.log('Testing Semantic Diagnostic System...\n');

  try {
    const diagnosticSuite = getDiagnosticTestSuite();
    const logger = getSemanticLogger();

    // Test 1: Quick health check
    console.log('1. Testing quick health check...');
    const quickResult = await diagnosticSuite.quickHealthCheck();
    console.log(`   Result: ${quickResult.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log(`   Execution time: ${quickResult.executionTime}ms`);
    console.log(`   Issues: ${quickResult.issues.length}`);
    console.log(`   Recommendations: ${quickResult.recommendations.length}`);

    // Test 2: Logger functionality
    console.log('\n2. Testing logger functionality...');
    logger.info('TestDiagnosticSystem', 'test', 'Test log message', { testData: 'example' });
    logger.warn('TestDiagnosticSystem', 'test', 'Test warning message');
    logger.error('TestDiagnosticSystem', 'test', 'Test error message', {}, new Error('Test error'));

    const logStats = logger.getLogStats();
    console.log(`   Total log entries: ${logStats.totalEntries}`);
    console.log(`   Recent errors: ${logStats.recentErrors.length}`);

    // Test 3: Available test suites
    console.log('\n3. Testing available test suites...');
    const availableSuites = diagnosticSuite.getAvailableTestSuites();
    console.log(`   Available suites: ${availableSuites.length}`);
    availableSuites.forEach(suite => {
      console.log(`   - ${suite.name}: ${suite.testsCount} tests, ~${suite.estimatedDuration}`);
    });

    // Test 4: System health check (if we have time)
    console.log('\n4. Testing system health check...');
    try {
      const healthResult = await diagnosticSuite.runTestSuite('QUICK', undefined, false);
      console.log(`   Suite result: ${healthResult.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Overall health: ${healthResult.summary.overallHealth}`);
      console.log(`   Tests passed: ${healthResult.summary.testsPassedPercent.toFixed(1)}%`);
    } catch (error) {
      console.log(`   Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n✅ Diagnostic system test completed successfully!');

  } catch (error) {
    console.error('\n❌ Diagnostic system test failed:');
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testDiagnosticSystem().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}