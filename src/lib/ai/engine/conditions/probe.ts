/**
 * Injection/off-topic probing (Req 18.2, hysteresis per Req 19.2 as amended —
 * task N2) — v1: injected pattern list (D48: patterns are host-supplied
 * config, not core content) fires IMMEDIATELY — the deterministic rail cannot
 * be talked down. The batched cheap-call's graded probing signal fires only
 * with hysteresis: clear+ on THIS turn confirmed by clear+ on an earlier ring
 * turn — a single classifier-flagged turn (the F4 false-positive class) never
 * routes an innocent visitor to the prober node. The D41(b) watchdog is the
 * designated later upgrade, publishing into the same evidence stream.
 */

import type { EdgeCondition } from '../types';
import { probeSignalConfirmed } from '../profile';
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
  // ctx.state.signalRing is the ring BEFORE this turn; the current turn's
  // grade rides ctx.cheap. "clear+ twice", anchored to the current turn.
  if (ctx.cheap && probeSignalConfirmed(ctx.state.signalRing, ctx.cheap.signals)) {
    return { fired: true, reason: 'classifier probing signal confirmed twice (hysteresis)' };
  }
  if (ctx.cheap?.signals.probing && ctx.cheap.signals.probing !== 'none') {
    return { fired: false, reason: `probing signal ${ctx.cheap.signals.probing} — below hysteresis threshold` };
  }
  return { fired: false, reason: 'no probe signal' };
}
