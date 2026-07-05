/**
 * Public chat session tokens (access-and-cost Req 3): short-lived HS256 JWT in an
 * HttpOnly cookie, bound to the issuing hashed IP. Stateless — no server session
 * store (D43); rate limiting keys off the sid claim + hashed IP.
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'ai_chat_session';

function secret(): string {
  const s = process.env.AI_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('AI_SESSION_SECRET or NEXTAUTH_SECRET must be set');
  return s;
}

/** Hashed IP for rate-limit keys and ledger rows — raw IPs are never stored (Req 4.1). */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${secret()}:ip:${ip}`).digest('hex').slice(0, 32);
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

interface SessionClaims {
  sid: string;
  hip: string;
  iat: number;
  exp: number;
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

export function mintSessionToken(hashedIp: string, ttlMinutes: number): { token: string; sid: string; expiresAt: Date } {
  const sid = randomBytes(12).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = { sid, hip: hashedIp, iat: now, exp: now + ttlMinutes * 60 };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const signature = createHmac('sha256', secret()).update(`${header}.${payload}`).digest('base64url');
  return { token: `${header}.${payload}.${signature}`, sid, expiresAt: new Date(claims.exp * 1000) };
}

export type SessionVerification =
  | { valid: true; sid: string; hashedIp: string }
  | { valid: false; reason: 'missing' | 'malformed' | 'bad_signature' | 'expired' | 'ip_mismatch' };

export function verifySessionToken(token: string | undefined, currentHashedIp: string): SessionVerification {
  if (!token) return { valid: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret()).update(`${header}.${payload}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'base64url');
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { valid: false, reason: 'bad_signature' };
  }
  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  if (claims.hip !== currentHashedIp) {
    return { valid: false, reason: 'ip_mismatch' };
  }
  return { valid: true, sid: claims.sid, hashedIp: claims.hip };
}
