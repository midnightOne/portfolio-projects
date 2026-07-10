/**
 * Vague-browser escalation (Req 18.2): fires when the merged consecutive
 * low-effort counter reaches the authored threshold. The counter itself is
 * maintained by the engine (heuristic + the batched cheap call) and handed in
 * via context — this module only compares.
 */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluateTurnQuality(
  condition: Extract<EdgeCondition, { type: 'turn_quality' }>,
  ctx: ConditionContext
): ConditionResult {
  const fired = ctx.lowEffortCount >= condition.consecutiveLowEffort;
  return {
    fired,
    reason: `consecutive low-effort ${ctx.lowEffortCount}/${condition.consecutiveLowEffort}`,
  };
}

/** Cheap heuristic half of the low-effort assessment (the classifier is the other half). */
export function heuristicLowEffort(utterance: string): boolean {
  const trimmed = utterance.trim();
  if (trimmed.length === 0) return true;
  const words = trimmed.split(/\s+/);
  return words.length <= 3 && !trimmed.includes('?');
}
