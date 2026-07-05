/**
 * Admin: manual re-enable after a watchdog trip (access-and-cost Req 6.3).
 * The ONLY way out of a tripped state — daily/monthly counter resets never auto-clear.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { reenableGlobalAI } from '@/lib/ai/ledger';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const actor = (auth.session?.user as { name?: string } | undefined)?.name ?? 'admin';
  const state = await reenableGlobalAI(actor);
  return NextResponse.json({ ok: true, status: state.status });
}
