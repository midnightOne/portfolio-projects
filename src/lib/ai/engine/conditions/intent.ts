/**
 * Intent match: exemplar-embedding similarity first (version-pinned vectors,
 * P11 — free after the one utterance embed), the batched cheap-call
 * classifier as the TIEBREAKER BAND only, never the default path (P10).
 * No embeddings recorded (unpublished graph / stale model) → classifier-only.
 */

import type { EdgeCondition } from '../types';
import {
  ConditionContext,
  ConditionResult,
  CLASSIFIER_FIRE_SCORE,
  INTENT_DEFAULT_THRESHOLD,
  INTENT_TIEBREAK_BAND,
} from './context';

export function evaluateIntent(
  condition: Extract<EdgeCondition, { type: 'intent' }>,
  ctx: ConditionContext,
  edgeId: string
): ConditionResult {
  const threshold = condition.threshold ?? INTENT_DEFAULT_THRESHOLD;

  if (ctx.similarity !== undefined) {
    if (ctx.similarity >= threshold) {
      return { fired: true, reason: `exemplar similarity ${ctx.similarity.toFixed(3)} ≥ ${threshold}` };
    }
    if (ctx.similarity < threshold - INTENT_TIEBREAK_BAND) {
      return { fired: false, reason: `exemplar similarity ${ctx.similarity.toFixed(3)} below band` };
    }
    // Tiebreaker band → classifier decides
    const score = ctx.cheap?.edgeScores[edgeId];
    if (score !== undefined && score >= CLASSIFIER_FIRE_SCORE) {
      return { fired: true, reason: `similarity ${ctx.similarity.toFixed(3)} in band; classifier ${score.toFixed(2)} confirmed` };
    }
    return { fired: false, reason: `similarity ${ctx.similarity.toFixed(3)} in band; classifier ${score?.toFixed(2) ?? 'unavailable'} declined` };
  }

  // Embeddings unavailable → classifier-only degrade (P11)
  const score = ctx.cheap?.edgeScores[edgeId];
  if (score !== undefined && score >= CLASSIFIER_FIRE_SCORE) {
    return { fired: true, reason: `classifier-only (no pinned embeddings) score ${score.toFixed(2)}` };
  }
  return { fired: false, reason: `classifier-only score ${score?.toFixed(2) ?? 'unavailable'} below ${CLASSIFIER_FIRE_SCORE}` };
}
