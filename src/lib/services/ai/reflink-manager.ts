/**
 * Reflink management service for AI assistant
 * Handles creation, validation, and management of reflink codes
 */

import { PrismaClient } from '@prisma/client';
import {
  ReflinkInfo,
  CreateReflinkParams,
  UpdateReflinkParams,
  RateLimitTier,
  ReflinkError,
  RATE_LIMIT_TIERS,
} from '@/lib/types/rate-limiting';

const prisma = new PrismaClient();

export class ReflinkManager {
  /**
   * Create a new reflink
   */
  async createReflink(params: CreateReflinkParams, createdBy?: string): Promise<ReflinkInfo> {
    try {
      // Check if code already exists
      const existing = await prisma.aIReflink.findUnique({
        where: { code: params.code },
      });

      if (existing) {
        throw new ReflinkError(`Reflink code '${params.code}' already exists`, params.code);
      }

      // Determine daily limit based on tier
      const dailyLimit = params.dailyLimit ?? RATE_LIMIT_TIERS[params.rateLimitTier].dailyLimit;

      const reflink = await prisma.aIReflink.create({
        data: {
          code: params.code,
          name: params.name,
          description: params.description,
          rateLimitTier: params.rateLimitTier,
          dailyLimit: dailyLimit === -1 ? 999999 : dailyLimit, // Handle unlimited
          expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
          createdBy,
        },
      });

      return this.mapToReflinkInfo(reflink);
    } catch (error) {
      if (error instanceof ReflinkError) {
        throw error;
      }
      console.error('Failed to create reflink:', error);
      throw new ReflinkError('Failed to create reflink');
    }
  }

  /**
   * Update an existing reflink
   */
  async updateReflink(id: string, params: UpdateReflinkParams): Promise<ReflinkInfo> {
    try {
      const existing = await prisma.aIReflink.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new ReflinkError('Reflink not found', undefined, 'not_found');
      }

      // Determine daily limit if tier is being updated
      let dailyLimit = params.dailyLimit;
      if (params.rateLimitTier && !params.dailyLimit) {
        const tierLimit = RATE_LIMIT_TIERS[params.rateLimitTier].dailyLimit;
        dailyLimit = tierLimit === -1 ? 999999 : tierLimit;
      }

      const reflink = await prisma.aIReflink.update({
        where: { id },
        data: {
          name: params.name,
          description: params.description,
          rateLimitTier: params.rateLimitTier,
          dailyLimit: dailyLimit,
          expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
          isActive: params.isActive,
        },
      });

      return this.mapToReflinkInfo(reflink);
    } catch (error) {
      if (error instanceof ReflinkError) {
        throw error;
      }
      console.error('Failed to update reflink:', error);
      throw new ReflinkError('Failed to update reflink');
    }
  }

  /**
   * Get a reflink by code
   */
  async getReflinkByCode(code: string): Promise<ReflinkInfo | null> {
    try {
      const reflink = await prisma.aIReflink.findUnique({
        where: { code },
      });

      return reflink ? this.mapToReflinkInfo(reflink) : null;
    } catch (error) {
      console.error('Failed to get reflink by code:', error);
      return null;
    }
  }

  /**
   * Get a reflink by ID
   */
  async getReflinkById(id: string): Promise<ReflinkInfo | null> {
    try {
      const reflink = await prisma.aIReflink.findUnique({
        where: { id },
      });

      return reflink ? this.mapToReflinkInfo(reflink) : null;
    } catch (error) {
      console.error('Failed to get reflink by ID:', error);
      return null;
    }
  }

  /**
   * List all reflinks with optional filtering
   */
  async listReflinks(options?: {
    isActive?: boolean;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    reflinks: ReflinkInfo[];
    totalCount: number;
  }> {
    try {
      const where: any = {};

      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (!options?.includeExpired) {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ];
      }

      const [reflinks, totalCount] = await Promise.all([
        prisma.aIReflink.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options?.limit,
          skip: options?.offset,
        }),
        prisma.aIReflink.count({ where }),
      ]);

      return {
        reflinks: reflinks.map(this.mapToReflinkInfo),
        totalCount,
      };
    } catch (error) {
      console.error('Failed to list reflinks:', error);
      throw new ReflinkError('Failed to list reflinks');
    }
  }

  /**
   * Validate a reflink code
   */
  async validateReflink(code: string): Promise<{
    valid: boolean;
    reflink?: ReflinkInfo;
    reason?: 'not_found' | 'inactive' | 'expired';
  }> {
    try {
      const reflink = await this.getReflinkByCode(code);

      if (!reflink) {
        return { valid: false, reason: 'not_found' };
      }

      if (!reflink.isActive) {
        return { valid: false, reflink, reason: 'inactive' };
      }

      if (reflink.expiresAt && reflink.expiresAt < new Date()) {
        return { valid: false, reflink, reason: 'expired' };
      }

      return { valid: true, reflink };
    } catch (error) {
      console.error('Failed to validate reflink:', error);
      return { valid: false, reason: 'not_found' };
    }
  }

  /**
   * Delete a reflink
   */
  async deleteReflink(id: string): Promise<void> {
    try {
      const existing = await prisma.aIReflink.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new ReflinkError('Reflink not found', undefined, 'not_found');
      }

      await prisma.aIReflink.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof ReflinkError) {
        throw error;
      }
      console.error('Failed to delete reflink:', error);
      throw new ReflinkError('Failed to delete reflink');
    }
  }

  /**
   * Get reflink usage statistics
   */
  async getReflinkUsage(id: string, days: number = 7): Promise<{
    totalRequests: number;
    blockedRequests: number;
    uniqueUsers: number;
    requestsByDay: Array<{
      date: string;
      requests: number;
      blocked: number;
    }>;
  }> {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const [totalRequests, blockedRequests, uniqueUsers, requestsByDay] = await Promise.all([
        // Total requests
        prisma.aIRateLimitLog.count({
          where: {
            reflinkId: id,
            timestamp: { gte: startDate },
          },
        }),

        // Blocked requests
        prisma.aIRateLimitLog.count({
          where: {
            reflinkId: id,
            timestamp: { gte: startDate },
            wasBlocked: true,
          },
        }),

        // Unique users
        prisma.aIRateLimitLog.findMany({
          where: {
            reflinkId: id,
            timestamp: { gte: startDate },
          },
          select: {
            identifier: true,
            identifierType: true,
          },
          distinct: ['identifier', 'identifierType'],
        }),

        // Requests by day
        prisma.$queryRaw<Array<{ date: Date; requests: bigint; blocked: bigint }>>`
          SELECT 
            DATE_TRUNC('day', timestamp) as date,
            COUNT(*) as requests,
            COUNT(*) FILTER (WHERE was_blocked = true) as blocked
          FROM ai_rate_limit_logs 
          WHERE reflink_id = ${id} AND timestamp >= ${startDate}
          GROUP BY DATE_TRUNC('day', timestamp)
          ORDER BY date
        `,
      ]);

      return {
        totalRequests,
        blockedRequests,
        uniqueUsers: uniqueUsers.length,
        requestsByDay: requestsByDay.map((row) => ({
          date: row.date.toISOString().split('T')[0],
          requests: Number(row.requests),
          blocked: Number(row.blocked),
        })),
      };
    } catch (error) {
      console.error('Failed to get reflink usage:', error);
      throw new ReflinkError('Failed to get reflink usage statistics');
    }
  }

  /**
   * Bulk update reflinks
   */
  async bulkUpdateReflinks(
    ids: string[],
    updates: Pick<UpdateReflinkParams, 'isActive' | 'rateLimitTier'>
  ): Promise<number> {
    try {
      const result = await prisma.aIReflink.updateMany({
        where: {
          id: { in: ids },
        },
        data: updates,
      });

      return result.count;
    } catch (error) {
      console.error('Failed to bulk update reflinks:', error);
      throw new ReflinkError('Failed to bulk update reflinks');
    }
  }

  /**
   * Clean up expired reflinks
   */
  async cleanupExpiredReflinks(): Promise<number> {
    try {
      const result = await prisma.aIReflink.updateMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      console.log(`Deactivated ${result.count} expired reflinks`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired reflinks:', error);
      return 0;
    }
  }

  /**
   * Generate a unique reflink code
   */
  async generateUniqueCode(prefix: string = 'ref'): Promise<string> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const code = `${prefix}-${randomSuffix}`;

      const existing = await prisma.aIReflink.findUnique({
        where: { code },
      });

      if (!existing) {
        return code;
      }

      attempts++;
    }

    throw new ReflinkError('Failed to generate unique reflink code');
  }

  /**
   * Map database record to ReflinkInfo
   */
  private mapToReflinkInfo(reflink: any): ReflinkInfo {
    return {
      id: reflink.id,
      code: reflink.code,
      name: reflink.name,
      description: reflink.description,
      rateLimitTier: reflink.rateLimitTier as RateLimitTier,
      dailyLimit: reflink.dailyLimit,
      expiresAt: reflink.expiresAt,
      isActive: reflink.isActive,
      createdBy: reflink.createdBy,
      createdAt: reflink.createdAt,
      updatedAt: reflink.updatedAt,
    };
  }
}

// Export singleton instance
export const reflinkManager = new ReflinkManager();