/**
 * Admin: safety-investigation list (Req 22.2, task L4) — the verdicts the
 * tripwire produced, newest first, with the conversation's sessionId joined so
 * the panel links straight into the conversation browser. Read-only telemetry;
 * no gateway (no model calls here — D33 does not apply).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const conversationId = searchParams.get('conversationId');
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '30', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

  const rows = await prisma.safetyInvestigation.findMany({
    where: {
      ...(status && ['running', 'complete', 'failed'].includes(status) ? { status } : {}),
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // sessionId per conversation for browser deep links (one query, not N).
  const conversationIds = [...new Set(rows.map((r) => r.conversationId))];
  const conversations = conversationIds.length
    ? await prisma.aIConversation.findMany({
        where: { id: { in: conversationIds } },
        select: { id: true, sessionId: true },
      })
    : [];
  const sessionById = new Map(conversations.map((c) => [c.id, c.sessionId]));

  return NextResponse.json({
    investigations: rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      sessionId: sessionById.get(r.conversationId) ?? null,
      triggeredBy: r.triggeredBy,
      status: r.status,
      verdict: r.verdict,
      recommendedAction: r.recommendedAction,
      rationale: r.rationale,
      actedOn: r.actedOn,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  });
}
