/**
 * Model alias resolution (D4 seed — full admin-editable registry lands Phase 3.4).
 *
 * Aliases (`default-chat`, `default-cheap`, `default-reasoning`, `default-embedding`,
 * `default-realtime`) map to concrete {provider, modelId} rows in `AIModelAlias`.
 * No literal model IDs belong in feature code — resolve through here.
 */

import { prisma } from '@/lib/prisma';

export type ModelAliasName =
  | 'default-chat'
  | 'default-cheap'
  | 'default-reasoning'
  | 'default-embedding'
  | 'default-realtime';

export interface ResolvedModel {
  alias: ModelAliasName;
  provider: string;
  modelId: string;
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; rows: Map<string, ResolvedModel> } | null = null;

async function loadAliases(): Promise<Map<string, ResolvedModel>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = await prisma.aIModelAlias.findMany();
  const map = new Map<string, ResolvedModel>();
  for (const r of rows) {
    map.set(r.alias, { alias: r.alias as ModelAliasName, provider: r.provider, modelId: r.modelId });
  }
  cache = { at: now, rows: map };
  return map;
}

/**
 * Resolve an alias to a concrete model. Throws when the alias is not configured —
 * callers on public paths must treat that as fail-closed, not fall back to a literal ID.
 */
export async function resolveModelAlias(alias: ModelAliasName): Promise<ResolvedModel> {
  const map = await loadAliases();
  const hit = map.get(alias);
  if (!hit) {
    throw new Error(`Model alias '${alias}' is not configured (AIModelAlias table)`);
  }
  return hit;
}

/**
 * Resolve a config-supplied value that may be either a role alias or a
 * concrete model id (D4: config stores aliases by default; admins may pin a
 * concrete id). Unknown values pass through as {provider:'openai', modelId}.
 */
export async function resolveAliasOrModelId(value: string): Promise<ResolvedModel> {
  const map = await (async () => {
    try {
      return await loadAliases();
    } catch {
      return new Map<string, ResolvedModel>();
    }
  })();
  const hit = map.get(value);
  if (hit) return hit;
  return { alias: value as ModelAliasName, provider: 'openai', modelId: value };
}

/** Test hook: drop the per-instance memo. */
export function __clearModelAliasCache(): void {
  cache = null;
}
