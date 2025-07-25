import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseConnection, runDatabasePerformanceTest } from "@/lib/database/connection";
import { getMemoryUsage } from "@/lib/utils/performance";

// Cache for performance test results to avoid repeated expensive queries
const performanceTestCache = new Map<string, { data: any; timestamp: number }>();

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Check database connection
    const dbHealth = await checkDatabaseConnection();
    
    // Get memory usage
    const memory = getMemoryUsage();
    
    // Run basic performance test if requested
    const url = new URL(request.url);
    const includePerformanceTest = url.searchParams.get('perf') === 'true';
    
    let performanceTest = null;
    // Optional performance test for detailed health check - CACHED to avoid repeated slow queries
    if (includePerformanceTest) {
      try {
        // Cache performance test results for 60 seconds to avoid repeated expensive queries
        const cacheKey = 'health-perf-test';
        const cached = performanceTestCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
          performanceTest = cached.data;
        } else {
          performanceTest = await runDatabasePerformanceTest();
          performanceTestCache.set(cacheKey, {
            data: performanceTest,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        performanceTest = { error: 'Performance test failed' };
      }
    }
    
    const responseTime = performance.now() - startTime;
    
    const healthStatus = {
      status: dbHealth.connected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTime: Number(responseTime.toFixed(2)),
      database: {
        connected: dbHealth.connected,
        provider: dbHealth.provider,
        responseTime: dbHealth.responseTime,
        error: dbHealth.error,
      },
      memory,
      performance: performanceTest,
      uptime: process.uptime ? Math.floor(process.uptime()) : null,
    };
    
    return NextResponse.json(
      healthStatus,
      { 
        status: dbHealth.connected ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        responseTime: Number(responseTime.toFixed(2)),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}