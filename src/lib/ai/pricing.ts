/**
 * Pricing module (D38): pricing is data (`AIModelPricing` rows), and `estimateCost()`
 * is the only cost function. Local per-file pricing constants are deleted as they are
 * touched; token accounting prefers provider `usage` — `estimateTokensFromChars` is
 * for rough pre-flight estimates only.
 */

import { prisma } from '@/lib/prisma';
import { resolveAliasOrModelId } from './model-registry';

export interface UsageTokens {
  inputTokens?: number;
  outputTokens?: number;
}

interface PricingRow {
  modelId: string;
  provider: string;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; rows: Map<string, PricingRow> } | null = null;

async function loadPricing(): Promise<Map<string, PricingRow>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = await prisma.aIModelPricing.findMany();
  const map = new Map<string, PricingRow>();
  for (const r of rows) {
    map.set(r.modelId, {
      modelId: r.modelId,
      provider: r.provider,
      inputPerMTokUsd: Number(r.inputPerMTokUsd),
      outputPerMTokUsd: Number(r.outputPerMTokUsd),
    });
  }
  cache = { at: now, rows: map };
  return map;
}

/**
 * Estimate the USD cost of a call from token usage.
 *
 * Unknown models are priced at the most expensive configured row (conservative — an
 * unpriced model must never meter as free) and logged once per process per model.
 */
const warnedUnknown = new Set<string>();

export async function estimateCost(modelId: string, usage: UsageTokens): Promise<number> {
  const row = await getPricingRow(modelId);
  const input = (usage.inputTokens ?? 0) * (row.inputPerMTokUsd / 1_000_000);
  const output = (usage.outputTokens ?? 0) * (row.outputPerMTokUsd / 1_000_000);
  return input + output;
}

async function getPricingRow(modelId: string): Promise<PricingRow> {
  const rows = await loadPricing();
  const row = rows.get(modelId);
  if (row) return row;
  if (!warnedUnknown.has(modelId)) {
    warnedUnknown.add(modelId);
    console.warn(`[pricing] No AIModelPricing row for '${modelId}' — using most expensive known rate (conservative)`);
  }
  let max: PricingRow | undefined;
  for (const r of rows.values()) {
    if (!max || r.inputPerMTokUsd + r.outputPerMTokUsd > max.inputPerMTokUsd + max.outputPerMTokUsd) max = r;
  }
  return max ?? { modelId, provider: 'unknown', inputPerMTokUsd: 10, outputPerMTokUsd: 30 };
}

/**
 * Pre-flight estimation rates (USD per 1K tokens) for the models the semantic
 * pipeline will actually run: `default-embedding` for embeddings, `default-cheap`
 * for summarization. Replaces the per-file hardcoded rate constants (D38) —
 * estimates track the registry instead of 2024-vintage literals. Estimation only;
 * ledger writes always go through `estimateCost()` with provider usage.
 */
export interface PreflightRates {
  embeddingModelId: string;
  summarizationModelId: string;
  embeddingPer1kUsd: number;
  summarizationInputPer1kUsd: number;
  summarizationOutputPer1kUsd: number;
}

export async function getPreflightRates(): Promise<PreflightRates> {
  const [embedding, cheap] = await Promise.all([
    resolveAliasOrModelId('default-embedding'),
    resolveAliasOrModelId('default-cheap'),
  ]);
  const [embeddingRow, cheapRow] = await Promise.all([
    getPricingRow(embedding.modelId),
    getPricingRow(cheap.modelId),
  ]);
  return {
    embeddingModelId: embedding.modelId,
    summarizationModelId: cheap.modelId,
    embeddingPer1kUsd: embeddingRow.inputPerMTokUsd / 1000,
    summarizationInputPer1kUsd: cheapRow.inputPerMTokUsd / 1000,
    summarizationOutputPer1kUsd: cheapRow.outputPerMTokUsd / 1000,
  };
}

/**
 * Embedding-model pricing rows (for the admin model-comparison surface).
 * Identified by modelId convention — embedding models all carry 'embedding' in
 * their id across providers; rates come from the same `AIModelPricing` table.
 */
export async function listEmbeddingPricing(): Promise<Array<{ modelId: string; provider: string; inputPerMTokUsd: number }>> {
  const rows = await loadPricing();
  return [...rows.values()]
    .filter(r => r.modelId.includes('embedding') && r.provider !== 'fake')
    .map(r => ({ modelId: r.modelId, provider: r.provider, inputPerMTokUsd: r.inputPerMTokUsd }));
}

/** Re-exported from the client-safe module (Block D: the editor's token meter imports the SAME estimator, notes §6). */
export { estimateTokensFromChars } from './token-estimate';

/** Test hook: drop the per-instance memo. */
export function __clearPricingCache(): void {
  cache = null;
}
