/**
 * Database adapter factory
 * Creates appropriate adapter based on configuration
 */

import { PrismaClient } from '@/generated/prisma';
import { DatabaseProvider, DatabaseConfig } from '../config';
import { DatabaseAdapter, DatabaseConfiguration } from './base';
import { SupabaseAdapter } from './supabase';
import { VercelAdapter } from './vercel';
import { LocalAdapter } from './local';

/**
 * Convert DatabaseConfig to DatabaseConfiguration
 */
function configToConfiguration(config: DatabaseConfig): DatabaseConfiguration {
  return {
    provider: config.provider,
    url: config.url,
    directUrl: config.directUrl,
    pooling: config.pooling,
    ssl: config.ssl,
    maxConnections: config.maxConnections || 10,
    connectionTimeout: 30000, // 30 seconds
    queryTimeout: 60000, // 60 seconds
    retryAttempts: 3,
    features: [], // Will be populated by adapter
  };
}

/**
 * Create database adapter based on provider
 */
export function createDatabaseAdapter(
  provider: DatabaseProvider,
  client: PrismaClient,
  config: DatabaseConfig
): DatabaseAdapter {
  const configuration = configToConfiguration(config);
  
  switch (provider) {
    case 'supabase':
      return new SupabaseAdapter(client, configuration);
    
    case 'vercel':
      return new VercelAdapter(client, configuration);
    
    case 'local':
      return new LocalAdapter(client, configuration);
    
    default:
      throw new Error(`Unsupported database provider: ${provider}`);
  }
}

/**
 * Get adapter for current configuration
 */
export function getCurrentAdapter(): DatabaseAdapter {
  const { getDatabaseConfig } = require('../config');
  const { getPrismaClient } = require('../connection');
  
  const config = getDatabaseConfig();
  const client = getPrismaClient();
  
  return createDatabaseAdapter(config.provider, client, config);
}

/**
 * Database adapter manager
 * Provides high-level operations across all adapters
 */
export class DatabaseAdapterManager {
  private adapter: DatabaseAdapter;

  constructor(adapter?: DatabaseAdapter) {
    this.adapter = adapter || getCurrentAdapter();
  }

  /**
   * Get current adapter
   */
  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  /**
   * Switch to different adapter
   */
  switchAdapter(provider: DatabaseProvider): void {
    const { getDatabaseConfig } = require('../config');
    const { getPrismaClient } = require('../connection');
    
    const config = getDatabaseConfig();
    const client = getPrismaClient();
    
    // Update config for new provider
    const newConfig = { ...config, provider };
    this.adapter = createDatabaseAdapter(provider, client, newConfig);
  }

  /**
   * Initialize database with current adapter
   */
  async initialize(): Promise<{
    success: boolean;
    provider: string;
    features: string[];
    errors: string[];
    warnings: string[];
  }> {
    try {
      // Connect to database
      await this.adapter.connect();

      // Validate configuration
      const validation = this.adapter.validateConfiguration();
      
      // Run health check
      const health = await this.adapter.healthCheck();
      
      if (!health.healthy) {
        return {
          success: false,
          provider: this.adapter.provider,
          features: this.adapter.features,
          errors: [health.error || 'Health check failed'],
          warnings: validation.warnings,
        };
      }

      // Run migrations if supported
      if (this.adapter.canMigrate()) {
        const migration = await this.adapter.migrate();
        if (!migration.success) {
          return {
            success: false,
            provider: this.adapter.provider,
            features: this.adapter.features,
            errors: migration.errors,
            warnings: [...validation.warnings, ...migration.warnings],
          };
        }
      }

      // Run optimizations
      const optimization = await this.adapter.optimize();
      
      return {
        success: validation.valid && health.healthy,
        provider: this.adapter.provider,
        features: this.adapter.features,
        errors: validation.errors,
        warnings: [
          ...validation.warnings,
          ...(optimization.success ? [] : ['Some optimizations failed']),
        ],
      };
    } catch (error) {
      return {
        success: false,
        provider: this.adapter.provider,
        features: this.adapter.features,
        errors: [`Initialization failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Get comprehensive database status
   */
  async getStatus(): Promise<{
    adapter: {
      name: string;
      provider: string;
      features: string[];
    };
    health: any;
    configuration: any;
    validation: any;
  }> {
    const [health, configuration, validation] = await Promise.all([
      this.adapter.healthCheck(),
      Promise.resolve(this.adapter.getConfiguration()),
      Promise.resolve(this.adapter.validateConfiguration()),
    ]);

    return {
      adapter: {
        name: this.adapter.name,
        provider: this.adapter.provider,
        features: this.adapter.features,
      },
      health,
      configuration,
      validation,
    };
  }

  /**
   * Run maintenance operations
   */
  async runMaintenance(): Promise<{
    success: boolean;
    operations: string[];
    errors: string[];
  }> {
    const operations: string[] = [];
    const errors: string[] = [];

    try {
      // Run optimizations
      const optimization = await this.adapter.optimize();
      if (optimization.success) {
        operations.push(...optimization.optimizations);
      } else {
        errors.push('Optimization failed');
      }

      // Run health check
      const health = await this.adapter.healthCheck();
      if (health.healthy) {
        operations.push('Health check passed');
      } else {
        errors.push(`Health check failed: ${health.error}`);
      }

      return {
        success: errors.length === 0,
        operations,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        operations,
        errors: [`Maintenance failed: ${error}`],
      };
    }
  }

  /**
   * Compare adapters for migration planning
   */
  static async compareAdapters(
    fromProvider: DatabaseProvider,
    toProvider: DatabaseProvider
  ): Promise<{
    compatible: boolean;
    differences: string[];
    recommendations: string[];
    migrationSteps: string[];
  }> {
    const { getDatabaseConfig } = require('../config');
    const { getPrismaClient } = require('../connection');
    
    const config = getDatabaseConfig();
    const client = getPrismaClient();
    
    const fromAdapter = createDatabaseAdapter(fromProvider, client, config);
    const toAdapter = createDatabaseAdapter(toProvider, client, config);

    const differences: string[] = [];
    const recommendations: string[] = [];
    const migrationSteps: string[] = [];

    // Compare features
    const fromFeatures = new Set(fromAdapter.features);
    const toFeatures = new Set(toAdapter.features);
    
    const lostFeatures = [...fromFeatures].filter(f => !toFeatures.has(f));
    const gainedFeatures = [...toFeatures].filter(f => !fromFeatures.has(f));

    if (lostFeatures.length > 0) {
      differences.push(`Lost features: ${lostFeatures.join(', ')}`);
    }
    
    if (gainedFeatures.length > 0) {
      differences.push(`Gained features: ${gainedFeatures.join(', ')}`);
    }

    // Migration compatibility
    const compatible = fromAdapter.canMigrate() && toAdapter.canMigrate();
    
    if (!compatible) {
      recommendations.push('Manual data migration may be required');
    }

    // Generate migration steps
    migrationSteps.push('1. Backup current database');
    migrationSteps.push('2. Export data from current provider');
    migrationSteps.push('3. Setup new database provider');
    migrationSteps.push('4. Import data to new provider');
    migrationSteps.push('5. Update application configuration');
    migrationSteps.push('6. Test application functionality');
    migrationSteps.push('7. Update deployment configuration');

    return {
      compatible,
      differences,
      recommendations,
      migrationSteps,
    };
  }
}

// Export lazy singleton instance
let _databaseManager: DatabaseAdapterManager | undefined;

export const databaseManager = new Proxy({} as DatabaseAdapterManager, {
  get(target, prop) {
    if (!_databaseManager) {
      _databaseManager = new DatabaseAdapterManager();
    }
    return (_databaseManager as any)[prop];
  }
});