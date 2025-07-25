/**
 * Performance Dashboard API - GET /api/admin/performance
 * Shows performance metrics, slow queries, and bottlenecks
 */

import { NextRequest, NextResponse } from 'next/server';
import { profiler, getMemoryUsage } from '@/lib/utils/performance';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { handleApiError } from '@/lib/utils/api-utils';

export async function GET(request: NextRequest) {
  try {
    const metrics = profiler.getMetrics();
    const memoryUsage = getMemoryUsage();
    
    const performanceData = {
      ...metrics,
      memory: memoryUsage,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(createApiSuccess(performanceData));
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    profiler.clearMetrics();
    
    return NextResponse.json(createApiSuccess({
      message: 'Performance metrics cleared',
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    return handleApiError(error, request);
  }
} 