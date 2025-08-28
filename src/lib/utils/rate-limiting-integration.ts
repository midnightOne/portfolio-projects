/**
 * Utility functions for integrating rate limiting with existing systems
 */

import { NextRequest } from 'next/server';
import { rateLimiter } from '@/lib/services/ai/rate-limiter';
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import {
  RateLimitStatus,
  RateLimitCheckParams,
  IdentifierType,
  RateLimitError,
  SecurityViolationError,
} from '@/lib/types/rate-limiting';

/**
 * Extract client information from request
 */
export function extractClientInfo(req: NextRequest) {
  // Get IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ipAddress = forwarded 
    ? forwarded.split(',')[0].trim()
    : req.headers.get('x-real-ip') || undefined;

  // Get user agent
  const userAgent = req.headers.get('user-agent') || undefined;

  // Get session ID from various sources
  const sessionId = req.headers.get('x-session-id') || 
                   req.cookies.get('session-id')?.value ||
                   req.nextUrl.searchParams.get('sessionId');

  // Get reflink from query or header
  const reflinkCode = req.nextUrl.searchParams.get('reflink') ||
                     req.headers.get('x-reflink') || undefined;

  return {
    ipAddress,
    userAgent,
    sessionId,
    reflinkCode,
    endpoint: req.nextUrl.pathname,
  };
}

/**
 * Check rate limit for a request
 */
export async function checkRequestRateLimit(
  req: NextRequest,
  identifierType: IdentifierType = 'session'
): Promise<{
  allowed: boolean;
  status: RateLimitStatus;
  headers: Record<string, string>;
}> {
  const clientInfo = extractClientInfo(req);
  
  // Determine identifier based on type
  let identifier: string;
  switch (identifierType) {
    case 'ip':
      identifier = clientInfo.ipAddress || 'unknown-ip';
      break;
    case 'session':
      identifier = clientInfo.sessionId || `ip-${clientInfo.ipAddress || 'unknown'}`;
      break;
    case 'reflink':
      identifier = clientInfo.reflinkCode || 'no-reflink';
      break;
    default:
      identifier = 'unknown';
  }

  const params: RateLimitCheckParams = {
    identifier,
    identifierType,
    endpoint: clientInfo.endpoint,
    reflinkCode: clientInfo.reflinkCode,
    userAgent: clientInfo.userAgent,
    ipAddress: clientInfo.ipAddress,
  };

  const result = await rateLimiter.checkRateLimit(params);

  // Prepare headers
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.status.dailyLimit.toString(),
    'X-RateLimit-Remaining': result.status.requestsRemaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.status.resetTime.getTime() / 1000).toString(),
  };

  if (!result.success) {
    headers['Retry-After'] = Math.ceil((result.status.resetTime.getTime() - Date.now()) / 1000).toString();
  }

  return {
    allowed: result.success,
    status: result.status,
    headers,
  };
}

/**
 * Validate reflink and get its configuration
 */
export async function validateReflink(code: string) {
  return await reflinkManager.validateReflink(code);
}

/**
 * Check if IP is blacklisted
 */
export async function checkIPBlacklist(ipAddress: string) {
  return await blacklistManager.isBlacklisted(ipAddress);
}

/**
 * Record a security violation
 */
export async function recordSecurityViolation(
  ipAddress: string,
  reason: string,
  metadata?: Record<string, any>
) {
  return await blacklistManager.recordViolation(ipAddress, reason, metadata);
}

/**
 * Get rate limit status for display to users
 */
export async function getRateLimitStatusForUser(
  req: NextRequest,
  identifierType: IdentifierType = 'session'
): Promise<{
  status: RateLimitStatus;
  identifier: string;
  identifierType: IdentifierType;
}> {
  const clientInfo = extractClientInfo(req);
  
  let identifier: string;
  switch (identifierType) {
    case 'ip':
      identifier = 'hidden'; // Don't expose IP to users
      break;
    case 'session':
      identifier = clientInfo.sessionId || 'anonymous';
      break;
    case 'reflink':
      identifier = clientInfo.reflinkCode || 'none';
      break;
    default:
      identifier = 'unknown';
  }

  const actualIdentifier = identifierType === 'ip' 
    ? clientInfo.ipAddress || 'unknown-ip'
    : identifier;

  const status = await rateLimiter.getStatus(
    actualIdentifier,
    identifierType,
    clientInfo.reflinkCode
  );

  return {
    status,
    identifier,
    identifierType,
  };
}

/**
 * Create rate limit error response data
 */
export function createRateLimitErrorData(
  status: RateLimitStatus,
  message: string = 'Rate limit exceeded'
) {
  return {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      details: {
        requestsRemaining: status.requestsRemaining,
        dailyLimit: status.dailyLimit,
        resetTime: status.resetTime,
        tier: status.tier,
        retryAfter: Math.ceil((status.resetTime.getTime() - Date.now()) / 1000),
      },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create security violation error response data
 */
export function createSecurityViolationErrorData(
  reason: string,
  ipAddress: string,
  violationCount: number,
  message: string = 'Security violation detected'
) {
  return {
    error: {
      code: 'SECURITY_VIOLATION',
      message,
      details: {
        reason,
        violationCount,
        // Don't expose IP address in response for privacy
        blocked: violationCount >= 2,
      },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Middleware helper for applying rate limiting to API routes
 */
export function createRateLimitMiddleware(
  identifierType: IdentifierType = 'session',
  options?: {
    skipBlacklistCheck?: boolean;
    customErrorMessage?: string;
  }
) {
  return async function(req: NextRequest) {
    try {
      const clientInfo = extractClientInfo(req);

      // Check IP blacklist first (unless skipped)
      if (!options?.skipBlacklistCheck && clientInfo.ipAddress) {
        const blacklistResult = await checkIPBlacklist(clientInfo.ipAddress);
        if (blacklistResult.blacklisted) {
          throw new SecurityViolationError(
            'Access denied: IP address is blacklisted',
            blacklistResult.reason || 'blacklisted',
            clientInfo.ipAddress,
            blacklistResult.entry?.violationCount || 1
          );
        }
      }

      // Check rate limit
      const rateLimitResult = await checkRequestRateLimit(req, identifierType);
      
      if (!rateLimitResult.allowed) {
        throw new RateLimitError(
          options?.customErrorMessage || 'Rate limit exceeded',
          rateLimitResult.status
        );
      }

      return {
        allowed: true,
        status: rateLimitResult.status,
        headers: rateLimitResult.headers,
      };

    } catch (error) {
      if (error instanceof RateLimitError || error instanceof SecurityViolationError) {
        throw error;
      }
      
      console.error('Rate limiting middleware error:', error);
      // Allow request to proceed on unexpected errors
      return {
        allowed: true,
        status: {
          allowed: true,
          requestsRemaining: 999,
          dailyLimit: 999,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          tier: 'STANDARD' as const,
        },
        headers: {},
      };
    }
  };
}

/**
 * Cleanup utility for expired records
 */
export async function performRateLimitCleanup() {
  try {
    await Promise.all([
      rateLimiter.cleanupExpiredRecords(),
      blacklistManager.cleanupOldEntries(),
      reflinkManager.cleanupExpiredReflinks(),
    ]);
    
    console.log('Rate limiting cleanup completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Rate limiting cleanup failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get comprehensive rate limiting status for admin dashboard
 */
export async function getAdminRateLimitStatus(days: number = 7) {
  try {
    const [rateLimitAnalytics, securityAnalytics] = await Promise.all([
      rateLimiter.getAnalytics(days),
      blacklistManager.getSecurityAnalytics(days),
    ]);

    return {
      rateLimiting: rateLimitAnalytics,
      security: securityAnalytics,
      summary: {
        totalRequests: rateLimitAnalytics.totalRequests,
        blockedRequests: rateLimitAnalytics.blockedRequests,
        uniqueUsers: rateLimitAnalytics.uniqueUsers,
        blacklistedIPs: securityAnalytics.totalBlacklisted,
        blockRate: rateLimitAnalytics.totalRequests > 0 
          ? (rateLimitAnalytics.blockedRequests / rateLimitAnalytics.totalRequests) * 100 
          : 0,
      },
    };
  } catch (error) {
    console.error('Failed to get admin rate limit status:', error);
    throw error;
  }
}