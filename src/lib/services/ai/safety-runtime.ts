/**
 * Safety-tripwire runtime composition (conversation-engine Req 22, Block L) —
 * where the D48-clean core (scan.ts, investigation.ts) gets its real
 * dependencies. Three roles, kept separate by design (P34):
 *
 *   CHEAP TRIGGER — `runSafetyTripwire`: static word scan at transcript
 *   persist time. Call sites fire-and-forget (`void runSafetyTripwire(...)`)
 *   so the log write is NEVER blocked, delayed, or failed by anything here
 *   (P33/Req 22.1); disabled config short-circuits to zero work (Req 22.4).
 *
 *   SMART JUDGE — `runSafetyInvestigation`: async reasoning-model analysis of
 *   the full conversation through the M1 secondary-LLM module (the REQUIRED
 *   path — alias resolution, metering, JSON-forced schema, timeout). One
 *   running investigation per conversation, enforced by an atomic DB claim
 *   (claimSafetyInvestigation — the P33 in-flight guard) plus an interval
 *   floor so a flood of flagged turns costs one call per interval, never a
 *   stampede.
 *
 *   CONFIGURED EXECUTIONER — `executeSafetyAction`: the admin-authored
 *   severity→action map decides what happens (Req 22.3); the agent's
 *   recommendation is recorded, never executed. Hard enforcement goes through
 *   access-and-cost surfaces (session-revocation.ts, reflink-manager) — this
 *   module never revokes anything itself. Evidence publication stages
 *   `latestState.safety.pendingEvidence`, which the next engine turn consumes
 *   into `TurnEvidence.toolEvents` as tool `safety_investigation` — graph
 *   safety edges fire via the existing `tool_result` condition, no new
 *   condition type.
 */

import { prisma } from '@/lib/prisma';
import { scanText } from '@/lib/ai/safety/scan';
import {
  buildInvestigationPrompt,
  SafetyVerdictSchema,
  type SafetyAction,
  type SafetySeverity,
  type SafetyVerdict,
} from '@/lib/ai/safety/investigation';
import { getSafetyConfig, type SafetyConfigState } from './safety-config';
import { runSecondaryLLMJob } from './secondary-llm';
import { conversationHistoryManager } from './conversation-history-manager';
import { revokeConversationSession } from './session-revocation';
import { notifyOwner } from '@/lib/ai/leads/notify';

/** Hard cap racing the investigation call — a hung provider degrades to a 'failed' row. */
const INVESTIGATION_TIMEOUT_MS = 60_000;
/** A crashed invocation's in-flight stamp self-heals after this (P33 guard staleness). */
const INVESTIGATION_IN_FLIGHT_STALE_MS = 300_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Interval floor between investigations of ONE conversation (spend guard —
 * P33's "one investigation, not a stampede" extended over time; implementer's
 * call, recorded in the ledger). New flags inside the window are absorbed by
 * the already-produced verdict; the next flag after it re-investigates.
 */
export function investigationIntervalMs(): number {
  return envInt('SAFETY_INVESTIGATION_INTERVAL_MS', 120_000);
}

export interface TripwireArgs {
  conversationId: string;
  role: 'user' | 'assistant';
  text: string;
  /** Persisted message id the flag anchors to (transcriptItemId on voice). */
  messageId: string;
}

/**
 * The persist-path hook (Req 22.1). ALWAYS call as `void runSafetyTripwire(...)`
 * — it never throws, and the log write must not await it. Cost when disabled:
 * one memoized config read (≤1 DB hit / 30s / instance), nothing else.
 */
export async function runSafetyTripwire(args: TripwireArgs): Promise<void> {
  try {
    const config = await getSafetyConfig();
    if (!config.enabled) return;
    const flags = scanText(args.text, config.wordLists);
    if (flags.length === 0) return;

    // Atomic claim (P33): concurrent flagged turns produce ONE investigation.
    const claimed = await conversationHistoryManager.claimSafetyInvestigation(
      args.conversationId,
      investigationIntervalMs(),
      INVESTIGATION_IN_FLIGHT_STALE_MS
    );
    if (!claimed) return;

    void runSafetyInvestigation({
      conversationId: args.conversationId,
      config,
      trigger: {
        words: [...new Set(flags.map((f) => f.word))],
        categories: [...new Set(flags.map((f) => f.category))],
        text: args.text,
        role: args.role,
        messageId: args.messageId,
      },
    }).catch((err) => console.error('[safety] investigation crashed (guard self-heals):', err));
  } catch (err) {
    // P33: nothing in the tripwire may surface to the persist path.
    console.warn('[safety] tripwire scan failed (log write unaffected):', err);
  }
}

interface InvestigationJobArgs {
  conversationId: string;
  config: SafetyConfigState;
  trigger: {
    words: string[];
    categories: string[];
    text: string;
    role: 'user' | 'assistant';
    messageId: string;
  };
}

/**
 * The async judge (Req 22.2). Assumes the caller holds the in-flight claim;
 * always clears it and stamps lastInvestigationAt, success or failure — a
 * persistently failing investigation costs one attempt per interval.
 */
export async function runSafetyInvestigation(args: InvestigationJobArgs): Promise<void> {
  let investigationId: string | null = null;
  try {
    const row = await prisma.safetyInvestigation.create({
      data: {
        conversationId: args.conversationId,
        triggeredBy: {
          words: args.trigger.words,
          categories: args.trigger.categories,
          messageId: args.trigger.messageId,
          role: args.trigger.role,
          text: args.trigger.text.slice(0, 600),
        },
        status: 'running',
      },
      select: { id: true },
    });
    investigationId = row.id;

    const turns = await conversationHistoryManager.getTurnsSince(args.conversationId, null, 60);
    const outcome = await runSecondaryLLMJob({
      alias: 'default-reasoning', // Req 22.2: the investigation is a reasoning-adapter job
      prompt: buildInvestigationPrompt({
        policy: args.config.investigationPolicy,
        trigger: args.trigger,
        turns: turns.map((t) => ({ role: t.role, content: t.content })),
      }),
      schema: SafetyVerdictSchema,
      usageType: 'safety_investigation',
      temperature: 0,
      maxOutputTokens: 500,
      timeoutMs: INVESTIGATION_TIMEOUT_MS,
      metadata: { conversationId: args.conversationId, investigationId },
    });

    if (!outcome.result) {
      throw new Error(outcome.timedOut ? 'investigation timed out' : 'investigation returned no parseable verdict');
    }
    const verdict = outcome.result;

    // Verdict lands BEFORE enforcement — a failed action never loses the analysis.
    await prisma.safetyInvestigation.update({
      where: { id: investigationId },
      data: {
        status: 'complete',
        verdict: verdict.verdict,
        recommendedAction: verdict.recommendedAction,
        rationale: verdict.rationale,
        completedAt: new Date(),
      },
    });

    let actedAction: string | null = null;
    if (verdict.verdict !== 'benign') {
      actedAction = await executeSafetyAction({
        conversationId: args.conversationId,
        investigationId,
        config: args.config,
        verdict,
      });
    }

    // Inline transcript link (Req 22.2 "linked from the conversation in admin").
    await conversationHistoryManager
      .recordSessionMarker(args.conversationId, {
        type: 'safety_investigation',
        investigationId,
        verdict: verdict.verdict,
        actedAction: actedAction ?? undefined,
        evidence: `words: ${args.trigger.words.join(', ')}`,
      })
      .catch((err) => console.warn('[safety] investigation marker failed (row is authoritative):', err));
  } catch (err) {
    console.error('[safety] investigation failed:', err);
    if (investigationId) {
      await prisma.safetyInvestigation
        .update({
          where: { id: investigationId },
          data: {
            status: 'failed',
            rationale: `run failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 2000),
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  } finally {
    await conversationHistoryManager
      .mergeConversationSafety(args.conversationId, {
        investigationInFlightSince: null,
        lastInvestigationAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  }
}

/**
 * The configured executioner (Req 22.3/22.5). Returns the action actually
 * executed (recorded in the row's actedOn and the transcript marker); the
 * escalation ladder is strictly what the admin map says — a missing severity
 * defaults to 'log_only' (least aggressive). `ban_reflink` also revokes the
 * live session: a banned reflink whose running session kept its tools would
 * be a toothless ban (superset semantics, documented in the admin UI).
 */
async function executeSafetyAction(args: {
  conversationId: string;
  investigationId: string;
  config: SafetyConfigState;
  verdict: SafetyVerdict;
}): Promise<string> {
  const severity = args.verdict.verdict as SafetySeverity;
  const action: SafetyAction = args.config.severityActionMap[severity] ?? 'log_only';
  const detail: Record<string, unknown> = { action, severity, executedAt: new Date().toISOString() };

  try {
    if (action === 'notify_owner') {
      // Req 15.2 seam (G6) — never throws; the send outcome is recorded honestly.
      const result = await notifyOwner({
        purpose: 'safety_alert',
        subject: `[safety] ${severity} verdict on conversation ${args.conversationId}`,
        text: [
          `The safety tripwire investigation reached a "${severity}" verdict.`,
          '',
          `Rationale: ${args.verdict.rationale || '(none)'}`,
          `Agent recommendation: ${args.verdict.recommendedAction}`,
          `Configured action: ${action}`,
          '',
          `Review: /admin/ai/safety (investigation ${args.investigationId})`,
          `Conversation: /admin/ai/conversations?conversationId=${args.conversationId}`,
        ].join('\n'),
        metadata: { investigationId: args.investigationId },
      });
      detail.notifyStatus = result.status;
    } else if (action === 'publish_evidence') {
      // Staged for the NEXT engine turn — consumed into TurnEvidence.toolEvents
      // as tool 'safety_investigation'; graph edges condition on it via the
      // existing tool_result type (path 'severity'/'verdict', op eq/exists).
      await conversationHistoryManager.mergeConversationSafety(args.conversationId, {
        pendingEvidence: {
          investigationId: args.investigationId,
          verdict: severity,
          severity,
          recommendedAction: args.verdict.recommendedAction,
          rationale: args.verdict.rationale.slice(0, 400),
          at: new Date().toISOString(),
        },
      });
      detail.staged = true;
    } else if (action === 'terminate_session') {
      detail.revoked = await revokeConversationSession(
        args.conversationId,
        `safety verdict ${severity} (investigation ${args.investigationId})`
      );
    } else if (action === 'ban_reflink') {
      const conversation = await prisma.aIConversation.findUnique({
        where: { id: args.conversationId },
        select: { reflinkId: true },
      });
      if (conversation?.reflinkId) {
        // Access-and-cost surface: deactivation kills gateway tier resolution,
        // voice mints, and resume (I3: invalid/revoked reflink → 403) at once.
        const { reflinkManager } = await import('./reflink-manager');
        await reflinkManager.updateReflink(conversation.reflinkId, { isActive: false });
        detail.reflinkId = conversation.reflinkId;
        detail.reflinkDeactivated = true;
      } else {
        detail.reflinkDeactivated = false;
        detail.note = 'conversation has no reflink — falling through to session revocation only';
      }
      detail.revoked = await revokeConversationSession(
        args.conversationId,
        `safety verdict ${severity} — reflink ban (investigation ${args.investigationId})`
      );
    }
    // 'log_only': the investigation row + marker ARE the action.
  } catch (err) {
    // Honest record over silent success: the row shows the action failed.
    detail.error = err instanceof Error ? err.message : String(err);
    console.error(`[safety] action '${action}' failed:`, err);
  }

  await prisma.safetyInvestigation
    .update({ where: { id: args.investigationId }, data: { actedOn: detail as never } })
    .catch((err) => console.warn('[safety] actedOn record failed:', err));
  return action;
}

/**
 * Enforcement gate helper for the public surfaces (/log, /chat,
 * tools/execute): revocation is consulted ONLY while the module is enabled —
 * disabled = zero extra reads = identical system (Req 22.4). Never throws;
 * fails open (the gate is defense-in-depth, P35's real teeth are the
 * combination of surfaces).
 */
export async function isSessionRevokedBySafety(sessionId: string): Promise<boolean> {
  try {
    const config = await getSafetyConfig();
    if (!config.enabled) return false;
    const { getSessionRevocation } = await import('./session-revocation');
    return (await getSessionRevocation(sessionId)).revoked;
  } catch (err) {
    console.warn('[safety] revocation gate failed (open):', err);
    return false;
  }
}

/**
 * Engine-evidence bridge (Req 22.3 publish_evidence): consume staged evidence
 * into this turn's TurnEvidence.toolEvents. Called by runEngineTurn before
 * evaluation; returns [] when the module is disabled or nothing is staged.
 */
export async function collectSafetyToolEvents(
  conversationId: string
): Promise<Array<{ tool: string; result: unknown }>> {
  try {
    const config = await getSafetyConfig();
    if (!config.enabled) return [];
    const evidence = await conversationHistoryManager.consumeSafetyEvidence(conversationId);
    if (!evidence) return [];
    return [{ tool: 'safety_investigation', result: evidence }];
  } catch (err) {
    console.warn('[safety] evidence consume failed (turn unaffected):', err);
    return [];
  }
}
