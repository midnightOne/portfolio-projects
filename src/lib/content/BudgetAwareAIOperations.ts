/**
 * Budget-Aware AI Operations
 * 
 * Wrapper functions that integrate budget tracking with AI operations.
 * All AI operations (embeddings, summarization) should go through these
 * functions to ensure proper cost tracking and budget enforcement.
 */

import OpenAI from 'openai';
import { semanticBudgetManager, OperationCost } from './SemanticBudgetManager';

export interface BudgetAwareEmbeddingOptions {
  input: string | string[];
  model?: string;
  projectId?: string;
  metadata?: Record<string, any>;
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
  
  // Cost constants (USD per 1K tokens) - Updated January 2025
  // See OPENAI_PRICING_REFERENCE.md for full pricing details
  private readonly INPUT_COSTS = {
    // Embeddings
    'text-embedding-3-small': 0.00002,      // $0.02 per 1M
    'text-embedding-3-large': 0.00013,      // $0.13 per 1M
    'text-embedding-ada-002': 0.0001,       // $0.10 per 1M
    
    // Chat models (input tokens)
    'gpt-4o-mini': 0.00015,                 // $0.15 per 1M
    'gpt-4o': 0.0025,                       // $2.50 per 1M
    'gpt-4.1-mini': 0.0004,                 // $0.40 per 1M
    'gpt-4.1': 0.002,                       // $2.00 per 1M
    'gpt-5-mini': 0.00025,                  // $0.25 per 1M
    'gpt-5': 0.00125,                       // $1.25 per 1M
    
    // Legacy
    'gpt-4': 0.03,                          // $30 per 1M
    'gpt-3.5-turbo': 0.0005,                // $0.50 per 1M
  };

  // Output token costs (for chat models)
  private readonly OUTPUT_COSTS = {
    'gpt-4o-mini': 0.0006,                  // $0.60 per 1M
    'gpt-4o': 0.01,                         // $10.00 per 1M
    'gpt-4.1-mini': 0.0016,                 // $1.60 per 1M
    'gpt-4.1': 0.008,                       // $8.00 per 1M
    'gpt-5-mini': 0.002,                    // $2.00 per 1M
    'gpt-5': 0.01,                          // $10.00 per 1M
    'gpt-4': 0.06,                          // $60 per 1M
    'gpt-3.5-turbo': 0.0015,                // $1.50 per 1M
  };

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate embeddings with budget tracking
   */
  async generateEmbedding(options: BudgetAwareEmbeddingOptions): Promise<{
    embeddings: number[][];
    tokensUsed: number;
    cost: number;
  }> {
    const model = options.model || 'text-embedding-3-small';
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
    const estimatedCost = this.calculateCost(model, estimatedTokens);

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
      // Perform embedding generation
      const response = await this.openai.embeddings.create({
        model,
        input: inputs
      });

      const embeddings = response.data.map(item => item.embedding);
      const tokensUsed = response.usage.total_tokens;
      const actualCost = this.calculateCost(model, tokensUsed);

      // Deduct actual cost from budget
      await semanticBudgetManager.deductCost({
        operationType: 'embedding',
        tokensUsed,
        cost: actualCost,
        model,
        projectId: options.projectId,
        chunksProcessed: inputs.length,
        tiersAffected: [3], // Embeddings typically for T3
        metadata: options.metadata
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
    const model = options.model || 'gpt-4o-mini';
    const maxTokens = options.maxTokens || 200;
    const temperature = options.temperature || 0.3;

    // Estimate input tokens
    const estimatedInputTokens = Math.ceil(options.content.length / 4);
    const estimatedTotalTokens = estimatedInputTokens + maxTokens;
    const estimatedCost = this.calculateCost(model, estimatedTotalTokens);

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
      const actualCost = this.calculateCost(model, inputTokens, outputTokens);

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
    const summaryCost = this.calculateCost('gpt-4o-mini', inputTokens, outputTokens);

    let embeddingTokens = 0;
    let embeddingCost = 0;

    if (options.includeEmbeddings) {
      // Estimate embedding tokens (typically 2-3x the summary tokens for full content)
      embeddingTokens = inputTokens * 2.5;
      embeddingCost = this.calculateCost('text-embedding-3-small', embeddingTokens);
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
   * Calculate cost based on model and token count
   * For embeddings, only input tokens are used
   * For chat models, can specify input and output tokens separately
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number = 0): number {
    const inputCostPer1K = this.INPUT_COSTS[model as keyof typeof this.INPUT_COSTS] || 0.0001;
    const outputCostPer1K = this.OUTPUT_COSTS[model as keyof typeof this.OUTPUT_COSTS] || inputCostPer1K;
    
    const inputCost = (inputTokens / 1000) * inputCostPer1K;
    const outputCost = (outputTokens / 1000) * outputCostPer1K;
    
    return inputCost + outputCost;
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
