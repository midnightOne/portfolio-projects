/**
 * UI-state event evidence (navigation / F-I-D deltas from the /log payload —
 * task A4). Free tier. On UI-less runtimes these events simply never appear,
 * so the condition never fires (Req 6.2 optional composition).
 */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluateUiState(
  condition: Extract<EdgeCondition, { type: 'ui_state' }>,
  ctx: ConditionContext
): ConditionResult {
  const events = ctx.evidence.uiEvents ?? [];
  for (const ev of events) {
    const haystack = JSON.stringify(ev).toLowerCase();
    const matchOk = !condition.match || haystack.includes(condition.match.toLowerCase());
    if (!matchOk) continue;
    if (condition.event === 'route_changed' && (ev.route !== undefined || ev.type === 'navigation')) {
      return { fired: true, reason: `route_changed evidence${condition.match ? ` matching "${condition.match}"` : ''}` };
    }
    if (condition.event === 'project_opened' && (ev.project != null || haystack.includes('project'))) {
      return { fired: true, reason: `project_opened evidence${condition.match ? ` matching "${condition.match}"` : ''}` };
    }
    if (condition.event === 'section_viewed' && haystack.includes('section')) {
      return { fired: true, reason: `section_viewed evidence${condition.match ? ` matching "${condition.match}"` : ''}` };
    }
  }
  return { fired: false, reason: 'no matching ui event this turn' };
}
