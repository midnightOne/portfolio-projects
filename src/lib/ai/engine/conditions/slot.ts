/**
 * Slot state as first-class transition evidence (Req 14.4). Evaluated against
 * the WORKING slot state — this turn's extractions are already merged, so
 * "job_description captured → offer analysis" fires the same turn.
 *
 * Req 19.2 unification (task J2): a name of the form `flags.<key>` reads the
 * inferred visitor profile instead of stated slots — same condition type, same
 * ops ("intent=hiring arms the fit node's edges"). Array flags (topics) render
 * comma-joined for `eq`.
 */

import type { EdgeCondition, VisitorFlags } from '../types';
import type { ConditionContext, ConditionResult } from './context';

function readValue(ctx: ConditionContext, name: string): string | undefined {
  if (name.startsWith('flags.')) {
    const value = ctx.state.flags?.[name.slice('flags.'.length) as keyof VisitorFlags];
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value.join(', ') : String(value);
  }
  return ctx.state.slots[name];
}

export function evaluateSlot(
  condition: Extract<EdgeCondition, { type: 'slot' }>,
  ctx: ConditionContext
): ConditionResult {
  const value = readValue(ctx, condition.name);
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
