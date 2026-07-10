/**
 * Question analytics batch trigger (Block I1, design §6 route table). Runs the
 * Req 16.2 pipeline: scan node_transition markers → NodeEntryQuestion rows
 * (idempotent) → embed (budget-gated, ledgered) → greedy clustering. NEVER
 * runs in the request path of a conversation (P23) — admin-triggered here;
 * cron wiring is a deploy-time addition (the project is out of deployment,
 * CLAUDE.md §5) and must come with its own auth story, not a gateway bypass.
 *
 * Gateway-wrapped (D33): the embedding step is a cost-incurring call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { runQuestionAnalyticsBatch } from '@/lib/services/ai/engine-batches';

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
  const result = await runQuestionAnalyticsBatch({ since });
  return NextResponse.json(createApiSuccess(result));
}

export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
