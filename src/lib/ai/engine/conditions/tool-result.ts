/** Predicate over a tool result this turn (e.g. content_search topic hit) — free tier. */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

function resolvePath(value: unknown, path: string): unknown {
  if (!path) return value;
  let cur: unknown = value;
  for (const segment of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

export function evaluateToolResult(
  condition: Extract<EdgeCondition, { type: 'tool_result' }>,
  ctx: ConditionContext
): ConditionResult {
  const events = (ctx.evidence.toolEvents ?? []).filter((t) => t.tool === condition.tool);
  if (events.length === 0) return { fired: false, reason: `no ${condition.tool} result this turn` };

  const { path, op, value } = condition.predicate;
  for (const event of events) {
    const resolved = resolvePath(event.result, path);
    if (op === 'exists' && resolved !== undefined && resolved !== null) {
      return { fired: true, reason: `${condition.tool}.${path} exists` };
    }
    if (op === 'eq' && resolved !== undefined && String(resolved) === String(value)) {
      return { fired: true, reason: `${condition.tool}.${path} == ${String(value)}` };
    }
    if (op === 'contains') {
      const haystack = typeof resolved === 'string' ? resolved : JSON.stringify(resolved ?? '');
      if (value !== undefined && haystack.toLowerCase().includes(String(value).toLowerCase())) {
        return { fired: true, reason: `${condition.tool}.${path} contains ${String(value)}` };
      }
    }
  }
  return { fired: false, reason: `predicate ${op} on ${condition.tool}.${path} not satisfied` };
}
