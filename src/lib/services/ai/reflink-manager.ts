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
  BudgetStatus,
  UsageEvent,
  ReflinkValidationResult,
  ReflinkAnalytics,
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
          
          // Enhanced features
          recipientName: params.recipientName,
          recipientEmail: params.recipientEmail,
          customContext: params.customContext,
          tokenLimit: params.tokenLimit,
          spendLimit: params.spendLimit,
          enableVoiceAI: params.enableVoiceAI ?? true,
          enableJobAnalysis: params.enableJobAnalysis ?? true,
          enableAdvancedNavigation: params.enableAdvancedNavigation ?? true,
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
          
          // Enhanced features
          recipientName: params.recipientName,
          recipientEmail: params.recipientEmail,
          customContext: params.customContext,
          tokenLimit: params.tokenLimit,
          spendLimit: params.spendLimit,
          enableVoiceAI: params.enableVoiceAI,
          enableJobAnalysis: params.enableJobAnalysis,
          enableAdvancedNavigation: params.enableAdvancedNavigation,
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
   * Reset usage for a reflink (refill budget)
   */
  async resetReflinkUsage(id: string): Promise<ReflinkInfo> {
    try {
      const existing = await prisma.aIReflink.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new ReflinkError('Reflink not found', undefined, 'not_found');
      }

      const reflink = await prisma.aIReflink.update({
        where: { id },
        data: {
          tokensUsed: 0,
          spendUsed: 0,
        },
      });

      return this.mapToReflinkInfo(reflink);
    } catch (error) {
      if (error instanceof ReflinkError) {
        throw error;
      }
      console.error('Failed to reset reflink usage:', error);
      throw new ReflinkError('Failed to reset reflink usage');
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
        requestsByDay: requestsByDay.map((row: any) => ({
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
   * Get enhanced reflink analytics
   */
  async getReflinkAnalytics(id: string, days: number = 30): Promise<ReflinkAnalytics> {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const [usageLogs, rateLimitLogs] = await Promise.all([
        prisma.aIUsageLog.findMany({
          where: {
            reflinkId: id,
            timestamp: { gte: startDate },
          },
        }),
        prisma.aIRateLimitLog.findMany({
          where: {
            reflinkId: id,
            timestamp: { gte: startDate },
          },
        }),
      ]);

      const totalCost = usageLogs.reduce((sum: number, log: any) => sum + Number(log.costUsd), 0);
      const totalRequests = rateLimitLogs.length;
      const blockedRequests = rateLimitLogs.filter((log: any) => log.wasBlocked).length;
      const uniqueUsers = new Set(rateLimitLogs.map((log: any) => `${log.identifier}-${log.identifierType}`)).size;

      const costBreakdown = usageLogs.reduce((breakdown: any, log: any) => {
        switch (log.usageType) {
          case 'llm_request':
            breakdown.llmCosts += Number(log.costUsd);
            break;
          case 'voice_generation':
          case 'voice_processing':
            breakdown.voiceCosts += Number(log.costUsd);
            break;
          default:
            breakdown.processingCosts += Number(log.costUsd);
        }
        return breakdown;
      }, { llmCosts: 0, voiceCosts: 0, processingCosts: 0 });

      const usageByType = usageLogs.reduce((usage: any, log: any) => {
        usage[log.usageType] = (usage[log.usageType] || 0) + 1;
        return usage;
      }, {} as Record<string, number>);

      // Group by day
      const requestsByDay = Array.from({ length: days }, (_, i) => {
        const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        
        const dayRequests = rateLimitLogs.filter((log: any) => 
          log.timestamp.toISOString().split('T')[0] === dateStr
        );
        
        const dayCosts = usageLogs.filter((log: any) => 
          log.timestamp.toISOString().split('T')[0] === dateStr
        ).reduce((sum: number, log: any) => sum + Number(log.costUsd), 0);

        return {
          date: dateStr,
          requests: dayRequests.length,
          blocked: dayRequests.filter((log: any) => log.wasBlocked).length,
          cost: dayCosts,
        };
      }).reverse();

      return {
        totalRequests,
        blockedRequests,
        uniqueUsers,
        totalCost,
        averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
        costBreakdown,
        usageByType,
        requestsByDay,
      };
    } catch (error) {
      console.error('Failed to get reflink analytics:', error);
      throw new ReflinkError('Failed to get reflink analytics');
    }
  }

  /**
   * Get remaining budget for a reflink
   */
  async getRemainingBudget(reflinkId: string): Promise<BudgetStatus> {
    try {
      const reflink = await prisma.aIReflink.findUnique({
        where: { id: reflinkId },
      });

      if (!reflink) {
        throw new ReflinkError('Reflink not found', undefined, 'not_found');
      }

      const tokensRemaining = reflink.tokenLimit 
        ? Math.max(0, reflink.tokenLimit - reflink.tokensUsed)
        : undefined;

      const spendRemaining = reflink.spendLimit 
        ? Math.max(0, Number(reflink.spendLimit) - Number(reflink.spendUsed))
        : Infinity;

      const isExhausted = Boolean(
        (reflink.tokenLimit && reflink.tokensUsed >= reflink.tokenLimit) ||
        (reflink.spendLimit && Number(reflink.spendUsed) >= Number(reflink.spendLimit))
      );

      // Estimate remaining requests based on average cost
      const estimatedRequestsRemaining = spendRemaining === Infinity 
        ? 999999 
        : Math.floor(spendRemaining / 0.01); // Assume $0.01 per request average

      return {
        tokensRemaining,
        spendRemaining,
        isExhausted,
        estimatedRequestsRemaining,
      };
    } catch (error) {
      if (error instanceof ReflinkError) {
        throw error;
      }
      console.error('Failed to get remaining budget:', error);
      throw new ReflinkError('Failed to get remaining budget');
    }
  }

  /**
   * Track usage for a reflink
   */
  async trackUsage(reflinkId: string, usage: UsageEvent): Promise<void> {
    try {
      // Create usage log entry
      await prisma.aIUsageLog.create({
        data: {
          reflinkId,
          usageType: usage.type,
          tokensUsed: usage.tokens,
          costUsd: usage.cost,
          modelUsed: usage.modelUsed,
          endpoint: usage.endpoint,
          metadata: usage.metadata || {},
        },
      });

      // Update reflink usage totals
      await prisma.aIReflink.update({
        where: { id: reflinkId },
        data: {
          tokensUsed: {
            increment: usage.tokens || 0,
          },
          spendUsed: {
            increment: usage.cost,
          },
          lastUsedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to track usage:', error);
      throw new ReflinkError('Failed to track usage');
    }
  }

  /**
   * Validate reflink with budget checking
   */
  async validateReflinkWithBudget(code: string): Promise<ReflinkValidationResult> {
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

      const budgetStatus = await this.getRemainingBudget(reflink.id);

      if (budgetStatus.isExhausted) {
        return { 
          valid: false, 
          reflink, 
          budgetStatus, 
          reason: 'budget_exhausted' 
        };
      }

      // Generate personalized welcome message
      const welcomeMessage = this.generateWelcomeMessage(reflink);

      return { 
        valid: true, 
        reflink, 
        budgetStatus, 
        welcomeMessage 
      };
    } catch (error) {
      console.error('Failed to validate reflink with budget:', error);
      return { valid: false, reason: 'not_found' };
    }
  }

  /**
   * Generate personalized welcome message
   */
  private generateWelcomeMessage(reflink: ReflinkInfo): string {
    const name = reflink.recipientName || 'there';
    const context = reflink.customContext ? ` ${reflink.customContext}` : '';
    
    return `Hello ${name}! You have special access to enhanced AI features.${context}`;
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
      
      // Enhanced features
      recipientName: reflink.recipientName,
      recipientEmail: reflink.recipientEmail,
      customContext: reflink.customContext,
      tokenLimit: reflink.tokenLimit,
      tokensUsed: reflink.tokensUsed || 0,
      spendLimit: reflink.spendLimit ? Number(reflink.spendLimit) : undefined,
      spendUsed: Number(reflink.spendUsed) || 0,
      enableVoiceAI: reflink.enableVoiceAI ?? true,
      enableJobAnalysis: reflink.enableJobAnalysis ?? true,
      enableAdvancedNavigation: reflink.enableAdvancedNavigation ?? true,
      lastUsedAt: reflink.lastUsedAt,
    };
  }
}

// Export singleton instance
export const reflinkManager = new ReflinkManager();