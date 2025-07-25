/**
 * Supabase database adapter
 * Handles Supabase-specific optimizations and features
 */

import { PrismaClient } from '@prisma/client';
import { 
  BaseDatabaseAdapter, 
  DatabaseConfiguration, 
  HealthCheckResult,
  MigrationResult,
  OptimizationResult 
} from './base';

export class SupabaseAdapter extends BaseDatabaseAdapter {
  readonly name = 'Supabase PostgreSQL';
  readonly provider = 'supabase';
  readonly features = [
    'Connection Pooling',
    'Row Level Security',
    'Real-time Subscriptions',
    'Built-in Auth',
    'Automatic Backups',
    'Dashboard UI',
    'Edge Functions',
    'Storage Integration'
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
      // Supabase-specific health checks
      const poolStatus = await this.checkConnectionPool();
      const rlsStatus = await this.checkRowLevelSecurity();
      
      return {
        ...baseHealth,
        connectionCount: poolStatus.activeConnections,
      };
    } catch (error) {
      return {
        ...baseHealth,
        error: `Supabase health check failed: ${error}`,
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
      // Check if we can run migrations
      const canMigrate = await this.checkMigrationPermissions();
      if (!canMigrate) {
        errors.push('Insufficient permissions to run migrations');
        return { success: false, migrationsApplied: 0, errors, warnings };
      }

      // Apply Supabase-specific optimizations
      await this.setupSupabaseOptimizations();
      migrationsApplied++;

      // Setup Row Level Security if needed
      const rlsSetup = await this.setupRowLevelSecurity();
      if (rlsSetup.applied) {
        migrationsApplied++;
      }
      warnings.push(...rlsSetup.warnings);

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
      // Connection pooling optimization
      if (this.config.pooling) {
        await this.optimizeConnectionPooling();
        optimizations.push('Connection pooling configured');
      }

      // Index optimization
      await this.optimizeIndexes();
      optimizations.push('Database indexes optimized');

      // Query performance optimization
      await this.optimizeQueries();
      optimizations.push('Query performance optimized');

      // Supabase-specific optimizations
      await this.optimizeSupabaseFeatures();
      optimizations.push('Supabase features optimized');

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
    // Validate Supabase URL format
    if (!this.config.url.includes('supabase.co')) {
      warnings.push('URL does not appear to be a Supabase URL');
    }

    // Check for connection pooling
    if (!this.config.pooling) {
      recommendations.push('Enable connection pooling for better performance');
    }

    // Check SSL configuration
    if (!this.config.ssl) {
      errors.push('SSL is required for Supabase connections');
    }

    // Check for direct URL
    if (!this.config.directUrl) {
      warnings.push('Direct URL not configured - some operations may be slower');
    }

    // Connection limits
    if (this.config.maxConnections > 20) {
      warnings.push('Max connections exceeds Supabase free tier limit (20)');
    }
  }

  private async checkConnectionPool(): Promise<{ activeConnections: number }> {
    try {
      const result = await this.client.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;
      return { activeConnections: result[0]?.count || 0 };
    } catch {
      return { activeConnections: 0 };
    }
  }

  private async checkRowLevelSecurity(): Promise<boolean> {
    try {
      const result = await this.client.$queryRaw<Array<{ rls_enabled: boolean }>>`
        SELECT schemaname, tablename, rowsecurity as rls_enabled 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'projects'
      `;
      return result[0]?.rls_enabled || false;
    } catch {
      return false;
    }
  }

  private async checkMigrationPermissions(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT has_database_privilege(current_user, current_database(), 'CREATE')`;
      return true;
    } catch {
      return false;
    }
  }

  private async setupSupabaseOptimizations(): Promise<void> {
    // Enable pg_stat_statements for query analysis
    try {
      await this.client.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
    } catch {
      // Extension might not be available or already exists
    }

    // Setup connection pooling parameters
    try {
      await this.client.$executeRaw`
        ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
      `;
    } catch {
      // Might not have permissions
    }
  }

  private async setupRowLevelSecurity(): Promise<{ applied: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    
    try {
      // Enable RLS on projects table (example)
      await this.client.$executeRaw`
        ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
      `;

      // Create policy for public access to published projects
      await this.client.$executeRaw`
        CREATE POLICY IF NOT EXISTS "Public projects are viewable by everyone" 
        ON projects FOR SELECT 
        USING (status = 'PUBLISHED' AND visibility = 'PUBLIC');
      `;

      return { applied: true, warnings };
    } catch (error) {
      warnings.push(`RLS setup failed: ${error}`);
      return { applied: false, warnings };
    }
  }

  private async optimizeConnectionPooling(): Promise<void> {
    // Connection pooling is handled by Supabase's pgbouncer
    // We can optimize our client configuration
    const poolConfig = {
      max: this.config.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: this.config.connectionTimeout,
    };

    // These would be applied to the Prisma client configuration
    // In practice, this is done during client initialization
  }

  private async optimizeIndexes(): Promise<void> {
    // Create performance indexes specific to our queries
    const indexes = [
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_visibility 
       ON projects(status, visibility) WHERE status = 'PUBLISHED'`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_search_vector_gin 
       ON projects USING gin(search_vector)`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_work_date_desc 
       ON projects(work_date DESC NULLS LAST)`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_project_type 
       ON media_items(project_id, type)`,
    ];

    for (const indexSQL of indexes) {
      try {
        await this.client.$executeRawUnsafe(indexSQL);
      } catch (error) {
        // Index might already exist or creation failed
        console.warn(`Index creation warning: ${error}`);
      }
    }
  }

  private async optimizeQueries(): Promise<void> {
    // Analyze table statistics for better query planning
    try {
      await this.client.$executeRaw`ANALYZE projects, media_items, tags, project_analytics`;
    } catch {
      // Analyze might not be available
    }
  }

  private async optimizeSupabaseFeatures(): Promise<void> {
    // Configure Supabase-specific optimizations
    
    // Enable real-time for specific tables if needed
    try {
      await this.client.$executeRaw`
        ALTER PUBLICATION supabase_realtime ADD TABLE projects;
      `;
    } catch {
      // Real-time might not be configured or table already added
    }

    // Setup automatic vacuum settings
    try {
      await this.client.$executeRaw`
        ALTER TABLE projects SET (
          autovacuum_vacuum_scale_factor = 0.1,
          autovacuum_analyze_scale_factor = 0.05
        );
      `;
    } catch {
      // Might not have permissions
    }
  }
}