'use client';

/**
 * Timing Debug Initializer Component
 * 
 * This component ensures timing debug utilities are available in the browser
 */

import { useEffect } from 'react';
import { productionTimingMonitor } from '@/lib/monitoring/ProductionTimingMonitor';

export function TimingDebugInitializer() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Create timing debug utilities directly
    const timingDebug = {
      getStats: () => {
        const stats = productionTimingMonitor.getStats();
        console.log('📊 Timing Stats:', stats);
        return stats;
      },
      
      getSlowCalls: () => {
        const stats = productionTimingMonitor.getStats();
        console.log('🐌 Slow Calls:', stats.slowCalls);
        return stats.slowCalls;
      },
      
      getRecentCalls: () => {
        const stats = productionTimingMonitor.getStats();
        console.log('📋 Recent Calls:', stats.recentCalls);
        return stats.recentCalls;
      },
      
      clear: () => {
        productionTimingMonitor.clear();
        console.log('🗑️ Timing data cleared');
      },
      
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
      
      monitorNext: () => {
        console.log('🔍 Monitoring next tool call... (will show detailed timing for 30 seconds)');
        (window as any).__showTimingDetails = true;
        setTimeout(() => {
          (window as any).__showTimingDetails = false;
          console.log('🔍 Monitoring stopped');
        }, 30000);
      },
      
      test: () => {
        console.log('🧪 Testing timing system...');
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

    // Assign to window with error handling
    try {
      (window as any).timingDebug = timingDebug;
      
      // Verify it's actually there
      if ((window as any).timingDebug) {
        (window as any).timingDebugReady = true;
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
      } else {
        console.error('❌ Failed to assign timingDebug to window');
      }
    } catch (error) {
      console.error('❌ Error setting up timing debug:', error);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

export default TimingDebugInitializer;