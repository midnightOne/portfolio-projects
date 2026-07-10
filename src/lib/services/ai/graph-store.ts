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
