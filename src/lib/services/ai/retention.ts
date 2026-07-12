/**
 * Data retention & lifecycle (conversation-engine Block K — Req 21.2/21.4 as
 * amended 2026-07-11).
 *
 * Owner ruling: visitor-initiated removal does not exist — interactions are
 * deliberately retained ("this is my portfolio and I want to retain the
 * interactions with it"). Deletion is owner-side only: three retention knobs,
 * EVERY one defaulting to null = retain indefinitely, executed inside the
 * existing batch jobs (P23 — never a conversation's request path), and every
 * deletion audit-logged (DataLifecycleAudit).
 *
 * Content classes (Req 21.2 — the admin UI labels these the same way):
 *  - VISITOR CONTENT, transcript clock: user/assistant message rows, plus
 *    `slot_filled` markers (visitor-stated values inline in the content), plus
 *    derived visitor state in latestState.engine (slots, flags, profile).
 *  - VISITOR CONTENT, summary clock ("summaries longer"): the running
 *    `conversation_summary` rows, plus `briefingSummary` copies riding
 *    session_resumed marker metadata.
 *  - OPERATIONAL TELEMETRY, never expired here: ledger rows, node_transition /
 *    edge_evaluated / disruption / directive markers, coverage counts,
 *    NodeEntryQuestion analytics, the audit trail itself.
 *
 * Read posture: singleton row id='retention', memoized ≤30s (memory-config
 * pattern). A missing row OR a read failure resolves to the defaults — and the
 * default direction is RETAIN, so a broken config read can never delete data.
 */

import { prisma } from '@/lib/prisma';

export interface ConversationRetentionState {
  /** Days after last activity before visitor turns + derived state expire. Null = keep forever. */
  transcriptRetentionDays: number | null;
  /** Days before conversation_summary rows expire (meant ≥ transcript). Null = keep forever. */
  summaryRetentionDays: number | null;
  /** Days after handledAt before a handled lead row expires. Null = keep forever. */
  leadRetentionDays: number | null;
}

export const RETENTION_DEFAULTS: ConversationRetentionState = {
  transcriptRetentionDays: null,
  summaryRetentionDays: null,
  leadRetentionDays: null,
};

/** Normalize a stored knob: positive integers pass, anything else = retain. */
export function normalizeRetentionDays(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

const CACHE_TTL_MS = 30_000;
let cache: { at: number; state: ConversationRetentionState } | null = null;

export async function getRetentionConfig(opts?: { fresh?: boolean }): Promise<ConversationRetentionState> {
  const now = Date.now();
  if (!opts?.fresh && cache && now - cache.at < CACHE_TTL_MS) return cache.state;
  let state: ConversationRetentionState = RETENTION_DEFAULTS;
  try {
    const row = await prisma.conversationRetentionConfig.findUnique({ where: { id: 'retention' } });
    if (row) {
      state = {
        transcriptRetentionDays: normalizeRetentionDays(row.transcriptRetentionDays),
        summaryRetentionDays: normalizeRetentionDays(row.summaryRetentionDays),
        leadRetentionDays: normalizeRetentionDays(row.leadRetentionDays),
      };
    }
  } catch (err) {
    console.warn('[retention] config read failed — defaults apply (retain indefinitely):', err);
  }
  cache = { at: now, state };
  return state;
}

export function __clearRetentionConfigCache(): void {
  cache = null;
}

export interface RetentionSweepResult {
  /** False = every knob null (the shipped default) — nothing to do, no audit row. */
  configured: boolean;
  conversationsScrubbed: number;
  messageRowsDeleted: number;
  summaryRowsDeleted: number;
  briefingRefsScrubbed: number;
  leadsDeleted: number;
  auditId: string | null;
  /** Honest reporting — caps hit, config oddities, per-scope errors (no silent anything). */
  notes: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Bounded work per run (P23: the batch may be slow, but each run stays bounded). */
const TRANSCRIPT_CONVERSATIONS_PER_RUN = 200;

/**
 * The owner-side expiry sweep. Runs inside the existing summaries batch
 * endpoint (Req 21.4 "expiry runs in the existing batch jobs") — never in a
 * conversation's request path. Idempotent: deletion-driven selection means a
 * second run over the same state deletes nothing and writes no audit row.
 */
export async function runRetentionSweep(opts?: {
  initiatedBy?: string;
  now?: Date;
}): Promise<RetentionSweepResult> {
  const config = await getRetentionConfig({ fresh: true });
  const result: RetentionSweepResult = {
    configured: false,
    conversationsScrubbed: 0,
    messageRowsDeleted: 0,
    summaryRowsDeleted: 0,
    briefingRefsScrubbed: 0,
    leadsDeleted: 0,
    auditId: null,
    notes: [],
  };
  if (
    config.transcriptRetentionDays === null &&
    config.summaryRetentionDays === null &&
    config.leadRetentionDays === null
  ) {
    result.notes.push('retention not configured — nothing expires (owner default: retain indefinitely)');
    return result;
  }
  result.configured = true;
  if (
    config.transcriptRetentionDays !== null &&
    config.summaryRetentionDays !== null &&
    config.summaryRetentionDays < config.transcriptRetentionDays
  ) {
    result.notes.push(
      `summaryRetentionDays (${config.summaryRetentionDays}) < transcriptRetentionDays (${config.transcriptRetentionDays}) — Req 21.4 intends summaries to outlive transcripts`
    );
  }
  const now = opts?.now ?? new Date();
  const cutoffs: Record<string, string> = {};

  // ---- Transcripts: visitor turns + slot_filled markers + derived state ----
  if (config.transcriptRetentionDays !== null) {
    const cutoff = new Date(now.getTime() - config.transcriptRetentionDays * DAY_MS);
    cutoffs.transcripts = cutoff.toISOString();
    try {
      // Deletion-driven selection: only conversations that STILL hold visitor
      // rows — naturally idempotent, no bookkeeping flag needed for re-runs.
      const targets = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT c.id FROM ai_conversations c
        JOIN ai_conversation_messages m ON m.conversation_id = c.id
        WHERE c.last_message_at IS NOT NULL
          AND c.last_message_at < ${cutoff}
          AND (m.role IN ('user', 'assistant')
               OR (m.role = 'system' AND m.metadata->>'markerType' = 'slot_filled'))
        LIMIT ${TRANSCRIPT_CONVERSATIONS_PER_RUN}`;
      if (targets.length === TRANSCRIPT_CONVERSATIONS_PER_RUN) {
        result.notes.push(
          `transcript scrub capped at ${TRANSCRIPT_CONVERSATIONS_PER_RUN} conversations this run — more remain, the next run continues`
        );
      }
      if (targets.length > 0) {
        const ids = targets.map((t) => t.id);
        const deleted = await prisma.$executeRaw`
          DELETE FROM ai_conversation_messages
          WHERE conversation_id = ANY(${ids})
            AND (role IN ('user', 'assistant')
                 OR (role = 'system' AND metadata->>'markerType' = 'slot_filled'))`;
        // Scrub derived visitor state (slots, flags, profile — Req 21.2's
        // named classes) and stamp WHEN retention ran so the admin transcript
        // can say honestly why the turns are gone. Engine bookkeeping
        // (nodeId, versions, counters) is operational telemetry and stays.
        await prisma.$executeRaw`
          UPDATE ai_conversations
          SET latest_state = jsonb_set(
            ((COALESCE(latest_state, '{}'::jsonb) #- '{engine,slots}') #- '{engine,flags}') #- '{engine,profile}',
            '{retention}',
            jsonb_build_object('transcriptsExpiredAt', ${now.toISOString()}::text),
            true)
          WHERE id = ANY(${ids})`;
        result.conversationsScrubbed = ids.length;
        result.messageRowsDeleted = Number(deleted);
      }
    } catch (err) {
      result.notes.push(`transcript expiry failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      console.error('[retention] transcript expiry failed:', err);
    }
  }

  // ---- Summaries (their own, longer clock) ----
  if (config.summaryRetentionDays !== null) {
    const cutoff = new Date(now.getTime() - config.summaryRetentionDays * DAY_MS);
    cutoffs.summaries = cutoff.toISOString();
    try {
      const deleted = await prisma.$executeRaw`
        DELETE FROM ai_conversation_messages m
        USING ai_conversations c
        WHERE m.conversation_id = c.id
          AND c.last_message_at IS NOT NULL
          AND c.last_message_at < ${cutoff}
          AND m.role = 'system'
          AND m.metadata->>'markerType' = 'conversation_summary'`;
      // Summary text also rides session_resumed markers as briefingSummary —
      // strip those copies on the same clock (the marker row itself is
      // operational telemetry and stays).
      const scrubbed = await prisma.$executeRaw`
        UPDATE ai_conversation_messages m
        SET metadata = m.metadata - 'briefingSummary'
        FROM ai_conversations c
        WHERE m.conversation_id = c.id
          AND c.last_message_at IS NOT NULL
          AND c.last_message_at < ${cutoff}
          AND m.role = 'system'
          AND m.metadata->>'markerType' = 'session_resumed'
          AND m.metadata ? 'briefingSummary'`;
      result.summaryRowsDeleted = Number(deleted);
      result.briefingRefsScrubbed = Number(scrubbed);
    } catch (err) {
      result.notes.push(`summary expiry failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      console.error('[retention] summary expiry failed:', err);
    }
  }

  // ---- Leads: handled + M days (handledAt stamped by the admin PATCH) ----
  if (config.leadRetentionDays !== null) {
    const cutoff = new Date(now.getTime() - config.leadRetentionDays * DAY_MS);
    cutoffs.leads = cutoff.toISOString();
    try {
      const deleted = await prisma.conversationLead.deleteMany({
        where: { status: 'handled', handledAt: { not: null, lt: cutoff } },
      });
      result.leadsDeleted = deleted.count;
    } catch (err) {
      result.notes.push(`lead expiry failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      console.error('[retention] lead expiry failed:', err);
    }
  }

  // ---- Audit (Req 21.2 as amended: every owner-side deletion leaves a row) ----
  const totalDeleted =
    result.messageRowsDeleted + result.summaryRowsDeleted + result.briefingRefsScrubbed + result.leadsDeleted;
  if (totalDeleted > 0) {
    try {
      const audit = await prisma.dataLifecycleAudit.create({
        data: {
          action: 'retention_expiry',
          criteria: { config: { ...config }, cutoffs },
          counts: {
            conversationsScrubbed: result.conversationsScrubbed,
            messageRowsDeleted: result.messageRowsDeleted,
            summaryRowsDeleted: result.summaryRowsDeleted,
            briefingRefsScrubbed: result.briefingRefsScrubbed,
            leadsDeleted: result.leadsDeleted,
          },
          initiatedBy: opts?.initiatedBy ?? 'batch',
        },
      });
      result.auditId = audit.id;
    } catch (err) {
      // The deletion already happened — an unlogged deletion is a defect, say so loudly.
      result.notes.push(`AUDIT WRITE FAILED after deletion: ${err instanceof Error ? err.message : 'unknown error'}`);
      console.error('[retention] audit write failed after deletion:', err);
    }
  }
  return result;
}
