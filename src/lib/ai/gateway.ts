/**
 * AI Gateway (D33 / access-and-cost Req 1): the single chokepoint for every
 * cost-incurring route. Chain, in order:
 *
 *   1 kill switch      — AIGlobalLimits; fail CLOSED for non-admin on any read failure
 *   2 access tier      — admin session | reflink | public (AIPublicAccessSettings)
 *   3 session          — public tier: signed HttpOnly JWT bound to hashed IP
 *   4 rate limits      — blacklist + windowed limits (hashed IP / session / reflink budgets)
 *   5 execute          — handler runs; reports usage via ctx.meter()
 *   6 meter            — ledger write + atomic watchdog counters (ledger.recordUsage)
 *
 * Debug envelope (verification spec Req 4): responses gain a `_debug` field only when
 * resolveDebugAuth passes (admin session ∨ DEV_VERIFICATION=true); otherwise the
 * response is byte-identical to normal traffic.
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getKillSwitchState,
  recordUsage,
  type LedgerFeature,
  type LedgerWriteResult,
  type UsageEntry,
} from './ledger';
import { getPublicAccessSettings, type PublicAccessSettingsState } from './public-access';
import {
  SESSION_COOKIE_NAME,
  getClientIp,
  hashIp,
  verifySessionToken,
} from './public-session';

if (process.env.DEV_VERIFICATION === 'true' && process.env.NODE_ENV === 'production') {
  console.warn(
    '[gateway] WARNING: DEV_VERIFICATION=true with NODE_ENV=production — the _debug envelope is exposed. This must never happen in a real deployment.'
  );
}

export type GatewayTier = 'public' | 'reflink' | 'admin';

export interface GatewayReflinkInfo {
  id: string;
  code: string;
  enableVoiceAI: boolean;
  enableJobAnalysis: boolean;
  enableAdvancedNavigation: boolean;
}

/** Public-tier tool allowlist (Req 2.1) — enforced at tier and re-checked at dispatch. */
export const PUBLIC_TOOL_ALLOWLIST = ['content_search', 'content_get', 'ui_intent', 'ui_describe'] as const;

export interface GatewayDebugState {
  model?: { alias?: string; resolved?: string };
  retrieval: Array<Record<string, unknown>>;
  toolCalls: Array<{ name: string; args?: unknown; ms?: number; ok: boolean; error?: string }>;
  modelMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd: number; ledgerId: string };
  rateLimit?: { remainingMinute?: number; remainingDay?: number };
  /** Assembled system prompt for this turn (ai-assistant task 2.4b debug parity). */
  systemPrompt?: string;
  /** Context string injected this turn (start frame today; D47 node context later). */
  contextString?: string;
}

export interface GatewayContext {
  requestId: string;
  tier: GatewayTier;
  hashedIp: string;
  /** Public chat session sid when tier=public with a session; otherwise undefined. */
  sessionId?: string;
  reflink?: GatewayReflinkInfo;
  settings: PublicAccessSettingsState | null;
  debugAuthorized: boolean;
  debug: GatewayDebugState;
  /** Tools this tier may execute; null = unrestricted (admin/reflink). */
  allowedTools: readonly string[] | null;
  /** Step 6: ledger write + watchdog counters. Fills identity fields from the context. */
  meter(entry: Omit<UsageEntry, 'feature'> & { feature?: LedgerFeature }): Promise<LedgerWriteResult>;
}

export interface GatewayOptions {
  feature: LedgerFeature;
  /** false → anonymous (no admin session, no valid reflink) requests are rejected. */
  publicAllowed: boolean;
  /** Require the public chat session JWT for public-tier requests (default true). */
  requirePublicSession?: boolean;
  /** 'mint' = session-issuance route: steps 1 + 4 only (no session requirement). */
  mode?: 'full' | 'mint';
  /**
   * Rate bucket. 'mcp' (mcp-server Req 3.1): anonymous clients with no cookie
   * session — gated by settings.mcpEnabled + its own per-IP windows instead of
   * the chat-session limits. Kill switch, blacklist, ledger identical.
   */
  bucket?: 'mcp';
}

function friendlyPause(): NextResponse {
  return NextResponse.json(
    { error: 'The assistant is resting right now — please try again later.', code: 'AI_PAUSED' },
    { status: 503 }
  );
}

function reject(status: number, code: string, error: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, code, ...extra }, { status });
}

async function resolveDebugAuth(isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  return process.env.DEV_VERIFICATION === 'true' && process.env.NODE_ENV !== 'production';
}

async function isAdminSession(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    return (session?.user as { role?: string } | undefined)?.role === 'admin';
  } catch {
    return false;
  }
}

async function getReflinkCode(req: NextRequest): Promise<string | undefined> {
  const direct =
    req.nextUrl.searchParams.get('reflink') ??
    req.nextUrl.searchParams.get('reflinkId') ??
    req.headers.get('x-reflink');
  if (direct) return direct;
  // Existing clients (voice tool calls) send reflinkId/reflinkCode in the JSON body.
  if (req.method === 'POST' && (req.headers.get('content-type') ?? '').includes('application/json')) {
    try {
      const body = await req.clone().json();
      const candidate = body?.reflinkId ?? body?.reflinkCode ?? body?.reflink;
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    } catch {
      // no/invalid body — fall through
    }
  }
  return undefined;
}

/**
 * Windowed rate limit on the AIRateLimit table (Postgres-backed, serverless-honest D43).
 * Increment-then-check; returns remaining. Identifiers are hashed IPs or session ids —
 * never raw IPs (Req 4.1).
 */
async function bumpWindow(
  identifier: string,
  identifierType: string,
  windowMs: number,
  limit: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const windowEnd = new Date(windowStart.getTime() + windowMs);
  const key = { identifier, identifierType, windowStart };
  let count: number;
  try {
    const row = await prisma.aIRateLimit.upsert({
      where: { ai_rate_limits_identifier_window_idx: key },
      create: { ...key, windowEnd, requestsCount: 1 },
      update: { requestsCount: { increment: 1 } },
    });
    count = row.requestsCount;
  } catch {
    // unique-race on first create: retry as plain update
    const row = await prisma.aIRateLimit.update({
      where: { ai_rate_limits_identifier_window_idx: key },
      data: { requestsCount: { increment: 1 } },
    });
    count = row.requestsCount;
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd.getTime() - now) / 1000)),
  };
}

async function isBlacklisted(rawIp: string): Promise<boolean> {
  try {
    const { blacklistManager } = await import('@/lib/services/ai/blacklist-manager');
    const result = await blacklistManager.isBlacklisted(rawIp);
    return result.blacklisted;
  } catch (error) {
    console.error('[gateway] blacklist check failed (continuing):', error);
    return false;
  }
}

/** Attach the _debug envelope to a JSON response when authorized. */
async function attachDebug(
  res: NextResponse,
  ctx: GatewayContext,
  startedAt: number
): Promise<NextResponse> {
  if (!ctx.debugAuthorized) return res;
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return res;
  let body: Record<string, unknown>;
  try {
    body = await res.clone().json();
  } catch {
    return res;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return res;
  body._debug = {
    requestId: ctx.requestId,
    tier: ctx.tier,
    rateLimit: ctx.debug.rateLimit,
    model: ctx.debug.model,
    retrieval: ctx.debug.retrieval,
    toolCalls: ctx.debug.toolCalls,
    usage: ctx.debug.usage,
    systemPrompt: ctx.debug.systemPrompt,
    contextString: ctx.debug.contextString,
    timings: { totalMs: Date.now() - startedAt, modelMs: ctx.debug.modelMs || undefined },
  };
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new NextResponse(JSON.stringify(body), { status: res.status, headers });
}

export function withAIGateway(
  opts: GatewayOptions,
  handler: (req: NextRequest, ctx: GatewayContext, routeContext?: any) => Promise<NextResponse>
): (req: NextRequest, routeContext?: any) => Promise<NextResponse> {
  return async (req: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const rawIp = getClientIp(req);

    const admin = await isAdminSession();
    const debugAuthorized = await resolveDebugAuth(admin);

    let hashedIp: string;
    try {
      hashedIp = hashIp(rawIp);
    } catch (error) {
      console.error('[gateway] cannot hash IP (secret missing):', error);
      return admin ? reject(500, 'CONFIG_ERROR', 'Server configuration error') : friendlyPause();
    }

    const ctx: GatewayContext = {
      requestId,
      tier: 'public',
      hashedIp,
      settings: null,
      debugAuthorized,
      debug: { retrieval: [], toolCalls: [], modelMs: 0 },
      allowedTools: PUBLIC_TOOL_ALLOWLIST,
      meter: async (entry) => {
        const result = await recordUsage({
          feature: opts.feature,
          endpoint: req.nextUrl.pathname,
          requestId,
          hashedIp,
          sessionId: ctx.sessionId,
          reflinkId: ctx.reflink?.id,
          ...entry,
        });
        ctx.debug.usage = {
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          costUsd: result.costUsd,
          ledgerId: result.ledgerId,
        };
        return result;
      },
    };

    // ---- Step 1: kill switch (fail closed for non-admin) ----
    let killState;
    try {
      killState = await getKillSwitchState();
    } catch (error) {
      console.error('[gateway] kill-switch read failed:', error);
      if (!admin) return friendlyPause();
    }

    // ---- Step 2: access tier ----
    if (admin) {
      ctx.tier = 'admin';
      ctx.allowedTools = null;
    } else {
      const reflinkCode = await getReflinkCode(req);
      if (reflinkCode) {
        try {
          const { reflinkManager } = await import('@/lib/services/ai/reflink-manager');
          const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);
          if (validation.valid && validation.reflink) {
            ctx.tier = 'reflink';
            ctx.allowedTools = null;
            ctx.reflink = {
              id: validation.reflink.id,
              code: validation.reflink.code,
              enableVoiceAI: validation.reflink.enableVoiceAI,
              enableJobAnalysis: validation.reflink.enableJobAnalysis,
              enableAdvancedNavigation: validation.reflink.enableAdvancedNavigation,
            };
          }
        } catch (error) {
          console.error('[gateway] reflink validation failed (treating as public):', error);
        }
      }

      if (ctx.tier === 'public') {
        try {
          ctx.settings = await getPublicAccessSettings();
        } catch (error) {
          console.error('[gateway] public access settings read failed (fail closed):', error);
          return friendlyPause();
        }
        if (opts.bucket === 'mcp') {
          // MCP has its own on/off knob — independent of the pill's publicTier
          if (!ctx.settings.mcpEnabled) {
            return reject(403, 'MCP_DISABLED', 'The MCP endpoint is currently disabled.');
          }
        } else if (!opts.publicAllowed || ctx.settings.publicTier === 'disabled') {
          return reject(403, 'PUBLIC_ACCESS_DISABLED', 'This feature requires an invitation link.');
        }
      }

      if (killState) {
        const paused = killState.status === 'tripped' || !killState.publicAIEnabled;
        if (paused && (ctx.tier === 'public' || (ctx.tier === 'reflink' && killState.disableReflinksOnTrip))) {
          return friendlyPause();
        }
      }
    }

    // ---- Step 3: public session validation (before any model call) ----
    // MCP clients are cookie-less by design: their bucket substitutes stricter
    // per-IP windows (step 4) for the chat-session JWT.
    if (ctx.tier === 'public' && opts.bucket !== 'mcp' && opts.mode !== 'mint' && (opts.requirePublicSession ?? true)) {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      const verification = verifySessionToken(token, hashedIp);
      if (verification.valid !== true) {
        return reject(401, 'SESSION_REQUIRED', 'A chat session is required.', { reason: verification.reason });
      }
      ctx.sessionId = verification.sid;
    }

    // ---- Step 4: rate limits ----
    if (ctx.tier !== 'admin') {
      if (await isBlacklisted(rawIp)) {
        return reject(403, 'FORBIDDEN', 'Access denied.');
      }

      if (ctx.tier === 'public') {
        const settings = ctx.settings ?? (await getPublicAccessSettings().catch(() => null));
        if (!settings) return friendlyPause();
        ctx.settings = settings;

        if (opts.bucket === 'mcp') {
          // Own bucket (mcp-server Req 3.1): per-IP minute + day windows, admin-tunable
          const minute = await bumpWindow(hashedIp, 'mcp_minute', 60 * 1000, settings.mcpRequestsPerMinute);
          if (!minute.allowed) {
            return reject(429, 'RATE_LIMITED', 'Too many MCP requests — slow down.', {
              retryAfterSeconds: minute.retryAfterSeconds,
            });
          }
          const day = await bumpWindow(hashedIp, 'mcp_day', 24 * 60 * 60 * 1000, settings.mcpRequestsPerDay);
          if (!day.allowed) {
            return reject(429, 'RATE_LIMITED', 'Daily MCP limit reached — come back tomorrow.', {
              retryAfterSeconds: day.retryAfterSeconds,
            });
          }
          ctx.debug.rateLimit = { remainingMinute: minute.remaining, remainingDay: day.remaining };
        } else if (opts.mode === 'mint') {
          const mint = await bumpWindow(hashedIp, 'session_mint', 60 * 60 * 1000, settings.sessionsPerIpPerHour);
          if (!mint.allowed) {
            return reject(429, 'RATE_LIMITED', 'Too many sessions — try again later.', {
              retryAfterSeconds: mint.retryAfterSeconds,
            });
          }
        } else {
          const minute = ctx.sessionId
            ? await bumpWindow(ctx.sessionId, 'session_minute', 60 * 1000, settings.messagesPerMinute)
            : null;
          if (minute && !minute.allowed) {
            return reject(429, 'RATE_LIMITED', 'Slow down a little — try again in a minute.', {
              retryAfterSeconds: minute.retryAfterSeconds,
            });
          }
          const day = await bumpWindow(hashedIp, 'ip_day', 24 * 60 * 60 * 1000, settings.messagesPerDay);
          if (!day.allowed) {
            return reject(429, 'RATE_LIMITED', 'Daily limit reached — come back tomorrow.', {
              retryAfterSeconds: day.retryAfterSeconds,
            });
          }
          ctx.debug.rateLimit = { remainingMinute: minute?.remaining, remainingDay: day.remaining };

          // tokens/day per IP from the ledger (Req 4.2) — pre-call check on real writes
          const since = new Date();
          since.setUTCHours(0, 0, 0, 0);
          const agg = await prisma.aIUsageLog.aggregate({
            where: { hashedIp, timestamp: { gte: since } },
            _sum: { tokensUsed: true },
          });
          if ((agg._sum.tokensUsed ?? 0) >= settings.tokensPerDay) {
            return reject(429, 'RATE_LIMITED', 'Daily usage limit reached — come back tomorrow.', {
              retryAfterSeconds: 3600,
            });
          }
        }
      }

      if (ctx.tier === 'reflink' && ctx.reflink) {
        const day = await bumpWindow(ctx.reflink.id, 'reflink_day', 24 * 60 * 60 * 1000, 1000);
        if (!day.allowed) {
          return reject(429, 'RATE_LIMITED', 'Daily limit reached for this invitation.', {
            retryAfterSeconds: day.retryAfterSeconds,
          });
        }
      }
    }

    // ---- Steps 5–6: execute (handler meters via ctx.meter) ----
    try {
      const res = await handler(req, ctx, routeContext);
      // MCP responses are JSON-RPC protocol frames — never mutate them (Req 1.3);
      // strict clients reject unknown top-level keys like _debug.
      if (opts.bucket === 'mcp') return res;
      return await attachDebug(res, ctx, startedAt);
    } catch (error) {
      console.error(`[gateway] handler error (${req.nextUrl.pathname}):`, error);
      return reject(500, 'INTERNAL_ERROR', 'Internal server error');
    }
  };
}
