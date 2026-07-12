/**
 * drill:scope-all — deterministic four-project scope:'all' acceptance drill
 * (semantic-content tasks 6.2.2 + 6.3.2; Requirement 9.1/9.2/9.5)
 *
 * Proves, without ANY SSE subscriber attached:
 *  1. scope:'all' runs one durable CHILD operation per project; every
 *     resulting ContextChunk belongs to its source entity (marker-vocabulary
 *     cross-contamination check across 4 projects).
 *  2. An injected mid-run failure (project #2's scaffold throws) fails that
 *     child + the parent, leaves the other projects' chunks intact and
 *     isolated, and the terminal status is PERSISTED (readable from the
 *     durable row by a fresh service instance — the "reconnect" path).
 *  3. Re-running after the failure completes cleanly (idempotent upserts).
 *
 * Determinism/cost: AI_FAKE_MODE=embeddings (stable fake vectors) and an
 * in-script stub for AI summaries — this drill verifies persistence
 * topology, not summary quality (check:semantic covers real summaries).
 * Blast radius: all other PUBLIC projects are temporarily set PRIVATE so the
 * REAL scope-all enumeration sees exactly the 4 drill projects; visibility
 * is restored in a finally block. Dev-only. Run: npx tsx scripts/drill-scope-all.ts
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

process.env.AI_FAKE_MODE = [process.env.AI_FAKE_MODE, 'embeddings'].filter(Boolean).join(',');

import { PrismaClient } from '@prisma/client';
import {
  DRILL_PROJECTS,
  ALL_MARKERS,
  FIXTURE_SLUG,
  seedDrillProjects,
  cleanupDrillProjects,
  privatizeNonDrillProjects,
} from './drill-fixtures';

const prisma = new PrismaClient();

let failures = 0;
function assert(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function runScopeAll(operationId: string): Promise<void> {
  const { getProcessingService } = await import('../src/lib/content/StageBasedProcessingServiceSingleton');
  const service = getProcessingService();
  const stages = (['chunking', 'summaries', 'embeddings', 'validation'] as const).map(stage => ({
    stage, enabled: true, mode: 'immediate' as const,
  }));
  // Deliberately NO subscribeToProgress and NO SSE anywhere in this drill —
  // terminal status must land durably regardless (task 6.3)
  await service.startProcessing({ operationId, scope: 'all', stages });

  // Await completion via the DURABLE row only
  const deadline = Date.now() + 5 * 60_000;
  for (;;) {
    const row = await prisma.semanticProcessingOperation.findUnique({ where: { id: operationId } });
    if (row && (row.status === 'completed' || row.status === 'failed')) return;
    if (Date.now() > deadline) throw new Error(`Drill timeout waiting for ${operationId}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function assertIsolation(label: string, expectChunks: Record<string, boolean>) {
  for (const dp of DRILL_PROJECTS) {
    const chunks = await prisma.contextChunk.findMany({
      where: { entity: { entityType: 'PROJECT', slug: dp.slug } },
      select: { chunkId: true, content: true, tier: true },
    });

    if (expectChunks[dp.slug]) {
      assert(`[${label}] ${dp.slug}: has chunks (${chunks.length})`, chunks.length > 0);
      const t3s = chunks.filter(c => c.tier === 3);
      const ownMarkerOk = t3s.length > 0 && t3s.every(c => c.content.includes(dp.marker) || !ALL_MARKERS.some(m => c.content.includes(m)));
      assert(`[${label}] ${dp.slug}: T3 content derives from its own article`, ownMarkerOk,
        `t3s=${t3s.length}`);
    }

    // The critical isolation assertion: no chunk under this entity carries
    // another project's marker vocabulary
    const foreign = chunks.filter(c => ALL_MARKERS.some(m => m !== dp.marker && c.content.includes(m)));
    assert(`[${label}] ${dp.slug}: zero cross-project contamination`, foreign.length === 0,
      `contaminated: ${foreign.map(c => c.chunkId).join(', ')}`);
  }

  // Kiln fixture isolation: none of the drill markers may appear
  const kilnForeign = await prisma.contextChunk.findMany({
    where: {
      entity: { entityType: 'PROJECT', slug: FIXTURE_SLUG },
      OR: ALL_MARKERS.map(m => ({ content: { contains: m } })),
    },
    select: { chunkId: true },
  });
  assert(`[${label}] ${FIXTURE_SLUG}: zero drill-marker contamination`, kilnForeign.length === 0,
    kilnForeign.map(c => c.chunkId).join(', '));
}

async function main() {
  console.log('🧪 drill:scope-all — per-project persistence + durable status (no SSE subscriber)');

  // Stub AI summaries: deterministic, free. Persistence topology is under
  // test here, not summary quality.
  const { SummaryGenerationService } = await import('../src/lib/content/SummaryGenerationService');
  (SummaryGenerationService.prototype as any).generateSummary = async function (req: any) {
    return {
      summary: `Deterministic drill summary of ${String(req.sectionTitle ?? 'project')}: ${String(req.content).slice(0, 120)}`,
      tokensUsed: 10,
      cost: 0,
      confidenceScore: 1,
    };
  };

  await seedDrillProjects(prisma);

  // Blast-radius containment: scope-all must see EXACTLY our 4 projects
  const restoreVisibility = await privatizeNonDrillProjects(prisma);

  try {
    const { SmartContentGenerator } = await import('../src/lib/content/SmartContentGenerator');
    const realScaffold = SmartContentGenerator.prototype.generateScaffoldOnly;

    // ---- Run 1: injected mid-run failure on drill-beta ----
    console.log('\n— Run 1: scope-all with injected failure on drill-beta —');
    (SmartContentGenerator.prototype as any).generateScaffoldOnly = async function (project: any) {
      if (project?.slug === 'drill-beta') {
        throw new Error('DRILL: injected scaffold failure for drill-beta');
      }
      return realScaffold.call(this, project);
    };

    const op1 = `stage-proc-drill-fail-${Date.now()}`;
    await runScopeAll(op1);

    const parent1 = await prisma.semanticProcessingOperation.findUnique({ where: { id: op1 } });
    assert('run1: parent terminal status persisted as failed', parent1?.status === 'failed', `got ${parent1?.status}`);
    const children1 = await prisma.semanticProcessingOperation.findMany({ where: { parentId: op1 } });
    assert('run1: one durable child operation per project (4)', children1.length === 4, `got ${children1.length}`);
    const betaChild = children1.find(c => c.error?.includes('drill-beta') || c.status === 'failed');
    assert('run1: exactly one failed child (drill-beta)', children1.filter(c => c.status === 'failed').length === 1
      && !!betaChild?.error?.includes('DRILL: injected'), children1.map(c => `${c.id}:${c.status}`).join(', '));
    assert('run1: other children completed', children1.filter(c => c.status === 'completed').length === 3);
    const outcomes1 = Array.isArray(parent1?.childOutcomes) ? (parent1!.childOutcomes as any[]) : [];
    assert('run1: parent aggregates 4 immutable per-project outcomes', outcomes1.length === 4
      && outcomes1.filter(o => o.status === 'failed').length === 1);

    await assertIsolation('run1', { 'drill-alpha': true, 'drill-beta': false, 'drill-gamma': true });

    // "Reconnect" path: a FRESH service instance (empty in-memory maps) must
    // read the persisted terminal state — this is what SSE/queue serve after
    // a disconnect or restart (task 6.3.2)
    const { StageBasedProcessingService } = await import('../src/lib/content/StageBasedProcessingService');
    const freshService = new StageBasedProcessingService();
    const snapshot = await freshService.getProgressOrPersisted(op1);
    assert('run1: fresh-instance snapshot equals persisted terminal state',
      snapshot?.status === 'failed' && snapshot.operationId === op1
      && snapshot.errors.length > 0 && !!snapshot.completedAt,
      JSON.stringify({ status: snapshot?.status, errors: snapshot?.errors.length }));

    // ---- Run 2: recovery — same scope, no injection ----
    console.log('\n— Run 2: scope-all re-run after failure (recovery) —');
    (SmartContentGenerator.prototype as any).generateScaffoldOnly = realScaffold;

    const op2 = `stage-proc-drill-recover-${Date.now()}`;
    await runScopeAll(op2);

    const parent2 = await prisma.semanticProcessingOperation.findUnique({ where: { id: op2 } });
    assert('run2: parent completed', parent2?.status === 'completed', `got ${parent2?.status}: ${parent2?.error}`);
    const children2 = await prisma.semanticProcessingOperation.findMany({ where: { parentId: op2 } });
    assert('run2: all 4 children completed', children2.length === 4 && children2.every(c => c.status === 'completed'),
      children2.map(c => `${c.id}:${c.status}`).join(', '));

    await assertIsolation('run2', { 'drill-alpha': true, 'drill-beta': true, 'drill-gamma': true });

    // Embeddings persisted per entity
    for (const dp of DRILL_PROJECTS) {
      const missing = await prisma.$queryRaw<Array<{ chunk_id: string }>>`
        SELECT c.chunk_id FROM context_chunks c
        JOIN content_entities e ON e.id = c.entity_id
        WHERE e.slug = ${dp.slug} AND c.embedding_vector IS NULL`;
      assert(`run2: ${dp.slug} fully embedded`, missing.length === 0, missing.map(m => m.chunk_id).join(', '));
    }
  } finally {
    await restoreVisibility();
  }

  // Cleanup drill artifacts (projects, entities, operations) unless --keep
  if (!process.argv.includes('--keep')) {
    await cleanupDrillProjects(prisma);
    console.log('ℹ️  Drill projects/entities/operations cleaned up (pass --keep to retain)');
  }

  console.log(failures === 0 ? '\n🎉 drill:scope-all PASSED' : `\n💥 drill:scope-all FAILED (${failures} assertion(s))`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('❌ drill:scope-all crashed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
