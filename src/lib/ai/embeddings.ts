/**
 * Embedding provider behind the `default-embedding` alias (D4) with a deterministic
 * fake (verification spec task 4.2): `AI_FAKE_MODE=embeddings` yields stable
 * sha256-derived unit vectors, so pgvector/HNSW/search run for real with zero spend.
 *
 * Provider-pluggable (owner, 2026-07-09): the alias row's `provider` selects the
 * implementation — 'openai' or 'google' today, one more `case` for anything else.
 * No SDK for Google: native REST, same as every other Google surface here.
 *
 * OPERATIONAL INVARIANT: query vectors and stored chunk vectors must come from
 * the SAME model. Repointing the alias requires re-ingesting all entities
 * (chunks record `embeddingModel`; ContentSearchService warns loudly on drift).
 */

import { createHash } from 'crypto';
import { isFakeMode } from './fake-mode';
import { resolveModelAlias } from './model-registry';

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Models the admin embedding switch offers. Every entry must support
 * EMBEDDING_DIMENSIONS-dim output (the pgvector column is fixed at 1536) and
 * have an implementation case in generateEmbeddings.
 */
export const SUPPORTED_EMBEDDING_MODELS: ReadonlyArray<{ provider: string; modelId: string; label: string }> = [
  { provider: 'openai', modelId: 'text-embedding-3-small', label: 'OpenAI text-embedding-3-small' },
  { provider: 'openai', modelId: 'text-embedding-3-large', label: 'OpenAI text-embedding-3-large (1536-dim truncation)' },
  { provider: 'google', modelId: 'gemini-embedding-001', label: 'Google gemini-embedding-001 (1536-dim truncation)' },
];

/**
 * Retrieval role of the text being embedded. OpenAI has one embedding space;
 * Google trains asymmetric spaces and wants queries and documents marked
 * (RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT) for best ranking.
 */
export type EmbeddingTaskType = 'query' | 'document';

export interface EmbeddingOptions {
  taskType?: EmbeddingTaskType;
}

export interface EmbeddingResult {
  vectors: number[][];
  /** Provider-reported total tokens (estimated when the provider reports none). */
  tokensUsed: number;
  modelId: string;
  provider: string;
}

/** Stable pseudo-random unit vector derived from content bytes. */
function fakeVector(content: string): number[] {
  const vec: number[] = new Array(EMBEDDING_DIMENSIONS);
  let seed = createHash('sha256').update(content).digest();
  let offset = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    if (offset + 4 > seed.length) {
      seed = createHash('sha256').update(seed).digest();
      offset = 0;
    }
    // map 32-bit uint to [-1, 1)
    vec[i] = seed.readUInt32BE(offset) / 0x80000000 - 1;
    offset += 4;
  }
  return normalize(vec);
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

const estimateTokens = (inputs: string[]): number =>
  inputs.reduce((s, t) => s + Math.ceil(t.length / 4), 0);

async function embedWithOpenAI(inputs: string[], modelId: string): Promise<EmbeddingResult> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: modelId,
    input: inputs,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return {
    vectors: response.data.map((d) => d.embedding),
    tokensUsed: response.usage?.total_tokens ?? estimateTokens(inputs),
    modelId,
    provider: 'openai',
  };
}

const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
/** batchEmbedContents caps requests per call. */
const GOOGLE_BATCH_LIMIT = 100;

async function embedWithGoogle(
  inputs: string[],
  modelId: string,
  taskType?: EmbeddingTaskType
): Promise<EmbeddingResult> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Embeddings: GOOGLE_API_KEY/GEMINI_API_KEY is not set');
  }
  const googleTaskType =
    taskType === 'query' ? 'RETRIEVAL_QUERY' : taskType === 'document' ? 'RETRIEVAL_DOCUMENT' : undefined;

  const vectors: number[][] = [];
  for (let i = 0; i < inputs.length; i += GOOGLE_BATCH_LIMIT) {
    const batch = inputs.slice(i, i + GOOGLE_BATCH_LIMIT);
    const res = await fetch(`${GOOGLE_BASE_URL}/models/${modelId}:batchEmbedContents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${modelId}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
          ...(googleTaskType ? { taskType: googleTaskType } : {}),
        })),
      }),
    });
    if (!res.ok) {
      // No response body in the error — it can echo internals (Req-3 style hygiene)
      throw new Error(`Google embeddings request failed (${res.status})`);
    }
    const data = (await res.json()) as { embeddings?: Array<{ values: number[] }> };
    const batchVectors = (data.embeddings ?? []).map((e) => e.values);
    if (batchVectors.length !== batch.length) {
      throw new Error('Google embeddings response is incomplete');
    }
    // Truncated (non-3072) Gemini embeddings are not unit-normalized — normalize
    // so cosine distances stay comparable and HNSW behaves like the OpenAI space.
    vectors.push(...batchVectors.map(normalize));
  }

  return {
    vectors,
    // The embeddings endpoint reports no usage — estimate for the ledger mirror.
    tokensUsed: estimateTokens(inputs),
    modelId,
    provider: 'google',
  };
}

/**
 * Embed with a SPECIFIC recorded model id, bypassing the `default-embedding`
 * alias (conversation-engine P11: intent-exemplar similarity is only
 * meaningful when exemplars and the runtime utterance embed with the SAME
 * model — graph versions record the id used at publish, and runtime MUST use
 * that id even after the alias moves on). Fake mode still short-circuits so
 * scenario runs stay deterministic (P16). Provider is inferred from the model
 * id; callers meter via recordUsage themselves (same contract as the other
 * exports here).
 */
export async function generateEmbeddingsForModel(
  inputs: string[],
  modelId: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult> {
  if (inputs.length === 0) return { vectors: [], tokensUsed: 0, modelId, provider: 'none' };
  if (isFakeMode('embeddings') || modelId === 'fake-embedding') {
    return {
      vectors: inputs.map((t) => fakeVector(t)),
      tokensUsed: estimateTokens(inputs),
      modelId: 'fake-embedding',
      provider: 'fake',
    };
  }
  const provider = /gemini|text-embedding-00\d/.test(modelId) && !modelId.startsWith('text-embedding-3') ? 'google' : 'openai';
  return provider === 'google'
    ? embedWithGoogle(inputs, modelId, options.taskType)
    : embedWithOpenAI(inputs, modelId);
}

export async function generateEmbeddings(
  inputs: string[],
  options?: EmbeddingOptions
): Promise<EmbeddingResult> {
  if (inputs.length === 0) {
    return { vectors: [], tokensUsed: 0, modelId: 'none', provider: 'none' };
  }

  if (isFakeMode('embeddings')) {
    return {
      vectors: inputs.map(fakeVector),
      tokensUsed: estimateTokens(inputs),
      modelId: 'fake-embedding',
      provider: 'fake',
    };
  }

  const resolved = await resolveModelAlias('default-embedding');
  switch (resolved.provider) {
    case 'openai':
      return embedWithOpenAI(inputs, resolved.modelId);
    case 'google':
      return embedWithGoogle(inputs, resolved.modelId, options?.taskType);
    default:
      throw new Error(
        `Embedding provider '${resolved.provider}' is not supported (supported: openai, google)`
      );
  }
}

export async function generateEmbedding(
  input: string,
  options?: EmbeddingOptions
): Promise<{ vector: number[]; tokensUsed: number; modelId: string; provider: string }> {
  const r = await generateEmbeddings([input], options);
  return { vector: r.vectors[0], tokensUsed: r.tokensUsed, modelId: r.modelId, provider: r.provider };
}

/**
 * The model id the `default-embedding` alias currently resolves to ('fake-embedding'
 * in fake mode). Callers use this for cache keys and stored-vs-query drift checks —
 * never hardcode an embedding model name (D4).
 */
export async function currentEmbeddingModelId(): Promise<string> {
  if (isFakeMode('embeddings')) return 'fake-embedding';
  return (await resolveModelAlias('default-embedding')).modelId;
}
