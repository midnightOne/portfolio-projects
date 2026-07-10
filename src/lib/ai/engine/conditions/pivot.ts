/** Explicit topic-change detection — classifier-only (design §3 ladder). */

import type { EdgeCondition } from '../types';
import { ConditionContext, ConditionResult, CLASSIFIER_FIRE_SCORE } from './context';

export function evaluatePivot(
  _condition: Extract<EdgeCondition, { type: 'pivot' }>,
  ctx: ConditionContext,
  edgeId: string
): ConditionResult {
  const score = ctx.cheap?.edgeScores[edgeId];
  if (score !== undefined && score >= CLASSIFIER_FIRE_SCORE) {
    return { fired: true, reason: `pivot classifier score ${score.toFixed(2)}` };
  }
  return { fired: false, reason: `pivot score ${score?.toFixed(2) ?? 'unavailable'} below ${CLASSIFIER_FIRE_SCORE}` };
}
