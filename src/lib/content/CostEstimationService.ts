/**
 * Cost Estimation and Tracking Service
 * 
 * Provides comprehensive cost estimation and tracking capabilities:
 * - Accurate cost estimation for regeneration operations
 * - Cost comparison between embedding models
 * - Cost projection based on historical data
 * - Cost alerts for unusual spending patterns
 * - Detailed cost breakdown in operation summary reports
 */

import { prisma } from '@/lib/prisma';
import { semanticBudgetManager } from './SemanticBudgetManager';

export interface RegenerationCostEstimate {
  totalCost: number;
  totalTokens: number;
  breakdown: {
    summarization: {
      t1: { sections: number; tokens: number; cost: number };
      t2: { sections: number; tokens: number; cost: number };
      total: { tokens: number; cost: number };
    };
    embedding: {
      t1: { chunks: number; tokens: number; cost: number };
      t2: { chunks: number; tokens: number; cost: number };
      t3: { chunks: number; tokens: number; cost: number };
      total: { tokens: number; cost: number };
    };
  };
  estimatedDuration: number; // seconds
  canAfford: boolean;
  shortfall?: number;
}

export interface ModelCostComparison {
  model: string;
  costPer1KTokens: number;
  costPer1MTokens: number;
  estimatedCostForOperation: number;
  savingsVsDefault?: number;
  savingsPercent?: number;
  qualityRating: 'high' | 'medium' | 'low';
  speedRating: 'fast' | 'medium' | 'slow';
  recommended: boolean;
}

export interface CostProjection {
  currentSpendingRate: number; // USD per day
  projectedMonthlySpend: number;
  projectedQuarterlySpend: number;
  daysUntilBudgetDepletion: number;
  operationsUntilBudgetDepletion: number;
  recommendedBudgetIncrease?: number;
  confidence: 'high' | 'medium' | 'low';
  basedOnDays: number;
}

export interface SpendingAlert {
  id: string;
  type: 'unusual_spike' | 'budget_warning' | 'cost_anomaly' | 'efficiency_drop';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: {
    currentValue: number;
    expectedValue: number;
    deviation: number;
    affectedProjects?: string[];
  };
  timestamp: Date;
  acknowledged: boolean;
}

export interface OperationSummaryReport {
  operationId: string;
  operationType: string;
  projectId?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  
  costBreakdown: {
    embedding: { cost: number; tokens: number; chunks: number };
    summarization: { cost: number; tokens: number; chunks: number };
    total: { cost: number; tokens: number };
  };
  
  efficiency: {
    costPerChunk: number;
    tokensPerChunk: number;
    chunksPerSecond: number;
  };
  
  budgetImpact: {
    remainingBudget: number;
    percentUsed: number;
    warningLevel: 'ok' | 'warning' | 'critical' | 'depleted';
  };
  
  comparison: {
    vsAverageOperation: {
      costDifference: number;
      percentDifference: number;
    };
    vsProjectAverage?: {
      costDifference: number;
      percentDifference: number;
    };
  };
}

export class CostEstimationService {
  // Cost constants (USD per 1K tokens)
  private readonly EMBEDDING_COSTS = {
    'text-embedding-3-small': 0.00002,
    'text-embedding-3-large': 0.00013,
    'text-embedding-ada-002': 0.0001,
  };

  private readonly SUMMARIZATION_INPUT_COSTS = {
    'gpt-4o-mini': 0.00015,
    'gpt-4o': 0.0025,
    'gpt-4.1-mini': 0.0004,
    'gpt-5-mini': 0.00025,
  };

  private readonly SUMMARIZATION_OUTPUT_COSTS = {
    'gpt-4o-mini': 0.0006,
    'gpt-4o': 0.01,
    'gpt-4.1-mini': 0.0016,
    'gpt-5-mini': 0.002,
  };

  /**
   * Estimate cost for regeneration operation before execution
   */
  async estimateRegenerationCost(options: {
    projectId?: string;
    scope: 'all' | 'project' | 'section';
    sectionIds?: string[];
    embeddingModel?: string;
    summarizationModel?: string;
  }): Promise<RegenerationCostEstimate> {
    const embeddingModel = options.embeddingModel || 'text-embedding-3-small';
    const summarizationModel = options.summarizationModel || 'gpt-4o-mini';

    let projectIds: string[] = [];
    
    if (options.scope === 'all') {
      // Get all projects
      const projects = await prisma.project.findMany({ select: { id: true } });
      projectIds = projects.map(p => p.id);
    } else if (options.scope === 'project' && options.projectId) {
      projectIds = [options.projectId];
    } else if (options.scope === 'section' && options.projectId) {
      projectIds = [options.projectId];
    }

    // Estimate tokens based on existing chunks or project content
    const estimate = await this.estimateTokensForProjects(
      projectIds,
      options.scope === 'section' ? options.sectionIds : undefined
    );

    // Calculate summarization costs
    const t1SummaryCost = this.calculateSummarizationCost(
      summarizationModel,
      estimate.t1.inputTokens,
      estimate.t1.outputTokens
    );

    const t2SummaryCost = this.calculateSummarizationCost(
      summarizationModel,
      estimate.t2.inputTokens,
      estimate.t2.outputTokens
    );

    const totalSummaryCost = t1SummaryCost + t2SummaryCost;
    const totalSummaryTokens = estimate.t1.inputTokens + estimate.t1.outputTokens +
                               estimate.t2.inputTokens + estimate.t2.outputTokens;

    // Calculate embedding costs
    const t1EmbeddingCost = this.calculateEmbeddingCost(embeddingModel, estimate.t1.embeddingTokens);
    const t2EmbeddingCost = this.calculateEmbeddingCost(embeddingModel, estimate.t2.embeddingTokens);
    const t3EmbeddingCost = this.calculateEmbeddingCost(embeddingModel, estimate.t3.embeddingTokens);

    const totalEmbeddingCost = t1EmbeddingCost + t2EmbeddingCost + t3EmbeddingCost;
    const totalEmbeddingTokens = estimate.t1.embeddingTokens + 
                                 estimate.t2.embeddingTokens + 
                                 estimate.t3.embeddingTokens;

    const totalCost = totalSummaryCost + totalEmbeddingCost;
    const totalTokens = totalSummaryTokens + totalEmbeddingTokens;

    // Estimate duration (rough: 1000 tokens per second for processing)
    const estimatedDuration = Math.ceil(totalTokens / 1000);

    // Check if budget can afford this
    const affordCheck = await semanticBudgetManager.canAffordOperation(totalCost);

    return {
      totalCost,
      totalTokens,
      breakdown: {
        summarization: {
          t1: {
            sections: estimate.t1.sections,
            tokens: estimate.t1.inputTokens + estimate.t1.outputTokens,
            cost: t1SummaryCost
          },
          t2: {
            sections: estimate.t2.sections,
            tokens: estimate.t2.inputTokens + estimate.t2.outputTokens,
            cost: t2SummaryCost
          },
          total: {
            tokens: totalSummaryTokens,
            cost: totalSummaryCost
          }
        },
        embedding: {
          t1: {
            chunks: estimate.t1.sections,
            tokens: estimate.t1.embeddingTokens,
            cost: t1EmbeddingCost
          },
          t2: {
            chunks: estimate.t2.sections,
            tokens: estimate.t2.embeddingTokens,
            cost: t2EmbeddingCost
          },
          t3: {
            chunks: estimate.t3.chunks,
            tokens: estimate.t3.embeddingTokens,
            cost: t3EmbeddingCost
          },
          total: {
            tokens: totalEmbeddingTokens,
            cost: totalEmbeddingCost
          }
        }
      },
      estimatedDuration,
      canAfford: affordCheck.canAfford,
      shortfall: affordCheck.shortfall
    };
  }

  /**
   * Compare costs between different embedding models
   */
  async compareEmbeddingModels(options: {
    estimatedTokens: number;
    currentModel?: string;
  }): Promise<ModelCostComparison[]> {
    const defaultModel = options.currentModel || 'text-embedding-3-small';
    const comparisons: ModelCostComparison[] = [];

    for (const [model, costPer1K] of Object.entries(this.EMBEDDING_COSTS)) {
      const costPer1M = costPer1K * 1000;
      const estimatedCost = (options.estimatedTokens / 1000) * costPer1K;
      
      const defaultCost = (options.estimatedTokens / 1000) * 
                         this.EMBEDDING_COSTS[defaultModel as keyof typeof this.EMBEDDING_COSTS];
      
      const savings = defaultCost - estimatedCost;
      const savingsPercent = defaultCost > 0 ? (savings / defaultCost) * 100 : 0;

      // Quality and speed ratings
      let qualityRating: 'high' | 'medium' | 'low' = 'medium';
      let speedRating: 'fast' | 'medium' | 'slow' = 'medium';

      if (model === 'text-embedding-3-large') {
        qualityRating = 'high';
        speedRating = 'slow';
      } else if (model === 'text-embedding-3-small') {
        qualityRating = 'medium';
        speedRating = 'fast';
      } else if (model === 'text-embedding-ada-002') {
        qualityRating = 'low';
        speedRating = 'fast';
      }

      comparisons.push({
        model,
        costPer1KTokens: costPer1K,
        costPer1MTokens: costPer1M,
        estimatedCostForOperation: estimatedCost,
        savingsVsDefault: model !== defaultModel ? savings : undefined,
        savingsPercent: model !== defaultModel ? savingsPercent : undefined,
        qualityRating,
        speedRating,
        recommended: model === 'text-embedding-3-small' // Best cost/performance
      });
    }

    return comparisons.sort((a, b) => a.estimatedCostForOperation - b.estimatedCostForOperation);
  }

  /**
   * Project future costs based on historical data
   */
  async projectCosts(options: {
    lookbackDays?: number;
    confidenceThreshold?: number;
  }): Promise<CostProjection> {
    const lookbackDays = options.lookbackDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Get historical operations
    const operations = await prisma.semanticOperation.findMany({
      where: {
        startedAt: { gte: startDate },
        success: true
      },
      orderBy: { startedAt: 'asc' }
    });

    if (operations.length === 0) {
      return {
        currentSpendingRate: 0,
        projectedMonthlySpend: 0,
        projectedQuarterlySpend: 0,
        daysUntilBudgetDepletion: Infinity,
        operationsUntilBudgetDepletion: Infinity,
        confidence: 'low',
        basedOnDays: 0
      };
    }

    // Calculate daily spending rate
    const totalSpent = operations.reduce((sum, op) => sum + Number(op.cost), 0);
    const actualDays = Math.max(1, (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = totalSpent / actualDays;

    // Project future spending
    const projectedMonthlySpend = dailyRate * 30;
    const projectedQuarterlySpend = dailyRate * 90;

    // Get current budget
    const budget = await semanticBudgetManager.getActiveBudget();
    const daysUntilDepletion = dailyRate > 0 
      ? Math.floor(budget.remainingFunds / dailyRate)
      : Infinity;

    // Calculate average cost per operation
    const avgCostPerOp = totalSpent / operations.length;
    const operationsUntilDepletion = avgCostPerOp > 0
      ? Math.floor(budget.remainingFunds / avgCostPerOp)
      : Infinity;

    // Determine confidence based on data points
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (operations.length >= 100 && actualDays >= 14) {
      confidence = 'high';
    } else if (operations.length >= 30 && actualDays >= 7) {
      confidence = 'medium';
    }

    // Recommend budget increase if depletion is imminent
    let recommendedBudgetIncrease: number | undefined;
    if (daysUntilDepletion < 30 && isFinite(daysUntilDepletion)) {
      recommendedBudgetIncrease = projectedMonthlySpend * 2; // 2 months buffer
    }

    return {
      currentSpendingRate: dailyRate,
      projectedMonthlySpend,
      projectedQuarterlySpend,
      daysUntilBudgetDepletion: isFinite(daysUntilDepletion) ? daysUntilDepletion : 999,
      operationsUntilBudgetDepletion: isFinite(operationsUntilDepletion) ? operationsUntilDepletion : 999,
      recommendedBudgetIncrease,
      confidence,
      basedOnDays: Math.floor(actualDays)
    };
  }

  /**
   * Detect unusual spending patterns and generate alerts
   */
  async detectSpendingAlerts(): Promise<SpendingAlert[]> {
    const alerts: SpendingAlert[] = [];

    // Get recent operations (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);

    const recentOps = await prisma.semanticOperation.findMany({
      where: {
        startedAt: { gte: recentDate },
        success: true
      }
    });

    // Get historical baseline (30 days before recent period)
    const baselineStart = new Date();
    baselineStart.setDate(baselineStart.getDate() - 37);
    const baselineEnd = new Date();
    baselineEnd.setDate(baselineEnd.getDate() - 7);

    const baselineOps = await prisma.semanticOperation.findMany({
      where: {
        startedAt: { gte: baselineStart, lte: baselineEnd },
        success: true
      }
    });

    if (baselineOps.length === 0) {
      return alerts; // Not enough historical data
    }

    // Calculate baseline metrics
    const baselineDailyCost = baselineOps.reduce((sum, op) => sum + Number(op.cost), 0) / 30;
    const baselineAvgCost = baselineOps.reduce((sum, op) => sum + Number(op.cost), 0) / baselineOps.length;

    // Calculate recent metrics
    const recentDailyCost = recentOps.reduce((sum, op) => sum + Number(op.cost), 0) / 7;
    const recentAvgCost = recentOps.reduce((sum, op) => sum + Number(op.cost), 0) / recentOps.length;

    // Alert 1: Unusual spending spike (>50% increase)
    const costIncrease = ((recentDailyCost - baselineDailyCost) / baselineDailyCost) * 100;
    if (costIncrease > 50) {
      alerts.push({
        id: `spike-${Date.now()}`,
        type: 'unusual_spike',
        severity: costIncrease > 100 ? 'critical' : 'warning',
        message: `Daily spending has increased by ${costIncrease.toFixed(1)}% compared to baseline`,
        details: {
          currentValue: recentDailyCost,
          expectedValue: baselineDailyCost,
          deviation: costIncrease
        },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Alert 2: Budget warning
    const budget = await semanticBudgetManager.getActiveBudget();
    if (budget.warningLevel === 'critical' || budget.warningLevel === 'depleted') {
      alerts.push({
        id: `budget-${Date.now()}`,
        type: 'budget_warning',
        severity: budget.warningLevel === 'depleted' ? 'critical' : 'warning',
        message: budget.warningLevel === 'depleted' 
          ? 'Budget depleted - AI operations blocked'
          : `Budget ${(budget.percentUsed * 100).toFixed(1)}% depleted`,
        details: {
          currentValue: budget.remainingFunds,
          expectedValue: budget.allocatedFunds,
          deviation: budget.percentUsed * 100
        },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Alert 3: Cost anomaly (individual operation >3x average)
    const anomalousOps = recentOps.filter(op => Number(op.cost) > baselineAvgCost * 3);
    if (anomalousOps.length > 0) {
      const affectedProjects = [...new Set(anomalousOps.map(op => op.projectId).filter(Boolean))] as string[];
      
      alerts.push({
        id: `anomaly-${Date.now()}`,
        type: 'cost_anomaly',
        severity: 'warning',
        message: `${anomalousOps.length} operations with unusually high costs detected`,
        details: {
          currentValue: Math.max(...anomalousOps.map(op => Number(op.cost))),
          expectedValue: baselineAvgCost,
          deviation: (Math.max(...anomalousOps.map(op => Number(op.cost))) / baselineAvgCost) * 100,
          affectedProjects
        },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Alert 4: Efficiency drop (cost per chunk increasing)
    const baselineCostPerChunk = baselineOps.reduce((sum, op) => sum + Number(op.cost), 0) /
                                 baselineOps.reduce((sum, op) => sum + op.chunksProcessed, 0);
    const recentCostPerChunk = recentOps.reduce((sum, op) => sum + Number(op.cost), 0) /
                               recentOps.reduce((sum, op) => sum + op.chunksProcessed, 0);

    const efficiencyDrop = ((recentCostPerChunk - baselineCostPerChunk) / baselineCostPerChunk) * 100;
    if (efficiencyDrop > 30) {
      alerts.push({
        id: `efficiency-${Date.now()}`,
        type: 'efficiency_drop',
        severity: 'info',
        message: `Cost per chunk has increased by ${efficiencyDrop.toFixed(1)}%`,
        details: {
          currentValue: recentCostPerChunk,
          expectedValue: baselineCostPerChunk,
          deviation: efficiencyDrop
        },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  /**
   * Generate comprehensive operation summary report
   */
  async generateOperationSummary(operationId: string): Promise<OperationSummaryReport> {
    const operation = await prisma.semanticOperation.findUnique({
      where: { id: operationId }
    });

    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    // Calculate cost breakdown
    const embeddingCost = operation.operationType === 'embedding' ? Number(operation.cost) : 0;
    const summarizationCost = operation.operationType === 'summarization' ? Number(operation.cost) : 0;
    const totalCost = Number(operation.cost);

    // Calculate efficiency metrics
    const duration = operation.duration || 0;
    const chunksProcessed = operation.chunksProcessed || 0;
    const costPerChunk = chunksProcessed > 0 ? totalCost / chunksProcessed : 0;
    const tokensPerChunk = chunksProcessed > 0 ? operation.tokensUsed / chunksProcessed : 0;
    const chunksPerSecond = duration > 0 ? chunksProcessed / (duration / 1000) : 0;

    // Get budget impact
    const budget = await semanticBudgetManager.getActiveBudget();

    // Get comparison data
    const avgOperation = await this.getAverageOperationCost(operation.operationType);
    const costDiffVsAvg = totalCost - avgOperation;
    const percentDiffVsAvg = avgOperation > 0 ? (costDiffVsAvg / avgOperation) * 100 : 0;

    let projectAvgComparison;
    if (operation.projectId) {
      const projectAvg = await this.getProjectAverageCost(operation.projectId);
      const costDiffVsProject = totalCost - projectAvg;
      const percentDiffVsProject = projectAvg > 0 ? (costDiffVsProject / projectAvg) * 100 : 0;
      
      projectAvgComparison = {
        costDifference: costDiffVsProject,
        percentDifference: percentDiffVsProject
      };
    }

    return {
      operationId: operation.id,
      operationType: operation.operationType,
      projectId: operation.projectId || undefined,
      startTime: operation.startedAt,
      endTime: operation.completedAt || operation.startedAt,
      duration,
      success: operation.success,
      
      costBreakdown: {
        embedding: {
          cost: embeddingCost,
          tokens: operation.operationType === 'embedding' ? operation.tokensUsed : 0,
          chunks: operation.operationType === 'embedding' ? chunksProcessed : 0
        },
        summarization: {
          cost: summarizationCost,
          tokens: operation.operationType === 'summarization' ? operation.tokensUsed : 0,
          chunks: operation.operationType === 'summarization' ? chunksProcessed : 0
        },
        total: {
          cost: totalCost,
          tokens: operation.tokensUsed
        }
      },
      
      efficiency: {
        costPerChunk,
        tokensPerChunk,
        chunksPerSecond
      },
      
      budgetImpact: {
        remainingBudget: budget.remainingFunds,
        percentUsed: budget.percentUsed,
        warningLevel: budget.warningLevel
      },
      
      comparison: {
        vsAverageOperation: {
          costDifference: costDiffVsAvg,
          percentDifference: percentDiffVsAvg
        },
        vsProjectAverage: projectAvgComparison
      }
    };
  }

  /**
   * Helper: Estimate tokens for projects
   */
  private async estimateTokensForProjects(
    projectIds: string[],
    sectionIds?: string[]
  ): Promise<{
    t1: { sections: number; inputTokens: number; outputTokens: number; embeddingTokens: number };
    t2: { sections: number; inputTokens: number; outputTokens: number; embeddingTokens: number };
    t3: { chunks: number; embeddingTokens: number };
  }> {
    // Get existing chunks to estimate (entity-based post-D37)
    const projectSlugs = (await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { slug: true }
    })).map((p) => p.slug);
    const where: any = {
      entity: { entityType: 'PROJECT', slug: { in: projectSlugs } }
    };

    if (sectionIds && sectionIds.length > 0) {
      where.sectionGroup = { in: sectionIds };
    }

    const chunks = await prisma.contextChunk.findMany({
      where,
      select: {
        tier: true,
        tokenCount: true,
        content: true
      }
    });

    // Estimate based on existing chunks or defaults
    const t1Chunks = chunks.filter(c => c.tier === 1);
    const t2Chunks = chunks.filter(c => c.tier === 2);
    const t3Chunks = chunks.filter(c => c.tier === 3);

    // T1: One per project, ~500 input tokens, ~200 output tokens
    const t1Count = projectIds.length;
    const t1InputTokens = t1Count * 500;
    const t1OutputTokens = t1Count * 200;
    const t1EmbeddingTokens = t1Count * 200; // Embed the summary

    // T2: Average 5 sections per project, ~300 input tokens, ~150 output tokens each
    const t2Count = t2Chunks.length || (projectIds.length * 5);
    const t2InputTokens = t2Count * 300;
    const t2OutputTokens = t2Count * 150;
    const t2EmbeddingTokens = t2Count * 150; // Embed the summary

    // T3: Average 20 chunks per project, ~300 tokens each
    const t3Count = t3Chunks.length || (projectIds.length * 20);
    const t3EmbeddingTokens = t3Count * 300; // Embed full content

    return {
      t1: {
        sections: t1Count,
        inputTokens: t1InputTokens,
        outputTokens: t1OutputTokens,
        embeddingTokens: t1EmbeddingTokens
      },
      t2: {
        sections: t2Count,
        inputTokens: t2InputTokens,
        outputTokens: t2OutputTokens,
        embeddingTokens: t2EmbeddingTokens
      },
      t3: {
        chunks: t3Count,
        embeddingTokens: t3EmbeddingTokens
      }
    };
  }

  /**
   * Helper: Calculate summarization cost
   */
  private calculateSummarizationCost(model: string, inputTokens: number, outputTokens: number): number {
    const inputCostPer1K = this.SUMMARIZATION_INPUT_COSTS[model as keyof typeof this.SUMMARIZATION_INPUT_COSTS] || 0.00015;
    const outputCostPer1K = this.SUMMARIZATION_OUTPUT_COSTS[model as keyof typeof this.SUMMARIZATION_OUTPUT_COSTS] || 0.0006;
    
    return (inputTokens / 1000) * inputCostPer1K + (outputTokens / 1000) * outputCostPer1K;
  }

  /**
   * Helper: Calculate embedding cost
   */
  private calculateEmbeddingCost(model: string, tokens: number): number {
    const costPer1K = this.EMBEDDING_COSTS[model as keyof typeof this.EMBEDDING_COSTS] || 0.00002;
    return (tokens / 1000) * costPer1K;
  }

  /**
   * Helper: Get average operation cost
   */
  private async getAverageOperationCost(operationType: string): Promise<number> {
    const operations = await prisma.semanticOperation.findMany({
      where: {
        operationType,
        success: true
      },
      select: { cost: true }
    });

    if (operations.length === 0) return 0;

    const total = operations.reduce((sum, op) => sum + Number(op.cost), 0);
    return total / operations.length;
  }

  /**
   * Helper: Get project average cost
   */
  private async getProjectAverageCost(projectId: string): Promise<number> {
    const operations = await prisma.semanticOperation.findMany({
      where: {
        projectId,
        success: true
      },
      select: { cost: true }
    });

    if (operations.length === 0) return 0;

    const total = operations.reduce((sum, op) => sum + Number(op.cost), 0);
    return total / operations.length;
  }
}

// Export singleton instance
export const costEstimationService = new CostEstimationService();
