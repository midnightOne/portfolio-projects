/**
 * AI Context Injection API - POST /api/ai/context/inject
 * Handles secure context injection with access control and filtering
 * Used for dynamic context loading with reflink-based permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { contextInjector } from '@/lib/services/ai/context-injector';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface ContextInjectionRequest {
  sessionId: string;
  query: string;
  reflinkCode?: string;
  options?: {
    maxTokens?: number;
    includeProjects?: boolean;
    includeAbout?: boolean;
    includeResume?: boolean;
    contextDepth?: 'minimal' | 'standard' | 'comprehensive';
  };
}

async function contextInjectionHandler(request: NextRequest) {
  try {
    const body: ContextInjectionRequest = await request.json();
    
    const {
      sessionId,
      query,
      reflinkCode,
      options = {}
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

    // Validate and filter context based on reflink permissions
    const validation = await contextInjector.validateAndFilterContext(sessionId, reflinkCode);

    if (!validation.valid) {
      return NextResponse.json(
        createApiError(
          'ACCESS_DENIED',
          validation.error || 'Access denied',
          { accessLevel: validation.accessLevel },
          request.url
        ),
        { status: 403 }
      );
    }

    // Load filtered context with access control
    const filteredContext = await contextInjector.loadFilteredContext(
      sessionId,
      query.trim(),
      reflinkCode,
      options
    );

    const processingTime = Date.now() - startTime;

    const responseData = {
      context: {
        publicContext: filteredContext.publicContext,
        contextSources: filteredContext.contextSources,
        relevantContent: filteredContext.relevantContent,
        accessLevel: filteredContext.accessLevel,
        tokenCount: filteredContext.tokenCount,
      },
      sessionId,
      query: query.trim(),
      accessLevel: validation.accessLevel,
      capabilities: validation.capabilities,
      welcomeMessage: validation.welcomeMessage,
      processingTime,
      cacheStats: contextInjector.getCacheStats(),
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const POST = withPerformanceTracking(contextInjectionHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}