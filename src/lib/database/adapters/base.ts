/**
 * Base database adapter interface
 * Defines the contract for all database providers
 */

import { PrismaClient } from '@/generated/prisma';

export interface DatabaseAdapter {
  readonly name: string;
  readonly provider: string;
  readonly features: string[];
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  
  // Health checks
  healthCheck(): Promise<HealthCheckResult>;
  
  // Migration support
  canMigrate(): boolean;
  migrate(): Promise<MigrationResult>;
  
  // Performance optimization
  optimize(): Promise<OptimizationResult>;
  
  // Provider-specific configuration
  getConfiguration(): DatabaseConfiguration;
  validateConfiguration(): ValidationResult;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency?: number;
  version?: string;
  connectionCount?: number;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  migrationsApplied: number;
  errors: string[];
  warnings: string[];
}

export interface OptimizationResult {
  success: boolean;
  optimizations: string[];
  performance: {
    before?: PerformanceMetrics;
    after?: PerformanceMetrics;
  };
}

export interface PerformanceMetrics {
  queryTime: number;
  connectionTime: number;
  indexUsage: number;
}

export interface DatabaseConfiguration {
  provider: string;
  url: string;
  directUrl?: string;
  pooling: boolean;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  features: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Abstract base class for database adapters
 */
export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  protected client: PrismaClient;
  protected config: DatabaseConfiguration;

  constructor(client: PrismaClient, config: DatabaseConfiguration) {
    this.client = client;
    this.config = config;
  }

  abstract readonly name: string;
  abstract readonly provider: string;
  abstract readonly features: string[];

  async connect(): Promise<void> {
    try {
      await this.client.$connect();
    } catch (error) {
      throw new Error(`Failed to connect to ${this.provider}: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.$disconnect();
    } catch (error) {
      throw new Error(`Failed to disconnect from ${this.provider}: ${error}`);
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await this.client.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;
      
      // Get database version
      const versionResult = await this.client.$queryRaw<Array<{ version: string }>>`SELECT version()`;
      const version = versionResult[0]?.version;

      return {
        healthy: true,
        latency,
        version,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getConfiguration(): DatabaseConfiguration {
    return { ...this.config };
  }

  validateConfiguration(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Basic validation
    if (!this.config.url) {
      errors.push('Database URL is required');
    }

    if (this.config.maxConnections < 1) {
      errors.push('Max connections must be at least 1');
    }

    if (this.config.connectionTimeout < 1000) {
      warnings.push('Connection timeout is very low (< 1s)');
    }

    if (this.config.queryTimeout < 5000) {
      warnings.push('Query timeout is very low (< 5s)');
    }

    // Provider-specific validation
    this.validateProviderSpecific(errors, warnings, recommendations);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  protected abstract validateProviderSpecific(
    errors: string[],
    warnings: string[],
    recommendations: string[]
  ): void;

  abstract canMigrate(): boolean;
  abstract migrate(): Promise<MigrationResult>;
  abstract optimize(): Promise<OptimizationResult>;
}