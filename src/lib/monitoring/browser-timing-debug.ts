/**
 * Browser Timing Debug Utilities
 * 
 * Provides easy access to timing data from browser console for debugging
 * production performance issues.
 */

import { productionTimingMonitor } from './ProductionTimingMonitor';

// Initialize timing debug utilities
const initializeTimingDebug = () => {
  if (typeof window === 'undefined') return;

  const timingDebugUtils = {
    // Get current stats
    getStats: () => productionTimingMonitor.getStats(),
    
    // Get recent slow calls
    getSlowCalls: () => {
      const stats = productionTimingMonitor.getStats();
      return stats.slowCalls;
    },
    
    // Get recent calls
    getRecentCalls: () => {
      const stats = productionTimingMonitor.getStats();
      return stats.recentCalls;
    },
    
    // Clear timing data
    clear: () => productionTimingMonitor.clear(),
    
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
      console.log('🔍 Monitoring next tool call...');
      const originalLog = console.log;
      const monitor = (message: string, ...args: any[]) => {
        if (message.includes('[ProductionTiming]')) {
          originalLog(message, ...args);
        }
      };
      
      // Temporarily override console.log to show only timing messages
      console.log = monitor;
      
      // Restore after 30 seconds
      setTimeout(() => {
        console.log = originalLog;
        console.log('🔍 Monitoring stopped');
      }, 30000);
    }
  };

  // Make available globally
  (window as any).timingDebug = timingDebugUtils;

  // Log instructions on load
  console.log(`
🔍 Production Timing Debug Available!

Use these commands in the browser console:
• timingDebug.summary() - Show performance summary
• timingDebug.getSlowCalls() - Get slow tool calls (>2s)
• timingDebug.getRecentCalls() - Get recent tool calls
• timingDebug.monitorNext() - Monitor next tool call in detail
• timingDebug.clear() - Clear timing data

Example: timingDebug.summary()
  `);

  return timingDebugUtils;
};

// Initialize immediately
const timingDebugUtils = initializeTimingDebug();

// Also initialize on DOM ready if not already done
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimingDebug);
  } else {
    // DOM is already ready
    if (!(window as any).timingDebug) {
      initializeTimingDebug();
    }
  }
}

export { productionTimingMonitor };