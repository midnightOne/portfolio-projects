/**
 * Voice Session Initialization API - POST /api/ai/voice/session-init
 * Generates ephemeral tokens with server-injected context for voice AI providers
 * Handles secure context injection via Context Provider system
 */

import { NextRequest, NextResponse } from 'next/server';
import { contextInjector, TokenGenerationRequest } from '@/lib/services/ai/context-injector';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface VoiceSessionInitRequest {
  sessionId: string;
  provider: 'openai' | 'elevenlabs';
  reflinkCode?: string;
  query?: string;
  contextConfig?: {
    maxTokens?: number;
    includeProjects?: boolean;
    includeAbout?: boolean;
    includeResume?: boolean;
    contextDepth?: 'minimal' | 'standard' | 'comprehensive';
  };
}

async function voiceSessionInitHandler(request: NextRequest) {
  try {
    const body: VoiceSessionInitRequest = await request.json();
    
    const {
      sessionId,
      provider,
      reflinkCode,
      query,
      contextConfig
    } = body;

    // Validate required fields
    if (!sessionId || !provider) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'sessionId and provider are required',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    if (!['openai', 'elevenlabs'].includes(provider)) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'provider must be either "openai" or "elevenlabs"',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // First validate access and capabilities
    const validation = await contextInjector.validateAndFilterContext(sessionId, reflinkCode);

    if (!validation.valid) {
      return NextResponse.json(
        createApiError(
          'ACCESS_DENIED',
          validation.error || 'Access denied',
          { 
            accessLevel: validation.accessLevel,
            capabilities: validation.capabilities 
          },
          request.url
        ),
        { status: 403 }
      );
    }

    // Check if voice AI is enabled for this access level
    if (!validation.capabilities.voiceAI) {
      return NextResponse.json(
        createApiError(
          'FEATURE_DISABLED',
          'Voice AI features are not enabled for your access level',
          { 
            accessLevel: validation.accessLevel,
            capabilities: validation.capabilities,
            upgradeMessage: 'Contact the portfolio owner for enhanced AI access'
          },
          request.url
        ),
        { status: 403 }
      );
    }

    // Generate ephemeral token with injected context
    const tokenRequest: TokenGenerationRequest = {
      sessionId,
      provider,
      reflinkCode,
      query: query || 'general conversation',
      contextConfig,
    };

    const tokenResult = await contextInjector.generateEphemeralToken(tokenRequest);

    if (!tokenResult.success) {
      return NextResponse.json(
        createApiError(
          'TOKEN_GENERATION_FAILED',
          tokenResult.error || 'Failed to generate ephemeral token',
          null,
          request.url
        ),
        { status: 500 }
      );
    }

    const processingTime = Date.now() - startTime;

    const responseData = {
      ephemeralToken: tokenResult.ephemeralToken,
      publicContext: tokenResult.publicContext,
      welcomeMessage: tokenResult.welcomeMessage,
      accessLevel: tokenResult.accessLevel,
      capabilities: validation.capabilities,
      budgetStatus: tokenResult.budgetStatus,
      provider,
      sessionId,
      processingTime,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const POST = withPerformanceTracking(voiceSessionInitHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}