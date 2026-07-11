/**
 * Conversation-session revocation — an ACCESS-AND-COST enforcement surface
 * (conversation-engine Req 22.3/22.5, task L3; honest mechanics per P35).
 *
 * "Terminate session" on a client-direct voice session cannot hang up the
 * call — the server holds no WebRTC/WS socket. What the server actually
 * controls, and what this surface revokes, is RESOURCES:
 *
 *   - `/api/ai/conversation/log` acceptance (persistence + directives),
 *   - `/api/ai/tools/execute` dispatch,
 *   - `/api/ai/chat` turns (the cascade/text brain),
 *
 * all of which consult `isSessionRevoked()` and fail closed; the first /log
 * POST after revocation additionally carries `sessionRevoked: true` — the
 * disconnect directive a COMPLIANT client (the base adapter) acts on. A
 * malicious client that ignores it keeps an open provider connection only
 * until the ephemeral token's duration cap expires, with no tools, no
 * persistence, and no re-mint — neutered, not fooled. Admin copy must never
 * claim stronger termination than this (P35).
 *
 * Ground truth is `AIConversation.latestState.safety.revokedAt` (a non-engine
 * sibling key — survives graph archival, exists graph-less). The safety
 * module's executor CALLS this surface; it never flips state itself (design
 * §6b "one owner per concept" — hard enforcement lives with access-and-cost,
 * beside reflink revocation in reflink-manager).
 *
 * Gate cost note: the routes above check revocation only while the safety
 * module is ENABLED (memoized config read) — module disabled = zero extra
 * reads = the system functions identically without it (Req 22.4).
 */

import { prisma } from '@/lib/prisma';
import { conversationHistoryManager } from './conversation-history-manager';

export interface SessionRevocation {
  revoked: boolean;
  reason?: string;
  revokedAt?: string;
}

/**
 * Revoke a conversation's session resources. Idempotent — re-revoking
 * refreshes the stamp. Never throws (enforcement failure is logged; the
 * caller records what actually happened).
 */
export async function revokeConversationSession(conversationId: string, reason: string): Promise<boolean> {
  try {
    await conversationHistoryManager.mergeConversationSafety(conversationId, {
      revokedAt: new Date().toISOString(),
      revokedReason: reason.slice(0, 300),
    });
    return true;
  } catch (err) {
    console.error('[session-revocation] revoke failed:', err);
    return false;
  }
}

function parseRevocation(latestState: unknown): SessionRevocation {
  const safety = (latestState as Record<string, unknown> | null)?.safety as
    | Record<string, unknown>
    | undefined;
  if (safety && typeof safety.revokedAt === 'string') {
    return {
      revoked: true,
      revokedAt: safety.revokedAt,
      reason: typeof safety.revokedReason === 'string' ? safety.revokedReason : undefined,
    };
  }
  return { revoked: false };
}

/** Revocation state by logical session id (the key every public surface holds). */
export async function getSessionRevocation(sessionId: string): Promise<SessionRevocation> {
  try {
    const row = await prisma.aIConversation.findUnique({
      where: { sessionId },
      select: { latestState: true },
    });
    return parseRevocation(row?.latestState ?? null);
  } catch (err) {
    // Fail OPEN: a read failure must not lock out legitimate sessions — the
    // revocation gate is defense-in-depth, not the only wall (tier checks,
    // rate limits, and token duration caps all still stand).
    console.warn('[session-revocation] read failed (gate skipped):', err);
    return { revoked: false };
  }
}

/** Revocation state by DB conversation id (server-internal callers). */
export async function isConversationRevoked(conversationId: string): Promise<SessionRevocation> {
  try {
    const row = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
      select: { latestState: true },
    });
    return parseRevocation(row?.latestState ?? null);
  } catch (err) {
    console.warn('[session-revocation] read failed (gate skipped):', err);
    return { revoked: false };
  }
}
