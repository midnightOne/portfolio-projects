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
 * Enhanced abuse detection middleware
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

      const userAgent = req.headers.get('user-agent') || '';
      const endpoint = req.nextUrl.pathname;
      const queryString = req.nextUrl.searchParams.toString();

      // Enhanced suspicious pattern detection
      const suspiciousPatterns = [
        // Malicious user agents
        /bot|crawler|spider|scraper|automated|script/i.test(userAgent),
        // Programming language user agents
        /curl|wget|python|java|node|php/i.test(userAgent),
        // Suspicious query parameters
        queryString.length > 1000,
        // Missing common headers
        !req.headers.get('accept'),
        // Unusual accept headers
        req.headers.get('accept') === '*/*' && !userAgent.includes('curl'),
        // Missing referer on non-direct requests
        !req.headers.get('referer') && req.method === 'POST',
        // Suspicious content-length
        req.headers.get('content-length') && parseInt(req.headers.get('content-length')!) > 100000,
      ];

      const suspiciousScore = suspiciousPatterns.filter(Boolean).length;
      const reasons: string[] = [];

      if (suspiciousPatterns[0]) reasons.push('Suspicious user agent');
      if (suspiciousPatterns[1]) reasons.push('Programming language user agent');
      if (suspiciousPatterns[2]) reasons.push('Excessive query parameters');
      if (suspiciousPatterns[3]) reasons.push('Missing accept header');
      if (suspiciousPatterns[4]) reasons.push('Generic accept header');
      if (suspiciousPatterns[5]) reasons.push('Missing referer on POST');
      if (suspiciousPatterns[6]) reasons.push('Large content length');

      if (suspiciousScore >= 2) {
        const { securityNotifier } = await import('@/lib/services/ai/security-notifier');
        
        // Record violation
        const violationResult = await blacklistManager.recordViolation(
          ipAddress,
          'suspicious_activity',
          {
            userAgent,
            endpoint,
            suspiciousScore,
            reasons,
            queryLength: queryString.length,
            contentLength: req.headers.get('content-length'),
          }
        );

        // Send notification for high-risk activity
        if (suspiciousScore >= 3 || violationResult.blacklisted) {
          await securityNotifier.notifyWarning(
            ipAddress,
            `Suspicious activity detected (score: ${suspiciousScore}): ${reasons.join(', ')}`,
            {
              endpoint,
              userAgent,
              metadata: {
                suspiciousScore,
                reasons,
                violationCount: violationResult.violationCount,
                blacklisted: violationResult.blacklisted,
              },
            }
          );

          // Send blacklist notification if IP was blacklisted
          if (violationResult.blacklisted) {
            const blacklistResult = await blacklistManager.isBlacklisted(ipAddress);
            if (blacklistResult.entry) {
              await securityNotifier.notifyBlacklist(ipAddress, blacklistResult.entry, {
                endpoint,
                userAgent,
              });
            }
          }
        }

        // Block if score is very high
        if (suspiciousScore >= 4) {
          return NextResponse.json(
            createApiError(
              'SUSPICIOUS_ACTIVITY',
              'Request blocked due to suspicious activity',
              { 
                reasons,
                suspiciousScore,
              },
              req.nextUrl.pathname
            ),
            { status: 403 }
          );
        }
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
 * Enhanced content analysis middleware using AI-powered abuse detection
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

      // Extract text content from request body
      const textContent = extractTextFromBody(body);
      if (!textContent || textContent.trim().length === 0) {
        return handler(req);
      }

      // Use enhanced abuse detection
      const { abuseDetector } = await import('@/lib/services/ai/abuse-detector');
      const { securityNotifier } = await import('@/lib/services/ai/security-notifier');
      
      const ipAddress = getClientIP(req);
      const userAgent = req.headers.get('user-agent') || undefined;
      const endpoint = req.nextUrl.pathname;

      const analysisResult = await abuseDetector.analyzeContent(textContent, {
        ipAddress,
        userAgent,
        endpoint,
      });

      // Handle analysis results
      if (analysisResult.suggestedAction === 'block') {
        if (ipAddress) {
          const violationResult = await abuseDetector.recordViolation(
            ipAddress,
            analysisResult,
            {
              endpoint,
              userAgent,
              content: textContent,
            }
          );

          // Send notification if needed
          if (violationResult.shouldNotify) {
            await securityNotifier.notifyViolation(ipAddress, analysisResult, {
              endpoint,
              userAgent,
              violationCount: violationResult.violationCount,
              content: textContent,
            });

            // Send blacklist notification if IP was blacklisted
            if (violationResult.blacklisted) {
              const blacklistResult = await blacklistManager.isBlacklisted(ipAddress);
              if (blacklistResult.entry) {
                await securityNotifier.notifyBlacklist(ipAddress, blacklistResult.entry, {
                  endpoint,
                  userAgent,
                });
              }
            }
          }
        }

        return NextResponse.json(
          createApiError(
            'CONTENT_VIOLATION',
            'Content violates usage policies',
            { 
              reasons: analysisResult.reasons,
              severity: analysisResult.severity,
              confidence: analysisResult.confidence,
            },
            req.nextUrl.pathname
          ),
          { status: 400 }
        );
      } else if (analysisResult.suggestedAction === 'warn') {
        // Log warning but allow request to proceed
        if (ipAddress) {
          await securityNotifier.notifyWarning(
            ipAddress,
            `Potentially inappropriate content detected: ${analysisResult.reasons.join(', ')}`,
            {
              endpoint,
              userAgent,
              metadata: {
                confidence: analysisResult.confidence,
                severity: analysisResult.severity,
                contentLength: textContent.length,
              },
            }
          );
        }
      }

      return handler(req);
    } catch (error) {
      console.error('Content analysis middleware error:', error);
      // Don't block request on content analysis errors
      return handler(req);
    }
  };
}

/**
 * Extract text content from request body for analysis
 */
function extractTextFromBody(body: any): string {
  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object' && body !== null) {
    // Common fields that might contain user content
    const textFields = ['content', 'message', 'text', 'query', 'prompt', 'description', 'jobSpec'];
    const textParts: string[] = [];

    for (const field of textFields) {
      if (body[field] && typeof body[field] === 'string') {
        textParts.push(body[field]);
      }
    }

    // If no specific fields found, stringify the entire body
    if (textParts.length === 0) {
      return JSON.stringify(body);
    }

    return textParts.join(' ');
  }

  return '';
}