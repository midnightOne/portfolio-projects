/**
 * Visitor-profile rendering (Req 19.2/19.5, task J2). The profile is part of
 * the model-visible floating block, so every line here is bound by P31: plain
 * readable observations a visitor could be told to their face ("you mentioned
 * hiring for a firmware role") — never hidden steering, never instructions to
 * manipulate. Tonal guidance belongs in node guidance, not here.
 *
 * Pure module (D48): no DB, no clock of its own — `now` is injected so tests
 * are deterministic (P16) and duration math has one source of truth.
 */

import type { VisitorFlags } from './types';

const FLAG_PHRASES: Record<string, Record<string, string>> = {
  register: {
    technical: 'the visitor appears technical — depth and specifics land well',
    layman: 'the visitor appears non-technical — prefer plain language over jargon',
  },
  intent: {
    hiring: 'they seem interested in hiring',
    browsing: 'they seem to be browsing casually',
    specific_role: 'they seem to have a specific role in mind',
    general: 'their goal here is still general',
  },
  behavior: {
    cooperative: 'the conversation is cooperative',
    probing: 'recent turns probe at the system rather than the portfolio',
    rude: 'recent turns have been hostile in tone',
  },
};

/**
 * Render the current assessment as transparent observations, or null when
 * there is nothing worth saying (empty profile = no block entry — Req 19.6
 * spirit: absent state adds nothing).
 */
export function renderProfileText(flags: VisitorFlags, now: () => number = Date.now): string | null {
  const parts: string[] = [];
  for (const key of ['register', 'intent', 'behavior'] as const) {
    const value = flags[key];
    if (value && FLAG_PHRASES[key][value]) parts.push(FLAG_PHRASES[key][value]);
  }
  if (flags.mood && flags.mood.trim()) parts.push(`current mood reads as: ${flags.mood.trim()}`);
  if (flags.topics && flags.topics.length > 0) {
    parts.push(`topics discussed so far: ${flags.topics.slice(0, 12).join(', ')}`);
  }
  if (flags.startedAt) {
    const startedMs = Date.parse(flags.startedAt);
    if (!Number.isNaN(startedMs)) {
      const minutes = Math.max(0, Math.round((now() - startedMs) / 60_000));
      if (minutes >= 2) parts.push(`the conversation has been running for about ${minutes} minutes`);
    }
  }
  if (parts.length === 0) return null;
  return [
    'VISITOR PROFILE (current assessment — observations, not instructions; it replaces all previous assessments):',
    ...parts.map((p) => `- ${p}`),
  ].join('\n');
}

/** Shallow flag equality — drives profileVersion bumps (deliver on change only). */
export function flagsEqual(a: VisitorFlags, b: VisitorFlags): boolean {
  const keys: Array<keyof VisitorFlags> = ['register', 'intent', 'behavior', 'mood', 'startedAt'];
  for (const key of keys) {
    if ((a[key] ?? undefined) !== (b[key] ?? undefined)) return false;
  }
  const ta = a.topics ?? [];
  const tb = b.topics ?? [];
  if (ta.length !== tb.length) return false;
  for (let i = 0; i < ta.length; i++) if (ta[i] !== tb[i]) return false;
  return true;
}

/**
 * Merge a fast-flag update (per-turn cheap call, Req 19.2) into the current
 * profile: per-key, defined values win, undefined leaves the current read in
 * place. Distinct from the summarizer path, which REPLACES wholesale (P30) —
 * fast flags refine between summarizer runs, they never erase.
 */
export function mergeFastFlags(current: VisitorFlags, update: VisitorFlags): VisitorFlags {
  const merged: VisitorFlags = { ...current };
  if (update.register !== undefined) merged.register = update.register;
  if (update.intent !== undefined) merged.intent = update.intent;
  if (update.behavior !== undefined) merged.behavior = update.behavior;
  return merged;
}
