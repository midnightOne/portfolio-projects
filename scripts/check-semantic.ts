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
 *     (requires the configured embedding provider's API key — see the
 *     default-embedding alias; pass --no-live to skip)
 *
 * Exit code 0 = all assertions pass; 1 = any failure.
 */

// Load env the way the app does (.env AND .env.local — provider keys live in
// .env.local; Prisma's auto-load only reads .env, which silently degraded the
// live query to FTS-only after the embedding provider moved to Google).
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

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
  metadata: any;
  embedding_model: string | null;
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
           c.parent_chunk_id, c.root_chunk_id, c.metadata, c.embedding_model,
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

  // Fake-contamination tripwire (owner ruling 2026-07-12: real ingestion/
  // embedding/retrieval must ALWAYS work — fake test doubles may never linger
  // in the index). Runs in --no-live mode too, so `npm run verify` fails loudly
  // if a fake-mode run ever overwrote the fixture (this happened once and
  // passed silently). Recovery: `npm run livefire:semantic`.
  const models = [...new Set(chunks.filter(c => c.has_embedding).map(c => c.embedding_model ?? 'unrecorded'))];
  assert('fixture embeddings are REAL (no fake-embedding vectors)',
    !models.includes('fake-embedding'), `models: ${models.join(', ')} — re-ingest with npm run livefire:semantic`);
  assert('fixture embeddings all come from ONE model (no drift)',
    models.length === 1, `models: ${models.join(', ')} — mixed vectors are not comparable; re-ingest`);

  // DB-wide: no entity may carry fake vectors — drills clean up after
  // themselves; residue anywhere means a fake-mode run leaked into the index
  const fakeResidue = await prisma.$queryRaw<Array<{ slug: string; n: bigint }>>`
    SELECT e.slug, count(*) AS n FROM context_chunks c
    JOIN content_entities e ON e.id = c.entity_id
    WHERE c.embedding_model = 'fake-embedding'
    GROUP BY e.slug`;
  assert('no fake-embedding residue anywhere in the index',
    fakeResidue.length === 0,
    fakeResidue.map(r => `${r.slug} (${r.n})`).join(', ') + ' — delete or re-ingest these entities');

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

  // Cumulative parent T2 summaries (semantic-content Req 9.3 / task 9):
  // a T2 with child sections must represent its whole subtree — either an AI
  // summary whose recorded provenance includes every child, or verbatim
  // auto-populated subtree content. "Covers:" heading lists are allowed only
  // for truly empty subtrees (never here — fixture children have content).
  const byChunkId = new Map(chunks.map(c => [c.chunk_id, c]));
  for (const parent of (expected.cumulativeParents ?? []) as Array<{ chunkId: string; expectedChildren: string[] }>) {
    const t2 = byTier(2).find(c => c.chunk_id === parent.chunkId);
    assert(`cumulative parent T2 "${parent.chunkId}" exists`, !!t2);
    if (!t2) continue;

    assert(`parent T2 "${parent.chunkId}" content is real (no placeholder, no "Covers:" list)`,
      t2.content.length >= 50 && !t2.content.includes('[TO BE GENERATED') && !/^Covers:/.test(t2.content),
      `content starts: "${t2.content.slice(0, 60)}"`);

    // Child T2 rows link to this parent
    const linkedChildren = byTier(2).filter(c => c.parent_chunk_id === t2.id).map(c => c.chunk_id);
    const missingLinks = parent.expectedChildren.filter(id => !linkedChildren.includes(id));
    assert(`parent T2 "${parent.chunkId}" is linked parent of [${parent.expectedChildren.join(', ')}]`,
      missingLinks.length === 0, `missing links: ${missingLinks.join(', ')}`);

    // Cumulative coverage: AI summaries record child provenance; verbatim
    // auto-population must contain each child's subtree text
    const provenance: string[] | undefined = t2.metadata?.summarySource?.childChunkIds;
    if (t2.metadata?.autoPopulated) {
      const missingContent = parent.expectedChildren.filter(childId => {
        const child = byChunkId.get(childId);
        return !child || !t2.content.includes(child.content.slice(0, 80));
      });
      assert(`auto-populated parent "${parent.chunkId}" contains child content`,
        missingContent.length === 0, `missing: ${missingContent.join(', ')}`);
    } else {
      const covered = parent.expectedChildren.filter(id => provenance?.includes(id));
      assert(`AI parent "${parent.chunkId}" summary provenance covers children`,
        covered.length === parent.expectedChildren.length,
        `provenance=${JSON.stringify(provenance)}, expected ${JSON.stringify(parent.expectedChildren)}`);
    }
  }

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
  } else if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    // Which key is required depends on the default-embedding alias's provider
    assert('canonical query (needs the embedding provider key)', false, 'no provider key in env; use --no-live to skip intentionally');
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
