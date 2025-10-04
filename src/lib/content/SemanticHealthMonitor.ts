/**
 * Semantic System Health Monitor
 * 
 * Provides comprehensive health monitoring for the semantic content management system,
 * including database performance metrics, embedding coverage analytics, and cost tracking.
 */

import { PrismaClient } from '@prisma/client';
import VectorOperations from './VectorOperations';
import { semanticBudgetManager } from './SemanticBudgetManager';
import { embeddingCache } from './EmbeddingCache';

const prisma = new PrismaClient();

export interface SemanticHealthMetrics {
  // Database health
  database: {
    totalChunks: number;
    chunksWithEmbeddings: number;
    embeddingCoverage: number; // Percentage
    averageQueryTime: number; // ms
    indexSize: string;
    lastMaintenance: Date | null;
  };
  
  // Content distribution
  content: {
    entitiesByType: Record<string, number>;
    chunksByTier: Record<number, number>;
    averageImportanceScore: number;
    manuallyEditedChunks: number;
    orphanedChunks: number;
  };
  
  // Performance metrics
  performance: {
    searchLatency: {
      p50: number;
      p95: number;
      p99: number;
    };
    embeddingGeneration: {
      averageTime: number;
      successRate: number;
      cacheHitRate: number;
    };
    indexMaintenance: {
      lastRun: Date | null;
      averageDuration: number;
      successRate: number;
    };
  };
  
  // Cost tracking
  costs: {
    totalSpent: number;
    dailySpend: number;
    weeklySpend: number;
    monthlySpend: number;
    budgetUtilization: number; // Percentage
    costPerChunk: number;
    costTrends: Array<{ date: string; cost: number }>;
  };
  
  // System health indicators
  health: {
    overall: 'healthy' | 'warning' | 'critical' | 'error';
    issues: Array<{
      type: 'performance' | 'cost' | 'data' | 'system';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      recommendation: string;
    }>;
    lastChecked: Date;
  };
}

export interface HealthCheckOptions {
  includePerformanceTests?: boolean;
  includeCostAnalysis?: boolean;
  includeDataValidation?: boolean;
  maxQueryTime?: number; // ms
}

export class SemanticHealthMonitor {
  private vectorOps: VectorOperations;
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor() {
    this.vectorOps = new VectorOperations(prisma);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(options: HealthCheckOptions = {}): Promise<SemanticHealthMetrics> {
    const startTime = Date.now();
    
    console.log('[SemanticHealthMonitor] Starting comprehensive health check...');

    try {
      // Gather all metrics in parallel
      const [
        databaseMetrics,
        contentMetrics,
        performanceMetrics,
        costMetrics
      ] = await Promise.all([
        this.getDatabaseHealth(),
        this.getContentDistribution(),
        options.includePerformanceTests ? this.getPerformanceMetrics() : this.getBasicPerformanceMetrics(),
        options.includeCostAnalysis ? this.getCostMetrics() : this.getBasicCostMetrics()
      ]);

      // Analyze health issues
      const healthAnalysis = this.analyzeSystemHealth({
        database: databaseMetrics,
        content: contentMetrics,
        performance: performanceMetrics,
        costs: costMetrics
      });

      const totalTime = Date.now() - startTime;
      console.log(`[SemanticHealthMonitor] Health check completed in ${totalTime}ms`);

      return {
        database: databaseMetrics,
        content: contentMetrics,
        performance: performanceMetrics,
        costs: costMetrics,
        health: {
          ...healthAnalysis,
          lastChecked: new Date()
        }
      };

    } catch (error) {
      console.error('[SemanticHealthMonitor] Health check failed:', error);
      
      return {
        database: this.getEmptyDatabaseMetrics(),
        content: this.getEmptyContentMetrics(),
        performance: this.getEmptyPerformanceMetrics(),
        costs: this.getEmptyCostMetrics(),
        health: {
          overall: 'error',
          issues: [{
            type: 'system',
            severity: 'critical',
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendation: 'Check system logs and database connectivity'
          }],
          lastChecked: new Date()
        }
      };
    }
  }

  /**
   * Get database health metrics
   */
  private async getDatabaseHealth(): Promise<SemanticHealthMetrics['database']> {
    const startTime = Date.now();

    // Get basic counts
    const [totalChunks, chunksWithEmbeddings] = await Promise.all([
      prisma.contextChunk.count(),
      this.vectorOps.getVectorCount()
    ]);

    // Calculate embedding coverage
    const embeddingCoverage = totalChunks > 0 ? (chunksWithEmbeddings / totalChunks) * 100 : 0;

    // Measure query performance with a simple test query
    const queryStartTime = Date.now();
    await prisma.contextChunk.findMany({ take: 1 });
    const averageQueryTime = Date.now() - queryStartTime;

    // Estimate index size (rough approximation)
    const indexSize = this.formatBytes(chunksWithEmbeddings * 1536 * 4); // 1536 dimensions * 4 bytes per float

    // Get last maintenance timestamp (would need to be tracked separately)
    const lastMaintenance = null; // TODO: Implement maintenance tracking

    return {
      totalChunks,
      chunksWithEmbeddings,
      embeddingCoverage: Math.round(embeddingCoverage * 100) / 100,
      averageQueryTime,
      indexSize,
      lastMaintenance
    };
  }

  /**
   * Get content distribution metrics
   */
  private async getContentDistribution(): Promise<SemanticHealthMetrics['content']> {
    // Get entities by type
    const entitiesByTypeRaw = await prisma.contentEntity.groupBy({
      by: ['entityType'],
      _count: { id: true }
    });

    const entitiesByType = entitiesByTypeRaw.reduce((acc, item) => {
      acc[item.entityType] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Get chunks by tier
    const chunksByTierRaw = await prisma.contextChunk.groupBy({
      by: ['tier'],
      _count: { id: true },
      _avg: { importance: true }
    });

    const chunksByTier = chunksByTierRaw.reduce((acc, item) => {
      acc[item.tier] = item._count.id;
      return acc;
    }, {} as Record<number, number>);

    // Calculate average importance score
    const avgImportanceData = await prisma.contextChunk.aggregate({
      _avg: { importance: true }
    });
    const averageImportanceScore = avgImportanceData._avg.importance || 0;

    // Count manually edited chunks
    const manuallyEditedChunks = await prisma.contextChunk.count({
      where: { manuallyEdited: true }
    });

    // Count orphaned chunks (chunks without valid entity references)
    // Note: This is a simplified check - in practice, we'd need to check for missing entity relationships
    const orphanedChunks = 0; // Placeholder - would need more complex query to detect orphaned chunks

    return {
      entitiesByType,
      chunksByTier,
      averageImportanceScore: Math.round(averageImportanceScore * 1000) / 1000,
      manuallyEditedChunks,
      orphanedChunks
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<SemanticHealthMetrics['performance']> {
    // Perform search latency tests
    const searchLatencies = await this.measureSearchLatency();
    
    // Get embedding generation metrics
    const embeddingMetrics = this.getEmbeddingMetrics();
    
    // Get index maintenance metrics (placeholder)
    const maintenanceMetrics = {
      lastRun: null,
      averageDuration: 0,
      successRate: 1.0
    };

    return {
      searchLatency: searchLatencies,
      embeddingGeneration: embeddingMetrics,
      indexMaintenance: maintenanceMetrics
    };
  }

  /**
   * Get basic performance metrics (faster, no tests)
   */
  private async getBasicPerformanceMetrics(): Promise<SemanticHealthMetrics['performance']> {
    return {
      searchLatency: { p50: 0, p95: 0, p99: 0 },
      embeddingGeneration: {
        averageTime: 0,
        successRate: 1.0,
        cacheHitRate: embeddingCache.getStats().hitRate || 0
      },
      indexMaintenance: {
        lastRun: null,
        averageDuration: 0,
        successRate: 1.0
      }
    };
  }

  /**
   * Measure search latency with test queries
   */
  private async measureSearchLatency(): Promise<{ p50: number; p95: number; p99: number }> {
    const testQueries = [
      'javascript react',
      'database performance',
      'api integration',
      'user interface',
      'technical implementation'
    ];

    const latencies: number[] = [];

    for (const query of testQueries) {
      const startTime = Date.now();
      try {
        // Perform a simple database query to measure latency
        await prisma.contextChunk.findMany({
          where: {
            content: { contains: query, mode: 'insensitive' }
          },
          take: 5
        });
        latencies.push(Date.now() - startTime);
      } catch (error) {
        console.warn(`Search latency test failed for query "${query}":`, error);
        latencies.push(1000); // Penalty for failed queries
      }
    }

    latencies.sort((a, b) => a - b);
    
    return {
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0
    };
  }

  /**
   * Get embedding generation metrics
   */
  private getEmbeddingMetrics(): SemanticHealthMetrics['performance']['embeddingGeneration'] {
    const cacheStats = embeddingCache.getStats();
    
    return {
      averageTime: 500, // Placeholder - would need to track actual times
      successRate: 0.98, // Placeholder - would need to track failures
      cacheHitRate: cacheStats.hitRate || 0
    };
  }

  /**
   * Get cost metrics
   */
  private async getCostMetrics(): Promise<SemanticHealthMetrics['costs']> {
    try {
      const budget = await semanticBudgetManager.getActiveBudget();
      const operations = await semanticBudgetManager.getSpendingHistory({});

      // Calculate time-based spending
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailySpend = operations
        .filter(op => new Date(op.startedAt) >= oneDayAgo)
        .reduce((sum, op) => sum + op.cost, 0);

      const weeklySpend = operations
        .filter(op => new Date(op.startedAt) >= oneWeekAgo)
        .reduce((sum, op) => sum + op.cost, 0);

      const monthlySpend = operations
        .filter(op => new Date(op.startedAt) >= oneMonthAgo)
        .reduce((sum, op) => sum + op.cost, 0);

      // Calculate cost per chunk
      const totalChunks = await prisma.contextChunk.count();
      const costPerChunk = totalChunks > 0 ? budget.totalSpent / totalChunks : 0;

      // Generate cost trends (last 7 days)
      const costTrends = this.generateCostTrends(operations, 7);

      return {
        totalSpent: budget.totalSpent,
        dailySpend,
        weeklySpend,
        monthlySpend,
        budgetUtilization: budget.allocatedFunds > 0 ? (budget.totalSpent / budget.allocatedFunds) * 100 : 0,
        costPerChunk,
        costTrends
      };
    } catch (error) {
      console.warn('Failed to get cost metrics:', error);
      return this.getEmptyCostMetrics();
    }
  }

  /**
   * Get basic cost metrics (faster)
   */
  private async getBasicCostMetrics(): Promise<SemanticHealthMetrics['costs']> {
    try {
      const budget = await semanticBudgetManager.getActiveBudget();
      
      return {
        totalSpent: budget.totalSpent,
        dailySpend: 0,
        weeklySpend: 0,
        monthlySpend: 0,
        budgetUtilization: budget.allocatedFunds > 0 ? (budget.totalSpent / budget.allocatedFunds) * 100 : 0,
        costPerChunk: 0,
        costTrends: []
      };
    } catch (error) {
      return this.getEmptyCostMetrics();
    }
  }

  /**
   * Generate cost trends over time
   */
  private generateCostTrends(operations: any[], days: number): Array<{ date: string; cost: number }> {
    const trends: Array<{ date: string; cost: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayCost = operations
        .filter(op => new Date(op.startedAt) >= dayStart && new Date(op.startedAt) < dayEnd)
        .reduce((sum, op) => sum + op.cost, 0);
      
      trends.push({ date: dateStr, cost: Math.round(dayCost * 10000) / 10000 });
    }

    return trends;
  }

  /**
   * Analyze system health and identify issues
   */
  private analyzeSystemHealth(metrics: {
    database: SemanticHealthMetrics['database'];
    content: SemanticHealthMetrics['content'];
    performance: SemanticHealthMetrics['performance'];
    costs: SemanticHealthMetrics['costs'];
  }): { overall: SemanticHealthMetrics['health']['overall']; issues: SemanticHealthMetrics['health']['issues'] } {
    const issues: SemanticHealthMetrics['health']['issues'] = [];

    // Database health checks
    if (metrics.database.embeddingCoverage < 80) {
      issues.push({
        type: 'data',
        severity: 'medium',
        message: `Low embedding coverage: ${metrics.database.embeddingCoverage.toFixed(1)}%`,
        recommendation: 'Run embedding generation for missing chunks'
      });
    }

    if (metrics.database.averageQueryTime > 1000) {
      issues.push({
        type: 'performance',
        severity: 'high',
        message: `Slow database queries: ${metrics.database.averageQueryTime}ms average`,
        recommendation: 'Consider database optimization or index maintenance'
      });
    }

    // Content health checks
    if (metrics.content.orphanedChunks > 0) {
      issues.push({
        type: 'data',
        severity: 'low',
        message: `${metrics.content.orphanedChunks} orphaned chunks found`,
        recommendation: 'Run cleanup operation to remove orphaned chunks'
      });
    }

    // Cost health checks
    if (metrics.costs.budgetUtilization > 90) {
      issues.push({
        type: 'cost',
        severity: 'high',
        message: `Budget utilization: ${metrics.costs.budgetUtilization.toFixed(1)}%`,
        recommendation: 'Allocate additional budget or optimize operations'
      });
    }

    if (metrics.costs.dailySpend > metrics.costs.totalSpent * 0.1) {
      issues.push({
        type: 'cost',
        severity: 'medium',
        message: 'High daily spending detected',
        recommendation: 'Review recent operations for cost optimization opportunities'
      });
    }

    // Performance health checks
    if (metrics.performance.searchLatency.p95 > 2000) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: `High search latency: ${metrics.performance.searchLatency.p95}ms (p95)`,
        recommendation: 'Optimize search queries or consider caching improvements'
      });
    }

    // Determine overall health
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;

    let overall: SemanticHealthMetrics['health']['overall'];
    if (criticalIssues > 0) {
      overall = 'critical';
    } else if (highIssues > 0) {
      overall = 'warning';
    } else if (mediumIssues > 2) {
      overall = 'warning';
    } else {
      overall = 'healthy';
    }

    return { overall, issues };
  }

  // Helper methods for empty metrics
  private getEmptyDatabaseMetrics(): SemanticHealthMetrics['database'] {
    return {
      totalChunks: 0,
      chunksWithEmbeddings: 0,
      embeddingCoverage: 0,
      averageQueryTime: 0,
      indexSize: '0 B',
      lastMaintenance: null
    };
  }

  private getEmptyContentMetrics(): SemanticHealthMetrics['content'] {
    return {
      entitiesByType: {},
      chunksByTier: {},
      averageImportanceScore: 0,
      manuallyEditedChunks: 0,
      orphanedChunks: 0
    };
  }

  private getEmptyPerformanceMetrics(): SemanticHealthMetrics['performance'] {
    return {
      searchLatency: { p50: 0, p95: 0, p99: 0 },
      embeddingGeneration: { averageTime: 0, successRate: 0, cacheHitRate: 0 },
      indexMaintenance: { lastRun: null, averageDuration: 0, successRate: 0 }
    };
  }

  private getEmptyCostMetrics(): SemanticHealthMetrics['costs'] {
    return {
      totalSpent: 0,
      dailySpend: 0,
      weeklySpend: 0,
      monthlySpend: 0,
      budgetUtilization: 0,
      costPerChunk: 0,
      costTrends: []
    };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
let semanticHealthMonitor: SemanticHealthMonitor | null = null;

export function getSemanticHealthMonitor(): SemanticHealthMonitor {
  if (!semanticHealthMonitor) {
    semanticHealthMonitor = new SemanticHealthMonitor();
  }
  return semanticHealthMonitor;
}