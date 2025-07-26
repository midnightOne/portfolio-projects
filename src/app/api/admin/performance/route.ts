/**
 * Admin Performance API - GET /api/admin/performance
 * Provides detailed performance metrics and profiling data
 */

import { NextRequest, NextResponse } from 'next/server';
import { profiler, getMemoryUsage } from '@/lib/utils/performance';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { addCorsHeaders } from '@/lib/utils/api-utils';
import { checkDatabaseConnection, runDatabasePerformanceTest } from '@/lib/database/connection';

export async function GET(request: NextRequest) {
  try {
    // Get performance metrics from profiler
    const metrics = profiler.getMetrics();
    
    // Get current memory usage
    const memory = getMemoryUsage();
    
    // Get database health
    const dbHealth = await checkDatabaseConnection();
    
    // Run performance test if requested
    const { searchParams } = new URL(request.url);
    const includeDbTest = searchParams.get('dbtest') === 'true';
    
    let dbPerformance = null;
    if (includeDbTest && dbHealth.connected) {
      try {
        dbPerformance = await runDatabasePerformanceTest();
      } catch (error) {
        console.error('Database performance test failed:', error);
      }
    }

    const performanceData = {
      timestamp: new Date().toISOString(),
      requests: metrics.requests,
      queries: metrics.queries,
      summary: metrics.summary,
      memory,
      database: {
        ...dbHealth,
        performance: dbPerformance,
      },
      recommendations: generatePerformanceRecommendations(metrics, memory, dbHealth),
    };

    const response = NextResponse.json(createApiSuccess(performanceData));
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Performance API error:', error);
    
    const response = NextResponse.json(
      createApiError(
        'PERFORMANCE_API_ERROR',
        'Failed to retrieve performance metrics',
        error instanceof Error ? error.message : 'Unknown error',
        request.url
      ),
      { status: 500 }
    );
    
    return addCorsHeaders(response);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Clear performance metrics
    if (!type || type === 'metrics') {
      profiler.clearMetrics();
    }

    // Clear application caches (if implemented)
    if (!type || type === 'cache') {
      // Clear in-memory caches from API routes
      // This would need to be implemented in the actual cache modules
      console.log('Cache clearing requested');
    }

    const response = NextResponse.json(createApiSuccess({
      message: 'Performance data cleared successfully',
      type: type || 'all',
      timestamp: new Date().toISOString(),
    }));
    
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Performance clear error:', error);
    
    const response = NextResponse.json(
      createApiError(
        'PERFORMANCE_CLEAR_ERROR',
        'Failed to clear performance data',
        error instanceof Error ? error.message : 'Unknown error',
        request.url
      ),
      { status: 500 }
    );
    
    return addCorsHeaders(response);
  }
}

function generatePerformanceRecommendations(
  metrics: any,
  memory: any,
  dbHealth: any
): Array<{
  type: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  action?: string;
}> {
  const recommendations = [];

  // Check average response time
  if (metrics.summary?.avgDuration) {
    if (metrics.summary.avgDuration > 1000) {
      recommendations.push({
        type: 'error' as const,
        title: 'Slow Response Times',
        description: `Average response time is ${metrics.summary.avgDuration.toFixed(1)}ms, which is above the 1000ms threshold.`,
        action: 'Consider implementing caching, optimizing database queries, or scaling resources.',
      });
    } else if (metrics.summary.avgDuration > 500) {
      recommendations.push({
        type: 'warning' as const,
        title: 'Moderate Response Times',
        description: `Average response time is ${metrics.summary.avgDuration.toFixed(1)}ms. Room for improvement.`,
        action: 'Review slow queries and consider adding response caching.',
      });
    } else if (metrics.summary.avgDuration < 200) {
      recommendations.push({
        type: 'info' as const,
        title: 'Excellent Performance',
        description: `Average response time of ${metrics.summary.avgDuration.toFixed(1)}ms is excellent.`,
      });
    }
  }

  // Check database performance
  if (dbHealth.responseTime > 500) {
    recommendations.push({
      type: 'warning' as const,
      title: 'Slow Database Connection',
      description: `Database response time is ${dbHealth.responseTime.toFixed(1)}ms.`,
      action: 'Check database connection pooling and consider upgrading database resources.',
    });
  }

  // Check memory usage
  if (memory && memory.heapUsed / memory.heapTotal > 0.8) {
    recommendations.push({
      type: 'warning' as const,
      title: 'High Memory Usage',
      description: `Memory usage is at ${((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)}%.`,
      action: 'Monitor for memory leaks and consider increasing available memory.',
    });
  }

  // Check for slow queries
  if (metrics.summary?.avgQueryTime > 100) {
    recommendations.push({
      type: 'warning' as const,
      title: 'Slow Database Queries',
      description: `Average query time is ${metrics.summary.avgQueryTime.toFixed(1)}ms.`,
      action: 'Review database indexes and optimize slow queries.',
    });
  }

  // Check request volume
  if (metrics.summary?.totalRequests > 100) {
    recommendations.push({
      type: 'info' as const,
      title: 'High Request Volume',
      description: `Processed ${metrics.summary.totalRequests} requests. Consider implementing rate limiting.`,
    });
  }

  return recommendations;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}