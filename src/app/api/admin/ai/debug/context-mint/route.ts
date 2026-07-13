/**
 * Admin-only mint-stash reader (ai-assistant task 7.0a(3)).
 *
 * GET ?sessionId=<session_…>  → that session's stashed mint material
 * GET ?sessionId=latest       → most recent stash (cascade sessions have no
 *                               mint id; the panel falls back to this)
 * GET (no param)              → list of stashed sessions
 *
 * Read-only over the in-memory stash — no provider calls, no gateway wrap
 * needed (check:gateway is content-driven, D33). The stash is per-instance:
 * after a server restart (or on a different serverless instance) entries are
 * gone until the next mint — the 404 message says so.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { getMintDebug, getLatestMintDebug, listMintDebug } from '@/lib/ai/mint-debug-stash';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ entries: listMintDebug() });
  }

  const entry = sessionId === 'latest' ? getLatestMintDebug() : getMintDebug(sessionId);
  if (!entry) {
    return NextResponse.json(
      {
        error:
          'No mint stash for that session — the stash is in-memory, so entries exist only for sessions minted since the server instance started.',
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ entry });
}
