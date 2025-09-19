/**
 * Admin API endpoint for rate limiting analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimiter } from '@/lib/services/ai/rate-limiter';
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';
import { createApiSuccess, createApiError } from '@/lib/types/api';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const days = parseInt(searchParams.get('days') || '7');
    const validDays = Math.min(Math.max(days, 1), 90); // Between 1 and 90 days

    // Get rate limiting analytics
    const rateLimitAnalytics = await rateLimiter.getAnalytics(validDays);

    // Get security analytics
    const securityAnalytics = await blacklistManager.getSecurityAnalytics(validDays);

    // Calculate additional metrics
    const blockRate = rateLimitAnalytics.totalRequests > 0 
      ? (rateLimitAnalytics.blockedRequests / rateLimitAnalytics.totalRequests) * 100 
      : 0;

    const averageRequestsPerUser = rateLimitAnalytics.uniqueUsers > 0
      ? rateLimitAnalytics.totalRequests / rateLimitAnalytics.uniqueUsers
      : 0;

    return NextResponse.json(createApiSuccess({
      period: {
        days: validDays,
        startDate: new Date(Date.now() - (validDays * 24 * 60 * 60 * 1000)).toISOString(),
        endDate: new Date().toISOString(),
      },
      rateLimiting: {
        ...rateLimitAnalytics,
        blockRate: Math.round(blockRate * 100) / 100,
        averageRequestsPerUser: Math.round(averageRequestsPerUser * 100) / 100,
      },
      security: securityAnalytics,
      summary: {
        totalRequests: rateLimitAnalytics.totalRequests,
        blockedRequests: rateLimitAnalytics.blockedRequests,
        uniqueUsers: rateLimitAnalytics.uniqueUsers,
        blacklistedIPs: securityAnalytics.totalBlacklisted,
        recentViolations: securityAnalytics.recentViolations,
        blockRate: Math.round(blockRate * 100) / 100,
      },
    }));

  } catch (error) {
    console.error('Failed to get rate limiting analytics:', error);
    return NextResponse.json(
      createApiError(
        'ANALYTICS_ERROR',
        'Failed to retrieve analytics data',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'cleanup') {
      // Perform cleanup operations
      await Promise.all([
        rateLimiter.cleanupExpiredRecords(),
        blacklistManager.cleanupOldEntries(),
      ]);

      return NextResponse.json(createApiSuccess({
        action: 'cleanup',
        completed: true,
        timestamp: new Date().toISOString(),
      }));
    }

    return NextResponse.json(
      createApiError('INVALID_ACTION', 'Invalid action specified'),
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to perform analytics action:', error);
    return NextResponse.json(
      createApiError(
        'ANALYTICS_ACTION_ERROR',
        'Failed to perform requested action',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}