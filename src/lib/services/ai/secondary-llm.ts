/**
 * Secondary-LLM job infrastructure (conversation-engine Block M1 — Req 16.4
 * clarified; registry D4/D33).
 *
 * ONE consumption path for every lightweight "second brain" job the harness
 * runs beside a conversation. The pattern was proven three times before it was
 * extracted (P26 batched cheap call, J3 behavior summarizer, I1 batch
 * embedding); it is now REQUIRED for every new secondary-LLM feature — safety
 * investigation (L2), JD analysis (G3), the deferred suggestion generators
 * (M4/M5). No bespoke plumbing per feature.
 *
 * What the module owns (the parts that were identical across consumers):
 *  - alias resolution (D4): jobs name a registry role alias, never a model id;
 *  - metering (D33): every completion is ledgered — even one that finished
 *    AFTER the caller's timeout gave up on it (the spend happened regardless);
 *    gateway-context consumers pass their own `meter` so tier/reflink
 *    attribution stays with the request;
 *  - JSON-forced schema: prompt promises one JSON object; the response goes
 *    through the shared defensive parse (llm-json.ts) + the caller's Zod
 *    schema; garbage output degrades the feature, never the caller's turn;
 *  - timeout discipline: a hard cap races the call (P10-style); on timeout the
 *    job reports `timedOut` and the caller fails safe.
 *
 * What stays with the CONSUMER (the parts that genuinely diverge — the M1
 * refactor rule):
 *  - in-flight guards + staleness intervals: async jobs own an ATOMIC claim in
 *    durable state before calling here (the P29/P33 pattern —
 *    `claimSummarizerRun` is the reference implementation; a flood of triggers
 *    must produce ONE running job, and the claim must be CAS'd in the DB, not
 *    guarded in process memory, D43);
 *  - async posture: fire-and-forget jobs never block a turn; the caller
 *    decides what "late" means for its feature (P29's one-turn lag contract);
 *  - prompt construction: pure per-feature modules (cheap-call.ts,
 *    summarizer.ts) so prompts stay testable without a model.
 *
 * Embedding variant: `runMeteredEmbeddingBatch` is the same pattern for
 * embedding jobs (alias-resolved model, budget gate, ledger row) — the I1
 * question batch consumes it; M4's cluster scoring would too.
 */

import type { z } from 'zod';
import {
  getReasoningAdapter,
  getReasoningAdapterForAliasOrModel,
  type ReasoningMessage,
} from '@/lib/ai/reasoning';
import type { ModelAliasName } from '@/lib/ai/model-registry';
import { parseJsonWithSchema } from '@/lib/ai/llm-json';
import { recordUsage, type LedgerFeature } from '@/lib/ai/ledger';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { estimateCost } from '@/lib/ai/pricing';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export interface SecondaryLLMMeterInput {
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  /** False when the response never parsed against the schema (or timed out first). */
  ok: boolean;
  timedOut: boolean;
}

export interface SecondaryLLMJobSpec<Schema extends z.ZodTypeAny> {
  /** D4 registry role alias — never a model id (D38). */
  alias: ModelAliasName;
  /**
   * Admin-supplied override that may be a role alias or a pinned model id
   * (resolved via resolveAliasOrModelId, same as the admin editing endpoints).
   * When set it wins over `alias`; `alias` remains the feature's default role.
   * Only for surfaces where the owner explicitly picks a model (e.g. the
   * semantic dashboard's custom-model summary regeneration) — features
   * themselves keep naming aliases (D4).
   */
  modelOverride?: string;
  /** Single user prompt or a full message array (system + user). */
  prompt: string | ReasoningMessage[];
  /** JSON-forced response shape; parse failure → result null, never a throw. */
  schema: Schema;
  /** Ledger usage type for the default meter (e.g. 'engine_classifier'). */
  usageType: string;
  /** Ledger feature bucket for the default meter (default 'chat'). */
  feature?: LedgerFeature;
  temperature?: number;
  maxOutputTokens?: number;
  /** Hard cap racing the call; absent = await completion. */
  timeoutMs?: number;
  /**
   * Custom metering — gateway-wrapped routes pass their `ctx.meter` here so
   * spend lands with request/tier/reflink attribution instead of the internal
   * ledger path. ALWAYS invoked on completion, even post-timeout (D33
   * honesty). A custom meter is AWAITED when the call completes in time and
   * its errors propagate (spend governance — same as calling ctx.meter
   * directly); the default internal meter is fire-and-forget so the P26 hot
   * path never waits on a ledger write. Post-timeout late completions meter
   * fire-and-forget in both modes.
   */
  meter?: (usage: SecondaryLLMMeterInput) => Promise<unknown>;
  /** Extra metadata for the default meter's ledger row. */
  metadata?: Record<string, unknown>;
}

export interface SecondaryLLMJobOutcome<Schema extends z.ZodTypeAny> {
  /** Schema-validated result; null on timeout, transport error, or unparseable output. */
  result: z.infer<Schema> | null;
  timedOut: boolean;
  /** Raw model text when the call completed in time (diagnostics). */
  raw: string | null;
  provider: string | null;
  modelId: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
}

/**
 * Run one metered, JSON-forced secondary-LLM job. Never throws for model-side
 * failures — transport errors and garbage output both come back as
 * `result: null` so callers keep their fail-safe posture (P1/P10: no feature
 * output beats a wrong one). Alias-resolution failures DO throw (config bug,
 * not model variance) — callers wrap per their own swallow rules.
 */
export async function runSecondaryLLMJob<Schema extends z.ZodTypeAny>(
  spec: SecondaryLLMJobSpec<Schema>
): Promise<SecondaryLLMJobOutcome<Schema>> {
  const adapter = spec.modelOverride
    ? await getReasoningAdapterForAliasOrModel(spec.modelOverride)
    : await getReasoningAdapter(spec.alias);
  const messages: ReasoningMessage[] =
    typeof spec.prompt === 'string' ? [{ role: 'user', content: spec.prompt }] : spec.prompt;

  const meterCall = (input: SecondaryLLMMeterInput): Promise<unknown> =>
    Promise.resolve(
      spec.meter
        ? spec.meter(input)
        : recordUsage({
            feature: spec.feature ?? 'chat',
            usageType: spec.usageType,
            provider: input.provider,
            modelId: input.modelId,
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
            metadata: { ok: input.ok, timedOut: input.timedOut, ...(spec.metadata ?? {}) },
          })
    );

  const chatPromise = adapter.chat(messages, {
    temperature: spec.temperature ?? 0,
    maxOutputTokens: spec.maxOutputTokens ?? 500,
  });

  let raced: Awaited<typeof chatPromise> | null;
  if (spec.timeoutMs && spec.timeoutMs > 0) {
    raced = await Promise.race([
      chatPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), spec.timeoutMs)),
    ]).catch(() => null);
  } else {
    raced = await chatPromise.catch(() => null);
  }

  if (!raced) {
    // Timed out (or transport error). If the call is still in flight, meter it
    // when it eventually completes — the spend happened regardless (D33).
    void chatPromise
      .then((res) =>
        meterCall({
          provider: res.provider,
          modelId: res.modelId,
          inputTokens: res.usage.inputTokens,
          outputTokens: res.usage.outputTokens,
          ok: false,
          timedOut: true,
        })
      )
      .catch(() => undefined);
    return { result: null, timedOut: true, raw: null, provider: null, modelId: null, usage: null };
  }

  const result = parseJsonWithSchema(raced.content, spec.schema);
  const meterInput: SecondaryLLMMeterInput = {
    provider: raced.provider,
    modelId: raced.modelId,
    inputTokens: raced.usage.inputTokens,
    outputTokens: raced.usage.outputTokens,
    ok: result !== null,
    timedOut: false,
  };
  // A custom meter is awaited and its errors PROPAGATE (gateway metering is
  // spend governance — its failure is the caller's failure, same as calling
  // ctx.meter directly); the default ledger write never blocks the hot path.
  if (spec.meter) await meterCall(meterInput);
  else void meterCall(meterInput).catch(() => undefined);
  return {
    result,
    timedOut: false,
    raw: raced.content,
    provider: raced.provider,
    modelId: raced.modelId,
    usage: { inputTokens: raced.usage.inputTokens, outputTokens: raced.usage.outputTokens },
  };
}

// ---------------------------------------------------------------------------
// Embedding variant (the I1 consumer): alias-resolved model + budget gate +
// ledger row, one call. Batches stay slow-and-cheap by design (P23).
// ---------------------------------------------------------------------------

export type EmbeddingBatchOutcome =
  | { ok: true; vectors: number[][]; modelId: string; provider: string; tokensUsed: number }
  | { ok: false; reason: string };

/**
 * Embed a batch through the default-embedding alias with the semantic budget
 * gate and a ledger row (D33). `ok: false` = budget-declined or provider
 * failure — the caller reports and leaves rows pending (no silent caps).
 */
export async function runMeteredEmbeddingBatch(args: {
  texts: string[];
  taskType: 'document' | 'query';
  usageType: string;
  /** Pre-flight cost estimate model id (current default-embedding resolution). */
  estimateModelId: string;
  metadata?: Record<string, unknown>;
}): Promise<EmbeddingBatchOutcome> {
  if (args.texts.length === 0) return { ok: true, vectors: [], modelId: args.estimateModelId, provider: 'none', tokensUsed: 0 };
  const estimatedTokens = args.texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
  const estimatedCost = await estimateCost(args.estimateModelId, { inputTokens: estimatedTokens }).catch(() => 0);
  const afford = await semanticBudgetManager.canAffordOperation(estimatedCost);
  if (!afford.canAfford) {
    return {
      ok: false,
      reason: `budget gate (needs $${estimatedCost.toFixed(4)}, remaining $${afford.remainingFunds.toFixed(2)})`,
    };
  }
  try {
    const result = await generateEmbeddings(args.texts, { taskType: args.taskType });
    const costUsd = await estimateCost(result.modelId, { inputTokens: result.tokensUsed }).catch(() => 0);
    await recordUsage({
      feature: 'semantic',
      usageType: args.usageType,
      provider: result.provider,
      modelId: result.modelId, // recorded embedding model id (Req 16.2 / P11 discipline)
      inputTokens: result.tokensUsed,
      costUsd,
      metadata: { rows: args.texts.length, ...(args.metadata ?? {}) },
    });
    return { ok: true, vectors: result.vectors, modelId: result.modelId, provider: result.provider, tokensUsed: result.tokensUsed };
  } catch (err) {
    return { ok: false, reason: `embedding failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
