/**
 * Safety tripwire config accessor (Req 22.4, task L1/L4).
 *
 * Singleton row id='safety' (same pattern as memory-config.ts), memoized ≤30s
 * per instance. A missing row OR a read failure resolves to the DEFAULTS —
 * module DISABLED — because disabled is the shipped state (Req 22.4: the
 * system functions identically without the module) and a config read must
 * never break a log write (P33). Word lists and the severity→action map are
 * owner-tuned data edited at /admin/ai/safety, never code (P34).
 */

import { prisma } from '@/lib/prisma';
import type { SafetyWordLists } from '@/lib/ai/safety/scan';
import { SAFETY_ACTIONS, SAFETY_SEVERITIES, type SafetyAction, type SafetySeverity } from '@/lib/ai/safety/investigation';

export interface SafetyConfigState {
  enabled: boolean;
  wordLists: SafetyWordLists;
  investigationPolicy: string | null;
  /** severity → configured action; a missing severity defaults to 'log_only' (least aggressive). */
  severityActionMap: Partial<Record<SafetySeverity, SafetyAction>>;
}

export const SAFETY_CONFIG_DEFAULTS: SafetyConfigState = {
  enabled: false,
  wordLists: {},
  investigationPolicy: null,
  severityActionMap: {},
};

function parseWordLists(raw: unknown): SafetyWordLists {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const lists: SafetyWordLists = {};
  for (const [category, words] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(words)) continue;
    const clean = words.filter((w): w is string => typeof w === 'string' && w.trim().length > 0);
    if (clean.length > 0) lists[category] = clean;
  }
  return lists;
}

function parseActionMap(raw: unknown): Partial<Record<SafetySeverity, SafetyAction>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const map: Partial<Record<SafetySeverity, SafetyAction>> = {};
  for (const [severity, action] of Object.entries(raw as Record<string, unknown>)) {
    if (
      (SAFETY_SEVERITIES as readonly string[]).includes(severity) &&
      typeof action === 'string' &&
      (SAFETY_ACTIONS as readonly string[]).includes(action)
    ) {
      map[severity as SafetySeverity] = action as SafetyAction;
    }
  }
  return map;
}

const CACHE_TTL_MS = 30_000;
let cache: { at: number; state: SafetyConfigState } | null = null;

export async function getSafetyConfig(opts?: { fresh?: boolean }): Promise<SafetyConfigState> {
  const now = Date.now();
  if (!opts?.fresh && cache && now - cache.at < CACHE_TTL_MS) return cache.state;
  let state: SafetyConfigState = SAFETY_CONFIG_DEFAULTS;
  try {
    const row = await prisma.safetyConfig.findUnique({ where: { id: 'safety' } });
    if (row) {
      state = {
        enabled: row.enabled,
        wordLists: parseWordLists(row.wordLists),
        investigationPolicy: row.investigationPolicy?.trim() ? row.investigationPolicy : null,
        severityActionMap: parseActionMap(row.severityActionMap),
      };
    }
  } catch (err) {
    console.warn('[safety-config] read failed — defaults apply (module disabled):', err);
  }
  cache = { at: now, state };
  return state;
}

export function __clearSafetyConfigCache(): void {
  cache = null;
}
