import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseConnection, runDatabasePerformanceTest } from "@/lib/database/connection";
import { getMemoryUsage } from "@/lib/utils/performance";

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
    if (includePerformanceTest) {
      try {
        performanceTest = await runDatabasePerformanceTest();
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