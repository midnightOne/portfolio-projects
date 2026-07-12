/**
 * GraphScenario host layer (Block F2 — Req 10.2–10.4): Prisma CRUD, the
 * record-from-test-session transform over real conversation rows, and the
 * scenario batch runner the admin route, the editor, and `check:scenarios`
 * all share. Thin over the pure core runner (src/lib/ai/engine/scenario.ts —
 * D48: core never sees Prisma; this module loads rows and hands in documents).
 *
 * Determinism (P16): every run goes through `runScenario`, which injects the
 * stable-vector embedding fake, scripted classifier results, and a fixed
 * clock. The ONLY production config injected is the probe-pattern list
 * (DEFAULT_PROBE_PATTERNS) — golden scenarios exercise the real probe tier.
 */

import { prisma } from '@/lib/prisma';
import {
  runScenario,
  buildScenarioFromTraversal,
  ScenarioScriptSchema,
  ScenarioExpectedPathSchema,
  type ScenarioRunResult,
} from '@/lib/ai/engine/scenario';
import { GraphDocumentSchema } from '@/lib/ai/engine/types';
import { DEFAULT_PROBE_PATTERNS } from './probe-patterns';

// ============================================================================
// CRUD
// ============================================================================

export interface ScenarioListItem {
  id: string;
  graphId: string;
  name: string;
  turnCount: number;
  pathLength: number;
  updatedAt: string;
  createdAt: string;
}

function toListItem(row: {
  id: string;
  graphId: string;
  name: string;
  turns: unknown;
  expectedPath: unknown;
  updatedAt: Date;
  createdAt: Date;
}): ScenarioListItem {
  const turns = row.turns as { turns?: unknown[] } | null;
  return {
    id: row.id,
    graphId: row.graphId,
    name: row.name,
    turnCount: Array.isArray(turns?.turns) ? turns.turns.length : 0,
    pathLength: Array.isArray(row.expectedPath) ? row.expectedPath.length : 0,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listScenarios(graphId: string): Promise<ScenarioListItem[] | null> {
  const graph = await prisma.conversationGraph.findUnique({ where: { id: graphId }, select: { id: true } });
  if (!graph) return null;
  const rows = await prisma.graphScenario.findMany({ where: { graphId }, orderBy: { createdAt: 'asc' } });
  return rows.map(toListItem);
}

export interface ScenarioDetail extends ScenarioListItem {
  turns: unknown;
  expectedPath: unknown;
}

export async function getScenario(graphId: string, scenarioId: string): Promise<ScenarioDetail | null> {
  const row = await prisma.graphScenario.findFirst({ where: { id: scenarioId, graphId } });
  if (!row) return null;
  return { ...toListItem(row), turns: row.turns, expectedPath: row.expectedPath };
}

export async function createScenario(
  graphId: string,
  input: { name: string; turns: unknown; expectedPath: unknown }
): Promise<ScenarioDetail | { error: string } | null> {
  const graph = await prisma.conversationGraph.findUnique({ where: { id: graphId }, select: { id: true } });
  if (!graph) return null;
  const turns = ScenarioScriptSchema.safeParse(input.turns);
  if (!turns.success) return { error: `turns invalid: ${turns.error.issues[0]?.message ?? 'parse failed'}` };
  const path = ScenarioExpectedPathSchema.safeParse(input.expectedPath);
  if (!path.success) return { error: `expectedPath invalid: ${path.error.issues[0]?.message ?? 'parse failed'}` };
  const row = await prisma.graphScenario.create({
    data: { graphId, name: input.name, turns: turns.data as object, expectedPath: path.data },
  });
  return { ...toListItem(row), turns: row.turns, expectedPath: row.expectedPath };
}

export async function updateScenario(
  graphId: string,
  scenarioId: string,
  patch: { name?: string; turns?: unknown; expectedPath?: unknown }
): Promise<ScenarioDetail | { error: string } | null> {
  const existing = await prisma.graphScenario.findFirst({ where: { id: scenarioId, graphId }, select: { id: true } });
  if (!existing) return null;
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.turns !== undefined) {
    const turns = ScenarioScriptSchema.safeParse(patch.turns);
    if (!turns.success) return { error: `turns invalid: ${turns.error.issues[0]?.message ?? 'parse failed'}` };
    data.turns = turns.data as object;
  }
  if (patch.expectedPath !== undefined) {
    const path = ScenarioExpectedPathSchema.safeParse(patch.expectedPath);
    if (!path.success) return { error: `expectedPath invalid: ${path.error.issues[0]?.message ?? 'parse failed'}` };
    data.expectedPath = path.data;
  }
  const row = await prisma.graphScenario.update({ where: { id: scenarioId }, data });
  return { ...toListItem(row), turns: row.turns, expectedPath: row.expectedPath };
}

export async function deleteScenario(graphId: string, scenarioId: string): Promise<boolean> {
  const existing = await prisma.graphScenario.findFirst({ where: { id: scenarioId, graphId }, select: { id: true } });
  if (!existing) return false;
  await prisma.graphScenario.delete({ where: { id: scenarioId } });
  return true;
}

// ============================================================================
// Record from a finished (test) session (Req 10.2)
// ============================================================================

/**
 * Build a scenario from a conversation's ACTUAL traversal — the "walk the flow
 * as a fake client, pin what happened" rail. Reads user turns + node_transition
 * + slot_filled markers and hands them to the pure transform, which picks the
 * deterministic replay strategy per condition type (intent → classifier-only).
 *
 * Voice turn ids: the engine's turnMessageId is the provider transcript item
 * id, persisted on the row as metadata.transcriptItemId — preferred over the
 * DB row id when present so marker joins line up on every runtime.
 */
export async function recordScenarioFromConversation(
  graphId: string,
  input: { conversationId: string; name: string }
): Promise<ScenarioDetail | { error: string } | null> {
  const graph = await prisma.conversationGraph.findUnique({ where: { id: graphId }, select: { id: true } });
  if (!graph) return null;

  const messages = await prisma.aIConversationMessage.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { timestamp: 'asc' },
    select: { id: true, role: true, content: true, metadata: true },
  });
  if (messages.length === 0) return { error: 'conversation not found or has no messages' };

  const versionIds = new Set(
    (
      await prisma.conversationGraphVersion.findMany({ where: { graphId }, select: { id: true } })
    ).map((v) => v.id)
  );

  const userTurns: Array<{ id: string; content: string }> = [];
  const transitions: Array<{
    toNode: string;
    turnMessageId: string | null;
    conditionType: string | null;
    edgeId: string | null;
    evidence?: string | null;
  }> = [];
  const slotFills: Array<{ turnMessageId: string; fills: Record<string, string> }> = [];
  let sawForeignVersion = false;

  for (const m of messages) {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    if (m.role === 'user') {
      const itemId = typeof meta.transcriptItemId === 'string' ? meta.transcriptItemId : m.id;
      userTurns.push({ id: itemId, content: m.content });
    } else if (m.role === 'system' && meta.markerType === 'node_transition') {
      if (typeof meta.graphVersionId === 'string' && !versionIds.has(meta.graphVersionId)) {
        sawForeignVersion = true;
        continue;
      }
      if (typeof meta.toNode !== 'string') continue;
      transitions.push({
        toNode: meta.toNode,
        turnMessageId: typeof meta.turnMessageId === 'string' ? meta.turnMessageId : null,
        conditionType: typeof meta.conditionType === 'string' ? meta.conditionType : null,
        edgeId: typeof meta.edgeId === 'string' ? meta.edgeId : null,
        evidence: typeof meta.evidence === 'string' ? meta.evidence : null,
      });
    } else if (m.role === 'system' && meta.markerType === 'slot_filled') {
      const fills = meta.slotFills;
      if (typeof meta.turnMessageId === 'string' && fills && typeof fills === 'object' && !Array.isArray(fills)) {
        slotFills.push({
          turnMessageId: meta.turnMessageId,
          fills: Object.fromEntries(
            Object.entries(fills as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string')
          ),
        });
      }
    }
  }

  if (transitions.length === 0) {
    return {
      error: sawForeignVersion
        ? 'conversation traversed a different graph — record scenarios on the graph it actually ran'
        : 'conversation has no traversal markers — nothing to record',
    };
  }
  if (userTurns.length === 0) return { error: 'conversation has no user turns' };

  const built = buildScenarioFromTraversal({ userTurns, transitions, slotFills });
  return createScenario(graphId, { name: input.name, turns: built.turns, expectedPath: built.expectedPath });
}

// ============================================================================
// Batch runner (route + editor + check:scenarios share this)
// ============================================================================

export type ScenarioRunTarget = 'draft' | 'active' | { versionId: string };

export interface ScenarioBatchEntry {
  scenarioId: string;
  name: string;
  result: ScenarioRunResult;
  /** Set when rebaseline was requested and this scenario's expectation was repinned (Req 10.4). */
  rebaselined?: boolean;
}

export interface ScenarioBatchResult {
  graphId: string;
  /** What the scenarios ran against — the editor shows this honestly. */
  target: { source: 'draft' | 'version'; versionId?: string; version?: number };
  total: number;
  passed: number;
  failed: number;
  /** Scenarios whose script/document could not run at all (structural error). */
  errored: number;
  entries: ScenarioBatchEntry[];
}

async function resolveTargetDocument(
  graph: { id: string; draftDocument: unknown; activeVersionId: string | null },
  target: ScenarioRunTarget
): Promise<{ document: unknown; source: 'draft' | 'version'; versionId?: string; version?: number } | { error: string }> {
  if (target === 'draft') return { document: graph.draftDocument, source: 'draft' };
  const versionId = target === 'active' ? graph.activeVersionId : target.versionId;
  if (!versionId) return { error: 'graph has no active version — run against the draft or publish first' };
  const row = await prisma.conversationGraphVersion.findFirst({
    where: { id: versionId, graphId: graph.id },
    select: { document: true, version: true, id: true },
  });
  if (!row) return { error: `version ${versionId} not found on this graph` };
  return { document: row.document, source: 'version', versionId: row.id, version: row.version };
}

/**
 * Run all (or selected) scenarios of a graph against a target document.
 * `rebaseline: true` = Req 10.4's one action: every scenario whose run
 * DIVERGED gets its expectedPath repinned to the new actual path — skipped
 * for structural errors and empty traversals (those need editing, not
 * repinning; an empty pin would silence a broken scenario).
 */
export async function runGraphScenarios(
  graphId: string,
  opts: { target?: ScenarioRunTarget; scenarioIds?: string[]; rebaseline?: boolean } = {}
): Promise<ScenarioBatchResult | { error: string } | null> {
  const graph = await prisma.conversationGraph.findUnique({
    where: { id: graphId },
    select: { id: true, draftDocument: true, activeVersionId: true },
  });
  if (!graph) return null;

  const resolved = await resolveTargetDocument(graph, opts.target ?? 'draft');
  if ('error' in resolved) return { error: resolved.error };
  // Fail the whole batch honestly when the target document doesn't parse —
  // per-scenario runs would all report the same structural error anyway.
  const docParse = GraphDocumentSchema.safeParse(resolved.document);
  if (!docParse.success) {
    return { error: `target document invalid: ${docParse.error.issues[0]?.message ?? 'parse failed'}` };
  }

  const rows = await prisma.graphScenario.findMany({
    where: { graphId, ...(opts.scenarioIds?.length ? { id: { in: opts.scenarioIds } } : {}) },
    orderBy: { createdAt: 'asc' },
  });

  const entries: ScenarioBatchEntry[] = [];
  for (const row of rows) {
    const result = await runScenario({
      document: resolved.document,
      turns: row.turns,
      expectedPath: row.expectedPath,
      probePatterns: DEFAULT_PROBE_PATTERNS,
    });
    const entry: ScenarioBatchEntry = { scenarioId: row.id, name: row.name, result };
    if (opts.rebaseline && !result.pass && !result.error && result.actualPath.length > 0) {
      await prisma.graphScenario.update({
        where: { id: row.id },
        data: { expectedPath: result.actualPath },
      });
      entry.rebaselined = true;
    }
    entries.push(entry);
  }

  return {
    graphId,
    target: { source: resolved.source, versionId: resolved.versionId, version: resolved.version },
    total: entries.length,
    passed: entries.filter((e) => e.result.pass).length,
    failed: entries.filter((e) => !e.result.pass && !e.result.error).length,
    errored: entries.filter((e) => !!e.result.error).length,
    entries,
  };
}
