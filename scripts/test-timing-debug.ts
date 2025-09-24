#!/usr/bin/env tsx

/**
 * Test Timing Debug Utilities
 * 
 * This script tests that the timing debug utilities work correctly
 */

import { initializeTimingDebug } from '../src/lib/monitoring/simple-timing-debug';

// Mock window object for testing
(global as any).window = {
  __showTimingDetails: false
};
(global as any).document = {
  readyState: 'complete'
};

async function testTimingDebug() {
  console.log('🧪 Testing Timing Debug Utilities...\n');

  try {
    // Initialize timing debug
    const timingDebug = initializeTimingDebug();
    
    console.log('✅ Timing debug initialized');
    console.log('Available methods:', Object.keys(timingDebug));
    
    // Test the test method
    console.log('\n🔄 Running timing test...');
    const testResult = timingDebug.test();
    console.log('Test result:', testResult);
    
    // Wait a bit for the test timing to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get stats
    console.log('\n📊 Getting stats...');
    const stats = timingDebug.getStats();
    
    console.log('\n✅ Timing debug test completed successfully!');
    console.log('Stats:', {
      totalCalls: stats.totalCalls,
      averageTime: stats.averageTime,
      slowCallsCount: stats.slowCalls.length,
      recentCallsCount: stats.recentCalls.length
    });
    
  } catch (error) {
    console.error('❌ Timing debug test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testTimingDebug()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testTimingDebug };