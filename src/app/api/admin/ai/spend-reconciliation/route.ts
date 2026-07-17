/**
 * GET /api/admin/ai/spend-reconciliation?days=7 (ai-assistant 7.23).
 *
 * Internal-ledger vs OpenAI-Costs-API drift report — the provider is ground
 * truth. Admin-auth only; NO token spend (metadata API, same class as
 * test-connection — justified in check-gateway's heuristic allowlist).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { reconcileOpenAISpend } from '@/lib/ai/spend-reconciliation';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const daysRaw = Number(request.nextUrl.searchParams.get('days') ?? 7);
  const days = Number.isFinite(daysRaw) ? daysRaw : 7;
  try {
    const report = await reconcileOpenAISpend(days);
    return NextResponse.json(createApiSuccess(report));
  } catch (error) {
    console.error('[spend-reconciliation] failed:', error);
    return NextResponse.json(
      createApiError('RECONCILIATION_FAILED', error instanceof Error ? error.message : 'Reconciliation failed'),
      { status: 500 }
    );
  }
}
