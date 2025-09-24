/**
 * Timing Debug - Direct Script
 * 
 * This script is loaded directly to ensure timing debug is available
 */

// Simple timing monitor implementation
window.timingMonitor = {
  entries: new Map(),
  maxEntries: 100,

  startTiming: function(toolCallId, toolName, sessionId, metadata) {
    const entry = {
      toolCallId,
      toolName,
      sessionId,
      startTime: Date.now(),
      phases: { browserStart: Date.now() },
      metadata: metadata || {}
    };
    
    this.entries.set(toolCallId, entry);
    
    // Clean up old entries
    if (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }
    
    console.log(`[TimingMonitor] Started tracking ${toolName} (${toolCallId})`);
  },

  markNetworkStart: function(toolCallId) {
    const entry = this.entries.get(toolCallId);
    if (entry) {
      entry.phases.networkStart = Date.now();
    }
  },

  markNetworkEnd: function(toolCallId) {
    const entry = this.entries.get(toolCallId);
    if (entry) {
      entry.phases.networkEnd = Date.now();
    }
  },

  addServerTiming: function(toolCallId, serverExecutionTime) {
    const entry = this.entries.get(toolCallId);
    if (entry) {
      entry.phases.serverProcessing = serverExecutionTime;
    }
  },

  completeTiming: function(toolCallId, success) {
    const entry = this.entries.get(toolCallId);
    if (!entry) return null;

    entry.endTime = Date.now();
    entry.phases.browserEnd = Date.now();

    // Calculate breakdown
    const breakdown = {};
    
    if (entry.phases.browserStart && entry.phases.networkStart) {
      breakdown.browserPrep = entry.phases.networkStart - entry.phases.browserStart;
    }
    
    if (entry.phases.networkStart && entry.phases.networkEnd) {
      breakdown.networkRoundTrip = entry.phases.networkEnd - entry.phases.networkStart;
    }
    
    if (entry.phases.serverProcessing) {
      breakdown.serverExecution = entry.phases.serverProcessing;
    }
    
    if (entry.phases.networkEnd && entry.phases.browserEnd) {
      breakdown.browserPostProcess = entry.phases.browserEnd - entry.phases.networkEnd;
    }
    
    breakdown.totalTime = entry.endTime - entry.startTime;
    entry.breakdown = breakdown;

    // Log timing breakdown
    this.logTimingBreakdown(entry);
    return entry;
  },

  logTimingBreakdown: function(entry) {
    const { toolName, toolCallId, breakdown } = entry;
    const showDetails = window.__showTimingDetails || (breakdown.totalTime || 0) > 1000;
    
    if (showDetails) {
      console.group(`[TimingMonitor] ${toolName} Complete Breakdown (${toolCallId})`);
      console.log(`🚀 Browser Prep: ${breakdown.browserPrep || 0}ms`);
      console.log(`🌐 Network Round-trip: ${breakdown.networkRoundTrip || 0}ms`);
      console.log(`⚙️  Server Execution: ${breakdown.serverExecution || 0}ms`);
      console.log(`🔄 Browser Post-process: ${breakdown.browserPostProcess || 0}ms`);
      console.log(`⏱️  Total Time: ${breakdown.totalTime || 0}ms`);
      
      if ((breakdown.totalTime || 0) > 3000) {
        console.warn(`⚠️  SLOW PERFORMANCE DETECTED (${breakdown.totalTime}ms)`);
      }
      
      console.groupEnd();
    } else {
      console.log(`[TimingMonitor] ${toolName}: ${breakdown.totalTime || 0}ms (${toolCallId})`);
    }
  },

  getStats: function() {
    const entries = Array.from(this.entries.values()).filter(e => e.breakdown);
    const totalTime = entries.reduce((sum, e) => sum + (e.breakdown.totalTime || 0), 0);
    const averageTime = entries.length > 0 ? totalTime / entries.length : 0;
    
    const slowCalls = entries
      .filter(e => (e.breakdown.totalTime || 0) > 2000)
      .sort((a, b) => (b.breakdown.totalTime || 0) - (a.breakdown.totalTime || 0));
    
    const recentCalls = entries
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 10);

    return {
      totalCalls: entries.length,
      averageTime,
      slowCalls,
      recentCalls
    };
  }
};

// Create timing debug utilities
window.timingDebug = {
  getStats: function() {
    const stats = window.timingMonitor.getStats();
    console.log('📊 Timing Stats:', stats);
    return stats;
  },
  
  getSlowCalls: function() {
    const stats = window.timingMonitor.getStats();
    console.log('🐌 Slow Calls:', stats.slowCalls);
    return stats.slowCalls;
  },
  
  getRecentCalls: function() {
    const stats = window.timingMonitor.getStats();
    console.log('📋 Recent Calls:', stats.recentCalls);
    return stats.recentCalls;
  },
  
  clear: function() {
    window.timingMonitor.entries.clear();
    console.log('🗑️ Timing data cleared');
  },
  
  summary: function() {
    const stats = window.timingMonitor.getStats();
    console.group('🔍 Performance Summary');
    console.log(`📊 Total calls: ${stats.totalCalls}`);
    console.log(`⏱️  Average time: ${stats.averageTime.toFixed(0)}ms`);
    console.log(`🐌 Slow calls (>2s): ${stats.slowCalls.length}`);
    
    if (stats.slowCalls.length > 0) {
      console.group('🐌 Slowest Calls:');
      stats.slowCalls.slice(0, 5).forEach((call, i) => {
        console.log(`${i + 1}. ${call.toolName}: ${call.breakdown.totalTime}ms (${call.toolCallId})`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
    return stats;
  },
  
  monitorNext: function() {
    console.log('🔍 Monitoring next tool call... (will show detailed timing for 30 seconds)');
    window.__showTimingDetails = true;
    setTimeout(() => {
      window.__showTimingDetails = false;
      console.log('🔍 Monitoring stopped');
    }, 30000);
  },
  
  test: function() {
    console.log('🧪 Testing timing system...');
    const testId = 'test-' + Date.now();
    window.timingMonitor.startTiming(testId, 'test_tool', 'test-session', { provider: 'test' });
    
    setTimeout(() => {
      window.timingMonitor.markNetworkStart(testId);
      setTimeout(() => {
        window.timingMonitor.markNetworkEnd(testId);
        window.timingMonitor.addServerTiming(testId, 100);
        window.timingMonitor.completeTiming(testId, true);
      }, 50);
    }, 10);
    
    return 'Test timing entry created';
  }
};

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