/**
 * Pricing module (D38): pricing is data (`AIModelPricing` rows), and `estimateCost()`
 * is the only cost function. Local per-file pricing constants are deleted as they are
 * touched; token accounting prefers provider `usage` — `estimateTokensFromChars` is
 * for rough pre-flight estimates only.
 */

import { prisma } from '@/lib/prisma';

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
  const rows = await loadPricing();
  let row = rows.get(modelId);
  if (!row) {
    if (!warnedUnknown.has(modelId)) {
      warnedUnknown.add(modelId);
      console.warn(`[pricing] No AIModelPricing row for '${modelId}' — using most expensive known rate (conservative)`);
    }
    let max: PricingRow | undefined;
    for (const r of rows.values()) {
      if (!max || r.inputPerMTokUsd + r.outputPerMTokUsd > max.inputPerMTokUsd + max.outputPerMTokUsd) max = r;
    }
    row = max ?? { modelId, provider: 'unknown', inputPerMTokUsd: 10, outputPerMTokUsd: 30 };
  }
  const input = (usage.inputTokens ?? 0) * (row.inputPerMTokUsd / 1_000_000);
  const output = (usage.outputTokens ?? 0) * (row.outputPerMTokUsd / 1_000_000);
  return input + output;
}

/** Rough pre-flight token estimate (chars/4). Never for ledger writes — provider usage wins. */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Test hook: drop the per-instance memo. */
export function __clearPricingCache(): void {
  cache = null;
}
