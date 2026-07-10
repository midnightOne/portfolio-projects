/**
 * Chip tap by id — the ONE transition path with a 100% fire guarantee (P22):
 * matches on the chipId evidence alone. No classifier, no embedding, no fuzzy
 * label matching — don't dilute it.
 */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluateChip(
  condition: Extract<EdgeCondition, { type: 'chip' }>,
  ctx: ConditionContext
): ConditionResult {
  const fired = ctx.evidence.chipId === condition.chipId;
  return { fired, reason: fired ? `chip ${condition.chipId} tapped` : 'chip id not in evidence' };
}
