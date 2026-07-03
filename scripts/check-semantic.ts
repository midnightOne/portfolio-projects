/**
 * check:semantic — executable acceptance check (verification spec Req 2.3 / 6.1)
 *
 * Asserts the fixture project's ingested semantic state against
 * fixtures/expected-semantic.json:
 *   - tier counts (T0/T1 exact, T2 exact, T3 within tolerance)
 *   - every chunk has an embedding
 *   - parent/root linkage is valid (no dangling references, correct hierarchy)
 *   - T3 titles derive from their parent T2 section titles
 *   - canonical retrieval query ranks the fixture's expected section first
 *     (requires OPENAI_API_KEY for the query embedding; pass --no-live to skip)
 *
 * Exit code 0 = all assertions pass; 1 = any failure.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const skipLive = process.argv.includes('--no-live');

interface ChunkRow {
  id: string;
  tier: number;
  chunk_id: string;
  title: string | null;
  content: string;
  section_group: string | null;
  parent_chunk_id: string | null;
  root_chunk_id: string | null;
  has_embedding: boolean;
}

let failures = 0;
function assert(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main() {
  const expected = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'expected-semantic.json'), 'utf-8')
  );
  const slug = expected.fixtureSlug;

  const chunks = await prisma.$queryRaw<ChunkRow[]>`
    SELECT c.id, c.tier, c.chunk_id, c.title, c.content, c.section_group,
           c.parent_chunk_id, c.root_chunk_id,
           (c.embedding_vector IS NOT NULL) as has_embedding
    FROM context_chunks c
    JOIN content_entities e ON e.id = c.entity_id
    WHERE e.slug = ${slug}`;

  assert(`fixture entity has chunks (found ${chunks.length})`, chunks.length > 0,
    `no chunks for slug "${slug}" — run seed:fixture and ingest first`);
  if (chunks.length === 0) return;

  const byTier = (t: number) => chunks.filter(c => c.tier === t);

  assert(`T0 count == ${expected.tiers.t0Count}`, byTier(0).length === expected.tiers.t0Count, `got ${byTier(0).length}`);
  assert(`T1 count == ${expected.tiers.t1Count}`, byTier(1).length === expected.tiers.t1Count, `got ${byTier(1).length}`);
  assert(`T2 count == ${expected.tiers.t2Count}`, byTier(2).length === expected.tiers.t2Count, `got ${byTier(2).length}`);
  const t3n = byTier(3).length;
  assert(`T3 count ${expected.tiers.t3Count} ± ${expected.tiers.t3Tolerance}`,
    Math.abs(t3n - expected.tiers.t3Count) <= expected.tiers.t3Tolerance, `got ${t3n}`);
  assert('no tier-4+ chunks (T0–T3 model, D27)', chunks.every(c => c.tier <= 3),
    `tiers present: ${[...new Set(chunks.map(c => c.tier))].join(',')}`);

  const missingEmb = chunks.filter(c => !c.has_embedding);
  assert('every chunk has an embedding', missingEmb.length === 0,
    `missing: ${missingEmb.map(c => c.chunk_id).join(', ')}`);

  const t1 = byTier(1)[0];
  assert('T1 summary is real generated content', !!t1 && t1.content.length >= expected.t1MinContentLength
    && !t1.content.includes('[TO BE GENERATED'), t1 ? `len=${t1.content.length}` : 'missing');

  const groups = new Set(byTier(2).map(c => c.section_group));
  const missingGroups = expected.t2SectionGroups.filter((g: string) => !groups.has(g));
  assert('T2 section groups match content headings', missingGroups.length === 0,
    `missing: ${missingGroups.join(', ')}`);

  // Linkage: every parent_chunk_id resolves to a chunk of this entity; roots point at T0
  const idSet = new Set(chunks.map(c => c.id));
  const t0Id = byTier(0)[0]?.id;
  const badParents = chunks.filter(c => c.parent_chunk_id && !idSet.has(c.parent_chunk_id));
  assert('parent linkage valid (no dangling parent ids)', badParents.length === 0,
    `dangling: ${badParents.map(c => c.chunk_id).join(', ')}`);
  const badRoots = chunks.filter(c => c.root_chunk_id && c.root_chunk_id !== t0Id);
  assert('root linkage points at T0', badRoots.length === 0,
    `wrong root: ${badRoots.map(c => c.chunk_id).join(', ')}`);

  // T3 titles derive from parent T2 titles
  const byId = new Map(chunks.map(c => [c.id, c]));
  const badT3Titles = byTier(3).filter(c => {
    const parent = c.parent_chunk_id ? byId.get(c.parent_chunk_id) : undefined;
    return !parent || parent.tier !== 2 || c.title !== parent.title;
  });
  assert('T3 titles derive from parent T2 sections', badT3Titles.length === 0,
    `mismatched: ${badT3Titles.map(c => c.chunk_id).join(', ')}`);

  // Canonical retrieval query through the real search service
  if (skipLive) {
    console.log('⏭️  SKIP  canonical query (--no-live)');
  } else if (!process.env.OPENAI_API_KEY) {
    assert('canonical query (needs OPENAI_API_KEY)', false, 'no key in env; use --no-live to skip intentionally');
  } else {
    const { ContentSearchService } = await import('../src/lib/content/ContentSearchService');
    const search = new ContentSearchService();
    const result = await search.searchContentInternal({
      query: expected.canonicalQuery.query,
      k: 5,
      maxTier: 3,
    });
    const top = result.items[0];
    assert(`canonical query top hit is from ${expected.canonicalQuery.expectedTopSlug}`,
      !!top && top.project === expected.canonicalQuery.expectedTopSlug,
      top ? `got ${top.project} ("${top.title}")` : 'no results');

    // The absolute top hit may legitimately be the T1 project summary (importance-weighted
    // ranking favors T1 by design); the expected *section* must be the best tier>=2 hit.
    const topSection = result.items
      .map(i => ({ item: i, chunk: byId.get(i.id) }))
      .find(x => x.chunk && x.chunk.tier >= 2);
    const sectionOk = !!topSection && (
      topSection.chunk!.section_group === expected.canonicalQuery.expectedSectionGroup
      || topSection.chunk!.chunk_id.includes(expected.canonicalQuery.expectedSectionGroup));
    assert(`canonical query best section hit is ${expected.canonicalQuery.expectedSectionGroup}`,
      sectionOk, topSection ? `got ${topSection.chunk!.chunk_id}` : 'no tier>=2 results');
  }

  console.log(failures === 0 ? '\n🎉 check:semantic PASSED' : `\n💥 check:semantic FAILED (${failures} assertion(s))`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('❌ check:semantic crashed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
