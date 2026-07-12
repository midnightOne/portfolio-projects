/**
 * drill:semantic-reliability — semantic operation reliability gate
 * (semantic-content task 10; Requirements 3, 9; verification Requirements 5–7)
 *
 * The combined HTTP-level acceptance drill that gates scope:'all' enablement:
 *   1. Multi-project scope:'all' ingest (kiln fixture with nested H2→H3 +
 *      three drill projects) through the REAL pipeline (real AI, pennies).
 *   2. Deliberate SSE disconnect mid-run; completion with NO subscriber;
 *      durable terminal status; queue API and reconnected-SSE snapshot agree.
 *   3. Child-content edit → scope:'section' regeneration: ancestor chain
 *      (parent T2s + T1) re-summarized cumulatively and re-embedded while
 *      unrelated sibling sections are untouched.
 *   4. Unified-ledger correlation (AIUsageLog.metadata.operationId).
 *
 * Prereqs: dev server on :3000, seeded fixture (npm run seed:fixture),
 * ADMIN_USERNAME/ADMIN_PASSWORD in env, real provider keys.
 * Blast radius: non-drill PUBLIC projects are temporarily privatized and
 * restored. Follow with `npm run check:semantic` (drill leaves the fixture
 * canonical and fully re-ingested).
 *
 * Run: npm run drill:semantic-reliability
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { PrismaClient } from '@prisma/client';
import {
  DRILL_PROJECTS,
  FIXTURE_SLUG,
  seedDrillProjects,
  cleanupDrillProjects,
  privatizeNonDrillProjects,
} from './drill-fixtures';

const BASE = process.env.DRILL_BASE_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

let failures = 0;
function assert(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// ---------- minimal cookie jar ----------
const jar = new Map<string, string>();
function storeCookies(res: Response) {
  const setCookies = (res.headers as any).getSetCookie?.() ?? [];
  for (const line of setCookies as string[]) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
function cookieHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
async function http(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { cookie: cookieHeader(), ...(init.headers ?? {}) },
    redirect: 'manual',
  });
  storeCookies(res);
  return res;
}

async function adminLogin(): Promise<void> {
  const strip = (v?: string) => (v ?? '').replace(/^['"]|['"]$/g, '');
  const username = strip(process.env.ADMIN_USERNAME);
  const password = strip(process.env.ADMIN_PASSWORD);
  if (!username || !password) throw new Error('ADMIN_USERNAME/ADMIN_PASSWORD not in env');

  const csrfRes = await http('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  const body = new URLSearchParams({ csrfToken, username, password, json: 'true' });
  const loginRes = await http('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
    body: body.toString(),
  });
  const hasSession = [...jar.keys()].some(k => k.includes('session-token'));
  if (!hasSession) {
    throw new Error(`Admin login failed (status ${loginRes.status}) — check ADMIN_USERNAME/ADMIN_PASSWORD`);
  }
  console.log('🔑 Admin session established');
}

// ---------- SSE helpers ----------
interface SSEEvent { [key: string]: any }
/** Read up to maxEvents SSE events then abort (the deliberate disconnect). */
async function readSSE(path: string, maxEvents: number, timeoutMs = 30_000): Promise<{ events: SSEEvent[]; streamEnded: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: SSEEvent[] = [];
  let streamEnded = false;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie: cookieHeader(), accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE request failed: ${res.status}`);
    const reader = (res.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { streamEnded = true; break; }
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
        if (dataLine) events.push(JSON.parse(dataLine.slice(6)));
        if (events.length >= maxEvents) {
          controller.abort(); // deliberate client disconnect
          return { events, streamEnded };
        }
      }
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') throw e;
  } finally {
    clearTimeout(timer);
  }
  return { events, streamEnded };
}

async function pollQueueUntilTerminal(operationId: string, timeoutMs = 8 * 60_000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await http('/api/admin/semantic/processing/queue?includeChildren=true');
    const data = await res.json() as { jobs: any[] };
    const job = data.jobs?.find(j => j.operationId === operationId);
    if (job && (job.status === 'completed' || job.status === 'failed')) return { job, all: data.jobs };
    if (Date.now() > deadline) throw new Error(`Timeout waiting for ${operationId} (last: ${job?.status})`);
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function pollRegenerationUntilTerminal(operationId: string, timeoutMs = 5 * 60_000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await http(`/api/admin/semantic/regenerate/${operationId}`);
    if (res.ok) {
      const progress = await res.json() as any;
      if (progress.status === 'completed' || progress.status === 'failed') return progress;
    }
    if (Date.now() > deadline) throw new Error(`Timeout waiting for regeneration ${operationId}`);
    await new Promise(r => setTimeout(r, 2000));
  }
}

// ---------- chunk snapshots ----------
interface ChunkStamp { chunkId: string; updatedAt: Date; embeddedAt: Date | null; content: string; metadata: any }
async function stampChunks(slug: string, chunkIds: string[]): Promise<Map<string, ChunkStamp>> {
  const rows = await prisma.$queryRaw<Array<{ chunk_id: string; updated_at: Date; embedding_generated_at: Date | null; content: string; metadata: any }>>`
    SELECT c.chunk_id, c.updated_at, c.embedding_generated_at, c.content, c.metadata
    FROM context_chunks c JOIN content_entities e ON e.id = c.entity_id
    WHERE e.slug = ${slug} AND c.chunk_id = ANY(${chunkIds})`;
  return new Map(rows.map(r => [r.chunk_id, {
    chunkId: r.chunk_id, updatedAt: r.updated_at, embeddedAt: r.embedding_generated_at,
    content: r.content, metadata: r.metadata,
  }]));
}

const CELADON_MARKER = 'Drill edit sentinel: chrome-tin celadon variant logged for the reliability drill.';

async function main() {
  console.log('🧪 drill:semantic-reliability — combined acceptance drill (task 10)');

  // Server up?
  try {
    await fetch(`${BASE}/api/auth/csrf`);
  } catch {
    throw new Error(`Dev server not reachable at ${BASE} — start it first (launch.json 'dev')`);
  }

  await adminLogin();
  await seedDrillProjects(prisma);

  const kiln = await prisma.project.findUnique({
    where: { slug: FIXTURE_SLUG },
    include: { articleContent: true },
  });
  if (!kiln?.articleContent) throw new Error('Kiln fixture missing — run npm run seed:fixture first');
  const originalArticle = kiln.articleContent.content;

  const restoreVisibility = await privatizeNonDrillProjects(prisma);

  try {
    // ---- 1. scope:'all' multi-project ingest, real pipeline ----
    console.log('\n— Step 1: scope-all ingest (4 projects, real AI) —');
    const stages = ['chunking', 'summaries', 'embeddings', 'validation']
      .map(stage => ({ stage, enabled: true, mode: 'immediate' }));
    const startRes = await http('/api/admin/semantic/processing/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader() },
      body: JSON.stringify({ scope: 'all', stages }),
    });
    assert('start: scope-all accepted', startRes.status === 200, `status ${startRes.status}`);
    const { operationId } = await startRes.json() as { operationId: string };
    console.log(`   operationId: ${operationId}`);

    // ---- 2. SSE attach → deliberate disconnect mid-run ----
    const early = await readSSE(`/api/admin/semantic/processing/${operationId}?sse=true`, 2);
    assert('sse: received live events before disconnect', early.events.length >= 1
      && early.events[0].operationId === operationId,
      `events=${early.events.length}`);
    console.log('   SSE deliberately disconnected mid-run; waiting for completion with NO subscriber…');

    // ---- completion observed via durable queue projection only ----
    const { job, all } = await pollQueueUntilTerminal(operationId);
    assert('queue: parent completed without any SSE subscriber', job.status === 'completed', `status ${job.status}: ${job.error ?? ''}`);
    const children = all.filter((j: any) => j.parentId === operationId);
    assert('queue: 4 durable child operations, all completed', children.length === 4
      && children.every((c: any) => c.status === 'completed'),
      children.map((c: any) => `${c.operationId}:${c.status}`).join(', '));
    assert('queue: parent aggregates per-project outcomes', Array.isArray(job.childOutcomes)
      && job.childOutcomes.length === 4
      && job.childOutcomes.every((o: any) => o.status === 'completed' && o.chunksCreated > 0),
      JSON.stringify(job.childOutcomes?.map((o: any) => ({ p: o.projectSlug, s: o.status, n: o.chunksCreated }))));

    // ---- reconnect: SSE snapshot must equal persisted/queue state ----
    const reconnect = await readSSE(`/api/admin/semantic/processing/${operationId}?sse=true`, 5, 15_000);
    const snap = reconnect.events[0];
    assert('sse reconnect: first event is persisted terminal snapshot', !!snap
      && snap.status === 'completed' && snap.operationId === operationId
      && snap.overallProgress === 100 && !!snap.completedAt,
      JSON.stringify({ status: snap?.status, overall: snap?.overallProgress }));
    assert('sse reconnect: stream closes after terminal snapshot', reconnect.streamEnded === true
      && reconnect.events.length === 1, `events=${reconnect.events.length}, ended=${reconnect.streamEnded}`);
    assert('sse snapshot equals queue projection', !!snap
      && snap.status === job.status
      && Math.round(snap.overallProgress) === Math.round(job.progress.overallProgress)
      && new Date(snap.completedAt).getTime() === new Date(job.progress.completedAt).getTime(),
      JSON.stringify({ sse: [snap?.status, snap?.overallProgress, snap?.completedAt], queue: [job.status, job.progress.overallProgress, job.progress.completedAt] }));

    // ---- ledger correlation ----
    const ledgerRows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM ai_usage_logs
      WHERE feature = 'semantic' AND metadata->>'operationId' LIKE ${operationId + '%'}`;
    assert('ledger: usage rows correlated to this operation (parent/children)', Number(ledgerRows[0].n) > 0,
      `rows=${ledgerRows[0].n}`);

    // ---- 3. child-content edit → ancestor invalidation ----
    console.log('\n— Step 3: child H3 edit → scope-section regeneration with ancestor chain —');
    const watched = ['celadon-iron-chemistry', 'glaze-chemistry-database', 'chrono-kiln-controller', 'thermal-control-system', 'summary', 't3-celadon-iron-chemistry-0'];
    const before = await stampChunks(FIXTURE_SLUG, watched);

    const editedArticle = originalArticle.replace(
      'replacing folklore with reproducible chemistry.',
      `replacing folklore with reproducible chemistry. ${CELADON_MARKER}`
    );
    if (editedArticle === originalArticle) throw new Error('Edit anchor text not found in fixture article');
    const { toTiptap } = await import('./drill-fixtures');
    await prisma.articleContent.update({
      where: { projectId: kiln.id },
      data: { content: editedArticle, jsonContent: toTiptap(editedArticle) },
    });

    const regenRes = await http('/api/admin/semantic/regenerate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader() },
      body: JSON.stringify({ scope: 'section', projectId: kiln.id, sectionId: 'celadon-iron-chemistry' }),
    });
    assert('regenerate: section-scope accepted', regenRes.status === 200, `status ${regenRes.status}`);
    const { operationId: regenId } = await regenRes.json() as { operationId: string };
    const regenProgress = await pollRegenerationUntilTerminal(regenId);
    assert('regenerate: completed', regenProgress.status === 'completed', JSON.stringify(regenProgress.errors ?? []));

    const after = await stampChunks(FIXTURE_SLUG, watched);
    const advanced = (id: string) => {
      const b = before.get(id); const a = after.get(id);
      return !!b?.embeddedAt && !!a?.embeddedAt && a.embeddedAt.getTime() > b.embeddedAt.getTime();
    };
    assert('edit: celadon T3 carries the new content', !!after.get('t3-celadon-iron-chemistry-0')?.content.includes(CELADON_MARKER));
    assert('edit: celadon T2 re-embedded', advanced('celadon-iron-chemistry'));
    assert('edit: parent T2 (glaze) re-summarized + re-embedded', advanced('glaze-chemistry-database')
      && (after.get('glaze-chemistry-database')?.metadata?.summarySource?.childChunkIds ?? []).includes('celadon-iron-chemistry'),
      JSON.stringify(after.get('glaze-chemistry-database')?.metadata?.summarySource));
    assert('edit: grandparent T2 (chrono) re-embedded', advanced('chrono-kiln-controller'));
    assert('edit: T1 re-embedded', advanced('summary'));
    assert('edit: unrelated sibling (thermal) untouched', !advanced('thermal-control-system'),
      `before=${before.get('thermal-control-system')?.embeddedAt}, after=${after.get('thermal-control-system')?.embeddedAt}`);

    // ---- revert the edit and restore canonical fixture state ----
    console.log('\n— Step 4: revert edit, regenerate back to canonical —');
    await prisma.articleContent.update({
      where: { projectId: kiln.id },
      data: { content: originalArticle, jsonContent: toTiptap(originalArticle) },
    });
    const revertRes = await http('/api/admin/semantic/regenerate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader() },
      body: JSON.stringify({ scope: 'section', projectId: kiln.id, sectionId: 'celadon-iron-chemistry' }),
    });
    const { operationId: revertId } = await revertRes.json() as { operationId: string };
    const revertProgress = await pollRegenerationUntilTerminal(revertId);
    assert('revert: regeneration completed', revertProgress.status === 'completed');
    const reverted = await stampChunks(FIXTURE_SLUG, ['t3-celadon-iron-chemistry-0']);
    assert('revert: celadon T3 back to canonical', !reverted.get('t3-celadon-iron-chemistry-0')?.content.includes(CELADON_MARKER));

  } finally {
    await restoreVisibility();
    // Always restore the canonical article even if the drill failed mid-edit
    await prisma.articleContent.update({
      where: { projectId: kiln.id },
      data: { content: originalArticle, jsonContent: (await import('./drill-fixtures')).toTiptap(originalArticle) },
    }).catch(() => {});
  }

  if (!process.argv.includes('--keep')) {
    await cleanupDrillProjects(prisma);
    console.log('ℹ️  Drill projects/entities/operations cleaned up (pass --keep to retain)');
  }

  console.log(failures === 0 ? '\n🎉 drill:semantic-reliability PASSED — follow with npm run check:semantic'
    : `\n💥 drill:semantic-reliability FAILED (${failures} assertion(s))`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('❌ drill:semantic-reliability crashed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
