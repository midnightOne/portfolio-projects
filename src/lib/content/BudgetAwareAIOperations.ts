/**
 * Budget-Aware AI Operations
 * 
 * Wrapper functions that integrate budget tracking with AI operations.
 * All AI operations (embeddings, summarization) should go through these
 * functions to ensure proper cost tracking and budget enforcement.
 */

import OpenAI from 'openai';
import { semanticBudgetManager } from './SemanticBudgetManager';
import { estimateCost } from '@/lib/ai/pricing';
import { recordUsage } from '@/lib/ai/ledger';
import { generateEmbeddings } from '@/lib/ai/embeddings';

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

export class BudgetAwareAIOperations {
  private openai: OpenAI;

  // Pricing lives in AIModelPricing via estimateCost() — no local cost tables (D38).

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

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
      const result = await generateEmbeddings(inputs);
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
      // Perform summarization
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.content }
        ],
        max_tokens: maxTokens,
        temperature
      });

      const summary = response.choices[0]?.message?.content || '';
      const inputTokens = response.usage?.prompt_tokens || estimatedInputTokens;
      const outputTokens = response.usage?.completion_tokens || maxTokens;
      const totalTokens = response.usage?.total_tokens || estimatedTotalTokens;
      const actualCost = await estimateCost(model, { inputTokens, outputTokens });

      // Deduct actual cost from budget
      await semanticBudgetManager.deductCost({
        operationType: 'summarization',
        tokensUsed: totalTokens,
        cost: actualCost,
        model,
        projectId: options.projectId,
        chunksProcessed: 1,
        tiersAffected: [1, 2], // Summaries for T1 and T2
        metadata: {
          ...options.metadata,
          inputTokens,
          outputTokens
        }
      });

      // Mirror actuals to the unified ledger (D32; semantic-content task 2.1)
      await recordUsage({
        feature: 'semantic',
        usageType: 'summary',
        provider: 'openai',
        modelId: model,
        inputTokens,
        outputTokens,
        costUsd: actualCost,
        metadata: { projectId: options.projectId },
      });

      return {
        summary,
        tokensUsed: totalTokens,
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

// Export singleton instance (requires OPENAI_API_KEY)
let budgetAwareAI: BudgetAwareAIOperations | null = null;

export function getBudgetAwareAI(): BudgetAwareAIOperations {
  if (!budgetAwareAI) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    budgetAwareAI = new BudgetAwareAIOperations(apiKey);
  }
  return budgetAwareAI;
}
