/**
 * Health Check API - GET /api/health
 * Provides system health status and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseConnection, runDatabasePerformanceTest } from '@/lib/database/connection';
import { profiler, getMemoryUsage } from '@/lib/utils/performance';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { addCorsHeaders } from '@/lib/utils/api-utils';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
    provider: string;
    responseTime: number;
    error?: string;
  };
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } | null;
  performance?: {
    simpleQuery: number;
    complexQuery: number;
    indexedQuery: number;
  };
  version: string;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includePerformance = searchParams.get('perf') === 'true';

    // Check database connection
    const dbHealth = await checkDatabaseConnection();
    
    // Get memory usage
    const memory = getMemoryUsage();
    
    // Calculate uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!dbHealth.connected) {
      status = 'unhealthy';
    } else if (dbHealth.responseTime > 1000) {
      status = 'degraded';
    } else if (memory && memory.heapUsed / memory.heapTotal > 0.9) {
      status = 'degraded';
    }

    const healthResponse: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      database: dbHealth,
      memory,
      version: process.env.npm_package_version || '1.0.0',
    };

    // Include performance test if requested
    if (includePerformance && dbHealth.connected) {
      try {
        const perfTest = await runDatabasePerformanceTest();
        healthResponse.performance = perfTest;
      } catch (error) {
        console.error('Performance test failed:', error);
      }
    }

    const response = NextResponse.json(createApiSuccess(healthResponse));
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: {
        connected: false,
        provider: 'unknown',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      memory: getMemoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    const response = NextResponse.json(
      createApiError(
        'HEALTH_CHECK_FAILED',
        'Health check failed',
        errorResponse,
        request.url
      ),
      { status: 503 }
    );
    
    return addCorsHeaders(response);
  }
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}