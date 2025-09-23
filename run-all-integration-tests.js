/**
 * Master Integration Test Runner
 * 
 * Runs all integration tests for the Semantic ID Registry System
 * and provides a comprehensive report.
 */

const { testSemanticNavigationIntegration } = require('./test-semantic-navigation-integration');
const { testVoiceSemanticIntegration } = require('./test-voice-semantic-integration');
const { testNavigationScenarios } = require('./test-navigation-scenarios');

async function runAllIntegrationTests() {
  console.log('🚀 Starting Comprehensive Integration Test Suite...\n');
  
  const testResults = [];
  const startTime = Date.now();
  
  // Test 1: Basic Semantic Navigation Integration
  console.log('=' .repeat(60));
  console.log('TEST 1: SEMANTIC NAVIGATION INTEGRATION');
  console.log('=' .repeat(60));
  
  try {
    await testSemanticNavigationIntegration();
    testResults.push({ name: 'Semantic Navigation Integration', passed: true });
  } catch (error) {
    console.error('❌ Semantic Navigation Integration failed:', error.message);
    testResults.push({ name: 'Semantic Navigation Integration', passed: false, error: error.message });
  }
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Voice + Semantic Integration
  console.log('\n' + '=' .repeat(60));
  console.log('TEST 2: VOICE + SEMANTIC INTEGRATION');
  console.log('=' .repeat(60));
  
  try {
    await testVoiceSemanticIntegration();
    testResults.push({ name: 'Voice + Semantic Integration', passed: true });
  } catch (error) {
    console.error('❌ Voice + Semantic Integration failed:', error.message);
    testResults.push({ name: 'Voice + Semantic Integration', passed: false, error: error.message });
  }
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Real-World Navigation Scenarios
  console.log('\n' + '=' .repeat(60));
  console.log('TEST 3: REAL-WORLD NAVIGATION SCENARIOS');
  console.log('=' .repeat(60));
  
  try {
    await testNavigationScenarios();
    testResults.push({ name: 'Real-World Navigation Scenarios', passed: true });
  } catch (error) {
    console.error('❌ Real-World Navigation Scenarios failed:', error.message);
    testResults.push({ name: 'Real-World Navigation Scenarios', passed: false, error: error.message });
  }
  
  // Final Report
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  const passedTests = testResults.filter(t => t.passed).length;
  const totalTests = testResults.length;
  
  console.log('\n' + '=' .repeat(60));
  console.log('COMPREHENSIVE INTEGRATION TEST REPORT');
  console.log('=' .repeat(60));
  
  console.log(`\n📊 Test Results:`);
  testResults.forEach((test, index) => {
    console.log(`${test.passed ? '✅' : '❌'} ${index + 1}. ${test.name}`);
    if (!test.passed && test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  
  console.log(`\n⏱️  Total Execution Time: ${totalTime.toFixed(2)} seconds`);
  console.log(`🎯 Overall Success Rate: ${passedTests}/${totalTests} (${((passedTests/totalTests) * 100).toFixed(1)}%)`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
    console.log('✨ The Semantic ID Registry System is fully functional and ready for production!');
  } else {
    console.log('\n⚠️  SOME INTEGRATION TESTS FAILED');
    console.log('🔧 Please review the failed tests and fix any issues before deploying.');
  }
  
  // Additional recommendations
  console.log('\n📋 Next Steps:');
  if (passedTests === totalTests) {
    console.log('• ✅ System is ready for production deployment');
    console.log('• ✅ Voice agents can use semantic navigation');
    console.log('• ✅ UI navigation is stable and reliable');
    console.log('• 🚀 Consider adding more semantic IDs to your HTML elements');
    console.log('• 📚 Review the SemanticIDRegistry.README.md for best practices');
  } else {
    console.log('• 🔍 Debug failed tests using browser developer tools');
    console.log('• 🧪 Run individual test files to isolate issues');
    console.log('• 📖 Check the console logs for detailed error messages');
    console.log('• 🔧 Verify that the development server is running on localhost:3000');
  }
  
  console.log('\n' + '=' .repeat(60));
  
  return {
    totalTests,
    passedTests,
    successRate: passedTests / totalTests,
    totalTime,
    results: testResults
  };
}

// Run all tests if this file is executed directly
if (require.main === module) {
  runAllIntegrationTests()
    .then(results => {
      process.exit(results.passedTests === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Integration test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllIntegrationTests };