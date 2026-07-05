/**
 * Embedding provider behind the `default-embedding` alias (D4) with a deterministic
 * fake (verification spec task 4.2): `AI_FAKE_MODE=embeddings` yields stable
 * sha256-derived unit vectors, so pgvector/HNSW/search run for real with zero spend.
 */

import { createHash } from 'crypto';
import { isFakeMode } from './fake-mode';
import { resolveModelAlias } from './model-registry';

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  vectors: number[][];
  /** Provider-reported total tokens (estimated for fakes). */
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
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function generateEmbeddings(inputs: string[]): Promise<EmbeddingResult> {
  if (inputs.length === 0) {
    return { vectors: [], tokensUsed: 0, modelId: 'none', provider: 'none' };
  }

  if (isFakeMode('embeddings')) {
    const tokensUsed = inputs.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
    return {
      vectors: inputs.map(fakeVector),
      tokensUsed,
      modelId: 'fake-embedding',
      provider: 'fake',
    };
  }

  const resolved = await resolveModelAlias('default-embedding');
  if (resolved.provider !== 'openai') {
    throw new Error(`Embedding provider '${resolved.provider}' not supported yet`);
  }
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: resolved.modelId,
    input: inputs,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return {
    vectors: response.data.map((d) => d.embedding),
    tokensUsed: response.usage?.total_tokens ?? 0,
    modelId: resolved.modelId,
    provider: resolved.provider,
  };
}

export async function generateEmbedding(input: string): Promise<{ vector: number[]; tokensUsed: number; modelId: string; provider: string }> {
  const r = await generateEmbeddings([input]);
  return { vector: r.vectors[0], tokensUsed: r.tokensUsed, modelId: r.modelId, provider: r.provider };
}
