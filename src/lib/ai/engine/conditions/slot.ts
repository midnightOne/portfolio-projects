/**
 * Slot state as first-class transition evidence (Req 14.4). Evaluated against
 * the WORKING slot state — this turn's extractions are already merged, so
 * "job_description captured → offer analysis" fires the same turn.
 */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluateSlot(
  condition: Extract<EdgeCondition, { type: 'slot' }>,
  ctx: ConditionContext
): ConditionResult {
  const value = ctx.state.slots[condition.name];
  const filled = typeof value === 'string' && value.trim().length > 0;
  switch (condition.op) {
    case 'filled':
      return { fired: filled, reason: filled ? `slot ${condition.name} filled` : `slot ${condition.name} empty` };
    case 'missing':
      return { fired: !filled, reason: !filled ? `slot ${condition.name} missing` : `slot ${condition.name} filled` };
    case 'eq': {
      const fired = filled && value === condition.value;
      return { fired, reason: fired ? `slot ${condition.name} == ${condition.value}` : `slot ${condition.name} != ${condition.value}` };
    }
  }
}
