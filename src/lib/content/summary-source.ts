/**
 * Cumulative summary-source construction (semantic-content Req 9.3, task 9).
 *
 * Owner design intent: the terminal tier (T3) carries verbatim text; every
 * higher tier summarizes the CUMULATIVE content of all its children. For a
 * parent T2 that means its own prose plus its children's completed T2
 * summaries — which requires bottom-up (deepest-first) processing so child
 * summaries exist before the parent's source is built (design §7).
 *
 * Shared by StageBasedProcessingService (summaries stage) and
 * SelectiveSectionRegenerator (ancestor-chain regeneration) so the two
 * paths cannot drift.
 */

import type { TierContent } from './SmartContentGenerator';

/** Content markers that must never leak into a summary source. */
const PLACEHOLDER_MARKERS = ['[TO BE GENERATED', 'No content available'];

function isUsableContent(content: string | undefined | null): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;
  return !PLACEHOLDER_MARKERS.some(marker => trimmed.startsWith(marker));
}

/**
 * Normalize parentChunkId references to LOGICAL chunk ids. Chunks loaded from
 * the database carry DB uuids in parentChunkId; chunks from a fresh scaffold
 * carry logical anchor ids. Hierarchy walks need one consistent id space.
 */
export function normalizeParentChunkIds(
  chunks: TierContent[],
  dbIdToChunkId: Map<string, string>
): TierContent[] {
  for (const chunk of chunks) {
    if (chunk.parentChunkId && dbIdToChunkId.has(chunk.parentChunkId)) {
      chunk.parentChunkId = dbIdToChunkId.get(chunk.parentChunkId)!;
    }
  }
  return chunks;
}

/** Direct T2 children of a T2 chunk (logical-id parent linkage). */
export function childT2sOf(chunk: TierContent, allT1T2: TierContent[]): TierContent[] {
  return allT1T2.filter(
    c => c.tier === 2 && c.chunkId !== chunk.chunkId && c.parentChunkId === chunk.chunkId
  );
}

/**
 * Order chunks for summary generation: T2s deepest-first (children before
 * parents, by hierarchy depth within the T2 set), then T1 last. Guarantees a
 * parent's source can include already-generated child summaries.
 */
export function orderSummaryChunksBottomUp(chunks: TierContent[]): TierContent[] {
  const t2ById = new Map(chunks.filter(c => c.tier === 2).map(c => [c.chunkId, c]));

  const depthCache = new Map<string, number>();
  const depthOf = (chunk: TierContent): number => {
    const cached = depthCache.get(chunk.chunkId);
    if (cached !== undefined) return cached;
    depthCache.set(chunk.chunkId, 0); // cycle guard
    const parent = chunk.parentChunkId ? t2ById.get(chunk.parentChunkId) : undefined;
    const depth = parent ? depthOf(parent) + 1 : 0;
    depthCache.set(chunk.chunkId, depth);
    return depth;
  };

  return [...chunks].sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier; // T2 before T1
    if (a.tier === 2 && b.tier === 2) return depthOf(b) - depthOf(a); // deepest first
    return 0;
  });
}

export interface T2SummarySource {
  /** Combined source text: own T3 prose + child T2 summaries. */
  source: string;
  /** Titles of direct child T2 sections (for the truly-empty fallback). */
  childTitles: string[];
  /** Logical chunk ids of children whose content contributed to the source. */
  contributingChildIds: string[];
  /** Number of the section's own T3 chunks that contributed. */
  ownT3Count: number;
}

/**
 * Build the cumulative summary source for one T2 chunk: the section's own
 * T3 prose followed by each direct child T2's content (auto-populated
 * verbatim or an already-generated summary — call in bottom-up order).
 */
export function buildT2SummarySource(
  chunk: TierContent,
  allT1T2: TierContent[],
  allT3: TierContent[]
): T2SummarySource {
  const sectionGroup = chunk.sectionGroup || chunk.chunkId;
  const ownT3s = allT3.filter(c => c.sectionGroup === sectionGroup && isUsableContent(c.content));
  const children = childT2sOf(chunk, allT1T2);

  const parts: string[] = [];
  if (ownT3s.length > 0) {
    parts.push(ownT3s.map(c => c.content).join('\n\n'));
  }

  const contributingChildIds: string[] = [];
  for (const child of children) {
    if (!isUsableContent(child.content)) continue;
    const childTitle = (child.title || child.chunkId).split('\n')[0].trim();
    parts.push(`Subsection "${childTitle}": ${child.content.trim()}`);
    contributingChildIds.push(child.chunkId);
  }

  return {
    source: parts.join('\n\n'),
    childTitles: children.map(c => (c.title || '').split('\n')[0].trim()).filter(Boolean),
    contributingChildIds,
    ownT3Count: ownT3s.length,
  };
}
