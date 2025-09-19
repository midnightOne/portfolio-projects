/**
 * IP Blacklist management service for AI assistant
 * Handles IP blocking, violation tracking, and reinstatement
 */

import { PrismaClient } from '@prisma/client';
import {
  IPBlacklistEntry,
  BlacklistIPParams,
  SecurityViolationError,
  SecurityAnalytics,
  SecurityConfig,
} from '@/lib/types/rate-limiting';

const prisma = new PrismaClient();

export class BlacklistManager {
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      maxViolationsBeforeBlock: 2,
      autoReinstateAfterDays: 30,
      suspiciousActivityThreshold: 100,
      contentAnalysisEnabled: true,
      ...config,
    };
  }

  /**
   * Add an IP to the blacklist
   */
  async blacklistIP(params: BlacklistIPParams): Promise<IPBlacklistEntry> {
    try {
      // Check if IP is already blacklisted
      const existing = await prisma.aIIPBlacklist.findUnique({
        where: { ipAddress: params.ipAddress },
      });

      if (existing && !existing.reinstatedAt) {
        // Update existing blacklist entry
        const updated = await prisma.aIIPBlacklist.update({
          where: { ipAddress: params.ipAddress },
          data: {
            reason: params.reason,
            violationCount: params.violationCount,
            lastViolationAt: new Date(),
            updatedAt: new Date(),
          },
        });
        return this.mapToBlacklistEntry(updated);
      }

      // Create new blacklist entry
      const blacklistEntry = await prisma.aIIPBlacklist.create({
        data: {
          ipAddress: params.ipAddress,
          reason: params.reason,
          violationCount: params.violationCount,
          firstViolationAt: new Date(),
          lastViolationAt: new Date(),
          blockedAt: new Date(),
        },
      });

      console.log(`IP ${params.ipAddress} blacklisted for: ${params.reason}`);
      return this.mapToBlacklistEntry(blacklistEntry);
    } catch (error) {
      console.error('Failed to blacklist IP:', error);
      throw new SecurityViolationError(
        'Failed to blacklist IP',
        params.reason,
        params.ipAddress,
        params.violationCount
      );
    }
  }

  /**
   * Record a security violation (may lead to blacklisting)
   */
  async recordViolation(
    ipAddress: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<{
    blacklisted: boolean;
    violationCount: number;
    entry?: IPBlacklistEntry;
  }> {
    try {
      const existing = await prisma.aIIPBlacklist.findUnique({
        where: { ipAddress },
      });

      if (existing && !existing.reinstatedAt) {
        // Update existing violation count
        const violationCount = existing.violationCount + 1;
        const shouldBlock = violationCount >= this.config.maxViolationsBeforeBlock;

        const updated = await prisma.aIIPBlacklist.update({
          where: { ipAddress },
          data: {
            reason: `${existing.reason}; ${reason}`,
            violationCount,
            lastViolationAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return {
          blacklisted: shouldBlock,
          violationCount,
          entry: this.mapToBlacklistEntry(updated),
        };
      }

      // First violation - create warning entry
      const violationCount = 1;
      const shouldBlock = violationCount >= this.config.maxViolationsBeforeBlock;

      const entry = await prisma.aIIPBlacklist.create({
        data: {
          ipAddress,
          reason,
          violationCount,
          firstViolationAt: new Date(),
          lastViolationAt: new Date(),
          blockedAt: shouldBlock ? new Date() : new Date(0), // Set to epoch if not blocking yet
        },
      });

      if (shouldBlock) {
        console.log(`IP ${ipAddress} blacklisted after ${violationCount} violations`);
      } else {
        console.log(`IP ${ipAddress} received warning (violation ${violationCount})`);
      }

      return {
        blacklisted: shouldBlock,
        violationCount,
        entry: this.mapToBlacklistEntry(entry),
      };
    } catch (error) {
      console.error('Failed to record violation:', error);
      throw new SecurityViolationError(
        'Failed to record security violation',
        reason,
        ipAddress,
        1
      );
    }
  }

  /**
   * Check if an IP is blacklisted
   */
  async isBlacklisted(ipAddress: string): Promise<{
    blacklisted: boolean;
    entry?: IPBlacklistEntry;
    reason?: string;
  }> {
    try {
      const entry = await prisma.aIIPBlacklist.findUnique({
        where: { ipAddress },
      });

      if (!entry) {
        return { blacklisted: false };
      }

      // Check if IP has been reinstated
      if (entry.reinstatedAt) {
        return { blacklisted: false, entry: this.mapToBlacklistEntry(entry) };
      }

      // Check if should be auto-reinstated
      if (this.shouldAutoReinstate(entry)) {
        await this.reinstateIP(ipAddress, 'system', 'Auto-reinstated after timeout');
        return { blacklisted: false, entry: this.mapToBlacklistEntry(entry) };
      }

      return {
        blacklisted: true,
        entry: this.mapToBlacklistEntry(entry),
        reason: entry.reason,
      };
    } catch (error) {
      console.error('Failed to check blacklist status:', error);
      return { blacklisted: false };
    }
  }

  /**
   * Reinstate a blacklisted IP
   */
  async reinstateIP(
    ipAddress: string,
    reinstatedBy: string,
    reason?: string
  ): Promise<IPBlacklistEntry> {
    try {
      const existing = await prisma.aIIPBlacklist.findUnique({
        where: { ipAddress },
      });

      if (!existing) {
        throw new SecurityViolationError(
          'IP not found in blacklist',
          'not_found',
          ipAddress,
          0
        );
      }

      if (existing.reinstatedAt) {
        throw new SecurityViolationError(
          'IP already reinstated',
          'already_reinstated',
          ipAddress,
          existing.violationCount
        );
      }

      const updated = await prisma.aIIPBlacklist.update({
        where: { ipAddress },
        data: {
          reinstatedAt: new Date(),
          reinstatedBy,
          reason: reason ? `${existing.reason}; Reinstated: ${reason}` : existing.reason,
          updatedAt: new Date(),
        },
      });

      console.log(`IP ${ipAddress} reinstated by ${reinstatedBy}`);
      return this.mapToBlacklistEntry(updated);
    } catch (error) {
      if (error instanceof SecurityViolationError) {
        throw error;
      }
      console.error('Failed to reinstate IP:', error);
      throw new SecurityViolationError(
        'Failed to reinstate IP',
        'reinstate_failed',
        ipAddress,
        0
      );
    }
  }

  /**
   * Get all blacklisted IPs with optional filtering
   */
  async getBlacklistedIPs(options?: {
    includeReinstated?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    entries: IPBlacklistEntry[];
    totalCount: number;
  }> {
    try {
      const where: any = {};

      if (!options?.includeReinstated) {
        where.reinstatedAt = null;
      }

      const [entries, totalCount] = await Promise.all([
        prisma.aIIPBlacklist.findMany({
          where,
          orderBy: { blockedAt: 'desc' },
          take: options?.limit,
          skip: options?.offset,
        }),
        prisma.aIIPBlacklist.count({ where }),
      ]);

      return {
        entries: entries.map(this.mapToBlacklistEntry),
        totalCount,
      };
    } catch (error) {
      console.error('Failed to get blacklisted IPs:', error);
      throw new SecurityViolationError(
        'Failed to retrieve blacklisted IPs',
        'query_failed',
        '',
        0
      );
    }
  }

  /**
   * Remove an IP from the blacklist entirely
   */
  async removeFromBlacklist(ipAddress: string): Promise<void> {
    try {
      const existing = await prisma.aIIPBlacklist.findUnique({
        where: { ipAddress },
      });

      if (!existing) {
        throw new SecurityViolationError(
          'IP not found in blacklist',
          'not_found',
          ipAddress,
          0
        );
      }

      await prisma.aIIPBlacklist.delete({
        where: { ipAddress },
      });

      console.log(`IP ${ipAddress} removed from blacklist`);
    } catch (error) {
      if (error instanceof SecurityViolationError) {
        throw error;
      }
      console.error('Failed to remove IP from blacklist:', error);
      throw new SecurityViolationError(
        'Failed to remove IP from blacklist',
        'removal_failed',
        ipAddress,
        0
      );
    }
  }

  /**
   * Get security analytics
   */
  async getSecurityAnalytics(days: number = 7): Promise<SecurityAnalytics> {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const [
        totalBlacklisted,
        recentViolations,
        violationsByReason,
        topViolatingIPs,
      ] = await Promise.all([
        // Total blacklisted (active)
        prisma.aIIPBlacklist.count({
          where: {
            reinstatedAt: null,
          },
        }),

        // Recent violations
        prisma.aIIPBlacklist.count({
          where: {
            lastViolationAt: { gte: startDate },
          },
        }),

        // Violations by reason
        prisma.aIIPBlacklist.findMany({
          where: {
            lastViolationAt: { gte: startDate },
          },
          select: {
            reason: true,
            violationCount: true,
          },
        }),

        // Top violating IPs
        prisma.aIIPBlacklist.findMany({
          where: {
            lastViolationAt: { gte: startDate },
          },
          orderBy: {
            violationCount: 'desc',
          },
          take: 10,
          select: {
            ipAddress: true,
            violationCount: true,
            lastViolationAt: true,
          },
        }),
      ]);

      // Process violations by reason
      const reasonCounts: Record<string, number> = {};
      violationsByReason.forEach((entry) => {
        // Extract primary reason (before first semicolon)
        const primaryReason = entry.reason.split(';')[0].trim();
        reasonCounts[primaryReason] = (reasonCounts[primaryReason] || 0) + entry.violationCount;
      });

      return {
        totalBlacklisted,
        recentViolations,
        violationsByReason: reasonCounts,
        topViolatingIPs: topViolatingIPs.map((ip) => ({
          ipAddress: ip.ipAddress,
          violations: ip.violationCount,
          lastViolation: ip.lastViolationAt,
        })),
      };
    } catch (error) {
      console.error('Failed to get security analytics:', error);
      throw new SecurityViolationError(
        'Failed to get security analytics',
        'analytics_failed',
        '',
        0
      );
    }
  }

  /**
   * Bulk reinstate IPs
   */
  async bulkReinstateIPs(
    ipAddresses: string[],
    reinstatedBy: string,
    reason?: string
  ): Promise<number> {
    try {
      const result = await prisma.aIIPBlacklist.updateMany({
        where: {
          ipAddress: { in: ipAddresses },
          reinstatedAt: null,
        },
        data: {
          reinstatedAt: new Date(),
          reinstatedBy,
          updatedAt: new Date(),
        },
      });

      console.log(`Bulk reinstated ${result.count} IPs by ${reinstatedBy}`);
      return result.count;
    } catch (error) {
      console.error('Failed to bulk reinstate IPs:', error);
      throw new SecurityViolationError(
        'Failed to bulk reinstate IPs',
        'bulk_reinstate_failed',
        '',
        0
      );
    }
  }

  /**
   * Check if an IP should be auto-reinstated
   */
  private shouldAutoReinstate(entry: any): boolean {
    if (!entry.canReinstate) {
      return false;
    }

    const daysSinceBlocked = (Date.now() - entry.blockedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceBlocked >= this.config.autoReinstateAfterDays;
  }

  /**
   * Map database record to IPBlacklistEntry
   */
  private mapToBlacklistEntry(entry: any): IPBlacklistEntry {
    return {
      id: entry.id,
      ipAddress: entry.ipAddress,
      reason: entry.reason,
      violationCount: entry.violationCount,
      firstViolationAt: entry.firstViolationAt,
      lastViolationAt: entry.lastViolationAt,
      blockedAt: entry.blockedAt,
      canReinstate: entry.canReinstate,
      reinstatedAt: entry.reinstatedAt,
      reinstatedBy: entry.reinstatedBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  /**
   * Clean up old blacklist entries
   */
  async cleanupOldEntries(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

      const result = await prisma.aIIPBlacklist.deleteMany({
        where: {
          reinstatedAt: {
            not: null,
            lt: cutoffDate,
          },
        },
      });

      console.log(`Cleaned up ${result.count} old blacklist entries`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup old blacklist entries:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const blacklistManager = new BlacklistManager();