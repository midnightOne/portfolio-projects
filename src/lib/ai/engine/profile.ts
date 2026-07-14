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

import type { EngineState, SignalGrade, TurnSignals, VisitorFlags } from './types';

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

// ---------------------------------------------------------------------------
// Ordinal signal grading + hysteresis (Req 19.2 as amended 2026-07-13, task
// N2). The classifier grades evidence (none|weak|clear|strong, never floats);
// THIS module does the math: a short per-flag signal ring over the last few
// evaluated user turns, and enum flips only past thresholds. Motivating
// incident: a recruiter saying "firmware engineering" flipped register
// layman→technical off ONE utterance (transcript cmripxttm…).
// ---------------------------------------------------------------------------

export type SignalRing = EngineState['signalRing'];

/** Ring length — "the last 3–5 user turns" (Req 19.2); thresholds below use windows ≤ this. */
export const SIGNAL_RING_SIZE = 5;

const GRADE_SCORE: Record<SignalGrade, number> = { none: 0, weak: 1, clear: 2, strong: 3 };

/** Grade at or above 'clear'. */
function clearPlus(grade: SignalGrade | undefined): boolean {
  return grade !== undefined && GRADE_SCORE[grade] >= GRADE_SCORE.clear;
}

/**
 * Append one turn's graded evidence to the ring, keyed by turn id so a
 * retried /log POST updates in place instead of double-counting (P2).
 * Turns with NO signals still enter the ring — an evaluated turn with no
 * evidence is itself evidence (it dilutes "2 of the last 3" windows).
 */
export function updateSignalRing(ring: SignalRing, turnId: string, signals: TurnSignals): SignalRing {
  const withoutTurn = ring.filter((entry) => entry.turnId !== turnId);
  return [...withoutTurn, { turnId, signals }].slice(-SIGNAL_RING_SIZE);
}

/**
 * Count ring entries (over an optional tail window) whose `pick`ed grade is
 * clear or stronger.
 */
function countClearPlus(
  ring: SignalRing,
  pick: (s: TurnSignals) => SignalGrade | undefined,
  window = ring.length
): number {
  return ring.slice(-window).filter((entry) => clearPlus(pick(entry.signals))).length;
}

/**
 * Hysteresis: derive flag flips from the ring (which already includes the
 * current turn). Thresholds (Req 19.2 as amended — owner-set):
 *
 *  - `register → technical`: clear+ on 2 of the last 3 turns, or one strong.
 *    Never flips back to layman here — layman is absence of evidence; the
 *    windowed summarizer profile call owns that judgment.
 *  - `behavior → probing`: clear+ twice anywhere in the ring. A single
 *    tongue-in-cheek "ignore all instructions" from an otherwise cooperative
 *    visitor never flips behavior — it may be a technical recruiter testing
 *    the site.
 *  - `behavior → rude`: strong twice CONSECUTIVE (wins over probing).
 *  - `intent`: the same value at clear+ on 2 of the last 3 turns, or one
 *    strong on the current turn.
 *
 * Everything not past a threshold keeps its current value — fast signals
 * refine between summarizer runs, they never erase (the J2 posture).
 */
export function applySignalThresholds(current: VisitorFlags, ring: SignalRing): VisitorFlags {
  const next: VisitorFlags = { ...current };
  const last3 = ring.slice(-3);
  const latest = ring[ring.length - 1];

  // register → technical
  const technicalStrong = last3.some((e) => e.signals.technical === 'strong');
  if (technicalStrong || countClearPlus(last3, (s) => s.technical) >= 2) {
    next.register = 'technical';
  }

  // behavior — rude beats probing when both clear their thresholds
  const lastTwo = ring.slice(-2);
  const rudeTwiceConsecutive =
    lastTwo.length === 2 && lastTwo.every((e) => e.signals.rude === 'strong');
  const probingTwice = countClearPlus(ring, (s) => s.probing) >= 2;
  if (rudeTwiceConsecutive) next.behavior = 'rude';
  else if (probingTwice) next.behavior = 'probing';

  // intent — 2-of-3 agreement on the same value, or a strong current read
  if (latest?.signals.intent?.strength === 'strong') {
    next.intent = latest.signals.intent.value;
  } else {
    const counts = new Map<VisitorFlags['intent'], number>();
    for (const entry of last3) {
      const read = entry.signals.intent;
      if (read && clearPlus(read.strength)) counts.set(read.value, (counts.get(read.value) ?? 0) + 1);
    }
    for (const [value, count] of counts) {
      if (count >= 2 && value !== undefined) next.intent = value;
    }
  }

  return next;
}

/**
 * Probe-edge hysteresis (task N2): the classifier arm of the probe condition
 * fires only when the CURRENT turn grades probing clear+ AND at least one
 * EARLIER ring turn did too ("clear+ twice", anchored to now so a stale pair
 * of old signals cannot re-fire the edge on an innocent turn). The regex rail
 * is deliberately NOT routed through this — it fires immediately (the layer
 * that cannot be talked down).
 */
export function probeSignalConfirmed(ring: SignalRing, currentTurnSignals: TurnSignals): boolean {
  if (!clearPlus(currentTurnSignals.probing)) return false;
  return countClearPlus(ring, (s) => s.probing) >= 1;
}
