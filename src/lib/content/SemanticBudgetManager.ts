/**
 * Semantic Budget Manager
 * 
 * Provides comprehensive budget management for semantic content operations:
 * - Budget allocation and tracking
 * - Real-time cost deduction
 * - Budget depletion detection
 * - Warning thresholds and notifications
 * - Spending history and analytics
 * - Cost breakdown by operation type
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface BudgetAllocation {
  amount: number;
  description?: string;
}

export interface BudgetStatus {
  id: string;
  allocatedFunds: number;
  remainingFunds: number;
  totalSpent: number;
  embeddingCosts: number;
  summarizationCosts: number;
  percentUsed: number;
  warningLevel: 'ok' | 'warning' | 'critical' | 'depleted';
  warningThreshold: number;
  criticalThreshold: number;
  isActive: boolean;
  lastAllocatedAt: Date | null;
  depletedAt: Date | null;
}

export interface OperationCost {
  operationType: 'embedding' | 'summarization' | 'regeneration';
  tokensUsed: number;
  cost: number;
  model: string;
  projectId?: string;
  chunksProcessed?: number;
  tiersAffected?: number[];
  metadata?: Record<string, any>;
}

export interface SpendingHistoryFilter {
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  operationType?: string;
  success?: boolean;
}

export interface BudgetAnalytics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalTokensUsed: number;
  averageCostPerOperation: number;
  costByOperationType: Record<string, number>;
  costByProject: Record<string, number>;
  costTrends: {
    date: string;
    cost: number;
    operations: number;
  }[];
  projections: {
    estimatedDaysRemaining: number;
    estimatedOperationsRemaining: number;
    averageDailyCost: number;
  };
}

export interface CostBreakdown {
  embedding: {
    cost: number;
    operations: number;
    tokens: number;
  };
  summarization: {
    cost: number;
    operations: number;
    tokens: number;
  };
  regeneration: {
    cost: number;
    operations: number;
    tokens: number;
  };
  total: {
    cost: number;
    operations: number;
    tokens: number;
  };
}

export class SemanticBudgetManager {
  /**
   * Get or create the active budget
   */
  async getActiveBudget(): Promise<BudgetStatus> {
    let budget = await prisma.semanticBudget.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // Create default budget if none exists
    if (!budget) {
      budget = await prisma.semanticBudget.create({
        data: {
          allocatedFunds: 10.00, // Default $10
          remainingFunds: 10.00,
          totalSpent: 0.00,
          embeddingCosts: 0.00,
          summarizationCosts: 0.00,
          warningThreshold: 0.8,
          criticalThreshold: 0.9,
          isActive: true,
          lastAllocatedAt: new Date()
        }
      });
    }

    return this.formatBudgetStatus(budget);
  }

  /**
   * Allocate additional funds to the budget
   */
  async allocateFunds(allocation: BudgetAllocation): Promise<BudgetStatus> {
    if (allocation.amount <= 0) {
      throw new Error('Allocation amount must be positive');
    }

    const budget = await this.getActiveBudget();
    
    const updated = await prisma.semanticBudget.update({
      where: { id: budget.id },
      data: {
        allocatedFunds: { increment: new Prisma.Decimal(allocation.amount) },
        remainingFunds: { increment: new Prisma.Decimal(allocation.amount) },
        lastAllocatedAt: new Date(),
        depletedAt: null, // Reset depletion if funds added
        isActive: true
      }
    });

    return this.formatBudgetStatus(updated);
  }

  /**
   * Deduct cost from budget in real-time
   */
  async deductCost(operationCost: OperationCost): Promise<{
    success: boolean;
    remainingFunds: number;
    warningLevel: 'ok' | 'warning' | 'critical' | 'depleted';
    operation: any;
  }> {
    const budget = await this.getActiveBudget();

    // Check if sufficient funds
    if (budget.remainingFunds < operationCost.cost) {
      throw new Error(
        `Insufficient funds. Required: $${operationCost.cost.toFixed(4)}, Available: $${budget.remainingFunds.toFixed(2)}`
      );
    }

    // Create operation record and deduct cost in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create operation record
      const operation = await tx.semanticOperation.create({
        data: {
          budgetId: budget.id,
          projectId: operationCost.projectId,
          operationType: operationCost.operationType,
          tokensUsed: operationCost.tokensUsed,
          cost: new Prisma.Decimal(operationCost.cost),
          model: operationCost.model,
          chunksProcessed: operationCost.chunksProcessed || 0,
          tiersAffected: operationCost.tiersAffected || [],
          success: true,
          metadata: operationCost.metadata || {},
          completedAt: new Date(),
          duration: 0
        }
      });

      // Deduct from budget
      const costField = operationCost.operationType === 'embedding' 
        ? 'embeddingCosts' 
        : 'summarizationCosts';

      const updated = await tx.semanticBudget.update({
        where: { id: budget.id },
        data: {
          remainingFunds: { decrement: new Prisma.Decimal(operationCost.cost) },
          totalSpent: { increment: new Prisma.Decimal(operationCost.cost) },
          [costField]: { increment: new Prisma.Decimal(operationCost.cost) }
        }
      });

      // Check if depleted
      if (Number(updated.remainingFunds) <= 0) {
        await tx.semanticBudget.update({
          where: { id: budget.id },
          data: { depletedAt: new Date() }
        });
      }

      return { operation, updated };
    });

    const status = this.formatBudgetStatus(result.updated);

    return {
      success: true,
      remainingFunds: status.remainingFunds,
      warningLevel: status.warningLevel,
      operation: result.operation
    };
  }

  /**
   * Check if operation can proceed (budget check)
   */
  async canAffordOperation(estimatedCost: number): Promise<{
    canAfford: boolean;
    remainingFunds: number;
    shortfall?: number;
  }> {
    const budget = await this.getActiveBudget();

    if (budget.warningLevel === 'depleted') {
      return {
        canAfford: false,
        remainingFunds: budget.remainingFunds,
        shortfall: estimatedCost - budget.remainingFunds
      };
    }

    const canAfford = budget.remainingFunds >= estimatedCost;

    return {
      canAfford,
      remainingFunds: budget.remainingFunds,
      shortfall: canAfford ? undefined : estimatedCost - budget.remainingFunds
    };
  }

  /**
   * Get spending history with filtering
   */
  async getSpendingHistory(filter: SpendingHistoryFilter = {}) {
    const where: any = {};

    if (filter.projectId) {
      where.projectId = filter.projectId;
    }

    if (filter.operationType) {
      where.operationType = filter.operationType;
    }

    if (filter.success !== undefined) {
      where.success = filter.success;
    }

    if (filter.startDate || filter.endDate) {
      where.startedAt = {};
      if (filter.startDate) {
        where.startedAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.startedAt.lte = filter.endDate;
      }
    }

    const operations = await prisma.semanticOperation.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 1000 // Limit to recent 1000 operations
    });

    return operations.map(op => ({
      id: op.id,
      projectId: op.projectId,
      operationType: op.operationType,
      tokensUsed: op.tokensUsed,
      cost: Number(op.cost),
      model: op.model,
      chunksProcessed: op.chunksProcessed,
      tiersAffected: op.tiersAffected as number[],
      success: op.success,
      error: op.error,
      startedAt: op.startedAt,
      completedAt: op.completedAt,
      duration: op.duration,
      metadata: op.metadata
    }));
  }

  /**
   * Get cost breakdown by operation type
   */
  async getCostBreakdown(): Promise<CostBreakdown> {
    const operations = await prisma.semanticOperation.findMany({
      where: { success: true }
    });

    const breakdown: CostBreakdown = {
      embedding: { cost: 0, operations: 0, tokens: 0 },
      summarization: { cost: 0, operations: 0, tokens: 0 },
      regeneration: { cost: 0, operations: 0, tokens: 0 },
      total: { cost: 0, operations: 0, tokens: 0 }
    };

    for (const op of operations) {
      const cost = Number(op.cost);
      const type = op.operationType as keyof Omit<CostBreakdown, 'total'>;

      if (breakdown[type]) {
        breakdown[type].cost += cost;
        breakdown[type].operations += 1;
        breakdown[type].tokens += op.tokensUsed;
      }

      breakdown.total.cost += cost;
      breakdown.total.operations += 1;
      breakdown.total.tokens += op.tokensUsed;
    }

    return breakdown;
  }

  /**
   * Get budget analytics
   */
  async getBudgetAnalytics(days: number = 30): Promise<BudgetAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const operations = await prisma.semanticOperation.findMany({
      where: {
        startedAt: { gte: startDate }
      },
      orderBy: { startedAt: 'asc' }
    });

    const totalOperations = operations.length;
    const successfulOperations = operations.filter(op => op.success).length;
    const failedOperations = totalOperations - successfulOperations;
    const totalTokensUsed = operations.reduce((sum, op) => sum + op.tokensUsed, 0);
    const totalCost = operations.reduce((sum, op) => sum + Number(op.cost), 0);
    const averageCostPerOperation = totalOperations > 0 ? totalCost / totalOperations : 0;

    // Cost by operation type
    const costByOperationType: Record<string, number> = {};
    operations.forEach(op => {
      costByOperationType[op.operationType] = 
        (costByOperationType[op.operationType] || 0) + Number(op.cost);
    });

    // Cost by project
    const costByProject: Record<string, number> = {};
    operations.forEach(op => {
      if (op.projectId) {
        costByProject[op.projectId] = 
          (costByProject[op.projectId] || 0) + Number(op.cost);
      }
    });

    // Cost trends (daily aggregation)
    const trendMap = new Map<string, { cost: number; operations: number }>();
    operations.forEach(op => {
      const date = op.startedAt.toISOString().split('T')[0];
      const existing = trendMap.get(date) || { cost: 0, operations: 0 };
      existing.cost += Number(op.cost);
      existing.operations += 1;
      trendMap.set(date, existing);
    });

    const costTrends = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Projections
    const budget = await this.getActiveBudget();
    const averageDailyCost = totalCost / days;
    const estimatedDaysRemaining = averageDailyCost > 0 
      ? Math.floor(budget.remainingFunds / averageDailyCost) 
      : Infinity;
    const estimatedOperationsRemaining = averageCostPerOperation > 0
      ? Math.floor(budget.remainingFunds / averageCostPerOperation)
      : Infinity;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      totalTokensUsed,
      averageCostPerOperation,
      costByOperationType,
      costByProject,
      costTrends,
      projections: {
        estimatedDaysRemaining: isFinite(estimatedDaysRemaining) ? estimatedDaysRemaining : 999,
        estimatedOperationsRemaining: isFinite(estimatedOperationsRemaining) ? estimatedOperationsRemaining : 999,
        averageDailyCost
      }
    };
  }

  /**
   * Export spending data to CSV format
   */
  async exportSpendingDataCSV(filter: SpendingHistoryFilter = {}): Promise<string> {
    const operations = await this.getSpendingHistory(filter);

    const headers = [
      'Date',
      'Operation Type',
      'Project ID',
      'Model',
      'Tokens Used',
      'Cost (USD)',
      'Chunks Processed',
      'Success',
      'Duration (ms)',
      'Error'
    ];

    const rows = operations.map(op => [
      op.startedAt.toISOString(),
      op.operationType,
      op.projectId || 'N/A',
      op.model || 'N/A',
      op.tokensUsed.toString(),
      op.cost.toFixed(4),
      op.chunksProcessed.toString(),
      op.success ? 'Yes' : 'No',
      op.duration?.toString() || 'N/A',
      op.error || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Update warning thresholds
   */
  async updateThresholds(warningThreshold: number, criticalThreshold: number): Promise<BudgetStatus> {
    if (warningThreshold < 0 || warningThreshold > 1) {
      throw new Error('Warning threshold must be between 0 and 1');
    }
    if (criticalThreshold < 0 || criticalThreshold > 1) {
      throw new Error('Critical threshold must be between 0 and 1');
    }
    if (warningThreshold >= criticalThreshold) {
      throw new Error('Warning threshold must be less than critical threshold');
    }

    const budget = await this.getActiveBudget();

    const updated = await prisma.semanticBudget.update({
      where: { id: budget.id },
      data: {
        warningThreshold,
        criticalThreshold
      }
    });

    return this.formatBudgetStatus(updated);
  }

  /**
   * Record failed operation
   */
  async recordFailedOperation(
    operationCost: Omit<OperationCost, 'cost'> & { error: string }
  ): Promise<void> {
    const budget = await this.getActiveBudget();

    await prisma.semanticOperation.create({
      data: {
        budgetId: budget.id,
        projectId: operationCost.projectId,
        operationType: operationCost.operationType,
        tokensUsed: operationCost.tokensUsed,
        cost: 0, // No cost for failed operations
        model: operationCost.model,
        chunksProcessed: operationCost.chunksProcessed || 0,
        tiersAffected: operationCost.tiersAffected || [],
        success: false,
        error: operationCost.error,
        metadata: operationCost.metadata || {},
        completedAt: new Date(),
        duration: 0
      }
    });
  }

  /**
   * Format budget status with warning level
   */
  private formatBudgetStatus(budget: any): BudgetStatus {
    const allocatedFunds = Number(budget.allocatedFunds);
    const remainingFunds = Number(budget.remainingFunds);
    const totalSpent = Number(budget.totalSpent);
    const percentUsed = allocatedFunds > 0 ? totalSpent / allocatedFunds : 0;

    let warningLevel: 'ok' | 'warning' | 'critical' | 'depleted' = 'ok';
    
    if (remainingFunds <= 0 || budget.depletedAt) {
      warningLevel = 'depleted';
    } else if (percentUsed >= budget.criticalThreshold) {
      warningLevel = 'critical';
    } else if (percentUsed >= budget.warningThreshold) {
      warningLevel = 'warning';
    }

    return {
      id: budget.id,
      allocatedFunds,
      remainingFunds,
      totalSpent,
      embeddingCosts: Number(budget.embeddingCosts),
      summarizationCosts: Number(budget.summarizationCosts),
      percentUsed,
      warningLevel,
      warningThreshold: budget.warningThreshold,
      criticalThreshold: budget.criticalThreshold,
      isActive: budget.isActive,
      lastAllocatedAt: budget.lastAllocatedAt,
      depletedAt: budget.depletedAt
    };
  }
}

// Export singleton instance
export const semanticBudgetManager = new SemanticBudgetManager();
