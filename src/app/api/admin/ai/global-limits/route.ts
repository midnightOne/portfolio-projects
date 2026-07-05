/**
 * Admin: global spend watchdog state + caps (access-and-cost Req 6/8).
 * GET → current state incl. live counters and trip history.
 * PUT → update caps / publicAIEnabled / disableReflinksOnTrip (never clears a trip).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { __clearKillSwitchCache } from '@/lib/ai/ledger';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const row = await prisma.aIGlobalLimits.findUnique({ where: { id: 'global' } });
  if (!row) return NextResponse.json({ error: 'AIGlobalLimits row missing — run the seed' }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  return NextResponse.json({
    status: row.status,
    trippedAt: row.trippedAt,
    tripReason: row.tripReason,
    tripHistory: row.tripHistory,
    publicAIEnabled: row.publicAIEnabled,
    disableReflinksOnTrip: row.disableReflinksOnTrip,
    dailySpendCapUsd: Number(row.dailySpendCapUsd),
    monthlySpendCapUsd: Number(row.monthlySpendCapUsd),
    daySpendUsd: row.dayKey === today ? Number(row.daySpendUsd) : 0,
    monthSpendUsd: row.monthKey === month ? Number(row.monthSpendUsd) : 0,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.dailySpendCapUsd === 'number' && body.dailySpendCapUsd >= 0) data.dailySpendCapUsd = body.dailySpendCapUsd;
  if (typeof body.monthlySpendCapUsd === 'number' && body.monthlySpendCapUsd >= 0) data.monthlySpendCapUsd = body.monthlySpendCapUsd;
  if (typeof body.publicAIEnabled === 'boolean') data.publicAIEnabled = body.publicAIEnabled;
  if (typeof body.disableReflinksOnTrip === 'boolean') data.disableReflinksOnTrip = body.disableReflinksOnTrip;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const row = await prisma.aIGlobalLimits.update({ where: { id: 'global' }, data });
  __clearKillSwitchCache();
  return NextResponse.json({ ok: true, status: row.status, publicAIEnabled: row.publicAIEnabled });
}
