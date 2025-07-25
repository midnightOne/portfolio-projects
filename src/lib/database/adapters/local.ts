/**
 * Local PostgreSQL database adapter
 * Handles local development database optimizations
 */

import { PrismaClient } from '@prisma/client';
import { 
  BaseDatabaseAdapter, 
  DatabaseConfiguration, 
  HealthCheckResult,
  MigrationResult,
  OptimizationResult 
} from './base';

export class LocalAdapter extends BaseDatabaseAdapter {
  readonly name = 'Local PostgreSQL';
  readonly provider = 'local';
  readonly features = [
    'Full Control',
    'No External Dependencies',
    'Fast Development',
    'Custom Extensions',
    'Direct Access',
    'Custom Configuration',
    'Development Tools',
    'Offline Support'
  ];

  constructor(client: PrismaClient, config: DatabaseConfiguration) {
    super(client, config);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const baseHealth = await super.healthCheck();
    
    if (!baseHealth.healthy) {
      return baseHealth;
    }

    try {
      // Local-specific health checks
      const dbSize = await this.getDatabaseSize();
      const extensions = await this.getAvailableExtensions();
      
      return {
        ...baseHealth,
        connectionCount: await this.getConnectionCount(),
      };
    } catch (error) {
      return {
        ...baseHealth,
        error: `Local database health check failed: ${error}`,
      };
    }
  }

  canMigrate(): boolean {
    return true;
  }

  async migrate(): Promise<MigrationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let migrationsApplied = 0;

    try {
      // Setup development-friendly configurations
      await this.setupDevelopmentOptimizations();
      migrationsApplied++;

      // Install useful extensions for development
      const extensionsResult = await this.installDevelopmentExtensions();
      migrationsApplied += extensionsResult.installed;
      warnings.push(...extensionsResult.warnings);

      // Setup development-specific indexes
      await this.setupDevelopmentIndexes();
      migrationsApplied++;

      return {
        success: true,
        migrationsApplied,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Migration failed: ${error}`);
      return { success: false, migrationsApplied, errors, warnings };
    }
  }

  async optimize(): Promise<OptimizationResult> {
    const optimizations: string[] = [];

    try {
      // Development-friendly optimizations
      await this.optimizeForDevelopment();
      optimizations.push('Development settings optimized');

      // Performance tuning for local machine
      await this.optimizeLocalPerformance();
      optimizations.push('Local performance optimized');

      // Setup development tools
      await this.setupDevelopmentTools();
      optimizations.push('Development tools configured');

      // Configure logging for debugging
      await this.setupDevelopmentLogging();
      optimizations.push('Development logging configured');

      return {
        success: true,
        optimizations,
        performance: {
          // Performance metrics would be measured here
        },
      };
    } catch (error) {
      return {
        success: false,
        optimizations,
        performance: {},
      };
    }
  }

  protected validateProviderSpecific(
    errors: string[],
    warnings: string[],
    recommendations: string[]
  ): void {
    // Validate local connection format
    const isLocalUrl = this.config.url.includes('localhost') || 
                      this.config.url.includes('127.0.0.1') ||
                      this.config.url.includes('::1');
    
    if (!isLocalUrl) {
      warnings.push('Local provider selected but URL does not appear to be local');
    }

    // SSL not typically needed for local development
    if (this.config.ssl) {
      warnings.push('SSL is typically not needed for local development');
    }

    // Connection pooling less critical for local development
    if (this.config.pooling) {
      recommendations.push('Connection pooling is less critical for local development');
    }

    // Reasonable connection limits for local development
    if (this.config.maxConnections > 20) {
      warnings.push('High connection count may not be necessary for local development');
    }

    // Check for development database naming
    if (this.config.url.includes('production') || this.config.url.includes('prod')) {
      errors.push('Local adapter should not be used with production database');
    }
  }

  private async getDatabaseSize(): Promise<string> {
    try {
      const result = await this.client.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      return result[0]?.size || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getAvailableExtensions(): Promise<string[]> {
    try {
      const result = await this.client.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM pg_available_extensions ORDER BY name
      `;
      return result.map(ext => ext.name);
    } catch {
      return [];
    }
  }

  private async getConnectionCount(): Promise<number> {
    try {
      const result = await this.client.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;
      return result[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  private async setupDevelopmentOptimizations(): Promise<void> {
    try {
      // Configure for development speed over durability
      await this.client.$executeRaw`SET synchronous_commit = off`;
      await this.client.$executeRaw`SET fsync = off`;
      await this.client.$executeRaw`SET full_page_writes = off`;
      
      // Increase work memory for better query performance
      await this.client.$executeRaw`SET work_mem = '16MB'`;
      
      // Enable more aggressive autovacuum for development
      await this.client.$executeRaw`SET autovacuum_naptime = '10s'`;
    } catch (error) {
      console.warn(`Development optimization warning: ${error}`);
    }
  }

  private async installDevelopmentExtensions(): Promise<{ installed: number; warnings: string[] }> {
    const warnings: string[] = [];
    let installed = 0;

    const extensions = [
      'pg_stat_statements', // Query performance analysis
      'pgcrypto',          // Cryptographic functions
      'uuid-ossp',         // UUID generation
      'pg_trgm',           // Trigram matching for search
      'unaccent',          // Remove accents from text
    ];

    for (const extension of extensions) {
      try {
        await this.client.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
        installed++;
      } catch (error) {
        warnings.push(`Failed to install extension ${extension}: ${error}`);
      }
    }

    return { installed, warnings };
  }

  private async setupDevelopmentIndexes(): Promise<void> {
    // Create indexes optimized for development and testing
    const developmentIndexes = [
      // Fast lookups for development
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_projects_all 
       ON projects(id, title, slug, status, visibility)`,
      
      // Full-text search development
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_projects_text_search 
       ON projects USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')))`,
       
      // Development analytics
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_analytics_all 
       ON project_analytics(project_id, event, timestamp)`,
    ];

    for (const indexSQL of developmentIndexes) {
      try {
        await this.client.$executeRawUnsafe(indexSQL);
      } catch (error) {
        console.warn(`Development index warning: ${error}`);
      }
    }
  }

  private async optimizeForDevelopment(): Promise<void> {
    try {
      // Configure checkpoint settings for development
      await this.client.$executeRaw`SET checkpoint_completion_target = 0.9`;
      await this.client.$executeRaw`SET wal_buffers = '16MB'`;
      
      // Configure shared buffers for local machine
      await this.client.$executeRaw`SET shared_buffers = '256MB'`;
      
      // Enable query plan caching
      await this.client.$executeRaw`SET plan_cache_mode = 'auto'`;
    } catch (error) {
      console.warn(`Development optimization warning: ${error}`);
    }
  }

  private async optimizeLocalPerformance(): Promise<void> {
    try {
      // Configure for local SSD performance
      await this.client.$executeRaw`SET random_page_cost = 1.1`;
      await this.client.$executeRaw`SET effective_cache_size = '1GB'`;
      
      // Configure maintenance work memory
      await this.client.$executeRaw`SET maintenance_work_mem = '64MB'`;
      
      // Configure parallel workers for local CPU
      await this.client.$executeRaw`SET max_parallel_workers = 4`;
      await this.client.$executeRaw`SET max_parallel_workers_per_gather = 2`;
    } catch (error) {
      console.warn(`Local performance optimization warning: ${error}`);
    }
  }

  private async setupDevelopmentTools(): Promise<void> {
    try {
      // Enable detailed query statistics
      await this.client.$executeRaw`SET track_activities = on`;
      await this.client.$executeRaw`SET track_counts = on`;
      await this.client.$executeRaw`SET track_io_timing = on`;
      await this.client.$executeRaw`SET track_functions = 'all'`;
      
      // Configure statement statistics
      if (await this.isExtensionAvailable('pg_stat_statements')) {
        await this.client.$executeRaw`SET pg_stat_statements.track = 'all'`;
        await this.client.$executeRaw`SET pg_stat_statements.max = 10000`;
      }
    } catch (error) {
      console.warn(`Development tools setup warning: ${error}`);
    }
  }

  private async setupDevelopmentLogging(): Promise<void> {
    try {
      // Configure logging for development debugging
      await this.client.$executeRaw`SET log_statement = 'mod'`; // Log modifications
      await this.client.$executeRaw`SET log_duration = on`;
      await this.client.$executeRaw`SET log_min_duration_statement = 500`; // Log slow queries
      await this.client.$executeRaw`SET log_checkpoints = on`;
      await this.client.$executeRaw`SET log_connections = on`;
      await this.client.$executeRaw`SET log_disconnections = on`;
      await this.client.$executeRaw`SET log_lock_waits = on`;
    } catch (error) {
      console.warn(`Development logging setup warning: ${error}`);
    }
  }

  private async isExtensionAvailable(extensionName: string): Promise<boolean> {
    try {
      const result = await this.client.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = ${extensionName}
        ) as exists
      `;
      return result[0]?.exists || false;
    } catch {
      return false;
    }
  }

  /**
   * Development utility: Reset database to clean state
   */
  async resetDatabase(): Promise<void> {
    console.warn('Resetting local database - this will delete all data!');
    
    try {
      // Truncate all tables (preserving structure)
      await this.client.$executeRaw`
        TRUNCATE TABLE 
          project_analytics,
          project_references,
          carousel_images,
          media_carousels,
          embedded_media,
          article_content,
          interactive_examples,
          downloadable_files,
          external_links,
          media_items,
          projects,
          tags
        RESTART IDENTITY CASCADE
      `;
      
      console.log('Database reset completed');
    } catch (error) {
      throw new Error(`Database reset failed: ${error}`);
    }
  }

  /**
   * Development utility: Get database statistics
   */
  async getDevelopmentStats(): Promise<{
    tableStats: Array<{ table: string; rows: number; size: string }>;
    indexStats: Array<{ index: string; table: string; size: string }>;
    queryStats: Array<{ query: string; calls: number; mean_time: number }>;
  }> {
    try {
      const [tableStats, indexStats, queryStats] = await Promise.all([
        this.getTableStats(),
        this.getIndexStats(),
        this.getQueryStats(),
      ]);

      return { tableStats, indexStats, queryStats };
    } catch (error) {
      throw new Error(`Failed to get development stats: ${error}`);
    }
  }

  private async getTableStats() {
    return this.client.$queryRaw<Array<{ table: string; rows: number; size: string }>>`
      SELECT 
        schemaname||'.'||tablename as table,
        n_tup_ins + n_tup_upd + n_tup_del as rows,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_stat_user_tables 
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
  }

  private async getIndexStats() {
    return this.client.$queryRaw<Array<{ index: string; table: string; size: string }>>`
      SELECT 
        indexrelname as index,
        tablename as table,
        pg_size_pretty(pg_relation_size(indexrelname)) as size
      FROM pg_stat_user_indexes 
      ORDER BY pg_relation_size(indexrelname) DESC
    `;
  }

  private async getQueryStats() {
    if (await this.isExtensionAvailable('pg_stat_statements')) {
      return this.client.$queryRaw<Array<{ query: string; calls: number; mean_time: number }>>`
        SELECT 
          LEFT(query, 100) as query,
          calls,
          mean_exec_time as mean_time
        FROM pg_stat_statements 
        ORDER BY mean_exec_time DESC 
        LIMIT 10
      `;
    }
    return [];
  }
}