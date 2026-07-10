/** Condition dispatcher — one module per type (notes §1). */

import type { GraphEdge } from '../types';
import type { ConditionContext, ConditionResult } from './context';
import { evaluatePattern } from './pattern';
import { evaluateChip } from './chip';
import { evaluateUiState } from './ui-state';
import { evaluateToolResult } from './tool-result';
import { evaluateSlot } from './slot';
import { evaluateIntent } from './intent';
import { evaluateTurnQuality } from './turn-quality';
import { evaluateProbe } from './probe';
import { evaluatePivot } from './pivot';
import { evaluateAlways } from './always';

export * from './context';
export { heuristicLowEffort } from './turn-quality';

/** Condition types whose evaluation may need the batched cheap call (P26). */
export function conditionNeedsClassifier(edge: GraphEdge): boolean {
  const t = edge.condition.type;
  return t === 'intent' || t === 'pivot' || t === 'probe' || t === 'turn_quality';
}

export function evaluateCondition(edge: GraphEdge, ctx: ConditionContext): ConditionResult {
  const condition = edge.condition;
  switch (condition.type) {
    case 'pattern':
      return evaluatePattern(condition, ctx);
    case 'chip':
      return evaluateChip(condition, ctx);
    case 'ui_state':
      return evaluateUiState(condition, ctx);
    case 'tool_result':
      return evaluateToolResult(condition, ctx);
    case 'slot':
      return evaluateSlot(condition, ctx);
    case 'intent':
      return evaluateIntent(condition, ctx, edge.id);
    case 'turn_quality':
      return evaluateTurnQuality(condition, ctx);
    case 'probe':
      return evaluateProbe(condition, ctx);
    case 'pivot':
      return evaluatePivot(condition, ctx, edge.id);
    case 'always':
      return evaluateAlways(condition, ctx);
  }
}
