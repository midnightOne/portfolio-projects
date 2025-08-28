/**
 * Rate limiting middleware for AI assistant endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/services/ai/rate-limiter';
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';
import {
  RateLimitCheckParams,
  IdentifierType,
  RateLimitError,
  SecurityViolationError,
} from '@/lib/types/rate-limiting';
import { createApiError } from '@/lib/types/api';

export interface RateLimitOptions {
  identifierType: IdentifierType;
  skipBlacklistCheck?: boolean;
  customIdentifier?: (req: NextRequest) => string;
}

/**
 * Rate limiting middleware factory
 */
export function withRateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Extract request information
      const ipAddress = getClientIP(req);
      const userAgent = req.headers.get('user-agent') || undefined;
      const reflinkCode = getReflinkFromRequest(req);
      const endpoint = req.nextUrl.pathname;

      // Determine identifier
      const identifier = options.customIdentifier 
        ? options.customIdentifier(req)
        : getIdentifier(req, options.identifierType);

      // Check IP blacklist first (unless skipped)
      if (!options.skipBlacklistCheck && ipAddress) {
        const blacklistResult = await blacklistManager.isBlacklisted(ipAddress);
        if (blacklistResult.blacklisted) {
          return NextResponse.json(
            createApiError(
              'IP_BLACKLISTED',
              'Access denied: IP address is blacklisted',
              { reason: blacklistResult.reason },
              endpoint
            ),
            { status: 403 }
          );
        }
      }

      // Prepare rate limit check parameters
      const rateLimitParams: RateLimitCheckParams = {
        identifier,
        identifierType: options.identifierType,
        endpoint,
        reflinkCode,
        userAgent,
        ipAddress,
      };

      // Check rate limit
      const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitParams);

      if (!rateLimitResult.success) {
        // Add rate limit headers
        const response = NextResponse.json(
          createApiError(
            'RATE_LIMIT_EXCEEDED',
            'Rate limit exceeded',
            {
              requestsRemaining: rateLimitResult.status.requestsRemaining,
              dailyLimit: rateLimitResult.status.dailyLimit,
              resetTime: rateLimitResult.status.resetTime,
              tier: rateLimitResult.status.tier,
            },
            endpoint
          ),
          { status: 429 }
        );

        // Add standard rate limit headers
        response.headers.set('X-RateLimit-Limit', rateLimitResult.status.dailyLimit.toString());
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.status.requestsRemaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.status.resetTime.getTime() / 1000).toString());
        response.headers.set('Retry-After', Math.ceil((rateLimitResult.status.resetTime.getTime() - Date.now()) / 1000).toString());

        return response;
      }

      // Rate limit passed, proceed with request
      const response = await handler(req);

      // Add rate limit headers to successful response
      response.headers.set('X-RateLimit-Limit', rateLimitResult.status.dailyLimit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.status.requestsRemaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.status.resetTime.getTime() / 1000).toString());

      return response;

    } catch (error) {
      console.error('Rate limiting middleware error:', error);

      if (error instanceof RateLimitError) {
        return NextResponse.json(
          createApiError(
            'RATE_LIMIT_ERROR',
            error.message,
            { status: error.status },
            req.nextUrl.pathname
          ),
          { status: 429 }
        );
      }

      if (error instanceof SecurityViolationError) {
        return NextResponse.json(
          createApiError(
            'SECURITY_VIOLATION',
            error.message,
            { 
              reason: error.reason,
              ipAddress: error.ipAddress,
              violationCount: error.violationCount,
            },
            req.nextUrl.pathname
          ),
          { status: 403 }
        );
      }

      // For other errors, allow request to proceed but log the error
      console.error('Rate limiting failed, allowing request:', error);
      return handler(req);
    }
  };
}

/**
 * Get client IP address from request
 */
function getClientIP(req: NextRequest): string | undefined {
  // Check various headers for IP address
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to connection remote address (may not be available in all environments)
  return '127.0.0.1';
}

/**
 * Get reflink code from request (query param or header)
 */
function getReflinkFromRequest(req: NextRequest): string | undefined {
  // Check query parameter first
  const queryReflink = req.nextUrl.searchParams.get('reflink');
  if (queryReflink) {
    return queryReflink;
  }

  // Check custom header
  const headerReflink = req.headers.get('x-reflink');
  if (headerReflink) {
    return headerReflink;
  }

  return undefined;
}

/**
 * Get identifier based on type
 */
function getIdentifier(req: NextRequest, type: IdentifierType): string {
  switch (type) {
    case 'ip':
      return getClientIP(req) || 'unknown-ip';
    
    case 'session':
      // Try to get session ID from various sources
      const sessionId = req.headers.get('x-session-id') || 
                       req.cookies.get('session-id')?.value ||
                       req.nextUrl.searchParams.get('sessionId');
      return sessionId || `ip-${getClientIP(req) || 'unknown'}`;
    
    case 'reflink':
      const reflink = getReflinkFromRequest(req);
      return reflink || 'no-reflink';
    
    default:
      return 'unknown';
  }
}

/**
 * Utility function to apply rate limiting to API routes
 */
export function createRateLimitedHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  const middleware = withRateLimit(options);
  return (req: NextRequest) => middleware(req, handler);
}

/**
 * Common rate limiting configurations
 */
export const RATE_LIMIT_CONFIGS = {
  // For general AI chat endpoints
  AI_CHAT: {
    identifierType: 'session' as IdentifierType,
  },

  // For job analysis endpoints (more restrictive)
  JOB_ANALYSIS: {
    identifierType: 'ip' as IdentifierType,
  },

  // For admin endpoints (IP-based)
  ADMIN: {
    identifierType: 'ip' as IdentifierType,
    skipBlacklistCheck: true, // Admins bypass blacklist
  },

  // For public endpoints with reflink support
  PUBLIC_WITH_REFLINK: {
    identifierType: 'session' as IdentifierType,
  },
} as const;

/**
 * Abuse detection middleware
 */
export function withAbuseDetection() {
  return async function abuseDetectionMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      const ipAddress = getClientIP(req);
      
      if (!ipAddress) {
        return handler(req);
      }

      // Check for suspicious patterns in request
      const suspiciousPatterns = [
        // Rapid requests (this would be handled by rate limiting)
        // Malicious user agents
        /bot|crawler|spider|scraper/i.test(req.headers.get('user-agent') || ''),
        // Suspicious query parameters
        req.nextUrl.searchParams.toString().length > 1000,
        // Missing common headers
        !req.headers.get('accept'),
      ];

      const suspiciousScore = suspiciousPatterns.filter(Boolean).length;

      if (suspiciousScore >= 2) {
        // Record violation but don't block immediately
        await blacklistManager.recordViolation(
          ipAddress,
          'suspicious_activity',
          {
            userAgent: req.headers.get('user-agent'),
            endpoint: req.nextUrl.pathname,
            suspiciousScore,
          }
        );
      }

      return handler(req);
    } catch (error) {
      console.error('Abuse detection middleware error:', error);
      // Don't block request on abuse detection errors
      return handler(req);
    }
  };
}

/**
 * Content analysis middleware for detecting inappropriate content
 */
export function withContentAnalysis() {
  return async function contentAnalysisMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Only analyze POST requests with body content
      if (req.method !== 'POST') {
        return handler(req);
      }

      const contentType = req.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return handler(req);
      }

      // Clone request to read body
      const body = await req.clone().json().catch(() => null);
      if (!body) {
        return handler(req);
      }

      // Simple content analysis (can be enhanced with AI-based detection)
      const textContent = JSON.stringify(body).toLowerCase();
      const inappropriatePatterns = [
        /spam/g,
        /advertisement/g,
        /buy now/g,
        /click here/g,
        // Add more patterns as needed
      ];

      const violations = inappropriatePatterns.reduce((count, pattern) => {
        const matches = textContent.match(pattern);
        return count + (matches ? matches.length : 0);
      }, 0);

      if (violations > 3) {
        const ipAddress = getClientIP(req);
        if (ipAddress) {
          await blacklistManager.recordViolation(
            ipAddress,
            'inappropriate_content',
            {
              endpoint: req.nextUrl.pathname,
              violations,
              contentLength: textContent.length,
            }
          );
        }

        return NextResponse.json(
          createApiError(
            'CONTENT_VIOLATION',
            'Content violates usage policies',
            { violations },
            req.nextUrl.pathname
          ),
          { status: 400 }
        );
      }

      return handler(req);
    } catch (error) {
      console.error('Content analysis middleware error:', error);
      // Don't block request on content analysis errors
      return handler(req);
    }
  };
}