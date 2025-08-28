/**
 * AI Context API - POST /api/ai/context
 * Builds intelligent context for AI conversations with caching
 * Used by the Client-Side AI Assistant system
 */

import { NextRequest, NextResponse } from 'next/server';
import { contextManager, ContextSource, ContextBuildOptions } from '@/lib/services/ai/context-manager';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface ContextRequest {
  sessionId: string;
  query: string;
  sources?: ContextSource[];
  options?: ContextBuildOptions;
  useCache?: boolean;
}

async function contextHandler(request: NextRequest) {
  try {
    const body: ContextRequest = await request.json();
    
    const {
      sessionId,
      query,
      sources = [],
      options = {},
      useCache = true
    } = body;

    // Validate required fields
    if (!sessionId || !query) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'sessionId and query are required',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    if (query.trim().length < 2) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Query must be at least 2 characters long',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    const startTime = Date.now();

    let result;
    
    if (useCache) {
      // Use caching
      result = await contextManager.buildContextWithCaching(
        sessionId,
        sources,
        query.trim(),
        options
      );
    } else {
      // Build fresh context
      const context = await contextManager.buildContext(sources, query.trim(), options);
      result = { context, fromCache: false };
    }

    const processingTime = Date.now() - startTime;

    const responseData = {
      context: result.context,
      fromCache: result.fromCache,
      sessionId,
      query: query.trim(),
      processingTime,
      tokenCount: Math.ceil(result.context.length / 4), // Rough token estimate
      cacheStats: contextManager.getCacheStats()
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const POST = withPerformanceTracking(contextHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}