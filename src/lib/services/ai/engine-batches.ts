/**
 * Conversation-engine batch jobs (Block I — Req 16/17.2). Host-layer service
 * (Prisma + ledger + budget); the engine core knows nothing about batches.
 *
 * Hard rule (P23): NOTHING here runs in the request path. Question sampling is
 * a post-hoc join over rows conversations already persisted; embedding,
 * clustering, and summarization happen only when the admin (or a future cron)
 * triggers these endpoints. If a batch is slow, it is allowed to be slow.
 *
 * P17: test-tagged conversations are excluded via the ONE session-metadata
 * seam — `AIConversation.metadata.test === true` (written at session start by
 * the F1 tagging task; reading it here is forward-compatible and excludes
 * nothing until F1 lands).
 */

import { prisma } from '@/lib/prisma';
import { generateEmbeddings, currentEmbeddingModelId } from '@/lib/ai/embeddings';
import { recordUsage } from '@/lib/ai/ledger';
import { estimateCost } from '@/lib/ai/pricing';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';
import { conversationHistoryManager } from './conversation-history-manager';
import { runSummarizerJob } from './engine-runtime';
import { attributeEntryTurns, type TransitionMarkerRow, type UserTurnRow } from './question-analytics';

/**
 * v1 clustering threshold (cosine similarity): near-duplicate questions group
 * together. Deliberately simple greedy grouping (Req 16.2) — the algorithm is
 * the thing the owner wants to iterate on, so it is one function, swappable.
 */
const CLUSTER_SIMILARITY_THRESHOLD = 0.85;
/** Per-run caps — a batch may be slow, but never unbounded. */
const EMBED_ROWS_PER_RUN = 300;
const SUMMARIZE_CONVERSATIONS_PER_RUN = 25;
/** Same cadence contract as engine-runtime's in-session summarizer (P29). */
const SUMMARIZER_INTERVAL_MS = 60_000;
const SUMMARIZER_IN_FLIGHT_STALE_MS = 120_000;

// ---------------------------------------------------------------------------
// I1 — question analytics batch (Req 16)
// ---------------------------------------------------------------------------

export interface QuestionBatchResult {
  transitionsScanned: number;
  rowsInserted: number;
  rowsEmbedded: number;
  rowsClustered: number;
  /** Non-fatal skips, reported honestly (no silent caps). */
  notes: string[];
}

/**
 * The Req 16.2 batch: scan → insert (idempotent on messageId) → embed
 * (budget-gated, ledgered) → greedy similarity clustering. Re-runs are safe:
 * inserts skip duplicates, embedding targets `embedding IS NULL`, clustering
 * targets `cluster_id IS NULL`.
 */
export async function runQuestionAnalyticsBatch(opts?: {
  /** Scan window start (default: 30 days back). Overlap is harmless — idempotent. */
  since?: Date;
}): Promise<QuestionBatchResult> {
  const since = opts?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const notes: string[] = [];

  // 1. Transition markers in the window. The P17 test-tag exclusion happens in
  //    JS below: a Prisma `NOT { metadata path equals true }` filter silently
  //    drops rows where the key is MISSING (SQL three-valued logic — NULL =
  //    true is NULL), which is every untagged conversation. Found by driving
  //    the batch (D46); do not reintroduce the "clean" filter.
  const markerRows = await prisma.aIConversationMessage.findMany({
    where: {
      role: 'system',
      timestamp: { gte: since },
      metadata: { path: ['markerType'], equals: 'node_transition' },
    },
    select: { conversationId: true, timestamp: true, metadata: true },
    orderBy: { timestamp: 'asc' },
  });
  const markerConversationIds = Array.from(new Set(markerRows.map((r) => r.conversationId)));
  const testTagged = new Set(
    markerConversationIds.length
      ? (
          await prisma.aIConversation.findMany({
            where: { id: { in: markerConversationIds } },
            select: { id: true, metadata: true },
          })
        )
          .filter((c) => (c.metadata as Record<string, unknown> | null)?.test === true)
          .map((c) => c.id)
      : []
  );
  const markers: TransitionMarkerRow[] = [];
  for (const row of markerRows) {
    if (testTagged.has(row.conversationId)) continue; // P17 — the one tagging seam
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.toNode === 'string' && typeof meta.graphVersionId === 'string') {
      markers.push({
        conversationId: row.conversationId,
        timestamp: row.timestamp,
        toNode: meta.toNode,
        graphVersionId: meta.graphVersionId,
      });
    }
  }

  // 2. User turns of those conversations (bounded by the same window start).
  const conversationIds = Array.from(new Set(markers.map((m) => m.conversationId)));
  const userTurns: UserTurnRow[] = conversationIds.length
    ? await prisma.aIConversationMessage.findMany({
        where: { conversationId: { in: conversationIds }, role: 'user', timestamp: { gte: since } },
        select: { id: true, conversationId: true, timestamp: true, content: true },
      })
    : [];

  const attributions = attributeEntryTurns(markers, userTurns);

  // 3. graphId per version (analytics key on stable node ids per graph, Req 1.5).
  const versionIds = Array.from(new Set(attributions.map((a) => a.graphVersionId)));
  const versions = versionIds.length
    ? await prisma.conversationGraphVersion.findMany({
        where: { id: { in: versionIds } },
        select: { id: true, graphId: true },
      })
    : [];
  const graphByVersion = new Map(versions.map((v) => [v.id, v.graphId]));

  const insertable = attributions.filter((a) => graphByVersion.has(a.graphVersionId));
  if (insertable.length < attributions.length) {
    notes.push(`${attributions.length - insertable.length} turn(s) skipped: graph version row no longer exists`);
  }
  const inserted = insertable.length
    ? await prisma.nodeEntryQuestion.createMany({
        data: insertable.map((a) => ({
          nodeId: a.nodeId,
          graphId: graphByVersion.get(a.graphVersionId)!,
          graphVersionId: a.graphVersionId,
          conversationId: a.conversationId,
          messageId: a.messageId,
          text: a.text,
        })),
        skipDuplicates: true, // messageId unique — re-runs are idempotent (design §2)
      })
    : { count: 0 };

  // 4. Embed new rows via default-embedding — budget-gated + ledgered like any
  //    semantic operation (P23), embedding model id recorded on the ledger row.
  const pending = await prisma.$queryRaw<Array<{ id: string; text: string }>>`
    SELECT id, text FROM node_entry_questions
    WHERE embedding IS NULL
    ORDER BY created_at ASC
    LIMIT ${EMBED_ROWS_PER_RUN}`;
  let embedded = 0;
  if (pending.length > 0) {
    const modelId = await currentEmbeddingModelId();
    const estimatedTokens = pending.reduce((s, r) => s + Math.ceil(r.text.length / 4), 0);
    const estimatedCost = await estimateCost(modelId, { inputTokens: estimatedTokens }).catch(() => 0);
    const afford = await semanticBudgetManager.canAffordOperation(estimatedCost);
    if (!afford.canAfford) {
      notes.push(
        `embedding skipped: budget gate (needs $${estimatedCost.toFixed(4)}, remaining $${afford.remainingFunds.toFixed(2)}) — ${pending.length} row(s) stay pending`
      );
    } else {
      const result = await generateEmbeddings(pending.map((r) => r.text), { taskType: 'document' });
      const costUsd = await estimateCost(result.modelId, { inputTokens: result.tokensUsed }).catch(() => 0);
      await recordUsage({
        feature: 'semantic',
        usageType: 'engine_question_embedding',
        provider: result.provider,
        modelId: result.modelId, // the recorded embedding model id (Req 16.2)
        inputTokens: result.tokensUsed,
        costUsd,
        metadata: { operation: 'question_analytics_batch', rows: pending.length },
      });
      for (let i = 0; i < pending.length; i++) {
        const vec = `[${result.vectors[i].join(',')}]`;
        await prisma.$executeRaw`
          UPDATE node_entry_questions SET embedding = ${vec}::vector WHERE id = ${pending[i].id}`;
        embedded++;
      }
    }
  }

  // 5. v1 clustering: greedy pgvector similarity grouping. Oldest first; each
  //    unclustered row adopts its nearest clustered neighbor's cluster (same
  //    node) when similarity clears the threshold, else seeds a new cluster
  //    with its own id. Simple and swappable on purpose (Req 16.2).
  const unclustered = await prisma.$queryRaw<Array<{ id: string; node_id: string; embedding: string }>>`
    SELECT id, node_id, embedding::text AS embedding FROM node_entry_questions
    WHERE embedding IS NOT NULL AND cluster_id IS NULL
    ORDER BY created_at ASC`;
  let clustered = 0;
  for (const row of unclustered) {
    const nearest = await prisma.$queryRaw<Array<{ cluster_id: string; sim: number }>>`
      SELECT cluster_id, (1 - (embedding <=> ${row.embedding}::vector))::float AS sim
      FROM node_entry_questions
      WHERE node_id = ${row.node_id} AND cluster_id IS NOT NULL AND embedding IS NOT NULL AND id != ${row.id}
      ORDER BY embedding <=> ${row.embedding}::vector
      LIMIT 1`;
    const clusterId =
      nearest.length > 0 && nearest[0].sim >= CLUSTER_SIMILARITY_THRESHOLD ? nearest[0].cluster_id : row.id;
    await prisma.nodeEntryQuestion.update({
      where: { id: row.id },
      data: { clusterId, processedAt: new Date() },
    });
    clustered++;
  }

  return { transitionsScanned: markers.length, rowsInserted: inserted.count, rowsEmbedded: embedded, rowsClustered: clustered, notes };
}

// ---------------------------------------------------------------------------
// I1/D4 — cluster read model for the editor's questions panel (Req 16.3)
// ---------------------------------------------------------------------------

export interface QuestionCluster {
  clusterId: string;
  count: number;
  /** The cluster seed's phrasing (the row whose id === clusterId). */
  representative: string;
  /** Up to 3 most recent distinct phrasings (representative excluded when possible). */
  samples: string[];
  lastAskedAt: string;
}

export interface NodeQuestions {
  nodeId: string;
  clusters: QuestionCluster[];
  /** Rows not yet embedded/clustered (budget-skipped or batch not run since insert). */
  pending: number;
}

export async function getNodeQuestionClusters(graphId: string): Promise<NodeQuestions[]> {
  const rows = await prisma.nodeEntryQuestion.findMany({
    where: { graphId },
    select: { id: true, nodeId: true, clusterId: true, text: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const byNode = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byNode.get(row.nodeId) ?? [];
    list.push(row);
    byNode.set(row.nodeId, list);
  }
  const out: NodeQuestions[] = [];
  for (const [nodeId, nodeRows] of byNode) {
    const byCluster = new Map<string, typeof rows>();
    let pending = 0;
    for (const row of nodeRows) {
      if (!row.clusterId) {
        pending++;
        continue;
      }
      const list = byCluster.get(row.clusterId) ?? [];
      list.push(row);
      byCluster.set(row.clusterId, list);
    }
    const clusters: QuestionCluster[] = [];
    for (const [clusterId, clusterRows] of byCluster) {
      const seed = clusterRows.find((r) => r.id === clusterId);
      const others = clusterRows.filter((r) => r.id !== clusterId).map((r) => r.text);
      clusters.push({
        clusterId,
        count: clusterRows.length,
        representative: seed?.text ?? clusterRows[clusterRows.length - 1].text,
        samples: Array.from(new Set(others)).slice(0, 3),
        lastAskedAt: clusterRows[0].createdAt.toISOString(), // rows are newest-first
      });
    }
    clusters.sort((a, b) => b.count - a.count || b.lastAskedAt.localeCompare(a.lastAskedAt));
    out.push({ nodeId, clusters, pending });
  }
  return out;
}

// ---------------------------------------------------------------------------
// I2 — summarization batch (Req 17.2): backfill/consolidation trigger of the
// ONE summary pipeline (runSummarizerJob — Req 20.5: never two competing
// summaries). Scope: engine-steered conversations only (nodeId non-null), the
// same gate the in-session trigger uses — with the engine off the app must
// behave exactly as today (Req 2.7), summaries included.
// ---------------------------------------------------------------------------

export interface SummaryBatchResult {
  candidates: number;
  claimed: number;
  failed: number;
}

export async function runSummaryBackfillBatch(opts?: {
  /** Only conversations active after this (default: 30 days back). */
  since?: Date;
}): Promise<SummaryBatchResult> {
  const since = opts?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // New activity since the summarizer last completed for the conversation —
  // exactly the conversations whose running summary is missing or stale
  // (a conversation that went silent gets its final summary here, P29).
  // last_message_at is a NAIVE-UTC timestamp column; the ISO string in
  // latest_state casts to timestamptz. Compare in naive UTC (AT TIME ZONE
  // 'UTC') — a bare timestamp/timestamptz comparison coerces through the
  // server timezone and over-selects (driven finding, D46). Over-selection is
  // harmless (the claim + summarizerNeeded still gate) but wrong is wrong.
  const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM ai_conversations
    WHERE (latest_state->'engine'->>'nodeId') IS NOT NULL
      AND last_message_at IS NOT NULL
      AND last_message_at >= ${since}
      AND last_message_at > COALESCE(
            (latest_state->'engine'->>'lastSummarizerRunAt')::timestamptz AT TIME ZONE 'UTC',
            'epoch'::timestamp
          )
    ORDER BY last_message_at DESC
    LIMIT ${SUMMARIZE_CONVERSATIONS_PER_RUN}`;

  let claimed = 0;
  let failed = 0;
  for (const { id } of candidates) {
    try {
      // Same atomic claim as the in-session trigger (P29) — a live turn's
      // summarizer and this batch can never double-run one conversation.
      const won = await conversationHistoryManager.claimSummarizerRun(
        id,
        SUMMARIZER_INTERVAL_MS,
        SUMMARIZER_IN_FLIGHT_STALE_MS
      );
      if (!won) continue;
      claimed++;
      await runSummarizerJob(id); // clears the claim itself, success or failure
    } catch (err) {
      failed++;
      console.error(`[engine-batches] summary backfill failed for conversation ${id}:`, err);
    }
  }
  return { candidates: candidates.length, claimed, failed };
}
