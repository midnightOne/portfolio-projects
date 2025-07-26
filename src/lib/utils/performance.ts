/**
 * Performance monitoring and profiling utilities
 */

import { NextRequest } from 'next/server';

interface PerformanceMetric {
  route: string;
  method: string;
  duration: number;
  queryCount: number;
  queryTime: number;
  timestamp: Date;
  userAgent?: string;
  responseSize?: number;
}

interface DatabaseQueryMetric {
  query: string;
  duration: number;
  params?: any;
  timestamp: Date;
  route?: string;
  queryType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COUNT' | 'UNKNOWN';
  recordCount?: number;
  isSlowQuery?: boolean;
}

class PerformanceProfiler {
  private metrics: PerformanceMetric[] = [];
  private queryMetrics: DatabaseQueryMetric[] = [];
  private currentRequest: {
    route: string;
    method: string;
    startTime: number;
    queryStartTimes: Map<string, number>;
    queryCount: number;
    totalQueryTime: number;
  } | null = null;

  startRequest(request: NextRequest) {
    const url = new URL(request.url);
    this.currentRequest = {
      route: url.pathname,
      method: request.method,
      startTime: performance.now(),
      queryStartTimes: new Map(),
      queryCount: 0,
      totalQueryTime: 0,
    };
  }

  startQuery(query: string, params?: any) {
    if (!this.currentRequest) return;
    
    const queryId = `${Date.now()}-${Math.random()}`;
    this.currentRequest.queryStartTimes.set(queryId, performance.now());
    this.currentRequest.queryCount++;

    return {
      queryId,
      endQuery: (recordCount?: number) => this.endQuery(queryId, query, params, recordCount),
    };
  }

  endQuery(queryId: string, query: string, params?: any, recordCount?: number) {
    if (!this.currentRequest) return;

    const startTime = this.currentRequest.queryStartTimes.get(queryId);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.currentRequest.totalQueryTime += duration;
    this.currentRequest.queryStartTimes.delete(queryId);

    // Analyze query type
    const queryType = this.analyzeQueryType(query);
    const isSlowQuery = duration > 100;

    this.queryMetrics.push({
      query: query.replace(/\s+/g, ' ').trim(),
      duration,
      params,
      timestamp: new Date(),
      route: this.currentRequest.route,
      queryType,
      recordCount,
      isSlowQuery,
    });

    // Enhanced logging for slow queries
    if (process.env.NODE_ENV === 'development' && isSlowQuery) {
      const severity = duration > 500 ? '🚨 CRITICAL' : duration > 200 ? '🐌 SLOW' : '⚠️  Warning';
      console.warn(`${severity} query (${duration.toFixed(2)}ms) on ${this.currentRequest.route}:`);
      console.warn(`  Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
      if (recordCount !== undefined) {
        console.warn(`  Records: ${recordCount}`);
      }
      if (params) {
        console.warn(`  Params:`, params);
      }
    }
  }

  private analyzeQueryType(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COUNT' | 'UNKNOWN' {
    const normalizedQuery = query.trim().toUpperCase();
    if (normalizedQuery.startsWith('SELECT COUNT')) return 'COUNT';
    if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
    return 'UNKNOWN';
  }

  endRequest(request: NextRequest, responseSize?: number) {
    if (!this.currentRequest) return;

    const duration = performance.now() - this.currentRequest.startTime;
    
    const metric: PerformanceMetric = {
      route: this.currentRequest.route,
      method: this.currentRequest.method,
      duration,
      queryCount: this.currentRequest.queryCount,
      queryTime: this.currentRequest.totalQueryTime,
      timestamp: new Date(),
      userAgent: request.headers.get('user-agent') || undefined,
      responseSize,
    };

    this.metrics.push(metric);

    // Log slow requests in development
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`🚨 Slow request (${duration.toFixed(2)}ms):`, {
        route: metric.route,
        method: metric.method,
        queries: metric.queryCount,
        queryTime: metric.queryTime.toFixed(2),
      });
    }

    // Keep only last 100 metrics in memory
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
    if (this.queryMetrics.length > 200) {
      this.queryMetrics = this.queryMetrics.slice(-200);
    }

    this.currentRequest = null;
  }

  getMetrics() {
    return {
      requests: this.metrics,
      queries: this.queryMetrics,
      summary: this.getSummary(),
    };
  }

  getSummary() {
    if (this.metrics.length === 0) return null;

    const sortedByDuration = [...this.metrics].sort((a, b) => b.duration - a.duration);
    const totalRequests = this.metrics.length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    const avgQueryTime = this.metrics.reduce((sum, m) => sum + m.queryTime, 0) / totalRequests;

    // Analyze query performance
    const slowQueries = this.queryMetrics.filter(q => q.isSlowQuery);
    const queryTypeStats = this.getQueryTypeStats();

    return {
      totalRequests,
      avgDuration: Number(avgDuration.toFixed(2)),
      avgQueryTime: Number(avgQueryTime.toFixed(2)),
      slowestRequests: sortedByDuration.slice(0, 5).map(m => ({
        route: m.route,
        method: m.method,
        duration: Number(m.duration.toFixed(2)),
        queryCount: m.queryCount,
        queryTime: Number(m.queryTime.toFixed(2)),
        timestamp: m.timestamp,
      })),
      routeStats: this.getRouteStats(),
      queryAnalysis: {
        totalQueries: this.queryMetrics.length,
        slowQueries: slowQueries.length,
        slowQueryPercentage: this.queryMetrics.length > 0 
          ? Number(((slowQueries.length / this.queryMetrics.length) * 100).toFixed(1))
          : 0,
        queryTypeStats,
        slowestQueries: slowQueries
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map(q => ({
            query: q.query.substring(0, 100) + (q.query.length > 100 ? '...' : ''),
            duration: Number(q.duration.toFixed(2)),
            route: q.route,
            queryType: q.queryType,
            recordCount: q.recordCount,
            timestamp: q.timestamp,
          })),
      },
      performanceTimeline: this.getPerformanceTimeline(),
    };
  }

  private getQueryTypeStats() {
    const stats = new Map<string, { count: number; totalDuration: number; avgDuration: number }>();
    
    this.queryMetrics.forEach(query => {
      const type = query.queryType || 'UNKNOWN';
      const existing = stats.get(type) || { count: 0, totalDuration: 0, avgDuration: 0 };
      
      const newStats = {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + query.duration,
        avgDuration: 0,
      };
      newStats.avgDuration = newStats.totalDuration / newStats.count;
      
      stats.set(type, newStats);
    });

    return Array.from(stats.entries()).map(([type, data]) => ({
      queryType: type,
      count: data.count,
      avgDuration: Number(data.avgDuration.toFixed(2)),
      totalDuration: Number(data.totalDuration.toFixed(2)),
    })).sort((a, b) => b.avgDuration - a.avgDuration);
  }

  private getPerformanceTimeline() {
    // Group metrics by time buckets (5-minute intervals)
    const bucketSize = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = Date.now();
    const timeline = new Map<number, {
      timestamp: number;
      requestCount: number;
      avgDuration: number;
      avgQueryTime: number;
      totalDuration: number;
      totalQueryTime: number;
    }>();

    this.metrics.forEach(metric => {
      const bucket = Math.floor(metric.timestamp.getTime() / bucketSize) * bucketSize;
      const existing = timeline.get(bucket) || {
        timestamp: bucket,
        requestCount: 0,
        avgDuration: 0,
        avgQueryTime: 0,
        totalDuration: 0,
        totalQueryTime: 0,
      };

      existing.requestCount++;
      existing.totalDuration += metric.duration;
      existing.totalQueryTime += metric.queryTime;
      existing.avgDuration = existing.totalDuration / existing.requestCount;
      existing.avgQueryTime = existing.totalQueryTime / existing.requestCount;

      timeline.set(bucket, existing);
    });

    return Array.from(timeline.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(bucket => ({
        ...bucket,
        avgDuration: Number(bucket.avgDuration.toFixed(2)),
        avgQueryTime: Number(bucket.avgQueryTime.toFixed(2)),
        timestamp: new Date(bucket.timestamp).toISOString(),
      }));
  }

  private getRouteStats() {
    const routeMap = new Map<string, { count: number; totalDuration: number; totalQueryTime: number }>();
    
    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.route}`;
      const existing = routeMap.get(key) || { count: 0, totalDuration: 0, totalQueryTime: 0 };
      
      routeMap.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + metric.duration,
        totalQueryTime: existing.totalQueryTime + metric.queryTime,
      });
    });

    return Array.from(routeMap.entries()).map(([route, stats]) => ({
      route,
      count: stats.count,
      avgDuration: Number((stats.totalDuration / stats.count).toFixed(2)),
      avgQueryTime: Number((stats.totalQueryTime / stats.count).toFixed(2)),
    })).sort((a, b) => b.avgDuration - a.avgDuration);
  }

  clearMetrics() {
    this.metrics = [];
    this.queryMetrics = [];
  }
}

// Global profiler instance
export const profiler = new PerformanceProfiler();

// Performance middleware wrapper
export function withPerformanceTracking<T>(
  handler: (request: NextRequest, ...args: any[]) => Promise<T>,
  routeName?: string
) {
  return async (request: NextRequest, ...args: any[]): Promise<T> => {
    profiler.startRequest(request);
    
    try {
      const result = await handler(request, ...args);
      
      // Try to estimate response size if it's a Response
      let responseSize: number | undefined;
      if (result && typeof result === 'object' && 'headers' in result) {
        const contentLength = (result as any).headers.get?.('content-length');
        if (contentLength) {
          responseSize = parseInt(contentLength, 10);
        }
      }
      
      profiler.endRequest(request, responseSize);
      return result;
    } catch (error) {
      profiler.endRequest(request);
      throw error;
    }
  };
}

// Database query wrapper with enhanced tracking
export function profileQuery<T>(
  query: () => Promise<T>,
  queryName: string,
  params?: any
): Promise<T> {
  const queryTracker = profiler.startQuery(queryName, params);
  
  return query()
    .then(result => {
      // Try to determine record count from result
      let recordCount: number | undefined;
      if (Array.isArray(result)) {
        recordCount = result.length;
      } else if (result && typeof result === 'object' && 'length' in result) {
        recordCount = (result as any).length;
      } else if (typeof result === 'number') {
        recordCount = result; // For count queries
      }

      if (queryTracker?.endQuery) {
        queryTracker.endQuery(recordCount);
      }
      return result;
    })
    .catch(error => {
      if (queryTracker?.endQuery) {
        queryTracker.endQuery();
      }
      throw error;
    });
}

// Enhanced query profiler for complex queries with custom record counting
export function profileQueryWithCount<T>(
  query: () => Promise<T>,
  queryName: string,
  params?: any,
  recordCountExtractor?: (result: T) => number
): Promise<T> {
  const queryTracker = profiler.startQuery(queryName, params);
  
  return query()
    .then(result => {
      let recordCount: number | undefined;
      
      if (recordCountExtractor) {
        recordCount = recordCountExtractor(result);
      } else if (Array.isArray(result)) {
        recordCount = result.length;
      } else if (typeof result === 'number') {
        recordCount = result;
      }

      if (queryTracker?.endQuery) {
        queryTracker.endQuery(recordCount);
      }
      return result;
    })
    .catch(error => {
      if (queryTracker?.endQuery) {
        queryTracker.endQuery();
      }
      throw error;
    });
}

// Memory usage monitoring
export function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
    };
  }
  return null;
} 