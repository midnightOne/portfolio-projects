/**
 * Prisma-backed GraphSource (conversation-engine notes §1) — registered into
 * the engine from OUTSIDE core (D48; the core receives loaded documents,
 * never Prisma handles). Immutable version documents are cached per instance
 * keyed by version id — never correctness-bearing (D43); the active POINTER
 * is read fresh on every call (one small DB read, notes §2.1.2).
 *
 * Graph CRUD for the admin routes lands here in Block D; Block B only reads.
 */

import { prisma } from '@/lib/prisma';
import type { GraphSource, ActiveGraphRef } from '@/lib/ai/engine/graph-source';
import { GraphDocument, GraphDocumentSchema } from '@/lib/ai/engine/types';
import { validateGraph, ValidationContext, ValidationIssue } from '@/lib/ai/engine/validation';
import { diffGraphDocuments, GraphDiff } from './graph-diff';
import { aggregateCoverage, CoverageReport, TransitionMarkerRow } from './graph-coverage';
import { unifiedToolRegistry } from '@/lib/ai/tools';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { recordUsage } from '@/lib/ai/ledger';
import { estimateCost } from '@/lib/ai/pricing';
import { assembleStartFrame } from '@/lib/ai/start-frame';
import { randomUUID } from 'crypto';

const versionCache = new Map<string, GraphDocument>();

async function loadVersionDocument(versionId: string): Promise<GraphDocument | null> {
  const cached = versionCache.get(versionId);
  if (cached) return cached;
  const row = await prisma.conversationGraphVersion.findUnique({
    where: { id: versionId },
    select: { document: true },
  });
  if (!row) return null;
  const parsed = GraphDocumentSchema.safeParse(row.document);
  if (!parsed.success) {
    console.error(`[graph-store] version ${versionId} failed schema validation — treated as unavailable:`, parsed.error.message);
    return null;
  }
  versionCache.set(versionId, parsed.data);
  return parsed.data;
}

export const prismaGraphSource: GraphSource = {
  async getActiveGraph(): Promise<ActiveGraphRef | null> {
    const graph = await prisma.conversationGraph.findFirst({
      where: { status: 'active', activeVersionId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, activeVersionId: true },
    });
    if (!graph?.activeVersionId) return null;
    const document = await loadVersionDocument(graph.activeVersionId);
    if (!document) return null;
    return { graphId: graph.id, versionId: graph.activeVersionId, document };
  },

  async getVersion(versionId: string): Promise<GraphDocument | null> {
    return loadVersionDocument(versionId);
  },
};

/** Test hook: version documents are immutable in production, but drills that reseed need a reset. */
export function __clearGraphVersionCache(): void {
  versionCache.clear();
}

// ============================================================================
// Block D — graph CRUD + publish, used by the /api/admin/ai/graphs routes
// (routes stay thin: auth → zod → these functions; notes §1)
// ============================================================================

/**
 * Registry-known sets for validation (Req 1.6/D4) — the host enumerates and
 * injects, core validation stays registry-free (D48). Aliases are the five
 * fixed roles (model-aliases route contract: "aliases are roles, not a
 * free-form list"); default-embedding is excluded — it is not a chat/voice
 * brain a node can run on.
 */
export function buildValidationContext(): ValidationContext {
  return {
    knownTools: unifiedToolRegistry.getAllToolDefinitions().map((t) => t.name),
    knownAliases: ['default-chat', 'default-cheap', 'default-reasoning', 'default-realtime'],
  };
}

/**
 * Host-side content checks (Req 11.2, P13's authoring-time half): warn when a
 * node references PRIVATE or missing entities/chunks. Warnings, never errors —
 * PRIVATE references are legitimate authoring (admin sessions see them);
 * runtime assembly excludes them for public sessions regardless (B4).
 */
export async function contentWarnings(documentRaw: unknown): Promise<ValidationIssue[]> {
  const parsed = GraphDocumentSchema.safeParse(documentRaw);
  if (!parsed.success) return []; // schema errors are already reported by validateGraph
  const issues: ValidationIssue[] = [];

  for (const node of parsed.data.nodes) {
    for (const item of node.contextSet) {
      if (item.type === 'entity') {
        const entity = await prisma.contentEntity.findUnique({
          where: { id: item.entityId },
          select: { entityType: true, slug: true },
        });
        if (!entity) {
          issues.push({ severity: 'warning', code: 'missing_content', message: `Node "${node.name}": entity "${item.entityId}" no longer exists`, nodeId: node.id });
          continue;
        }
        if (entity.entityType === 'PROJECT') {
          const project = await prisma.project.findUnique({ where: { slug: entity.slug }, select: { visibility: true } });
          if (project && project.visibility !== 'PUBLIC') {
            issues.push({ severity: 'warning', code: 'private_content', message: `Node "${node.name}": entity "${entity.slug}" is ${project.visibility} — excluded for public sessions at runtime (Req 11.2)`, nodeId: node.id });
          }
        }
      } else if (item.type === 'chunk') {
        const chunk = await prisma.contextChunk.findFirst({
          where: { OR: [{ id: item.chunkId }, { chunkId: item.chunkId }] },
          select: { entity: { select: { entityType: true, slug: true } } },
        });
        if (!chunk) {
          issues.push({ severity: 'warning', code: 'missing_content', message: `Node "${node.name}": chunk "${item.chunkId}" no longer exists`, nodeId: node.id });
          continue;
        }
        if (chunk.entity.entityType === 'PROJECT') {
          const project = await prisma.project.findUnique({ where: { slug: chunk.entity.slug }, select: { visibility: true } });
          if (project && project.visibility !== 'PUBLIC') {
            issues.push({ severity: 'warning', code: 'private_content', message: `Node "${node.name}": chunk "${item.chunkId}" belongs to ${project.visibility} project "${chunk.entity.slug}" — excluded for public sessions at runtime (Req 11.2)`, nodeId: node.id });
          }
        }
      }
    }
  }
  return issues;
}

export interface GraphListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  activeVersion: number | null;
  versionCount: number;
  nodeCount: number;
  updatedAt: string;
}

export async function listGraphs(): Promise<GraphListItem[]> {
  const graphs = await prisma.conversationGraph.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { versions: { select: { id: true, version: true } } },
  });
  return graphs.map((g) => {
    const draft = g.draftDocument as { nodes?: unknown[] } | null;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      status: g.status,
      activeVersion: g.versions.find((v) => v.id === g.activeVersionId)?.version ?? null,
      versionCount: g.versions.length,
      nodeCount: Array.isArray(draft?.nodes) ? draft.nodes.length : 0,
      updatedAt: g.updatedAt.toISOString(),
    };
  });
}

const newId = (prefix: 'n' | 'e') => `${prefix}_${randomUUID().slice(0, 13)}`;

/**
 * Seed document for a new graph: the required start + offgraph pair, with the
 * current static start frame snapshotted as the start node's first context
 * item (design §4 — "the static start frame literally becomes the default
 * start node's contextSet seed when a graph is first created"). The snapshot
 * is owner-editable data from then on; the LIVE static frame remains the
 * no-graph fallback path (Req 3.4).
 */
async function seedDocument(): Promise<GraphDocument> {
  let frame = '';
  try {
    frame = await assembleStartFrame();
  } catch (err) {
    console.warn('[graph-store] start-frame seed unavailable — seeding an empty start node:', err);
  }
  const startId = newId('n');
  const offgraphId = newId('n');
  return GraphDocumentSchema.parse({
    nodes: [
      {
        id: startId,
        name: 'Start',
        role: 'start',
        guidance: { promptFragments: [] },
        contextSet: frame ? [{ type: 'static', text: frame }] : [],
      },
      {
        id: offgraphId,
        name: 'Off-graph',
        role: 'offgraph',
        guidance: { promptFragments: [] },
        contextSet: [],
      },
    ],
    edges: [],
    layout: { [startId]: { x: 0, y: 0 }, [offgraphId]: { x: 320, y: 0 } },
  });
}

export async function createGraph(input: { name: string; description?: string }): Promise<{ id: string }> {
  const document = await seedDocument();
  const graph = await prisma.conversationGraph.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      status: 'draft',
      draftDocument: document as object,
    },
    select: { id: true },
  });
  return graph;
}

/**
 * Duplicate = a NEW graph lineage: node/edge ids are REGENERATED (mapped
 * consistently) so telemetry/annotations of the source graph can never join
 * onto the copy's traffic (P15's paste-gets-new-ids rule applied at graph
 * scale). Versions are not copied — the copy starts unpublished.
 */
export async function duplicateGraph(id: string): Promise<{ id: string } | null> {
  const source = await prisma.conversationGraph.findUnique({ where: { id } });
  if (!source) return null;
  const parsed = GraphDocumentSchema.safeParse(source.draftDocument);
  const idMap = new Map<string, string>();
  let document: object;
  if (parsed.success) {
    for (const node of parsed.data.nodes) idMap.set(node.id, newId('n'));
    const layout = (parsed.data.layout ?? {}) as Record<string, unknown>;
    document = {
      ...parsed.data,
      nodes: parsed.data.nodes.map((n) => ({ ...n, id: idMap.get(n.id)! })),
      edges: parsed.data.edges.map((e) => ({
        ...e,
        id: newId('e'),
        from: idMap.get(e.from) ?? e.from,
        to: idMap.get(e.to) ?? e.to,
      })),
      layout: Object.fromEntries(Object.entries(layout).map(([k, v]) => [idMap.get(k) ?? k, v])),
      embeddings: undefined, // derived at publish, never copied
    };
  } else {
    document = source.draftDocument as object; // copy broken drafts verbatim — the editor shows the schema errors
  }
  const copy = await prisma.conversationGraph.create({
    data: {
      name: `${source.name} (copy)`,
      description: source.description,
      status: 'draft',
      draftDocument: document,
    },
    select: { id: true },
  });
  return copy;
}

export interface GraphDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  activeVersionId: string | null;
  activeVersion: number | null;
  draftDocument: unknown;
  issues: ValidationIssue[];
  updatedAt: string;
}

export async function getGraphDetail(id: string): Promise<GraphDetail | null> {
  const graph = await prisma.conversationGraph.findUnique({
    where: { id },
    include: { versions: { select: { id: true, version: true } } },
  });
  if (!graph) return null;
  const issues = [
    ...validateGraph(graph.draftDocument, buildValidationContext()),
    ...(await contentWarnings(graph.draftDocument)),
  ];
  return {
    id: graph.id,
    name: graph.name,
    description: graph.description,
    status: graph.status,
    activeVersionId: graph.activeVersionId,
    activeVersion: graph.versions.find((v) => v.id === graph.activeVersionId)?.version ?? null,
    draftDocument: graph.draftDocument,
    issues,
    updatedAt: graph.updatedAt.toISOString(),
  };
}

/**
 * Draft save (debounced autosave from the editor). Deliberately permissive:
 * invalid drafts SAVE — the draft never serves traffic (Req 1.3) and an
 * autosave that rejected mid-edit states would lose work (P15). The only gate
 * is "structurally a document" (object with node/edge arrays); validation
 * results ride back for the canvas badges.
 */
export async function saveDraft(
  id: string,
  documentRaw: unknown,
  meta?: { name?: string; description?: string }
): Promise<{ issues: ValidationIssue[] } | null> {
  const doc = documentRaw as { nodes?: unknown; edges?: unknown } | null;
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    throw new Error('document must be an object with nodes[] and edges[]');
  }
  const existing = await prisma.conversationGraph.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;
  await prisma.conversationGraph.update({
    where: { id },
    data: {
      draftDocument: documentRaw as object,
      ...(meta?.name !== undefined ? { name: meta.name } : {}),
      ...(meta?.description !== undefined ? { description: meta.description } : {}),
    },
  });
  const issues = [...validateGraph(documentRaw, buildValidationContext()), ...(await contentWarnings(documentRaw))];
  return { issues };
}

/** Archive: the graph stops serving (runtime reads status='active' only) but versions/telemetry joins stay. */
export async function archiveGraph(id: string): Promise<boolean> {
  const graph = await prisma.conversationGraph.findUnique({ where: { id }, select: { id: true } });
  if (!graph) return false;
  await prisma.conversationGraph.update({ where: { id }, data: { status: 'archived' } });
  return true;
}

export interface PublishResult {
  ok: boolean;
  /** Blocking issues when ok=false (error severity blocks — notes §2.3.1). */
  issues?: ValidationIssue[];
  version?: number;
  versionId?: string;
  embedding?: { model: string; exemplars: number; costUsd: number } | null;
}

/**
 * Publish per notes §2.3: validate (errors block) → embed intent exemplars
 * with the RECORDED model id (P11) → snapshot + activate in ONE transaction.
 * Also enforces the single-active-graph rule (notes §8 "exactly one active
 * graph"): activating this graph demotes any other active graph to 'draft'
 * (their drafts and versions are untouched — re-publish reactivates them).
 * Live conversations are untouched either way (P6 — versions pin at start).
 */
export async function publishGraph(id: string, note?: string): Promise<PublishResult | null> {
  const graph = await prisma.conversationGraph.findUnique({ where: { id } });
  if (!graph) return null;
  if (graph.status === 'archived') {
    return { ok: false, issues: [{ severity: 'error', code: 'schema', message: 'Graph is archived — unarchive (save the draft) before publishing' }] };
  }

  const issues = [...validateGraph(graph.draftDocument, buildValidationContext()), ...(await contentWarnings(graph.draftDocument))];
  if (issues.some((i) => i.severity === 'error')) {
    return { ok: false, issues };
  }
  const document = GraphDocumentSchema.parse(graph.draftDocument);

  // Intent-exemplar embeddings, batched in ONE call through the default-embedding
  // alias; the resolved model id is RECORDED in the version document so runtime
  // utterance embedding can pin it after the alias moves on (P11).
  let embeddings: GraphDocument['embeddings'];
  let embeddingSummary: PublishResult['embedding'] = null;
  const intentEdges = document.edges.filter(
    (e): e is typeof e & { condition: { type: 'intent'; exemplars: string[] } } => e.condition.type === 'intent'
  );
  if (intentEdges.length > 0) {
    const inputs = intentEdges.flatMap((e) => e.condition.exemplars);
    const result = await generateEmbeddings(inputs, { taskType: 'document' });
    const costUsd = await estimateCost(result.modelId, { inputTokens: result.tokensUsed }).catch(() => 0);
    await recordUsage({
      feature: 'semantic',
      usageType: 'engine_exemplar_embedding',
      provider: result.provider,
      modelId: result.modelId,
      inputTokens: result.tokensUsed,
      costUsd,
      metadata: { operation: 'graph_publish', graphId: id, edges: intentEdges.length, exemplars: inputs.length },
    });
    embeddings = {};
    let cursor = 0;
    for (const edge of intentEdges) {
      const count = edge.condition.exemplars.length;
      embeddings[edge.id] = { model: result.modelId, vectors: result.vectors.slice(cursor, cursor + count) };
      cursor += count;
    }
    embeddingSummary = { model: result.modelId, exemplars: inputs.length, costUsd };
  }

  const versionDocument = { ...document, embeddings } as object;

  const created = await prisma.$transaction(async (tx) => {
    const latest = await tx.conversationGraphVersion.aggregate({
      where: { graphId: id },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;
    const row = await tx.conversationGraphVersion.create({
      data: { graphId: id, version, document: versionDocument, note: note ?? null },
      select: { id: true, version: true },
    });
    await tx.conversationGraph.update({
      where: { id },
      data: { status: 'active', activeVersionId: row.id },
    });
    await tx.conversationGraph.updateMany({
      where: { status: 'active', id: { not: id } },
      data: { status: 'draft' },
    });
    return row;
  });

  return { ok: true, version: created.version, versionId: created.id, issues, embedding: embeddingSummary };
}

export interface VersionListItem {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  isActive: boolean;
  nodeCount: number;
  edgeCount: number;
}

export async function listVersions(graphId: string): Promise<VersionListItem[] | null> {
  const graph = await prisma.conversationGraph.findUnique({ where: { id: graphId }, select: { activeVersionId: true } });
  if (!graph) return null;
  const rows = await prisma.conversationGraphVersion.findMany({
    where: { graphId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, note: true, createdAt: true, document: true },
  });
  return rows.map((r) => {
    const doc = r.document as { nodes?: unknown[]; edges?: unknown[] };
    return {
      id: r.id,
      version: r.version,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      isActive: r.id === graph.activeVersionId,
      nodeCount: Array.isArray(doc.nodes) ? doc.nodes.length : 0,
      edgeCount: Array.isArray(doc.edges) ? doc.edges.length : 0,
    };
  });
}

/** Structural diff between two versions of the SAME graph (Req 8.4). */
export async function diffVersions(graphId: string, versionIdA: string, versionIdB: string): Promise<GraphDiff | null> {
  const [a, b] = await Promise.all([
    prisma.conversationGraphVersion.findFirst({ where: { id: versionIdA, graphId }, select: { document: true } }),
    prisma.conversationGraphVersion.findFirst({ where: { id: versionIdB, graphId }, select: { document: true } }),
  ]);
  if (!a || !b) return null;
  const docA = GraphDocumentSchema.safeParse(a.document);
  const docB = GraphDocumentSchema.safeParse(b.document);
  if (!docA.success || !docB.success) return null;
  return diffGraphDocuments(docA.data, docB.data);
}

/**
 * Re-activate a previously published version (Req 8.4). Moves the live
 * pointer only — the draft stays the working copy (an owner reverting a bad
 * publish keeps their in-progress edits). Same single-active rule as publish;
 * live conversations keep their pinned version (P6).
 */
export async function activateVersion(graphId: string, versionId: string): Promise<{ version: number } | null> {
  const row = await prisma.conversationGraphVersion.findFirst({
    where: { id: versionId, graphId },
    select: { id: true, version: true },
  });
  if (!row) return null;
  await prisma.$transaction(async (tx) => {
    await tx.conversationGraph.update({
      where: { id: graphId },
      data: { status: 'active', activeVersionId: row.id },
    });
    await tx.conversationGraph.updateMany({
      where: { status: 'active', id: { not: graphId } },
      data: { status: 'draft' },
    });
  });
  return { version: row.version };
}

// ============================================================================
// Block E — review, annotation, coverage (Req 9)
// ============================================================================

/**
 * Version lookup for replay/traversal rendering (Req 9.1): the conversation
 * pins a graphVersionId (P6); this resolves it to the graph + human-readable
 * node names without shipping the full document (edge conditions/exemplars
 * stay server-side for the REPLAY payload; the traversal viewer is a separate
 * admin-only fetch of the document itself).
 */
export async function getVersionMeta(versionId: string): Promise<{
  graphId: string;
  graphName: string;
  graphVersionId: string;
  version: number;
  nodeNames: Record<string, string>;
} | null> {
  const row = await prisma.conversationGraphVersion.findUnique({
    where: { id: versionId },
    select: { id: true, version: true, graph: { select: { id: true, name: true } } },
  });
  if (!row) return null;
  const document = await loadVersionDocument(versionId);
  return {
    graphId: row.graph.id,
    graphName: row.graph.name,
    graphVersionId: row.id,
    version: row.version,
    nodeNames: Object.fromEntries((document?.nodes ?? []).map((n) => [n.id, n.name])),
  };
}

/**
 * Full immutable version document for the read-only traversal viewer
 * (Req 9.1 "show on graph"). Embedding vectors are stripped — they are
 * publish-time derivation data the canvas never renders, and they dominate
 * the payload size.
 */
export async function getVersionDetail(
  graphId: string,
  versionId: string
): Promise<{ id: string; version: number; note: string | null; createdAt: string; document: GraphDocument } | null> {
  const row = await prisma.conversationGraphVersion.findFirst({
    where: { id: versionId, graphId },
    select: { id: true, version: true, note: true, createdAt: true },
  });
  if (!row) return null;
  const document = await loadVersionDocument(versionId);
  if (!document) return null;
  return {
    id: row.id,
    version: row.version,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    document: { ...document, embeddings: undefined },
  };
}

export interface AnnotationRow {
  id: string;
  conversationId: string;
  messageId: string | null;
  nodeId: string;
  nodeName: string | null;
  graphId: string | null;
  graphVersionId: string;
  version: number | null;
  kind: string;
  note: string | null;
  status: string;
  resolvedByVersionId: string | null;
  resolvedByVersion: number | null;
  createdAt: string;
}

async function decorateAnnotations(
  rows: Array<{
    id: string;
    conversationId: string;
    messageId: string | null;
    nodeId: string;
    graphVersionId: string;
    kind: string;
    note: string | null;
    status: string;
    resolvedByVersionId: string | null;
    createdAt: Date;
  }>
): Promise<AnnotationRow[]> {
  const versionIds = [
    ...new Set(rows.flatMap((r) => [r.graphVersionId, r.resolvedByVersionId].filter((v): v is string => !!v))),
  ];
  const versions = versionIds.length
    ? await prisma.conversationGraphVersion.findMany({
        where: { id: { in: versionIds } },
        select: { id: true, version: true, graphId: true },
      })
    : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const nameCache = new Map<string, Record<string, string>>();
  const out: AnnotationRow[] = [];
  for (const r of rows) {
    const v = versionById.get(r.graphVersionId);
    let nodeName: string | null = null;
    if (v) {
      if (!nameCache.has(r.graphVersionId)) {
        const doc = await loadVersionDocument(r.graphVersionId);
        nameCache.set(r.graphVersionId, Object.fromEntries((doc?.nodes ?? []).map((n) => [n.id, n.name])));
      }
      nodeName = nameCache.get(r.graphVersionId)?.[r.nodeId] ?? null;
    }
    out.push({
      id: r.id,
      conversationId: r.conversationId,
      messageId: r.messageId,
      nodeId: r.nodeId,
      nodeName,
      graphId: v?.graphId ?? null,
      graphVersionId: r.graphVersionId,
      version: v?.version ?? null,
      kind: r.kind,
      note: r.note,
      status: r.status,
      resolvedByVersionId: r.resolvedByVersionId,
      resolvedByVersion: r.resolvedByVersionId ? versionById.get(r.resolvedByVersionId)?.version ?? null : null,
      createdAt: r.createdAt.toISOString(),
    });
  }
  return out;
}

/**
 * Annotations list (Req 9.2). `graphId` scoping joins through the graph's
 * version ids — GraphAnnotation deliberately has no graphId column (the
 * version pin is the interpretation context, design §2).
 */
export async function listAnnotations(filter: {
  graphId?: string;
  conversationId?: string;
  status?: 'open' | 'resolved';
}): Promise<AnnotationRow[]> {
  let versionScope: string[] | undefined;
  if (filter.graphId) {
    const versions = await prisma.conversationGraphVersion.findMany({
      where: { graphId: filter.graphId },
      select: { id: true },
    });
    versionScope = versions.map((v) => v.id);
    if (versionScope.length === 0) return [];
  }
  const rows = await prisma.graphAnnotation.findMany({
    where: {
      ...(versionScope ? { graphVersionId: { in: versionScope } } : {}),
      ...(filter.conversationId ? { conversationId: filter.conversationId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return decorateAnnotations(rows);
}

export async function createAnnotation(input: {
  conversationId: string;
  messageId?: string;
  nodeId: string;
  graphVersionId: string;
  kind: 'bad_answer' | 'missed_transition' | 'note';
  note?: string;
}): Promise<AnnotationRow | { error: string }> {
  const version = await prisma.conversationGraphVersion.findUnique({
    where: { id: input.graphVersionId },
    select: { id: true },
  });
  if (!version) return { error: `graph version ${input.graphVersionId} not found` };
  const row = await prisma.graphAnnotation.create({
    data: {
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      nodeId: input.nodeId,
      graphVersionId: input.graphVersionId,
      kind: input.kind,
      note: input.note ?? null,
      status: 'open',
    },
  });
  const [decorated] = await decorateAnnotations([row]);
  return decorated;
}

/**
 * Annotation update (Req 9.2). Resolving without an explicit
 * `resolvedByVersionId` links the graph's CURRENT version (active pointer,
 * else latest) — the publish that addressed the mark is by construction the
 * newest one when the owner clicks resolve in the drawer. Reopening clears
 * the link.
 */
export async function updateAnnotation(
  id: string,
  patch: { status?: 'open' | 'resolved'; note?: string; resolvedByVersionId?: string }
): Promise<AnnotationRow | null> {
  const existing = await prisma.graphAnnotation.findUnique({ where: { id } });
  if (!existing) return null;

  let resolvedByVersionId = existing.resolvedByVersionId;
  if (patch.status === 'resolved') {
    resolvedByVersionId = patch.resolvedByVersionId ?? null;
    if (!resolvedByVersionId) {
      const version = await prisma.conversationGraphVersion.findUnique({
        where: { id: existing.graphVersionId },
        select: { graphId: true },
      });
      if (version) {
        const graph = await prisma.conversationGraph.findUnique({
          where: { id: version.graphId },
          select: { activeVersionId: true },
        });
        resolvedByVersionId =
          graph?.activeVersionId ??
          (
            await prisma.conversationGraphVersion.findFirst({
              where: { graphId: version.graphId },
              orderBy: { version: 'desc' },
              select: { id: true },
            })
          )?.id ??
          null;
      }
    }
  } else if (patch.status === 'open') {
    resolvedByVersionId = null;
  }

  const row = await prisma.graphAnnotation.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.status ? { resolvedByVersionId } : {}),
    },
  });
  const [decorated] = await decorateAnnotations([row]);
  return decorated;
}

/**
 * Coverage report (Req 9.3): bounded-window fetch of node_transition marker
 * rows (P14 — SQL filters markerType + timestamp only), then pure TS
 * aggregation with version scoping + P17 test exclusion in graph-coverage.ts.
 * Reference document = active version when one exists, else the draft — the
 * "where to invest the next node" view tracks what the owner is editing.
 */
export async function graphCoverage(graphId: string, windowDays: number): Promise<CoverageReport | null> {
  const graph = await prisma.conversationGraph.findUnique({
    where: { id: graphId },
    select: { id: true, activeVersionId: true, draftDocument: true },
  });
  if (!graph) return null;

  const versions = await prisma.conversationGraphVersion.findMany({
    where: { graphId },
    select: { id: true },
  });
  const versionIds = new Set(versions.map((v) => v.id));

  let reference: GraphDocument | null = null;
  if (graph.activeVersionId && versionIds.has(graph.activeVersionId)) {
    reference = await loadVersionDocument(graph.activeVersionId);
  }
  if (!reference) {
    const parsed = GraphDocumentSchema.safeParse(graph.draftDocument);
    reference = parsed.success ? parsed.data : null;
  }
  if (!reference) return null;

  const days = Math.min(Math.max(Math.floor(windowDays), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const markers = await prisma.aIConversationMessage.findMany({
    where: {
      timestamp: { gte: since },
      metadata: { path: ['markerType'], equals: 'node_transition' },
    },
    select: {
      conversationId: true,
      timestamp: true,
      metadata: true,
      conversation: { select: { metadata: true } },
    },
  });

  const rows: TransitionMarkerRow[] = [];
  for (const m of markers) {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.toNode !== 'string' || typeof meta.graphVersionId !== 'string') continue;
    const convMeta = (m.conversation?.metadata ?? {}) as Record<string, unknown>;
    rows.push({
      conversationId: m.conversationId,
      timestamp: m.timestamp.toISOString(),
      fromNode: typeof meta.fromNode === 'string' ? meta.fromNode : null,
      toNode: meta.toNode,
      edgeId: typeof meta.edgeId === 'string' ? meta.edgeId : null,
      conditionType: typeof meta.conditionType === 'string' ? meta.conditionType : null,
      graphVersionId: meta.graphVersionId,
      isTest: convMeta.test === true,
    });
  }

  return aggregateCoverage(reference, rows, { versionIds, windowDays: days, since: since.toISOString() });
}

/**
 * Editor metadata (D2 pickers): live tool registry enumeration with metadata
 * (Req 4.2 — never a hardcoded list), the alias roles, and the voice-clip
 * category vocabulary (distinct phrase tags — custom categories allowed).
 */
export async function editorMeta(): Promise<{
  tools: Array<{ name: string; description: string; executionContext: string }>;
  aliases: string[];
  voiceClipCategories: string[];
  entities: Array<{ id: string; entityType: string; slug: string; title: string | null }>;
}> {
  const [tags, entities] = await Promise.all([
    prisma.voiceClipPhrase.findMany({ distinct: ['tag'], select: { tag: true } }),
    prisma.contentEntity.findMany({
      select: { id: true, entityType: true, slug: true, title: true },
      orderBy: [{ entityType: 'asc' }, { slug: 'asc' }],
    }),
  ]);
  return {
    tools: unifiedToolRegistry.getAllToolDefinitions().map((t) => ({
      name: t.name,
      description: t.description,
      executionContext: t.executionContext,
    })),
    aliases: buildValidationContext().knownAliases!,
    voiceClipCategories: tags.map((t) => t.tag).sort(),
    entities,
  };
}
