/**
 * Coverage aggregation over node_transition markers (Block E3 — Req 9.3).
 *
 * Pure: the store fetches a bounded window of marker rows (P14 — default 30
 * days, filtered by timestamp + markerType in SQL) and this module does the
 * rest in TS: version scoping (only markers written under THIS graph's
 * versions — node ids are stable across versions, Req 1.5, so counts join
 * across them), test exclusion (P17 — the ONE flag: conversation
 * metadata.test === true; Block F1 writes the same key at session start), and
 * the aggregates the editor overlay renders: per-node hit rates, dead nodes,
 * hot off-graph exits, edge fire counts.
 *
 * Deliberately no rollup tables and no SQL GROUP BY cleverness (P14): traffic
 * is portfolio-scale, and TS aggregation keeps the exclusion rules unit-
 * testable. Sibling of graph-diff.ts — same "pure module next to the store"
 * layout addition recorded in the Block D ledger.
 */

import type { GraphDocument } from '@/lib/ai/engine/types';

/** One node_transition marker row, flattened by the store. */
export interface TransitionMarkerRow {
  conversationId: string;
  timestamp: string;
  fromNode: string | null;
  toNode: string;
  edgeId: string | null;
  conditionType: string | null;
  graphVersionId: string;
  /** P17: conversation.metadata.test === true (single seam, F1 writes it). */
  isTest: boolean;
}

export interface NodeCoverage {
  nodeId: string;
  name: string;
  role: string;
  /** Transition markers landing ON this node (incl. turn-zero ∅ → start). */
  entries: number;
  /** Distinct conversations that entered it. */
  conversations: number;
  /** In the reference document but never entered in the window (Req 9.3 "dead nodes"). */
  dead: boolean;
}

export interface OffGraphExit {
  fromNode: string;
  name: string;
  count: number;
}

export interface CoverageReport {
  windowDays: number;
  since: string;
  /** Distinct non-test conversations that produced transitions in the window. */
  conversations: number;
  transitions: number;
  testConversationsExcluded: number;
  nodes: NodeCoverage[];
  /** Fires per edge id (edges present in the reference document). */
  edgeFires: Record<string, number>;
  /** Most frequent last-node-before-off-graph, descending (Req 9.3). */
  offGraphExits: OffGraphExit[];
  /**
   * Markers pointing at nodes absent from the reference document (deleted
   * since) — surfaced instead of silently dropped so counts always reconcile.
   */
  removedNodeEntries: Array<{ nodeId: string; entries: number }>;
}

export function aggregateCoverage(
  reference: GraphDocument,
  rows: TransitionMarkerRow[],
  opts: { versionIds: Set<string>; windowDays: number; since: string }
): CoverageReport {
  const inScope = rows.filter((r) => opts.versionIds.has(r.graphVersionId));
  const testConversations = new Set(inScope.filter((r) => r.isTest).map((r) => r.conversationId));
  const counted = inScope.filter((r) => !r.isTest);

  const knownNodes = new Map(reference.nodes.map((n) => [n.id, n]));
  const knownEdgeIds = new Set(reference.edges.map((e) => e.id));
  const offgraphId = reference.nodes.find((n) => n.role === 'offgraph')?.id ?? null;

  const entries = new Map<string, number>();
  const entryConversations = new Map<string, Set<string>>();
  const edgeFires: Record<string, number> = {};
  const exitCounts = new Map<string, number>();
  const removed = new Map<string, number>();
  const conversations = new Set<string>();

  for (const row of counted) {
    conversations.add(row.conversationId);
    entries.set(row.toNode, (entries.get(row.toNode) ?? 0) + 1);
    if (!entryConversations.has(row.toNode)) entryConversations.set(row.toNode, new Set());
    entryConversations.get(row.toNode)!.add(row.conversationId);
    if (!knownNodes.has(row.toNode)) removed.set(row.toNode, (removed.get(row.toNode) ?? 0) + 1);
    if (row.edgeId && knownEdgeIds.has(row.edgeId)) {
      edgeFires[row.edgeId] = (edgeFires[row.edgeId] ?? 0) + 1;
    }
    if (offgraphId && row.toNode === offgraphId && row.fromNode) {
      exitCounts.set(row.fromNode, (exitCounts.get(row.fromNode) ?? 0) + 1);
    }
  }

  return {
    windowDays: opts.windowDays,
    since: opts.since,
    conversations: conversations.size,
    transitions: counted.length,
    testConversationsExcluded: testConversations.size,
    nodes: reference.nodes.map((n) => ({
      nodeId: n.id,
      name: n.name,
      role: n.role,
      entries: entries.get(n.id) ?? 0,
      conversations: entryConversations.get(n.id)?.size ?? 0,
      dead: (entries.get(n.id) ?? 0) === 0,
    })),
    edgeFires,
    offGraphExits: [...exitCounts.entries()]
      .map(([fromNode, count]) => ({
        fromNode,
        name: knownNodes.get(fromNode)?.name ?? fromNode,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    removedNodeEntries: [...removed.entries()].map(([nodeId, entries]) => ({ nodeId, entries })),
  };
}
