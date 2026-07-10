/**
 * Summarization batch trigger (Block I2, design §6 route table): backfills/
 * consolidates `conversation_summary` rows for engine-steered conversations
 * with activity since their last summarizer run — the SECOND trigger of the
 * ONE summary pipeline (runSummarizerJob; Req 20.5 — never two competing
 * summaries). Never in a conversation's request path (P23); admin-triggered,
 * cron wiring is deploy-time (see the questions route note).
 *
 * Gateway-wrapped (D33): each summarizer run is a metered cheap-LLM call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { runSummaryBackfillBatch } from '@/lib/services/ai/engine-batches';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

const BodySchema = z.object({ sinceDays: z.number().int().min(1).max(365).optional() });

async function handlePOST(request: NextRequest, _ctx: GatewayContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', 'Invalid body'), { status: 400 });
  }
  const since = parsed.data.sinceDays
    ? new Date(Date.now() - parsed.data.sinceDays * 24 * 60 * 60 * 1000)
    : undefined;
  const result = await runSummaryBackfillBatch({ since });
  return NextResponse.json(createApiSuccess(result));
}

export const POST = withAIGateway({ feature: 'chat', publicAllowed: false }, handlePOST);
