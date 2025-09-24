/**
 * Production Timing Monitor
 * 
 * Tracks complete tool call timing in production environment including:
 * - Browser-side processing
 * - Network round-trip time
 * - Server-side processing
 * - Complete end-to-end timing
 */

interface TimingEntry {
  toolCallId: string;
  toolName: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  phases: {
    browserStart?: number;
    networkStart?: number;
    serverProcessing?: number;
    networkEnd?: number;
    browserEnd?: number;
  };
  breakdown?: {
    browserPrep?: number;
    networkRoundTrip?: number;
    serverExecution?: number;
    browserPostProcess?: number;
    totalTime?: number;
  };
  metadata?: {
    provider?: string;
    toolType?: 'client' | 'server';
    cacheHit?: boolean;
    errorOccurred?: boolean;
  };
}

class ProductionTimingMonitor {
  private static instance: ProductionTimingMonitor;
  private timingEntries = new Map<string, TimingEntry>();
  private maxEntries = 100; // Keep last 100 entries

  private constructor() {
    // Bind to window for browser debugging
    if (typeof window !== 'undefined') {
      (window as any).timingMonitor = this;
    }
  }

  static getInstance(): ProductionTimingMonitor {
    if (!ProductionTimingMonitor.instance) {
      ProductionTimingMonitor.instance = new ProductionTimingMonitor();
    }
    return ProductionTimingMonitor.instance;
  }

  /**
   * Start timing a tool call
   */
  startTiming(toolCallId: string, toolName: string, sessionId: string, metadata?: TimingEntry['metadata']): void {
    const entry: TimingEntry = {
      toolCallId,
      toolName,
      sessionId,
      startTime: Date.now(),
      phases: {
        browserStart: Date.now()
      },
      metadata
    };

    this.timingEntries.set(toolCallId, entry);
    
    // Clean up old entries
    if (this.timingEntries.size > this.maxEntries) {
      const oldestKey = this.timingEntries.keys().next().value;
      this.timingEntries.delete(oldestKey);
    }

    console.log(`[ProductionTiming] Started tracking ${toolName} (${toolCallId})`);
  }

  /**
   * Mark network start (when fetch begins)
   */
  markNetworkStart(toolCallId: string): void {
    const entry = this.timingEntries.get(toolCallId);
    if (entry) {
      entry.phases.networkStart = Date.now();
    }
  }

  /**
   * Mark network end (when fetch completes)
   */
  markNetworkEnd(toolCallId: string): void {
    const entry = this.timingEntries.get(toolCallId);
    if (entry) {
      entry.phases.networkEnd = Date.now();
    }
  }

  /**
   * Add server processing time from API response
   */
  addServerTiming(toolCallId: string, serverExecutionTime: number): void {
    const entry = this.timingEntries.get(toolCallId);
    if (entry) {
      entry.phases.serverProcessing = serverExecutionTime;
    }
  }

  /**
   * Complete timing and calculate breakdown
   */
  completeTiming(toolCallId: string, success: boolean = true): TimingEntry | null {
    const entry = this.timingEntries.get(toolCallId);
    if (!entry) {
      console.warn(`[ProductionTiming] No timing entry found for ${toolCallId}`);
      return null;
    }

    entry.endTime = Date.now();
    entry.phases.browserEnd = Date.now();

    // Calculate breakdown
    const breakdown: TimingEntry['breakdown'] = {};
    
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
    entry.metadata = { ...entry.metadata, errorOccurred: !success };

    // Log complete timing breakdown
    this.logTimingBreakdown(entry);

    return entry;
  }

  /**
   * Log detailed timing breakdown
   */
  private logTimingBreakdown(entry: TimingEntry): void {
    const { toolName, toolCallId, breakdown, metadata } = entry;
    
    // Check if detailed monitoring is enabled
    const showDetails = typeof window !== 'undefined' && (window as any).__showTimingDetails;
    
    if (showDetails || (breakdown?.totalTime || 0) > 1000) {
      console.group(`[ProductionTiming] ${toolName} Complete Breakdown (${toolCallId})`);
      
      if (breakdown) {
        console.log(`🚀 Browser Prep: ${breakdown.browserPrep || 0}ms`);
        console.log(`🌐 Network Round-trip: ${breakdown.networkRoundTrip || 0}ms`);
        console.log(`⚙️  Server Execution: ${breakdown.serverExecution || 0}ms`);
        console.log(`🔄 Browser Post-process: ${breakdown.browserPostProcess || 0}ms`);
        console.log(`⏱️  Total Time: ${breakdown.totalTime || 0}ms`);
        
        // Highlight slow components
        if ((breakdown.totalTime || 0) > 3000) {
          console.warn(`⚠️  SLOW PERFORMANCE DETECTED (${breakdown.totalTime}ms)`);
          
          if ((breakdown.networkRoundTrip || 0) > 2000) {
            console.warn(`   🌐 Network is slow: ${breakdown.networkRoundTrip}ms`);
          }
          
          if ((breakdown.serverExecution || 0) > 2000) {
            console.warn(`   ⚙️  Server is slow: ${breakdown.serverExecution}ms`);
          }
          
          if ((breakdown.browserPrep || 0) > 500) {
            console.warn(`   🚀 Browser prep is slow: ${breakdown.browserPrep}ms`);
          }
        }
      }
      
      if (metadata) {
        console.log(`📊 Metadata:`, metadata);
      }
      
      console.groupEnd();
    } else {
      // Just log a summary for fast calls
      console.log(`[ProductionTiming] ${toolName}: ${breakdown?.totalTime || 0}ms (${toolCallId})`);
    }

    // Send to analytics if available
    this.sendToAnalytics(entry);
  }

  /**
   * Send timing data to analytics
   */
  private sendToAnalytics(entry: TimingEntry): void {
    // Only send in production and if timing is significant
    if (process.env.NODE_ENV === 'production' && (entry.breakdown?.totalTime || 0) > 1000) {
      try {
        // Send to your analytics service
        fetch('/api/analytics/timing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'tool_call_timing',
            data: entry,
            timestamp: new Date().toISOString()
          })
        }).catch(error => {
          console.warn('Failed to send timing analytics:', error);
        });
      } catch (error) {
        console.warn('Analytics error:', error);
      }
    }
  }

  /**
   * Get timing statistics
   */
  getStats(): {
    totalCalls: number;
    averageTime: number;
    slowCalls: TimingEntry[];
    recentCalls: TimingEntry[];
  } {
    const entries = Array.from(this.timingEntries.values()).filter(e => e.breakdown);
    
    const totalTime = entries.reduce((sum, e) => sum + (e.breakdown?.totalTime || 0), 0);
    const averageTime = entries.length > 0 ? totalTime / entries.length : 0;
    
    const slowCalls = entries
      .filter(e => (e.breakdown?.totalTime || 0) > 2000)
      .sort((a, b) => (b.breakdown?.totalTime || 0) - (a.breakdown?.totalTime || 0));
    
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

  /**
   * Clear all timing data
   */
  clear(): void {
    this.timingEntries.clear();
    console.log('[ProductionTiming] Cleared all timing data');
  }
}

export const productionTimingMonitor = ProductionTimingMonitor.getInstance();
export default ProductionTimingMonitor;