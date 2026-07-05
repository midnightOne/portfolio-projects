/**
 * Admin: live spend gauges from the unified ledger (access-and-cost Req 8 — one
 * cost record, D32). Aggregates AIUsageLog by feature for today / this month.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));

  const [dayByFeature, monthByFeature, recent] = await Promise.all([
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: { timestamp: { gte: dayStart } },
      _sum: { costUsd: true, tokensUsed: true },
      _count: { _all: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: { timestamp: { gte: monthStart } },
      _sum: { costUsd: true, tokensUsed: true },
      _count: { _all: true },
    }),
    prisma.aIUsageLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 25,
      select: {
        id: true, feature: true, usageType: true, modelUsed: true, provider: true,
        inputTokens: true, outputTokens: true, costUsd: true, endpoint: true,
        requestId: true, timestamp: true,
      },
    }),
  ]);

  const shape = (rows: typeof dayByFeature) =>
    rows.map((r) => ({
      feature: r.feature ?? 'untagged',
      costUsd: Number(r._sum.costUsd ?? 0),
      tokens: r._sum.tokensUsed ?? 0,
      calls: r._count._all,
    }));

  return NextResponse.json({
    day: shape(dayByFeature),
    month: shape(monthByFeature),
    dayTotalUsd: shape(dayByFeature).reduce((s, r) => s + r.costUsd, 0),
    monthTotalUsd: shape(monthByFeature).reduce((s, r) => s + r.costUsd, 0),
    recent: recent.map((r) => ({ ...r, costUsd: Number(r.costUsd) })),
  });
}
