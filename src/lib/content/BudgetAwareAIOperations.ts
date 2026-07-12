/**
 * Budget-Aware AI Operations
 *
 * Wrapper functions that integrate budget tracking with AI operations.
 * All AI operations (embeddings, summarization) should go through these
 * functions to ensure proper cost tracking and budget enforcement.
 *
 * No direct provider SDKs here: summaries run through the secondary-LLM job
 * module (conversation-engine M1 — the required path for every secondary-LLM
 * feature: alias resolution D4, AI_FAKE_MODE support, unified metering D33);
 * embeddings run through the shared `default-embedding` provider. This module
 * adds the SemanticBudget pre-flight gate + deduction around both.
 */

import { z } from 'zod';
import { semanticBudgetManager } from './SemanticBudgetManager';
import { estimateCost } from '@/lib/ai/pricing';
import { recordUsage } from '@/lib/ai/ledger';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { runSecondaryLLMJob } from '@/lib/services/ai/secondary-llm';

export interface BudgetAwareEmbeddingOptions {
  input: string | string[];
  model?: string;
  projectId?: string;
  metadata?: Record<string, any>;
  useBatchMode?: boolean; // Use batch API for 50% cost savings (24-hour processing)
  batchPriority?: 'low' | 'normal' | 'high';
}

export interface BudgetAwareSummarizationOptions {
  content: string;
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  projectId?: string;
  metadata?: Record<string, any>;
}

// JSON shape the summary job is asked to return; raw-text salvage below
// covers non-compliant output (a summary IS plain text, so any text is usable)
const SUMMARY_JOB_SCHEMA = z.object({ summary: z.string().min(1) });

/**
 * Salvage a usable summary from non-JSON model output: tolerate plain prose
 * (FakeReasoningAdapter, non-compliant models) and JSON truncated mid-string
 * by the output-token cap (`{"summary": "text…` with no closing brace).
 */
function salvageSummaryText(raw: string): string {
  const stripped = raw.replace(/```(?:json)?/gi, '').trim();
  const truncated = stripped.match(/"summary"\s*:\s*"([\s\S]*)$/);
  if (truncated) {
    return truncated[1]
      .replace(/["}\s]*$/, '')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .trim();
  }
  return stripped;
}

export class BudgetAwareAIOperations {
  // Pricing lives in AIModelPricing via estimateCost() — no local cost tables (D38).
  // No provider client: summaries ride the secondary-LLM job module (M1),
  // embeddings the shared provider — both AI_FAKE_MODE-aware and keyless in
  // fake mode.

  /**
   * Generate embeddings with budget tracking
   * Supports both standard (immediate) and batch (24-hour, 50% savings) modes
   */
  async generateEmbedding(options: BudgetAwareEmbeddingOptions): Promise<{
    embeddings: number[][];
    tokensUsed: number;
    cost: number;
    batchId?: string; // Returned if using batch mode
  }> {
    const { resolveAliasOrModelId } = await import('@/lib/ai/model-registry');
    const model = (await resolveAliasOrModelId(options.model || 'default-embedding')).modelId;
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

    // Calculate cost based on mode (batch = 50% discount)
    const costMultiplier = options.useBatchMode ? 0.5 : 1.0;
    const estimatedCost = (await estimateCost(model, { inputTokens: estimatedTokens })) * costMultiplier;

    // Check budget before operation
    const affordCheck = await semanticBudgetManager.canAffordOperation(estimatedCost);
    if (!affordCheck.canAfford) {
      throw new Error(
        `Insufficient budget for embedding operation. Required: $${estimatedCost.toFixed(4)}, ` +
        `Available: $${affordCheck.remainingFunds.toFixed(2)}, ` +
        `Shortfall: $${affordCheck.shortfall?.toFixed(4)}`
      );
    }

    try {
      // If batch mode requested, use batch API
      if (options.useBatchMode) {
        const { getBatchEmbeddingService } = await import('./BatchEmbeddingService');
        const batchService = getBatchEmbeddingService();
        
        // Prepare batch requests
        const requests = inputs.map((content, index) => ({
          id: `${options.projectId || 'unknown'}-${Date.now()}-${index}`,
          content,
          metadata: {
            chunkId: options.metadata?.chunkId || `chunk-${index}`,
            projectId: options.projectId,
            tier: options.metadata?.tier || 3
          }
        }));

        // Submit batch job
        const result = await batchService.submitBatchJob(requests, {
          model,
          priority: options.batchPriority || 'normal',
          estimatedTokens,
          estimatedCost,
          projectIds: options.projectId ? [options.projectId] : []
        });

        // Return placeholder embeddings (actual embeddings will be processed later)
        return {
          embeddings: inputs.map(() => []), // Empty arrays as placeholders
          tokensUsed: estimatedTokens,
          cost: estimatedCost,
          batchId: result.batchId
        };
      }

      // Standard mode: immediate processing through the shared embedding provider
      // (default-embedding alias; honors AI_FAKE_MODE=embeddings)
      const result = await generateEmbeddings(inputs, { taskType: 'document' });
      const embeddings = result.vectors;
      const tokensUsed = result.tokensUsed;
      const actualCost = await estimateCost(result.modelId, { inputTokens: tokensUsed });

      // Deduct actual cost from budget
      await semanticBudgetManager.deductCost({
        operationType: 'embedding',
        tokensUsed,
        cost: actualCost,
        model: result.modelId,
        projectId: options.projectId,
        chunksProcessed: inputs.length,
        tiersAffected: [3], // Embeddings typically for T3
        metadata: options.metadata
      });

      // Mirror actuals to the unified ledger (D32; semantic-content task 2.1)
      await recordUsage({
        feature: 'semantic',
        usageType: 'embedding',
        provider: result.provider,
        modelId: result.modelId,
        inputTokens: tokensUsed,
        costUsd: actualCost,
        metadata: { projectId: options.projectId, chunksProcessed: inputs.length },
      });

      return {
        embeddings,
        tokensUsed,
        cost: actualCost
      };
    } catch (error) {
      // Record failed operation
      await semanticBudgetManager.recordFailedOperation({
        operationType: 'embedding',
        tokensUsed: estimatedTokens,
        model,
        projectId: options.projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: options.metadata
      });
      throw error;
    }
  }

  /**
   * Generate AI summary with budget tracking
   */
  async generateSummary(options: BudgetAwareSummarizationOptions): Promise<{
    summary: string;
    tokensUsed: number;
    cost: number;
  }> {
    const { resolveAliasOrModelId } = await import('@/lib/ai/model-registry');
    const model = (await resolveAliasOrModelId(options.model || 'default-cheap')).modelId;
    const maxTokens = options.maxTokens || 200;
    const temperature = options.temperature || 0.3;

    // Estimate input tokens
    const estimatedInputTokens = Math.ceil(options.content.length / 4);
    const estimatedTotalTokens = estimatedInputTokens + maxTokens;
    const estimatedCost = await estimateCost(model, { inputTokens: estimatedInputTokens, outputTokens: maxTokens });

    // Check budget before operation
    const affordCheck = await semanticBudgetManager.canAffordOperation(estimatedCost);
    if (!affordCheck.canAfford) {
      throw new Error(
        `Insufficient budget for summarization operation. Required: $${estimatedCost.toFixed(4)}, ` +
        `Available: $${affordCheck.remainingFunds.toFixed(2)}, ` +
        `Shortfall: $${affordCheck.shortfall?.toFixed(4)}`
      );
    }

    try {
      // Perform summarization through the secondary-LLM job module (M1 —
      // alias resolution, AI_FAKE_MODE=reasoning, unified metering). The
      // custom meter keeps budget deduction + the D32 ledger mirror on the
      // completion path exactly as before.
      let actualCost = 0;
      let meteredTokens = estimatedTotalTokens;
      const outcome = await runSecondaryLLMJob({
        alias: 'default-cheap',
        // Admin-supplied override may be an alias or a pinned model id
        modelOverride: options.model,
        prompt: [
          {
            role: 'system',
            content: `${options.systemPrompt}\n\nRespond with a single JSON object: {"summary": "<the summary text>"}.`,
          },
          { role: 'user', content: options.content },
        ],
        schema: SUMMARY_JOB_SCHEMA,
        usageType: 'summary',
        feature: 'semantic',
        temperature,
        // Headroom for the JSON wrapper so the summary itself keeps the
        // caller's token budget
        maxOutputTokens: maxTokens + 32,
        meter: async (usage) => {
          actualCost = await estimateCost(usage.modelId, {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          });
          meteredTokens = usage.inputTokens + usage.outputTokens;

          // Deduct actual cost from budget (pre-flight gate ran above)
          await semanticBudgetManager.deductCost({
            operationType: 'summarization',
            tokensUsed: meteredTokens,
            cost: actualCost,
            model: usage.modelId,
            projectId: options.projectId,
            chunksProcessed: 1,
            tiersAffected: [1, 2], // Summaries for T1 and T2
            metadata: {
              ...options.metadata,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens
            }
          });

          // Mirror actuals to the unified ledger (D32; semantic-content task 2.1)
          await recordUsage({
            feature: 'semantic',
            usageType: 'summary',
            provider: usage.provider,
            modelId: usage.modelId,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            costUsd: actualCost,
            metadata: { projectId: options.projectId },
          });
        },
      });

      // Schema-validated JSON first; salvage plain/truncated text otherwise —
      // summaries are load-bearing pipeline output, so no text at all is an
      // error (the stage fails visibly and stays resumable)
      const summary = outcome.result?.summary ?? (outcome.raw ? salvageSummaryText(outcome.raw) : '');
      if (!summary) {
        throw new Error(
          `Summary generation produced no usable output (model: ${outcome.modelId ?? model}, timedOut: ${outcome.timedOut})`
        );
      }

      return {
        summary,
        tokensUsed: meteredTokens,
        cost: actualCost
      };
    } catch (error) {
      // Record failed operation
      await semanticBudgetManager.recordFailedOperation({
        operationType: 'summarization',
        tokensUsed: estimatedTotalTokens,
        model,
        projectId: options.projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: options.metadata
      });
      throw error;
    }
  }

  /**
   * Estimate cost for a regeneration operation
   */
  async estimateRegenerationCost(options: {
    projectId: string;
    sectionsToRegenerate: number;
    averageTokensPerSection: number;
    includeEmbeddings: boolean;
  }): Promise<{
    estimatedTokens: number;
    estimatedCost: number;
    breakdown: {
      summarization: { tokens: number; cost: number };
      embedding: { tokens: number; cost: number };
    };
  }> {
    const inputTokens = options.sectionsToRegenerate * options.averageTokensPerSection;
    const outputTokens = options.sectionsToRegenerate * 200; // Estimate 200 tokens per summary
    const { resolveModelAlias } = await import('@/lib/ai/model-registry');
    const cheapModel = await resolveModelAlias('default-cheap');
    const summaryCost = await estimateCost(cheapModel.modelId, { inputTokens, outputTokens });

    let embeddingTokens = 0;
    let embeddingCost = 0;

    if (options.includeEmbeddings) {
      // Estimate embedding tokens (typically 2-3x the summary tokens for full content)
      embeddingTokens = inputTokens * 2.5;
      const embeddingModel = await resolveModelAlias('default-embedding');
      embeddingCost = await estimateCost(embeddingModel.modelId, { inputTokens: embeddingTokens });
    }

    return {
      estimatedTokens: inputTokens + outputTokens + embeddingTokens,
      estimatedCost: summaryCost + embeddingCost,
      breakdown: {
        summarization: { tokens: inputTokens + outputTokens, cost: summaryCost },
        embedding: { tokens: embeddingTokens, cost: embeddingCost }
      }
    };
  }

  /**
   * Check if budget can afford an operation
   */
  async canAffordOperation(estimatedCost: number): Promise<{
    canAfford: boolean;
    remainingFunds: number;
    shortfall?: number;
  }> {
    return semanticBudgetManager.canAffordOperation(estimatedCost);
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus() {
    return semanticBudgetManager.getActiveBudget();
  }
}

// Export singleton instance. No API key requirement here — provider keys are
// the concern of the adapters the shared modules resolve (and fake mode needs
// none at all); a missing key surfaces from the provider call itself.
let budgetAwareAI: BudgetAwareAIOperations | null = null;

export function getBudgetAwareAI(): BudgetAwareAIOperations {
  if (!budgetAwareAI) {
    budgetAwareAI = new BudgetAwareAIOperations();
  }
  return budgetAwareAI;
}
