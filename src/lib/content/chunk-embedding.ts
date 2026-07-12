/**
 * Shared chunk-embedding glue: embed via the 'default-embedding' alias (D4,
 * AI_FAKE_MODE-aware) and mirror the actual spend to the unified ledger (D32),
 * correlated to the owning operation when one exists.
 *
 * Single owner for this concept — used by StageBasedProcessingService
 * (embeddings stage) and SelectiveSectionRegenerator (ancestor re-embedding).
 */

export interface ChunkEmbeddingResult {
  embedding: number[];
  tokensUsed: number;
  costUsd: number;
  modelId: string;
}

/**
 * Embedding input for a chunk: prepend the title unless the content already
 * starts with it — heading-based chunking makes the heading the section's
 * most important semantic anchor (owner, 2026-07-08).
 */
export function chunkEmbeddingInput(chunk: { title?: string | null; content: string }): string {
  return chunk.title && !chunk.content.startsWith(chunk.title)
    ? `${chunk.title}\n\n${chunk.content}`
    : chunk.content;
}

export async function generateChunkEmbedding(
  content: string,
  opts: { operationId?: string } = {}
): Promise<ChunkEmbeddingResult> {
  const { generateEmbedding } = await import('@/lib/ai/embeddings');
  const { estimateCost } = await import('@/lib/ai/pricing');
  const { recordUsage } = await import('@/lib/ai/ledger');

  const result = await generateEmbedding(content, { taskType: 'document' });
  const costUsd = await estimateCost(result.modelId, { inputTokens: result.tokensUsed });
  await recordUsage({
    feature: 'semantic',
    usageType: 'embedding',
    provider: result.provider,
    modelId: result.modelId,
    inputTokens: result.tokensUsed,
    costUsd,
    // Correlates ledger rows with the durable operation row (task 10)
    metadata: opts.operationId ? { operationId: opts.operationId } : undefined,
  });
  return { embedding: result.vector, tokensUsed: result.tokensUsed, costUsd, modelId: result.modelId };
}
