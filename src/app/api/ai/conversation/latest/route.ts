/**
 * Returning-visitor resume lookup (Block I3, Req 17.1/21.1): given a reflink
 * code, return the latest resumable conversation's session pointer + a SAFE
 * one-line summary for the cross-device confirmation. The reflink is the sole
 * access control (P32 — the client continuity marker only selects auto-resume
 * vs confirm UX); a revoked/expired reflink gets nothing (Req 21.5). Response
 * carries NO transcript content beyond the summary line (Req 21.1 — forwarded
 * reflink URLs must never leak a previous holder's conversation).
 *
 * Pure DB read — no model spend, so no gateway wrap (D33 scopes cost-incurring
 * routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('reflink');
  if (!code) {
    return NextResponse.json({ error: 'reflink parameter required' }, { status: 400 });
  }
  const validation = await reflinkManager.validateReflink(code);
  if (!validation.valid || !validation.reflink) {
    return NextResponse.json({ error: 'Invalid reflink' }, { status: 403 });
  }
  const latest = await conversationHistoryManager.getLatestConversationForReflink(validation.reflink.id);
  const body = latest
    ? {
        resumable: true,
        sessionId: latest.sessionId,
        lastActivityAt: latest.lastActivityAt?.toISOString() ?? null,
        summaryLine: latest.summaryLine,
      }
    : { resumable: false };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
