/**
 * Document scaffold generation (ai-assistant 7.15 — all-source ingestion).
 *
 * The markdown/plain-text analogue of SmartContentGenerator.generateScaffoldOnly:
 * turns a config-owned document source (resume/CV, article, arbitrary text —
 * classic RAG) into the SAME TierContent scaffold the project pipeline
 * produces, so the downstream stages (summaries → embeddings → validation)
 * run unchanged on one corpus:
 *
 *   T0  metadata JSON (title/type/slug/uiLocation/tags) — system, unembedded-ok
 *   T1  'summary' placeholder → AI summary of all T3 prose
 *   T2  one per heading — verbatim auto-populate when the cumulative subtree
 *       fits the T2 token budget (same 6.2-preserving rule as projects),
 *       else a placeholder for a cumulative AI summary
 *   T3  heading-bounded verbatim chunks (`t3-<anchor>-<i>`), same id scheme
 *       and metadata as T3HeadingBoundedChunking
 *
 * Text before the first heading becomes an 'overview' section. A document
 * with no headings at all is one 'overview' section.
 */

import type { TierContent } from './SmartContentGenerator';
import type { DocumentSourceSpec } from './source-registry';

const T3_TARGET_TOKENS = 400; // paragraph-packed chunk size (chars/4 estimate)

interface DocSection {
  anchorId: string;
  title: string;
  level: number; // 0 = synthetic overview, 1–3 = heading levels
  parentAnchorId: string | null; // null → parent is T1 'summary'
  body: string; // own prose only (until the next heading of ANY level)
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Same slug algorithm as HierarchicalContentParser.generateAnchorId. */
export function documentAnchorId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Split markdown into heading-bounded sections with parent linkage (H1–H3; H4+ folds into body). */
export function parseDocumentSections(doc: { title: string; content: string }): DocSection[] {
  const lines = doc.content.replace(/\r\n/g, '\n').split('\n');
  const sections: DocSection[] = [];
  const usedAnchors = new Set<string>();
  // Heading stack: last seen section per level, for parent resolution
  const stack: Array<{ level: number; anchorId: string }> = [];

  const uniqueAnchor = (base: string): string => {
    let anchor = base || 'section';
    let n = 2;
    while (usedAnchors.has(anchor)) anchor = `${base}-${n++}`;
    usedAnchors.add(anchor);
    return anchor;
  };

  let current: DocSection | null = null;
  const bodyLines: string[] = [];

  const flush = () => {
    if (!current) {
      const preamble = bodyLines.join('\n').trim();
      if (preamble) {
        sections.push({
          anchorId: uniqueAnchor('overview'),
          title: doc.title,
          level: 0,
          parentAnchorId: null,
          body: preamble,
        });
      }
    } else {
      current.body = bodyLines.join('\n').trim();
      sections.push(current);
    }
    bodyLines.length = 0;
  };

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!m) {
      // H4+ folds into the body — demote the marker to plain text (T3 chunks
      // must never contain heading markers; validateHeadingBoundaries throws).
      const deep = /^#{4,6}\s+(.+)$/.exec(line);
      bodyLines.push(deep ? deep[1] : line);
      continue;
    }
    flush();
    const level = m[1].length;
    const title = m[2].trim();
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    current = {
      anchorId: uniqueAnchor(documentAnchorId(title)),
      title,
      level,
      parentAnchorId: parent ? parent.anchorId : null,
      body: '',
    };
    stack.push({ level, anchorId: current.anchorId });
  }
  flush();

  return sections;
}

/** Pack paragraphs into ~T3_TARGET_TOKENS chunks (never splitting a paragraph). */
function chunkBody(body: string): string[] {
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf: string[] = [];
  let bufTokens = 0;
  for (const p of paragraphs) {
    const t = estimateTokens(p);
    if (buf.length > 0 && bufTokens + t > T3_TARGET_TOKENS) {
      chunks.push(buf.join('\n\n'));
      buf = [];
      bufTokens = 0;
    }
    buf.push(p);
    bufTokens += t;
  }
  if (buf.length > 0) chunks.push(buf.join('\n\n'));
  return chunks;
}

/**
 * Generate the full T0–T3 scaffold for a document source. Mirrors the project
 * scaffold contract exactly (placeholders marked needsAIGeneration; T2
 * auto-populated verbatim when the cumulative subtree fits `t2MaxTokens`).
 */
export function generateDocumentScaffold(doc: DocumentSourceSpec, t2MaxTokens: number): TierContent[] {
  const sections = parseDocumentSections(doc);
  const tiers: TierContent[] = [];

  // T0 metadata (uiLocation rides here — retrieval reads it for route navTargets)
  const t0Content = JSON.stringify({
    title: doc.title,
    type: doc.entityType,
    slug: doc.slug,
    ...(doc.uiLocation ? { page: doc.uiLocation } : {}),
    tags: doc.tags,
    technologies: doc.technologies,
  });
  tiers.push({
    tier: 0,
    chunkId: 'metadata',
    title: 'Document Metadata',
    content: t0Content,
    tokenCount: estimateTokens(t0Content),
    parentChunkId: undefined,
    rootChunkId: 'metadata',
    sectionGroup: 'root',
    derivationPath: 'T0',
    metadata: {
      type: 'metadata',
      importance: 1.0,
      source: 'document-source',
      generationMode: 'system',
      editable: false,
      ...(doc.uiLocation ? { uiLocation: doc.uiLocation } : {}),
    },
  });

  // T1 placeholder
  tiers.push({
    tier: 1,
    chunkId: 'summary',
    title: `${doc.title} - Summary`,
    content: '[TO BE GENERATED BY SUMMARIES STAGE]',
    tokenCount: 0,
    parentChunkId: 'metadata',
    rootChunkId: 'metadata',
    derivationPath: 'metadata → summary',
    metadata: {
      type: 'document-summary',
      placeholder: true,
      needsAIGeneration: true,
      editable: true,
      source: 'pending-ai',
      generationMode: 'pending',
    },
  });

  // T3 first (the T2 auto-populate decision needs them)
  const t3Chunks: TierContent[] = [];
  for (const section of sections) {
    const parts = chunkBody(section.body);
    parts.forEach((content, i) => {
      t3Chunks.push({
        tier: 3,
        chunkId: `t3-${section.anchorId}-${i}`,
        title: i === 0 ? section.title : `${section.title} (part ${i + 1})`,
        content,
        tokenCount: estimateTokens(content),
        parentChunkId: section.anchorId,
        rootChunkId: 'metadata',
        sectionGroup: section.anchorId,
        derivationPath: `metadata → summary → ${section.anchorId} → chunk-${i}`,
        sectionBounded: true,
        chunkIndexInSection: i,
        metadata: {
          type: 'content-chunk',
          parentHeading: section.title,
          headingLevel: section.level,
          chunkIndexInSection: i,
          totalChunksInSection: parts.length,
          sectionGroup: section.anchorId,
          sectionId: section.anchorId,
          source: 'original-content',
          generationMode: 'extracted',
          editable: true,
        },
      });
    });
  }

  // T2 per section — cumulative-subtree auto-populate rule (Req 9.3 / 6.2)
  const childrenOf = (anchorId: string): DocSection[] =>
    sections.filter(s => s.parentAnchorId === anchorId);
  const subtreeAnchors = (section: DocSection): string[] => {
    const out: string[] = [section.anchorId];
    for (const child of childrenOf(section.anchorId)) out.push(...subtreeAnchors(child));
    return out;
  };

  for (const section of sections) {
    const anchors = new Set(subtreeAnchors(section));
    const subtreeT3 = t3Chunks.filter(c => c.sectionGroup && anchors.has(c.sectionGroup));
    const combined = subtreeT3.map(c => c.content).join('\n\n');
    const combinedTokens = estimateTokens(combined);
    const hasChildren = childrenOf(section.anchorId).length > 0;
    const autoPopulate = combined.length > 0 && combinedTokens <= t2MaxTokens;

    tiers.push({
      tier: 2,
      chunkId: section.anchorId,
      title: section.title,
      content: autoPopulate ? combined : '[TO BE GENERATED BY SUMMARIES STAGE]',
      tokenCount: autoPopulate ? combinedTokens : 0,
      parentChunkId: section.parentAnchorId ?? 'summary',
      rootChunkId: 'metadata',
      sectionGroup: section.anchorId,
      derivationPath: `metadata → summary → T2:${section.anchorId}`,
      metadata: {
        type: 'heading-summary',
        nodeType: 'heading',
        headingLevel: section.level,
        anchorId: section.anchorId,
        placeholder: !autoPopulate,
        needsAIGeneration: !autoPopulate,
        editable: true,
        source: autoPopulate ? 'auto-populated' : 'pending-ai',
        generationMode: autoPopulate ? 'extracted' : 'pending',
        includesSubsections: true,
        hasChildSections: hasChildren,
        ...(autoPopulate ? { autoPopulated: true, originalTokenCount: combinedTokens } : {}),
      },
    });
  }

  tiers.push(...t3Chunks);
  return tiers;
}
