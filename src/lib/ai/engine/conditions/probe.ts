/**
 * Injection/off-topic probing (Req 18.2) — v1: injected pattern list (D48:
 * patterns are host-supplied config, not core content) OR the batched
 * cheap-call's probe flag. The D41(b) watchdog is the designated later
 * upgrade, publishing into the same evidence stream.
 */

import type { EdgeCondition } from '../types';
import type { ConditionContext, ConditionResult } from './context';

export function evaluateProbe(
  _condition: Extract<EdgeCondition, { type: 'probe' }>,
  ctx: ConditionContext
): ConditionResult {
  for (const pattern of ctx.probePatterns) {
    if (pattern.test(ctx.evidence.utterance)) {
      return { fired: true, reason: `probe pattern ${pattern.source} matched` };
    }
  }
  if (ctx.cheap?.probe) {
    return { fired: true, reason: 'classifier flagged probe' };
  }
  return { fired: false, reason: 'no probe signal' };
}
