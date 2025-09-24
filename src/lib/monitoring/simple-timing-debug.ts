/**
 * Simple Timing Debug - Direct Window Assignment
 * 
 * A more reliable way to add timing debug to the browser console
 */

import { productionTimingMonitor } from './ProductionTimingMonitor';

export const initializeTimingDebug = () => {
  if (typeof window === 'undefined') return;

  // Create timing debug utilities
  const timingDebug = {
    // Get current stats
    getStats: () => {
      const stats = productionTimingMonitor.getStats();
      console.log('📊 Timing Stats:', stats);
      return stats;
    },
    
    // Get recent slow calls
    getSlowCalls: () => {
      const stats = productionTimingMonitor.getStats();
      console.log('🐌 Slow Calls:', stats.slowCalls);
      return stats.slowCalls;
    },
    
    // Get recent calls
    getRecentCalls: () => {
      const stats = productionTimingMonitor.getStats();
      console.log('📋 Recent Calls:', stats.recentCalls);
      return stats.recentCalls;
    },
    
    // Clear timing data
    clear: () => {
      productionTimingMonitor.clear();
      console.log('🗑️ Timing data cleared');
    },
    
    // Log performance summary
    summary: () => {
      const stats = productionTimingMonitor.getStats();
      console.group('🔍 Performance Summary');
      console.log(`📊 Total calls: ${stats.totalCalls}`);
      console.log(`⏱️  Average time: ${stats.averageTime.toFixed(0)}ms`);
      console.log(`🐌 Slow calls (>2s): ${stats.slowCalls.length}`);
      
      if (stats.slowCalls.length > 0) {
        console.group('🐌 Slowest Calls:');
        stats.slowCalls.slice(0, 5).forEach((call, i) => {
          console.log(`${i + 1}. ${call.toolName}: ${call.breakdown?.totalTime}ms (${call.toolCallId})`);
        });
        console.groupEnd();
      }
      
      console.groupEnd();
      return stats;
    },
    
    // Monitor next tool call
    monitorNext: () => {
      console.log('🔍 Monitoring next tool call... (will show detailed timing for 30 seconds)');
      
      // Set a flag to show detailed logs
      (window as any).__showTimingDetails = true;
      
      // Clear the flag after 30 seconds
      setTimeout(() => {
        (window as any).__showTimingDetails = false;
        console.log('🔍 Monitoring stopped');
      }, 30000);
    },
    
    // Test the timing system
    test: () => {
      console.log('🧪 Testing timing system...');
      
      // Create a fake timing entry for testing
      const testId = 'test-' + Date.now();
      productionTimingMonitor.startTiming(testId, 'test_tool', 'test-session', { provider: 'test' });
      
      setTimeout(() => {
        productionTimingMonitor.markNetworkStart(testId);
        setTimeout(() => {
          productionTimingMonitor.markNetworkEnd(testId);
          productionTimingMonitor.addServerTiming(testId, 100);
          productionTimingMonitor.completeTiming(testId, true);
        }, 50);
      }, 10);
      
      return 'Test timing entry created';
    }
  };

  // Assign to window
  (window as any).timingDebug = timingDebug;
  
  // Log availability
  console.log(`
🔍 Production Timing Debug Available!

Use these commands in the browser console:
• timingDebug.summary() - Show performance summary
• timingDebug.getSlowCalls() - Get slow tool calls (>2s)
• timingDebug.getRecentCalls() - Get recent tool calls
• timingDebug.monitorNext() - Monitor next tool call in detail
• timingDebug.clear() - Clear timing data
• timingDebug.test() - Test the timing system

Example: timingDebug.summary()
  `);

  return timingDebug;
};

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  // Initialize immediately
  initializeTimingDebug();
  
  // Also initialize on DOM ready as backup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimingDebug);
  }
}