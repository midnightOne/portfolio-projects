/**
 * Dev/test-only synthetic engine directives (conversation-engine task A4
 * verification seam; same dev-only class as the D53 fake-mic TTS route).
 *
 * Until Block B lands the evaluator, nothing real produces an engineDirective.
 * This module lets a drill stage one for a session id (via
 * POST /api/dev/engine-directive); the NEXT /log POSTs for that session
 * return it, exercising the REAL return path and the base adapter's
 * seq-gated application (D56: the drill runs the production pipeline — only
 * the directive's ORIGIN is synthetic). Peek does not consume: a retried /log
 * POST returns the same directive again, which is exactly what the
 * exactly-once client application test needs (P2/P4).
 *
 * Refuses production unconditionally. In-memory per server process — dev runs
 * a single instance; entries expire after 5 minutes as a leak guard.
 */

import type { EngineDirective } from '@/lib/ai/engine/types';

const TTL_MS = 5 * 60 * 1000;

const pending = new Map<string, { directive: EngineDirective; storedAt: number }>();

function devGateOpen(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function setSyntheticDirective(sessionId: string, directive: EngineDirective): void {
  if (!devGateOpen()) throw new Error('Synthetic engine directives refuse production');
  pending.set(sessionId, { directive, storedAt: Date.now() });
}

/** Non-consuming read — retries must see the same directive (client seq-gates). */
export function peekSyntheticDirective(sessionId: string): EngineDirective | undefined {
  if (!devGateOpen()) return undefined;
  const entry = pending.get(sessionId);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > TTL_MS) {
    pending.delete(sessionId);
    return undefined;
  }
  return entry.directive;
}

export function clearSyntheticDirective(sessionId: string): void {
  pending.delete(sessionId);
}
