/**
 * Database adapters - Main exports
 */

// Base adapter interface and types
export type { 
  DatabaseAdapter,
  HealthCheckResult,
  MigrationResult,
  OptimizationResult,
  DatabaseConfiguration,
  ValidationResult,
  PerformanceMetrics
} from './base';

export { BaseDatabaseAdapter } from './base';

// Specific adapters
export { SupabaseAdapter } from './supabase';
export { VercelAdapter } from './vercel';
export { LocalAdapter } from './local';

// Factory and manager
export { 
  createDatabaseAdapter,
  getCurrentAdapter,
  DatabaseAdapterManager,
  databaseManager
} from './factory';