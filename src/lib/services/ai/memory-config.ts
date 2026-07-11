/**
 * Conversation-memory layer config (Block M2 — Req 19.7, P39).
 *
 * The memory layer (profile flags, behavior summarizer, rolling window) is its
 * own switch, independent of graph presence: "no active graph" stops the
 * STEERING layer; "memory off" stops the MEMORY layer; both off = the app
 * behaves exactly as pre-engine (Req 2.7 as re-scoped 2026-07-10).
 *
 * Read posture: singleton row id='memory', memoized ≤30s per instance (same
 * pattern as public-access.ts). A missing row OR a read failure resolves to
 * the DEFAULTS (memory on, no graph-less tool narrowing) — the default state
 * is the shipped behavior, so failing open here changes nothing, and a config
 * read must never break a turn (P1 posture).
 */

import { prisma } from '@/lib/prisma';

export interface ConversationMemoryConfigState {
  /** Profile flags + summarizer + rolling window run for every conversation. */
  memoryEnabled: boolean;
  /**
   * Owner-curated default tool set for GRAPH-LESS sessions (registry names).
   * Narrow-only — layered like a node allowlist, never grants beyond tier.
   * Null = no narrowing (session default set).
   */
  graphlessToolAllowlist: string[] | null;
}

export const MEMORY_CONFIG_DEFAULTS: ConversationMemoryConfigState = {
  memoryEnabled: true,
  graphlessToolAllowlist: null,
};

const CACHE_TTL_MS = 30_000;
let cache: { at: number; state: ConversationMemoryConfigState } | null = null;

export async function getMemoryConfig(opts?: { fresh?: boolean }): Promise<ConversationMemoryConfigState> {
  const now = Date.now();
  if (!opts?.fresh && cache && now - cache.at < CACHE_TTL_MS) return cache.state;
  let state: ConversationMemoryConfigState = MEMORY_CONFIG_DEFAULTS;
  try {
    const row = await prisma.conversationMemoryConfig.findUnique({ where: { id: 'memory' } });
    if (row) {
      const allowlist = Array.isArray(row.graphlessToolAllowlist)
        ? (row.graphlessToolAllowlist as unknown[]).filter((t): t is string => typeof t === 'string')
        : null;
      state = {
        memoryEnabled: row.memoryEnabled,
        graphlessToolAllowlist: allowlist && allowlist.length > 0 ? allowlist : null,
      };
    }
  } catch (err) {
    console.warn('[memory-config] read failed — defaults apply (memory on):', err);
  }
  cache = { at: now, state };
  return state;
}

export function __clearMemoryConfigCache(): void {
  cache = null;
}
