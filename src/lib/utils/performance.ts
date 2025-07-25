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
      endQuery: () => this.endQuery(queryId, query, params),
    };
  }

  endQuery(queryId: string, query: string, params?: any) {
    if (!this.currentRequest) return;

    const startTime = this.currentRequest.queryStartTimes.get(queryId);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.currentRequest.totalQueryTime += duration;
    this.currentRequest.queryStartTimes.delete(queryId);

    this.queryMetrics.push({
      query: query.replace(/\s+/g, ' ').trim(),
      duration,
      params,
      timestamp: new Date(),
    });

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.warn(`🐌 Slow query (${duration.toFixed(2)}ms):`, query.substring(0, 100));
    }
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
      })),
      routeStats: this.getRouteStats(),
    };
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

// Database query wrapper
export function profileQuery<T>(
  query: () => Promise<T>,
  queryName: string,
  params?: any
): Promise<T> {
  const { endQuery } = profiler.startQuery(queryName, params);
  
  return query()
    .then(result => {
      endQuery();
      return result;
    })
    .catch(error => {
      endQuery();
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