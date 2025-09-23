/**
 * Index Maintenance Service
 * 
 * Ensures vector indexes are properly maintained when content changes.
 * Handles automatic index updates, statistics refresh, and performance monitoring.
 */

import { PrismaClient } from '@prisma/client';

export interface IndexMaintenanceConfig {
  autoAnalyzeThreshold: number;  // Number of changes before auto-ANALYZE
  reindexThreshold: number;      // Number of changes before suggesting reindex
  performanceThreshold: number;  // Query time threshold for performance alerts
  enableAutoMaintenance: boolean;
}

export interface IndexStats {
  totalRows: number;
  rowsWithEmbeddings: number;
  indexSize: string;
  lastAnalyzed: Date | null;
  lastVacuumed: Date | null;
  changesSinceAnalyze: number;
}

export interface MaintenanceResult {
  action: 'analyze' | 'reindex' | 'vacuum' | 'none';
  success: boolean;
  duration: number;
  message: string;
  stats?: IndexStats;
}

export class IndexMaintenanceService {
  private static instance: IndexMaintenanceService;
  private prisma: PrismaClient;
  private config: IndexMaintenanceConfig;
  private changeCounter: number = 0;

  private constructor(prisma: PrismaClient, config?: Partial<IndexMaintenanceConfig>) {
    this.prisma = prisma;
    this.config = {
      autoAnalyzeThreshold: 100,      // Auto-analyze after 100 changes
      reindexThreshold: 10000,        // Suggest reindex after 10k changes
      performanceThreshold: 500,      // Alert if queries > 500ms
      enableAutoMaintenance: true,
      ...config
    };
  }

  static getInstance(prisma: PrismaClient, config?: Partial<IndexMaintenanceConfig>): IndexMaintenanceService {
    if (!IndexMaintenanceService.instance) {
      IndexMaintenanceService.instance = new IndexMaintenanceService(prisma, config);
    }
    return IndexMaintenanceService.instance;
  }

  /**
   * Called after content ingestion to trigger maintenance if needed
   */
  async onContentChange(changeType: 'insert' | 'update' | 'delete', count: number = 1): Promise<MaintenanceResult | null> {
    this.changeCounter += count;

    if (!this.config.enableAutoMaintenance) {
      return null;
    }

    // Check if we need to run maintenance
    if (this.changeCounter >= this.config.autoAnalyzeThreshold) {
      return await this.performMaintenance();
    }

    return null;
  }

  /**
   * Perform automatic maintenance based on current state
   */
  async performMaintenance(): Promise<MaintenanceResult> {
    const startTime = Date.now();

    try {
      // Get current index statistics
      const stats = await this.getIndexStats();

      // Determine what maintenance action to take
      if (stats.changesSinceAnalyze >= this.config.reindexThreshold) {
        return await this.reindexVectorIndex();
      } else if (this.changeCounter >= this.config.autoAnalyzeThreshold) {
        return await this.analyzeTable();
      } else {
        return {
          action: 'none',
          success: true,
          duration: Date.now() - startTime,
          message: 'No maintenance needed',
          stats
        };
      }
    } catch (error) {
      return {
        action: 'none',
        success: false,
        duration: Date.now() - startTime,
        message: `Maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update table statistics (lightweight maintenance)
   */
  async analyzeTable(): Promise<MaintenanceResult> {
    const startTime = Date.now();

    try {
      console.log('🔧 Running ANALYZE on context_chunks table...');
      
      await this.prisma.$executeRaw`ANALYZE context_chunks`;
      
      this.changeCounter = 0; // Reset counter after analyze
      
      const stats = await this.getIndexStats();
      const duration = Date.now() - startTime;

      console.log(`✅ ANALYZE completed in ${duration}ms`);

      return {
        action: 'analyze',
        success: true,
        duration,
        message: `Table statistics updated successfully`,
        stats
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ ANALYZE failed:', error);

      return {
        action: 'analyze',
        success: false,
        duration,
        message: `ANALYZE failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reindex vector index (heavy maintenance)
   */
  async reindexVectorIndex(): Promise<MaintenanceResult> {
    const startTime = Date.now();

    try {
      console.log('🔧 Reindexing vector index (this may take several minutes)...');
      
      // Reindex the HNSW vector index
      await this.prisma.$executeRaw`REINDEX INDEX CONCURRENTLY idx_context_chunks_embedding_hnsw`;
      
      // Also analyze after reindex
      await this.prisma.$executeRaw`ANALYZE context_chunks`;
      
      this.changeCounter = 0; // Reset counter after reindex
      
      const stats = await this.getIndexStats();
      const duration = Date.now() - startTime;

      console.log(`✅ Vector index reindexed in ${duration}ms`);

      return {
        action: 'reindex',
        success: true,
        duration,
        message: `Vector index reindexed successfully`,
        stats
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ Reindex failed:', error);

      return {
        action: 'reindex',
        success: false,
        duration,
        message: `Reindex failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get comprehensive index statistics
   */
  async getIndexStats(): Promise<IndexStats> {
    try {
      // Get row counts
      const totalRows = await this.prisma.contextChunk.count();
      
      const rowsWithEmbeddingsResult = await this.prisma.$queryRaw<Array<{count: string}>>`
        SELECT COUNT(*) as count
        FROM context_chunks 
        WHERE embedding_vector IS NOT NULL
      `;
      const rowsWithEmbeddings = parseInt(rowsWithEmbeddingsResult[0].count);

      // Get index size
      const indexSizeResult = await this.prisma.$queryRaw<Array<{size: string}>>`
        SELECT pg_size_pretty(pg_relation_size('idx_context_chunks_embedding_hnsw')) as size
      `;
      const indexSize = indexSizeResult[0]?.size || 'Unknown';

      // Get table statistics
      const tableStatsResult = await this.prisma.$queryRaw<Array<{
        last_analyze: Date | null;
        last_autovacuum: Date | null;
        n_tup_ins: string;
        n_tup_upd: string;
        n_tup_del: string;
      }>>`
        SELECT 
          last_analyze,
          last_autovacuum,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables 
        WHERE relname = 'context_chunks'
      `;

      const tableStats = tableStatsResult[0];
      const changesSinceAnalyze = tableStats ? 
        parseInt(tableStats.n_tup_ins) + parseInt(tableStats.n_tup_upd) + parseInt(tableStats.n_tup_del) : 0;

      return {
        totalRows,
        rowsWithEmbeddings,
        indexSize,
        lastAnalyzed: tableStats?.last_analyze || null,
        lastVacuumed: tableStats?.last_autovacuum || null,
        changesSinceAnalyze
      };
    } catch (error) {
      console.error('Failed to get index stats:', error);
      return {
        totalRows: 0,
        rowsWithEmbeddings: 0,
        indexSize: 'Unknown',
        lastAnalyzed: null,
        lastVacuumed: null,
        changesSinceAnalyze: 0
      };
    }
  }

  /**
   * Check if vector indexes exist and are properly configured
   */
  async verifyIndexes(): Promise<{
    vectorIndexExists: boolean;
    supportingIndexesExist: boolean;
    recommendations: string[];
  }> {
    try {
      // Check for vector index
      const vectorIndexResult = await this.prisma.$queryRaw<Array<{indexname: string}>>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'context_chunks' 
        AND indexname = 'idx_context_chunks_embedding_hnsw'
      `;
      const vectorIndexExists = vectorIndexResult.length > 0;

      // Check for supporting indexes
      const supportingIndexesResult = await this.prisma.$queryRaw<Array<{indexname: string}>>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'context_chunks' 
        AND (indexname = 'idx_context_chunks_tier' OR indexname = 'idx_context_chunks_entity_tier')
      `;
      const supportingIndexesExist = supportingIndexesResult.length >= 2;

      const recommendations: string[] = [];
      
      if (!vectorIndexExists) {
        recommendations.push('Create HNSW vector index: CREATE INDEX CONCURRENTLY idx_context_chunks_embedding_hnsw ON context_chunks USING hnsw (embedding_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64)');
      }
      
      if (!supportingIndexesExist) {
        recommendations.push('Create supporting indexes for filtered searches');
      }

      return {
        vectorIndexExists,
        supportingIndexesExist,
        recommendations
      };
    } catch (error) {
      console.error('Failed to verify indexes:', error);
      return {
        vectorIndexExists: false,
        supportingIndexesExist: false,
        recommendations: ['Unable to verify indexes - check database connection']
      };
    }
  }

  /**
   * Force maintenance regardless of thresholds
   */
  async forceMaintenance(action: 'analyze' | 'reindex' | 'both' = 'analyze'): Promise<MaintenanceResult[]> {
    const results: MaintenanceResult[] = [];

    if (action === 'analyze' || action === 'both') {
      results.push(await this.analyzeTable());
    }

    if (action === 'reindex' || action === 'both') {
      results.push(await this.reindexVectorIndex());
    }

    return results;
  }

  /**
   * Get maintenance recommendations based on current state
   */
  async getMaintenanceRecommendations(): Promise<{
    urgency: 'low' | 'medium' | 'high';
    recommendations: string[];
    stats: IndexStats;
  }> {
    const stats = await this.getIndexStats();
    const recommendations: string[] = [];
    let urgency: 'low' | 'medium' | 'high' = 'low';

    // Check if indexes exist
    const indexCheck = await this.verifyIndexes();
    if (!indexCheck.vectorIndexExists) {
      recommendations.push('CRITICAL: Vector index missing - create immediately');
      urgency = 'high';
    }

    // Check change volume
    if (stats.changesSinceAnalyze >= this.config.reindexThreshold) {
      recommendations.push('High change volume detected - consider reindexing');
      urgency = urgency === 'high' ? 'high' : 'medium';
    } else if (this.changeCounter >= this.config.autoAnalyzeThreshold) {
      recommendations.push('Moderate changes detected - run ANALYZE');
      urgency = urgency === 'high' ? 'high' : urgency === 'medium' ? 'medium' : 'low';
    }

    // Check last analyze time
    if (stats.lastAnalyzed && Date.now() - stats.lastAnalyzed.getTime() > 7 * 24 * 60 * 60 * 1000) {
      recommendations.push('Statistics are over 1 week old - run ANALYZE');
      urgency = urgency === 'high' ? 'high' : 'medium';
    }

    if (recommendations.length === 0) {
      recommendations.push('No maintenance needed - indexes are healthy');
    }

    return {
      urgency,
      recommendations,
      stats
    };
  }

  /**
   * Reset change counter (useful for testing)
   */
  resetChangeCounter(): void {
    this.changeCounter = 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): IndexMaintenanceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IndexMaintenanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}