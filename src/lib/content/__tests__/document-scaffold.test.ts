/**
 * 7.15 — document scaffold: the markdown analogue of the project scaffold.
 * Pins the contract the downstream stages rely on: tier shape, placeholder
 * markers, parent linkage, the T2 auto-populate budget rule (the 6.2 diet —
 * T2 bodies stay within t2MaxTokens either as verbatim-fits or AI summary),
 * and heading-marker-free T3 bodies (validateHeadingBoundaries would throw).
 */

import { generateDocumentScaffold, parseDocumentSections, documentAnchorId } from '../document-scaffold';
import { chunkTextByParagraphs, estimateTextTokens } from '../bounded-text-chunking';
import type { DocumentSourceSpec } from '../source-registry';

const doc = (content: string, overrides: Partial<DocumentSourceSpec> = {}): DocumentSourceSpec => ({
  sourceId: 'doc:test-doc',
  entityType: 'RESUME',
  slug: 'test-doc',
  title: 'Test Document',
  tags: ['test'],
  technologies: ['TypeScript'],
  uiLocation: null,
  content,
  enabled: true,
  updatedAt: new Date(),
  ...overrides,
});

const MD = `Intro paragraph before any heading.

# Experience

## Acme Corp

Built the flagship widget platform in TypeScript.

Shipped four releases.

### Widget Engine

Deep detail about the widget engine internals.

## Personal Projects

Assorted side projects.

#### Deep heading folds into body
`;

describe('parseDocumentSections', () => {
  it('splits H1–H3 with parent linkage and a synthetic overview for the preamble', () => {
    const sections = parseDocumentSections({ title: 'Test Document', content: MD });
    const byAnchor = Object.fromEntries(sections.map(s => [s.anchorId, s]));

    expect(byAnchor['overview'].level).toBe(0);
    expect(byAnchor['overview'].body).toContain('Intro paragraph');
    expect(byAnchor['experience'].parentAnchorId).toBeNull();
    expect(byAnchor['acme-corp'].parentAnchorId).toBe('experience');
    expect(byAnchor['widget-engine'].parentAnchorId).toBe('acme-corp');
    expect(byAnchor['personal-projects'].parentAnchorId).toBe('experience');
    // H4 demoted into the body, marker stripped
    expect(byAnchor['personal-projects'].body).toContain('Deep heading folds into body');
    expect(byAnchor['personal-projects'].body).not.toMatch(/^#{1,6}\s/m);
  });

  it('handles a headingless document as one overview section', () => {
    const sections = parseDocumentSections({ title: 'Plain', content: 'Just some text.\n\nMore text.' });
    expect(sections).toHaveLength(1);
    expect(sections[0].anchorId).toBe('overview');
    expect(sections[0].title).toBe('Plain');
  });

  it('uses the shared anchor slug algorithm', () => {
    expect(documentAnchorId('Results & Business Impact!')).toBe('results-business-impact');
  });
});

describe('generateDocumentScaffold', () => {
  const options = { t2MaxTokens: 150, targetChunkTokens: 300, maxChunkTokens: 400 };
  const scaffold = generateDocumentScaffold(doc(MD), options);
  const byTier = (t: number) => scaffold.filter(c => c.tier === t);

  it('produces the project-pipeline tier shape (T0 metadata, T1 placeholder, T2 per heading, populated T3s)', () => {
    expect(byTier(0)).toHaveLength(1);
    expect(byTier(0)[0].chunkId).toBe('metadata');
    expect(JSON.parse(byTier(0)[0].content)).toMatchObject({ type: 'RESUME', slug: 'test-doc' });

    expect(byTier(1)).toHaveLength(1);
    expect(byTier(1)[0].chunkId).toBe('summary');
    expect(byTier(1)[0].content).toContain('[TO BE GENERATED');
    expect(byTier(1)[0].metadata.needsAIGeneration).toBe(true);

    // overview + experience + acme-corp + widget-engine + personal-projects
    expect(byTier(2)).toHaveLength(5);
    // 'Experience' has no own prose (children only) → no T3 of its own
    expect(byTier(3).length).toBeGreaterThanOrEqual(4);
  });

  it('T3 chunks are section-bounded, heading-marker-free, and linked to their T2', () => {
    for (const t3 of byTier(3)) {
      expect(t3.sectionBounded).toBe(true);
      expect(t3.content).not.toMatch(/^#{1,6}\s+/m);
      expect(byTier(2).some(t2 => t2.chunkId === t3.parentChunkId)).toBe(true);
      expect(t3.chunkId).toMatch(/^t3-.+-\d+$/);
    }
  });

  it('T2 auto-populates verbatim only when the cumulative subtree fits the budget', () => {
    const small = generateDocumentScaffold(doc(MD), { ...options, t2MaxTokens: 10_000 });
    const smallT2s = small.filter(c => c.tier === 2);
    // Everything fits a huge budget → all verbatim
    expect(smallT2s.every(t2 => t2.metadata.autoPopulated === true)).toBe(true);

    const tiny = generateDocumentScaffold(doc(MD), { ...options, t2MaxTokens: 1 });
    const tinyT2s = tiny.filter(c => c.tier === 2);
    // Nothing fits a 1-token budget → all placeholders for AI summaries
    expect(tinyT2s.every(t2 => t2.metadata.needsAIGeneration === true)).toBe(true);
    expect(tinyT2s.every(t2 => t2.content.includes('[TO BE GENERATED'))).toBe(true);
  });

  it('nested T2 parent chain mirrors the heading hierarchy (root T2s parent to T1 summary)', () => {
    const t2 = (anchor: string) => byTier(2).find(c => c.chunkId === anchor)!;
    expect(t2('experience').parentChunkId).toBe('summary');
    expect(t2('acme-corp').parentChunkId).toBe('experience');
    expect(t2('widget-engine').parentChunkId).toBe('acme-corp');
    expect(t2('overview').parentChunkId).toBe('summary');
  });

  it('records uiLocation in T0 when the source has an on-site page', () => {
    const withPage = generateDocumentScaffold(doc(MD, { uiLocation: '/about' }), options);
    const t0 = withPage.find(c => c.tier === 0)!;
    expect(JSON.parse(t0.content).page).toBe('/about');
  });

  it('uses the configured hard limit for a long single paragraph', () => {
    const longParagraph = Array.from({ length: 300 }, (_, i) => `Sentence ${i} has useful detail.`).join(' ');
    const bounded = generateDocumentScaffold(doc(longParagraph), {
      t2MaxTokens: 150,
      targetChunkTokens: 40,
      maxChunkTokens: 50,
    }).filter(chunk => chunk.tier === 3);

    expect(bounded.length).toBeGreaterThan(1);
    expect(bounded.every(chunk => chunk.tokenCount <= 50)).toBe(true);
  });
});

describe('chunkTextByParagraphs', () => {
  const limits = { targetTokens: 20, maxTokens: 25 };

  it('keeps paragraph boundaries as the preferred split', () => {
    const paragraphs = ['A'.repeat(36), 'B'.repeat(36), 'C'.repeat(36)];
    expect(chunkTextByParagraphs(paragraphs.join('\n\n'), limits)).toEqual([
      `${paragraphs[0]}\n\n${paragraphs[1]}`,
      paragraphs[2],
    ]);
  });

  it('falls back from a large paragraph to sentence and word boundaries', () => {
    const paragraph = Array.from({ length: 40 }, (_, i) => `Sentence ${i} contains several words.`).join(' ');
    const chunks = chunkTextByParagraphs(paragraph, limits);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => estimateTextTokens(chunk) <= limits.maxTokens)).toBe(true);
    expect(chunks.join(' ')).toContain('Sentence 39 contains several words.');
  });

  it('hard-slices an unbroken token so minified or URL-like input cannot exceed the cap', () => {
    const unbroken = `https://example.com/${'a'.repeat(500)}`;
    const chunks = chunkTextByParagraphs(unbroken, limits);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => estimateTextTokens(chunk) <= limits.maxTokens)).toBe(true);
    expect(chunks.join('')).toBe(unbroken);
  });
});
