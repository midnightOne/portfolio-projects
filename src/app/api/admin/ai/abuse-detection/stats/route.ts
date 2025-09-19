/**
 * Admin API endpoint for abuse detection statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const startDate = new Date(Date.now() - (validDays * 24 * 60 * 60 * 1000));

    // Get abuse detection statistics from rate limit logs and blacklist entries
    const [
      totalAnalyzed,
      blockedRequests,
      warningRequests,
      violationReasons,
    ] = await Promise.all([
      // Total requests analyzed (approximated from rate limit logs)
      prisma.aIRateLimitLog.count({
        where: {
          timestamp: { gte: startDate },
        },
      }),

      // Blocked requests (from blacklist violations)
      prisma.aIIPBlacklist.count({
        where: {
          lastViolationAt: { gte: startDate },
          reason: {
            contains: 'Content violation',
          },
        },
      }),

      // Warning requests (estimated from violation patterns)
      prisma.aIIPBlacklist.count({
        where: {
          lastViolationAt: { gte: startDate },
          violationCount: 1, // First violations are typically warnings
        },
      }),

      // Get violation reasons for analysis
      prisma.aIIPBlacklist.findMany({
        where: {
          lastViolationAt: { gte: startDate },
        },
        select: {
          reason: true,
          violationCount: true,
        },
      }),
    ]);

    // Process violation reasons to extract top reasons
    const reasonCounts: Record<string, number> = {};
    let totalConfidenceSum = 0;
    let confidenceCount = 0;

    for (const entry of violationReasons) {
      // Extract primary reason (before first semicolon or colon)
      const primaryReason = entry.reason.split(/[;:]/)[0].trim();
      
      // Categorize common reasons
      let category = 'Other';
      if (primaryReason.toLowerCase().includes('spam')) {
        category = 'Spam Content';
      } else if (primaryReason.toLowerCase().includes('inappropriate')) {
        category = 'Inappropriate Content';
      } else if (primaryReason.toLowerCase().includes('suspicious')) {
        category = 'Suspicious Activity';
      } else if (primaryReason.toLowerCase().includes('content violation')) {
        category = 'Content Violation';
      } else if (primaryReason.toLowerCase().includes('pattern')) {
        category = 'Pattern Match';
      }

      reasonCounts[category] = (reasonCounts[category] || 0) + entry.violationCount;
      
      // Simulate confidence calculation (in real implementation, this would be stored)
      totalConfidenceSum += 0.75; // Average confidence
      confidenceCount++;
    }

    // Sort reasons by count
    const topReasons = Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    const averageConfidence = confidenceCount > 0 ? totalConfidenceSum / confidenceCount : 0;

    const stats = {
      totalAnalyzed,
      blockedRequests,
      warningRequests,
      averageConfidence,
      topReasons,
      period: {
        days: validDays,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    return NextResponse.json(createApiSuccess(stats));

  } catch (error) {
    console.error('Failed to get abuse detection stats:', error);
    return NextResponse.json(
      createApiError(
        'STATS_ERROR',
        'Failed to retrieve abuse detection statistics',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}