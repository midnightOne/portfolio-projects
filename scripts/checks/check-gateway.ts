/**
 * check:gateway (verification spec task 2.1; access-and-cost Req 1.3, D33)
 *
 * Statically proves no cost-incurring route ships unwrapped:
 *  1. An explicit list of known cost-incurring routes must import + use withAIGateway.
 *  2. A heuristic scan flags any route.ts under src/app/api whose source matches
 *     cost-incurring patterns (provider SDK calls, provider HTTP endpoints, AI
 *     service entry points) but does not use withAIGateway.
 *
 * Exits nonzero with named-requirement messages on any violation.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.join(ROOT, 'src', 'app', 'api');

// Routes the access-and-cost spec names explicitly (Req 1.1) plus semantic starts.
const REQUIRED_WRAPPED = [
  'src/app/api/ai/chat/route.ts',
  'src/app/api/ai/chat/session/route.ts',
  'src/app/api/ai/openai/session/route.ts',
  'src/app/api/ai/elevenlabs/token/route.ts',
  'src/app/api/ai/google/session/route.ts',
  'src/app/api/ai/tools/execute/route.ts',
  'src/app/api/ai/analyze-job/route.ts',
  'src/app/api/admin/ai/edit-content/route.ts',
  'src/app/api/admin/ai/improve-content/route.ts',
  'src/app/api/admin/ai/process-prompt/route.ts',
  'src/app/api/admin/ai/suggest-tags/route.ts',
  'src/app/api/admin/semantic/processing/start/route.ts',
  'src/app/api/admin/semantic/regenerate/route.ts',
  'src/app/api/admin/semantic/bulk/regenerate/route.ts',
  'src/app/api/admin/semantic/force-reindex/route.ts',
  'src/app/api/admin/semantic/ingest/route.ts',
  'src/app/api/admin/semantic/batch/submit/route.ts',
  'src/app/api/admin/semantic/batch/[batchId]/process/route.ts',
  'src/app/api/admin/semantic/chunks/[id]/generate-summary/route.ts',
  'src/app/api/admin/semantic/chunks/[id]/ai-edit/route.ts',
  'src/app/api/mcp/route.ts',
];

// Routes the heuristic flags that are NOT cost-incurring — each entry needs a
// justification. If a route here starts making model calls, remove it and wrap it.
const HEURISTIC_ALLOWLIST: Record<string, string> = {
  'src/app/api/admin/ai/available-models/route.ts': 'lists configured models from DB; no provider token spend',
  'src/app/api/admin/ai/model-config/route.ts': 'model config CRUD; no provider token spend',
  'src/app/api/admin/ai/providers/route.ts': 'provider status listing; no token spend',
  'src/app/api/admin/ai/providers/refresh/route.ts': 'refreshes provider model lists (metadata API); no token spend',
  'src/app/api/admin/ai/test-connection/route.ts': 'connectivity check via provider models endpoint; no token spend',
  'src/app/api/admin/ai/voice-config/test/route.ts': 'config check via /models, /user, /voices metadata endpoints; no token spend',
  'src/app/api/admin/ai/elevenlabs/agents/route.ts': 'agent listing (metadata API); no token spend',
  'src/app/api/admin/ai/elevenlabs/voices/route.ts': 'voice listing (metadata API); no token spend',
  'src/app/api/ai/[provider]/agents/route.ts': 'agent listing (metadata API); no token spend',
  'src/app/api/admin/semantic/summary-config/route.ts': 'summary config CRUD/listing; generation happens via wrapped routes',
  'src/app/api/admin/semantic/processing/queue/route.ts': 'queue metadata only; spend starts via wrapped processing/start',
  'src/app/api/admin/semantic/processing/[operationId]/route.ts': 'pause/resume/cancel of an already-authorized wrapped operation',
  'src/app/api/admin/semantic/regenerate/[operationId]/route.ts': 'status/control of an already-authorized wrapped operation',
};

// Source patterns that mark a route as cost-incurring.
const COST_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /\.embeddings\.create\(/, why: 'direct embedding call' },
  { re: /\.chat\.completions\.create\(/, why: 'direct chat completion call' },
  { re: /api\.openai\.com/, why: 'OpenAI HTTP endpoint' },
  { re: /api\.elevenlabs\.io/, why: 'ElevenLabs HTTP endpoint' },
  { re: /api\.anthropic\.com/, why: 'Anthropic HTTP endpoint' },
  { re: /new OpenAI\(/, why: 'OpenAI client construction' },
  { re: /AIServiceManager/, why: 'AIServiceManager (model calls)' },
  { re: /getBudgetAwareAI|BudgetAwareAIOperations/, why: 'budget-aware AI operations' },
  { re: /getReasoningAdapter/, why: 'reasoning adapter' },
  { re: /SummaryGenerationService/, why: 'summary generation (model calls)' },
  { re: /StageBasedProcessingService|startProcessing/, why: 'semantic processing pipeline' },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name === 'route.ts') out.push(p);
  }
  return out;
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

console.log('check:gateway — no unguarded cost-incurring route (access-and-cost Req 1.3 / D33)\n');

// 1. Explicit list
console.log('Explicit route list:');
for (const rel of REQUIRED_WRAPPED) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    fail(`${rel}: file missing (spec Req 1.1 names this route)`);
    continue;
  }
  const src = fs.readFileSync(p, 'utf8');
  if (!src.includes('withAIGateway(')) {
    fail(`${rel}: does not use withAIGateway (Req 1.1)`);
  } else {
    console.log(`  ✓ ${rel}`);
  }
}

// 2. Heuristic scan
console.log('\nHeuristic scan of src/app/api/**/route.ts:');
let flagged = 0;
for (const p of walk(API_ROOT)) {
  const src = fs.readFileSync(p, 'utf8');
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  if (HEURISTIC_ALLOWLIST[rel]) continue;
  const hits = COST_PATTERNS.filter((c) => c.re.test(src));
  if (hits.length > 0 && !src.includes('withAIGateway(')) {
    fail(`${rel}: matches cost pattern(s) [${hits.map((h) => h.why).join('; ')}] without withAIGateway`);
    flagged++;
  }
}
if (flagged === 0) console.log('  ✓ no unwrapped cost-incurring routes detected');

if (failures > 0) {
  console.error(`\ncheck:gateway FAILED — ${failures} violation(s)`);
  process.exit(1);
}
console.log('\ncheck:gateway PASSED');
