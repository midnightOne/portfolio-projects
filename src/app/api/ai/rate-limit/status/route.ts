/**
 * API endpoint for checking rate limit status
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/services/ai/rate-limiter';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { IdentifierType } from '@/lib/types/rate-limiting';

function getClientIP(req: NextRequest): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

function getIdentifier(req: NextRequest, type: IdentifierType): string {
  switch (type) {
    case 'ip':
      return getClientIP(req) || 'unknown-ip';
    case 'session':
      const sessionId = req.headers.get('x-session-id') || 
                       req.nextUrl.searchParams.get('sessionId');
      return sessionId || `ip-${getClientIP(req) || 'unknown'}`;
    case 'reflink':
      const reflink = req.nextUrl.searchParams.get('reflink');
      return reflink || 'no-reflink';
    default:
      return 'unknown';
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get parameters from query string
    const { searchParams } = req.nextUrl;
    const identifierType = (searchParams.get('type') as IdentifierType) || 'session';
    const reflinkCode = searchParams.get('reflink') || undefined;

    // Get identifier
    const identifier = getIdentifier(req, identifierType);

    // Get rate limit status
    const status = await rateLimiter.getStatus(identifier, identifierType, reflinkCode);

    return NextResponse.json(createApiSuccess({
      status,
      identifier: identifierType === 'ip' ? 'hidden' : identifier, // Hide IP for privacy
      identifierType,
    }));

  } catch (error) {
    console.error('Rate limit status check failed:', error);
    return NextResponse.json(
      createApiError(
        'RATE_LIMIT_STATUS_ERROR',
        'Failed to check rate limit status',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifierType = 'session', reflinkCode } = body;

    // Get identifier
    const identifier = getIdentifier(req, identifierType);

    // Get rate limit status
    const status = await rateLimiter.getStatus(identifier, identifierType, reflinkCode);

    return NextResponse.json(createApiSuccess({
      status,
      identifier: identifierType === 'ip' ? 'hidden' : identifier, // Hide IP for privacy
      identifierType,
    }));

  } catch (error) {
    console.error('Rate limit status check failed:', error);
    return NextResponse.json(
      createApiError(
        'RATE_LIMIT_STATUS_ERROR',
        'Failed to check rate limit status',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}