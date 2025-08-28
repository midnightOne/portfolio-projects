/**
 * Rate limiting service for AI assistant
 * Implements per-IP and per-session rate limiting with reflink-based access control
 */

import { PrismaClient } from '@prisma/client';
import {
  RateLimitStatus,
  RateLimitResult,
  RateLimitCheckParams,
  RateLimitTier,
  IdentifierType,
  RATE_LIMIT_TIERS,
  RateLimitError,
  RateLimitConfig,
  RateLimitAnalytics,
} from '@/lib/types/rate-limiting';

const prisma = new PrismaClient();

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowSizeMs: 24 * 60 * 60 * 1000, // 24 hours
      defaultDailyLimit: 50,
      cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
      logRetentionDays: 30,
      ...config,
    };
  }

  /**
   * Check if a request is allowed based on rate limits
   */
  async checkRateLimit(params: RateLimitCheckParams): Promise<RateLimitResult> {
    try {
      // Check if IP is blacklisted first
      if (params.ipAddress) {
        const isBlacklisted = await this.isIPBlacklisted(params.ipAddress);
        if (isBlacklisted) {
          return {
            success: false,
            status: this.createBlockedStatus('IP blacklisted'),
            blocked: true,
            reason: 'IP address is blacklisted',
          };
        }
      }

      // Get rate limit configuration
      const rateLimitConfig = await this.getRateLimitConfig(params.reflinkCode);
      
      // Get current usage
      const currentUsage = await this.getCurrentUsage(
        params.identifier,
        params.identifierType,
        rateLimitConfig.reflinkId
      );

      // Calculate remaining requests
      const requestsRemaining = Math.max(0, rateLimitConfig.dailyLimit - currentUsage.requestsCount);
      const allowed = requestsRemaining > 0;

      const status: RateLimitStatus = {
        allowed,
        requestsRemaining,
        dailyLimit: rateLimitConfig.dailyLimit,
        resetTime: currentUsage.windowEnd,
        tier: rateLimitConfig.tier,
        reflinkCode: params.reflinkCode,
      };

      // Log the request
      await this.logRequest({
        ...params,
        reflinkId: rateLimitConfig.reflinkId,
        wasBlocked: !allowed,
        requestsRemaining,
      });

      if (!allowed) {
        return {
          success: false,
          status,
          blocked: true,
          reason: 'Rate limit exceeded',
        };
      }

      // Increment usage if allowed
      await this.incrementUsage(
        params.identifier,
        params.identifierType,
        rateLimitConfig.reflinkId
      );

      return {
        success: true,
        status: {
          ...status,
          requestsRemaining: requestsRemaining - 1,
        },
        blocked: false,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      throw new RateLimitError('Rate limit check failed', this.createBlockedStatus('Internal error'));
    }
  }

  /**
   * Get rate limit configuration for a reflink or default
   */
  private async getRateLimitConfig(reflinkCode?: string): Promise<{
    dailyLimit: number;
    tier: RateLimitTier;
    reflinkId?: string;
  }> {
    if (!reflinkCode) {
      return {
        dailyLimit: this.config.defaultDailyLimit,
        tier: 'STANDARD',
      };
    }

    const reflink = await prisma.aIReflink.findUnique({
      where: { code: reflinkCode },
    });

    if (!reflink || !reflink.isActive) {
      return {
        dailyLimit: this.config.defaultDailyLimit,
        tier: 'STANDARD',
      };
    }

    // Check if reflink is expired
    if (reflink.expiresAt && reflink.expiresAt < new Date()) {
      return {
        dailyLimit: this.config.defaultDailyLimit,
        tier: 'STANDARD',
      };
    }

    return {
      dailyLimit: reflink.dailyLimit,
      tier: reflink.rateLimitTier as RateLimitTier,
      reflinkId: reflink.id,
    };
  }

  /**
   * Get current usage for an identifier within the current window
   */
  private async getCurrentUsage(
    identifier: string,
    identifierType: IdentifierType,
    reflinkId?: string
  ): Promise<{
    requestsCount: number;
    windowStart: Date;
    windowEnd: Date;
  }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowSizeMs);
    const windowEnd = new Date(windowStart.getTime() + this.config.windowSizeMs);

    // Try to find existing rate limit record for current window
    let rateLimit = await prisma.aIRateLimit.findFirst({
      where: {
        identifier,
        identifierType,
        reflinkId,
        windowStart: {
          lte: now,
        },
        windowEnd: {
          gt: now,
        },
      },
    });

    if (!rateLimit) {
      // Create new rate limit record for current window
      rateLimit = await prisma.aIRateLimit.create({
        data: {
          identifier,
          identifierType,
          requestsCount: 0,
          windowStart,
          windowEnd,
          reflinkId,
        },
      });
    }

    return {
      requestsCount: rateLimit.requestsCount,
      windowStart: rateLimit.windowStart,
      windowEnd: rateLimit.windowEnd,
    };
  }

  /**
   * Increment usage count for an identifier
   */
  private async incrementUsage(
    identifier: string,
    identifierType: IdentifierType,
    reflinkId?: string
  ): Promise<void> {
    const now = new Date();
    
    await prisma.aIRateLimit.updateMany({
      where: {
        identifier,
        identifierType,
        reflinkId,
        windowStart: {
          lte: now,
        },
        windowEnd: {
          gt: now,
        },
      },
      data: {
        requestsCount: {
          increment: 1,
        },
        updatedAt: now,
      },
    });
  }

  /**
   * Check if an IP address is blacklisted
   */
  private async isIPBlacklisted(ipAddress: string): Promise<boolean> {
    const blacklistEntry = await prisma.aIIPBlacklist.findUnique({
      where: { ipAddress },
    });

    if (!blacklistEntry) {
      return false;
    }

    // Check if IP has been reinstated
    if (blacklistEntry.reinstatedAt) {
      return false;
    }

    return true;
  }

  /**
   * Log a rate limit request for analytics
   */
  private async logRequest(params: {
    identifier: string;
    identifierType: IdentifierType;
    endpoint: string;
    reflinkId?: string;
    userAgent?: string;
    ipAddress?: string;
    wasBlocked: boolean;
    requestsRemaining: number;
  }): Promise<void> {
    try {
      await prisma.aIRateLimitLog.create({
        data: {
          identifier: params.identifier,
          identifierType: params.identifierType,
          endpoint: params.endpoint,
          reflinkId: params.reflinkId,
          userAgent: params.userAgent,
          ipAddress: params.ipAddress,
          wasBlocked: params.wasBlocked,
          requestsRemaining: params.requestsRemaining,
        },
      });
    } catch (error) {
      console.error('Failed to log rate limit request:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Create a blocked status response
   */
  private createBlockedStatus(reason: string): RateLimitStatus {
    return {
      allowed: false,
      requestsRemaining: 0,
      dailyLimit: 0,
      resetTime: new Date(Date.now() + this.config.windowSizeMs),
      tier: 'BASIC',
    };
  }

  /**
   * Clean up expired rate limit records
   */
  async cleanupExpiredRecords(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.windowSizeMs * 2);
    
    try {
      // Clean up expired rate limit records
      await prisma.aIRateLimit.deleteMany({
        where: {
          windowEnd: {
            lt: cutoffDate,
          },
        },
      });

      // Clean up old log entries
      const logCutoffDate = new Date(Date.now() - (this.config.logRetentionDays * 24 * 60 * 60 * 1000));
      await prisma.aIRateLimitLog.deleteMany({
        where: {
          timestamp: {
            lt: logCutoffDate,
          },
        },
      });

      console.log('Rate limit cleanup completed');
    } catch (error) {
      console.error('Rate limit cleanup failed:', error);
    }
  }

  /**
   * Get rate limit analytics
   */
  async getAnalytics(days: number = 7): Promise<RateLimitAnalytics> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const [
      totalRequests,
      blockedRequests,
      uniqueUsers,
      topEndpoints,
      requestsByTier,
      requestsByHour,
    ] = await Promise.all([
      // Total requests
      prisma.aIRateLimitLog.count({
        where: {
          timestamp: { gte: startDate },
        },
      }),

      // Blocked requests
      prisma.aIRateLimitLog.count({
        where: {
          timestamp: { gte: startDate },
          wasBlocked: true,
        },
      }),

      // Unique users
      prisma.aIRateLimitLog.findMany({
        where: {
          timestamp: { gte: startDate },
        },
        select: {
          identifier: true,
          identifierType: true,
        },
        distinct: ['identifier', 'identifierType'],
      }),

      // Top endpoints
      prisma.aIRateLimitLog.groupBy({
        by: ['endpoint'],
        where: {
          timestamp: { gte: startDate },
        },
        _count: {
          endpoint: true,
        },
        orderBy: {
          _count: {
            endpoint: 'desc',
          },
        },
        take: 10,
      }),

      // Requests by tier (via reflinks)
      prisma.aIRateLimitLog.findMany({
        where: {
          timestamp: { gte: startDate },
          reflinkId: { not: null },
        },
        include: {
          reflink: {
            select: {
              rateLimitTier: true,
            },
          },
        },
      }),

      // Requests by hour
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as requests,
          COUNT(*) FILTER (WHERE was_blocked = true) as blocked
        FROM ai_rate_limit_logs 
        WHERE timestamp >= ${startDate}
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY hour
      ` as Array<{ hour: Date; requests: bigint; blocked: bigint }>,
    ]);

    // Process requests by tier
    const tierCounts: Record<RateLimitTier, number> = {
      BASIC: 0,
      STANDARD: 0,
      PREMIUM: 0,
      UNLIMITED: 0,
    };

    requestsByTier.forEach((log) => {
      if (log.reflink?.rateLimitTier) {
        tierCounts[log.reflink.rateLimitTier as RateLimitTier]++;
      } else {
        tierCounts.STANDARD++; // Default tier
      }
    });

    return {
      totalRequests,
      blockedRequests,
      uniqueUsers: uniqueUsers.length,
      topEndpoints: topEndpoints.map((ep) => ({
        endpoint: ep.endpoint,
        requests: ep._count.endpoint,
      })),
      requestsByTier: tierCounts,
      requestsByHour: requestsByHour.map((row) => ({
        hour: row.hour.toISOString(),
        requests: Number(row.requests),
        blocked: Number(row.blocked),
      })),
    };
  }

  /**
   * Reset rate limits for an identifier (admin function)
   */
  async resetRateLimit(
    identifier: string,
    identifierType: IdentifierType,
    reflinkId?: string
  ): Promise<void> {
    await prisma.aIRateLimit.deleteMany({
      where: {
        identifier,
        identifierType,
        reflinkId,
      },
    });
  }

  /**
   * Get current status for an identifier
   */
  async getStatus(
    identifier: string,
    identifierType: IdentifierType,
    reflinkCode?: string
  ): Promise<RateLimitStatus> {
    const rateLimitConfig = await this.getRateLimitConfig(reflinkCode);
    const currentUsage = await this.getCurrentUsage(
      identifier,
      identifierType,
      rateLimitConfig.reflinkId
    );

    const requestsRemaining = Math.max(0, rateLimitConfig.dailyLimit - currentUsage.requestsCount);

    return {
      allowed: requestsRemaining > 0,
      requestsRemaining,
      dailyLimit: rateLimitConfig.dailyLimit,
      resetTime: currentUsage.windowEnd,
      tier: rateLimitConfig.tier,
      reflinkCode,
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();