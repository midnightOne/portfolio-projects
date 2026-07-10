/**
 * GET /api/ai/engine/ux[?sessionId=…] — the pill's visitor-surface read
 * (conversation-engine Req 13.1/13.3/13.5, Block G1).
 *
 * Returns the CURRENT chips + topic label: the conversation's persisted node
 * when a sessionId is supplied (resume/reload), else the active graph's
 * landing node — so chips render BEFORE the first turn and draw the visitor
 * into first contact (owner 2026-07-10). Live updates then arrive via engine
 * directives (/log responses, native voice) or the /chat response envelope.
 *
 * Public and un-metered by design: a pure DB read (graph document only — no
 * context resolution, no model calls, no spend), and the payload is
 * visitor-visible by definition — chips/label carry no graph structure
 * (Req 13.5; same exposure class as /api/ai/voice-config). No graph active →
 * `{ ux: null }` and the pill hides the surfaces (Req 2.7).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEngineUx } from '@/lib/services/ai/engine-runtime';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const ux = await getCurrentEngineUx(sessionId && sessionId.length <= 200 ? sessionId : null);
  return NextResponse.json({ ux });
}
