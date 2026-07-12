/**
 * check:scenarios — golden-scenario regression runner (conversation-engine
 * Req 10.3/10.4, Block F2; runs inside `npm run verify`).
 *
 * Executes every GraphScenario through the REAL ConversationEngine against
 * fakes only (P16: scripted classifier results, stable-vector embeddings,
 * injectable clock — zero AI spend, deterministic). Each graph's scenarios run
 * against the document that graph would serve: the active version when one is
 * published, else the draft. Archived graphs are skipped (reported).
 *
 * Failures print the readable path diff (Req 10.3). One-action re-baseline
 * (Req 10.4): `npm run check:scenarios -- --rebaseline` repins every DIVERGED
 * scenario's expectedPath to the new actual path (structural errors and
 * empty traversals are never repinned — those need editing, not silencing).
 * Optional `--graph <id>` scopes to one graph.
 *
 * Exit code 0 = all scenarios pass (or none exist); 1 = any failure/error.
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { PrismaClient } from '@prisma/client';
import { runScenario } from '../src/lib/ai/engine/scenario';
import { DEFAULT_PROBE_PATTERNS } from '../src/lib/services/ai/probe-patterns';

const prisma = new PrismaClient();

const rebaseline = process.argv.includes('--rebaseline');
const graphFlagIdx = process.argv.indexOf('--graph');
const graphFilter = graphFlagIdx >= 0 ? process.argv[graphFlagIdx + 1] : undefined;

let failures = 0;

async function main() {
  const graphs = await prisma.conversationGraph.findMany({
    where: graphFilter ? { id: graphFilter } : {},
    select: {
      id: true,
      name: true,
      status: true,
      draftDocument: true,
      activeVersionId: true,
      scenarios: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const withScenarios = graphs.filter((g) => g.scenarios.length > 0);
  if (withScenarios.length === 0) {
    console.log(`✅ check:scenarios — no golden scenarios exist${graphFilter ? ' for this graph' : ''} (nothing to run)`);
    return;
  }

  for (const graph of withScenarios) {
    if (graph.status === 'archived') {
      console.log(`⏭️  ${graph.name} (${graph.id}) — archived, ${graph.scenarios.length} scenario(s) skipped`);
      continue;
    }

    // Run against what this graph would serve: active version, else draft.
    let document: unknown = graph.draftDocument;
    let targetLabel = 'draft';
    if (graph.activeVersionId) {
      const version = await prisma.conversationGraphVersion.findUnique({
        where: { id: graph.activeVersionId },
        select: { document: true, version: true },
      });
      if (version) {
        document = version.document;
        targetLabel = `v${version.version} (active)`;
      }
    }

    console.log(`\n📊 ${graph.name} — ${graph.scenarios.length} scenario(s) against ${targetLabel}`);
    for (const scenario of graph.scenarios) {
      const result = await runScenario({
        document,
        turns: scenario.turns,
        expectedPath: scenario.expectedPath,
        probePatterns: DEFAULT_PROBE_PATTERNS,
      });

      if (result.error) {
        failures++;
        console.log(`  ❌ ERROR ${scenario.name} — ${result.error}`);
        continue;
      }
      if (result.pass) {
        console.log(`  ✅ PASS  ${scenario.name} (${result.actualPath.join(' → ')})`);
        continue;
      }
      if (rebaseline && result.actualPath.length > 0) {
        await prisma.graphScenario.update({
          where: { id: scenario.id },
          data: { expectedPath: result.actualPath },
        });
        console.log(`  📌 REBASELINED ${scenario.name} → ${result.actualPath.join(' → ')}`);
        continue;
      }
      failures++;
      console.log(`  ❌ FAIL  ${scenario.name}`);
      for (const line of result.diff.split('\n')) console.log(`     ${line}`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    if (failures > 0) {
      console.log(`\n❌ check:scenarios — ${failures} failing scenario(s)${rebaseline ? '' : ' (re-baseline deliberate changes with --rebaseline)'}`);
      process.exit(1);
    }
    console.log(`\n✅ check:scenarios — all scenarios pass`);
  })
  .catch(async (err) => {
    console.error('check:scenarios crashed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
