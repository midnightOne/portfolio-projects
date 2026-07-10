/** Keyword/regex on the user turn — free tier, evaluated without any model call. */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluatePattern(
  condition: Extract<EdgeCondition, { type: 'pattern' }>,
  ctx: ConditionContext
): ConditionResult {
  const utterance = ctx.evidence.utterance;
  for (const raw of condition.anyOf) {
    let matched = false;
    try {
      matched = new RegExp(raw, 'i').test(utterance);
    } catch {
      // Invalid regex authored — degrade to case-insensitive substring, never throw.
      matched = utterance.toLowerCase().includes(raw.toLowerCase());
    }
    if (matched) return { fired: true, reason: `pattern "${raw}" matched` };
  }
  return { fired: false, reason: 'no pattern matched' };
}
