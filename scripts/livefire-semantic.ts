/**
 * livefire:semantic — real ingestion of the fixture project through the real
 * pipeline with capped spend (verification spec task 7.1 / Requirement 7).
 *
 * Runs the four-stage stage-based pipeline (chunk → summarize → embed →
 * validate) for `verification-fixture-kiln` with REAL providers (summaries via
 * the secondary-LLM job module, embeddings via the default-embedding alias),
 * observes completion through the durable operation row, reports per-stage
 * outcomes + ledgered spend, and enforces a hard cost cap. Follow with
 * `npm run check:semantic` for the acceptance assertions.
 *
 * Refuses to run under AI_FAKE_MODE — a live-fire run that fakes providers is
 * not a live-fire run (pass --allow-fake to override for plumbing tests).
 *
 * Run: npm run livefire:semantic
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FIXTURE_SLUG = 'verification-fixture-kiln';
const COST_CAP_USD = 0.5;

async function main() {
  if (process.env.AI_FAKE_MODE && !process.argv.includes('--allow-fake')) {
    console.error(`❌ AI_FAKE_MODE='${process.env.AI_FAKE_MODE}' is set — live-fire requires real providers (--allow-fake to override).`);
    process.exit(1);
  }

  const project = await prisma.project.findUnique({ where: { slug: FIXTURE_SLUG } });
  if (!project) {
    console.error('❌ Fixture project missing — run `npm run seed:fixture` first.');
    process.exit(1);
  }

  const operationId = `stage-proc-livefire-${Date.now()}`;
  console.log(`🔥 livefire:semantic — real ingestion of ${FIXTURE_SLUG} (op ${operationId}, cap $${COST_CAP_USD})`);

  const { getProcessingService } = await import('../src/lib/content/StageBasedProcessingServiceSingleton');
  const service = getProcessingService();
  await service.startProcessing({
    operationId,
    scope: 'project',
    projectId: project.id,
    stages: (['chunking', 'summaries', 'embeddings', 'validation'] as const)
      .map(stage => ({ stage, enabled: true, mode: 'immediate' as const })),
  });

  // Observe via the durable row (the same projection the queue serves)
  const deadline = Date.now() + 10 * 60_000;
  let row;
  for (;;) {
    row = await prisma.semanticProcessingOperation.findUnique({ where: { id: operationId } });
    if (row && (row.status === 'completed' || row.status === 'failed')) break;
    if (Date.now() > deadline) {
      console.error('❌ Timeout waiting for operation to reach a terminal state.');
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  // Report: per-stage outcomes + spend
  const stageProgress = (row!.stageProgress ?? {}) as Record<string, any>;
  console.log('\n— Stage outcomes —');
  for (const [stage, sp] of Object.entries(stageProgress)) {
    console.log(`  ${stage.padEnd(11)} ${String(sp.status).padEnd(10)} ${sp.itemsProcessed}/${sp.totalItems} items${sp.errors?.length ? `  errors: ${sp.errors.join('; ')}` : ''}`);
  }

  const ledger = await prisma.$queryRaw<Array<{ usage_type: string; n: bigint; cost: number }>>`
    SELECT usage_type, count(*) AS n, COALESCE(sum(cost_usd), 0)::float AS cost
    FROM ai_usage_logs
    WHERE feature = 'semantic' AND metadata->>'operationId' = ${operationId}
    GROUP BY usage_type`;
  const ledgerCost = ledger.reduce((s, r) => s + r.cost, 0);
  console.log('\n— Ledger (correlated to this operation) —');
  for (const r of ledger) console.log(`  ${r.usage_type.padEnd(11)} ${r.n} rows  $${r.cost.toFixed(4)}`);
  console.log(`  operation costAccumulated: $${Number(row!.costAccumulated).toFixed(4)}`);

  const totalCost = Math.max(Number(row!.costAccumulated), ledgerCost);
  if (totalCost > COST_CAP_USD) {
    console.error(`\n💥 SPEND CAP EXCEEDED: $${totalCost.toFixed(4)} > $${COST_CAP_USD} — investigate before re-running.`);
    process.exit(1);
  }

  if (row!.status !== 'completed') {
    console.error(`\n💥 livefire:semantic FAILED — operation ${row!.status}: ${row!.error ?? 'see stage errors above'}`);
    process.exit(1);
  }

  console.log(`\n🎉 livefire:semantic PASSED — real ingestion completed for $${totalCost.toFixed(4)}. Next: npm run check:semantic`);
}

main()
  .catch((e) => { console.error('❌ livefire:semantic crashed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
