/**
 * 'always' edges are ONLY followed during startPolicy (§3 turn-zero rule —
 * re-firing them per turn would loop the start chain). At runtime they refuse
 * to fire; validation warns when one is authored outside the start chain.
 */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluateAlways(
  _condition: Extract<EdgeCondition, { type: 'always' }>,
  _ctx: ConditionContext
): ConditionResult {
  return { fired: false, reason: "'always' edges resolve at startPolicy only (§3)" };
}
