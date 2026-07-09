/**
 * DB-backed public access settings (D31 — replaces the JSON-config placeholder in
 * PublicAccessManager). Single row id='public'; reads are memoized ≤30s per instance.
 * Callers on public paths must treat a read failure as fail-closed.
 */

import { prisma } from '@/lib/prisma';

export interface PublicAccessSettingsState {
  publicTier: 'disabled' | 'text_chat';
  turnstileEnabled: boolean;
  sessionTtlMinutes: number;
  sessionsPerIpPerHour: number;
  messagesPerMinute: number;
  messagesPerDay: number;
  tokensPerDay: number;
  maxHistoryMessages: number;
  /** MCP server bucket (mcp-server Req 3.1): own on/off + per-IP limits. */
  mcpEnabled: boolean;
  mcpRequestsPerMinute: number;
  mcpRequestsPerDay: number;
  /** Voice adapter family visitors get by default (owner, 2026-07-09). */
  defaultVoiceProvider: 'openai' | 'google' | 'cascade';
}

const CACHE_TTL_MS = 30_000;
let cache: { at: number; state: PublicAccessSettingsState } | null = null;

export async function getPublicAccessSettings(opts?: { fresh?: boolean }): Promise<PublicAccessSettingsState> {
  const now = Date.now();
  if (!opts?.fresh && cache && now - cache.at < CACHE_TTL_MS) return cache.state;
  const row = await prisma.aIPublicAccessSettings.findUnique({ where: { id: 'public' } });
  if (!row) throw new Error('AIPublicAccessSettings row missing — run the seed');
  const state: PublicAccessSettingsState = {
    publicTier: row.publicTier === 'text_chat' ? 'text_chat' : 'disabled',
    turnstileEnabled: row.turnstileEnabled,
    sessionTtlMinutes: row.sessionTtlMinutes,
    sessionsPerIpPerHour: row.sessionsPerIpPerHour,
    messagesPerMinute: row.messagesPerMinute,
    messagesPerDay: row.messagesPerDay,
    tokensPerDay: row.tokensPerDay,
    maxHistoryMessages: row.maxHistoryMessages,
    mcpEnabled: row.mcpEnabled,
    mcpRequestsPerMinute: row.mcpRequestsPerMinute,
    mcpRequestsPerDay: row.mcpRequestsPerDay,
    defaultVoiceProvider:
      row.defaultVoiceProvider === 'google' || row.defaultVoiceProvider === 'cascade'
        ? row.defaultVoiceProvider
        : 'openai',
  };
  cache = { at: now, state };
  return state;
}

export function __clearPublicAccessCache(): void {
  cache = null;
}
