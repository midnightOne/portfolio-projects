/**
 * Public chat session mint (access-and-cost Req 3.1/3.2).
 *
 * POST { turnstileToken? } → HttpOnly session cookie (short-lived HS256 JWT bound to
 * the hashed IP). Turnstile verification gates issuance when enabled in
 * AIPublicAccessSettings; per-IP issuance caps run in the gateway ('mint' mode:
 * kill switch + rate limit only). Dev uses Cloudflare's official always-pass test
 * keys — swap to real keys at deploy time (CLAUDE.md §Environment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { mintSessionToken, SESSION_COOKIE_NAME } from '@/lib/ai/public-session';
import { getPublicAccessSettings } from '@/lib/ai/public-access';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(token: string | undefined, remoteIp: string | undefined): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Enabled but unconfigured → fail closed, never silently open.
    return { ok: false, reason: 'challenge_unconfigured' };
  }
  if (!token) return { ok: false, reason: 'challenge_token_missing' };
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    return data.success ? { ok: true } : { ok: false, reason: (data['error-codes'] ?? []).join(',') || 'challenge_failed' };
  } catch (error) {
    console.error('[chat/session] Turnstile verification error:', error);
    return { ok: false, reason: 'challenge_unreachable' };
  }
}

async function handler(req: NextRequest, ctx: GatewayContext): Promise<NextResponse> {
  const settings = ctx.settings ?? (await getPublicAccessSettings());

  let turnstileToken: string | undefined;
  try {
    const body = await req.json();
    turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : undefined;
  } catch {
    // empty body is fine when Turnstile is disabled
  }

  if (ctx.tier === 'public' && settings.turnstileEnabled) {
    const check = await verifyTurnstile(turnstileToken, undefined);
    if (!check.ok) {
      return NextResponse.json(
        { error: 'Bot challenge failed.', code: 'CHALLENGE_FAILED', reason: check.reason },
        { status: 403 }
      );
    }
  }

  const { token, expiresAt } = mintSessionToken(ctx.hashedIp, settings.sessionTtlMinutes);
  const res = NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/ai',
    expires: expiresAt,
  });
  return res;
}

export const POST = withAIGateway({ feature: 'chat', publicAllowed: true, mode: 'mint' }, handler);
