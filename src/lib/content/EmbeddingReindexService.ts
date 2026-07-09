/**
 * Full-corpus embedding reindex (owner, 2026-07-09): re-embeds EVERY context
 * chunk with the model the `default-embedding` alias currently resolves to.
 *
 * This is the operational counterpart of switching the embedding model — query
 * vectors and stored vectors must come from the same model, so the admin
 * embedding switch runs this immediately after repointing the alias (with
 * explicit consent; the admin API is the only caller). Spend is mirrored to
 * the unified ledger (D32) per batch.
 */

import { prisma } from '@/lib/prisma';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { estimateCost } from '@/lib/ai/pricing';
import { recordUsage } from '@/lib/ai/ledger';

const BATCH_SIZE = 50;

export interface ReindexResult {
  chunks: number;
  tokensUsed: number;
  costUsd: number;
  modelId: string;
  provider: string;
  tookMs: number;
}

export interface ReindexEstimate {
  chunks: number;
  estimatedTokens: number;
  /** Cost of re-embedding the corpus with the given model. */
  estimatedCostUsd: number;
}

/** Chunk count + token/cost estimate for re-embedding the whole corpus. */
export async function estimateReindex(modelId: string): Promise<ReindexEstimate> {
  const agg = await prisma.contextChunk.aggregate({
    _count: { id: true },
    _sum: { tokenCount: true },
  });
  const estimatedTokens = agg._sum.tokenCount ?? 0;
  return {
    chunks: agg._count.id,
    estimatedTokens,
    estimatedCostUsd: await estimateCost(modelId, { inputTokens: estimatedTokens }),
  };
}

/**
 * Re-embed all chunks with the CURRENT default-embedding model. Batched;
 * each chunk's embeddingModel/embeddingGeneratedAt are stamped so the
 * ContentSearchService drift guard goes quiet.
 */
export async function reindexAllEmbeddings(): Promise<ReindexResult> {
  const startedAt = Date.now();
  const chunks = await prisma.$queryRaw<Array<{ id: string; title: string | null; content: string }>>`
    SELECT id, title, content FROM context_chunks ORDER BY id`;

  let tokensUsed = 0;
  let costUsd = 0;
  let modelId = 'none';
  let provider = 'none';

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    // Same input shape as the embeddings stage (StageBasedProcessingService):
    // heading prefixed unless the content already starts with it.
    const inputs = batch.map((c) =>
      c.title && !c.content.startsWith(c.title) ? `${c.title}\n\n${c.content}` : c.content
    );
    const result = await generateEmbeddings(inputs, { taskType: 'document' });
    modelId = result.modelId;
    provider = result.provider;
    tokensUsed += result.tokensUsed;

    for (let j = 0; j < batch.length; j++) {
      const vecLiteral = `[${result.vectors[j].join(',')}]`;
      await prisma.$executeRaw`
        UPDATE context_chunks
        SET embedding_vector = ${vecLiteral}::vector(1536),
            embedding_model = ${result.modelId},
            embedding_generated_at = now()
        WHERE id = ${batch[j].id}`;
    }

    const batchCost = await estimateCost(result.modelId, { inputTokens: result.tokensUsed });
    costUsd += batchCost;
    await recordUsage({
      feature: 'semantic',
      usageType: 'embedding',
      provider: result.provider,
      modelId: result.modelId,
      inputTokens: result.tokensUsed,
      costUsd: batchCost,
      metadata: { operation: 'embedding_model_reindex', batchStart: i, batchSize: batch.length },
    });
  }

  return { chunks: chunks.length, tokensUsed, costUsd, modelId, provider, tookMs: Date.now() - startedAt };
}
