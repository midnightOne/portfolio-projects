/**
 * Database utilities - Main exports
 */

// Core connection and client
export { 
  prisma, 
  getPrismaClient, 
  checkDatabaseConnection, 
  disconnectDatabase, 
  withTransaction 
} from './connection';

// Configuration utilities
export { 
  getDatabaseConfig, 
  validateDatabaseConfig, 
  getConnectionString 
} from './config';

// Provider-specific utilities
export { 
  getProviderConfig, 
  validateProviderRequirements, 
  optimizeConnectionString, 
  getMigrationOptions,
  PROVIDER_CONFIGS 
} from './providers';

// Initialization utilities
export { 
  initializeDatabase, 
  isDatabaseReady, 
  getDatabaseStatus 
} from './init';

// Search utilities
export {
  searchProjects,
  getSearchSuggestions,
  getPopularSearchTerms,
  updateProjectSearchVector,
  rebuildSearchVectors
} from './search';

// Database adapters
export {
  createDatabaseAdapter,
  getCurrentAdapter,
  DatabaseAdapterManager,
  databaseManager
} from './adapters';

// Types
export type { DatabaseProvider, DatabaseConfig } from './config';
export type { ProviderConfig } from './providers';
export type { InitializationResult } from './init';
export type { SearchOptions, SearchResult } from './search';
export type { 
  DatabaseAdapter,
  HealthCheckResult,
  MigrationResult,
  OptimizationResult
} from './adapters';