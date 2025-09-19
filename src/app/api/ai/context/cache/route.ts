/**
 * AI Context Cache Management API
 * GET /api/ai/context/cache - Get cache statistics
 * DELETE /api/ai/context/cache - Clear cache (all or specific session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { contextManager } from '@/lib/services/ai/context-manager';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

async function getCacheStats(request: NextRequest) {
  try {
    const stats = contextManager.getCacheStats();
    
    const responseData = {
      cacheSize: stats.size,
      activeSessions: stats.sessions,
      totalTokensCached: stats.totalTokens,
      timestamp: new Date().toISOString()
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

async function clearCache(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Clear specific session cache
      contextManager.clearSessionCache(sessionId);
      
      const responseData = {
        message: `Cache cleared for session: ${sessionId}`,
        sessionId,
        timestamp: new Date().toISOString()
      };

      const response = NextResponse.json(createApiSuccess(responseData));
      return addCorsHeaders(response);
    } else {
      // Clear all cache
      contextManager.clearAllCache();
      
      const responseData = {
        message: 'All cache cleared',
        timestamp: new Date().toISOString()
      };

      const response = NextResponse.json(createApiSuccess(responseData));
      return addCorsHeaders(response);
    }

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const GET = withPerformanceTracking(getCacheStats);
export const DELETE = withPerformanceTracking(clearCache);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}