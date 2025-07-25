/**
 * Database initialization utilities
 */

import { checkDatabaseConnection, prisma } from './connection';
import { getDatabaseConfig, validateDatabaseConfig } from './config';
import { validateProviderRequirements } from './providers';

export interface InitializationResult {
  success: boolean;
  provider: string;
  errors: string[];
  warnings: string[];
}

/**
 * Initialize database connection and validate configuration
 */
export async function initializeDatabase(): Promise<InitializationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get and validate configuration
    const config = getDatabaseConfig();
    validateDatabaseConfig(config);

    // Validate provider-specific requirements
    const providerValidation = validateProviderRequirements(config.provider, config.url);
    errors.push(...providerValidation.errors);
    warnings.push(...providerValidation.warnings);

    // Test database connection
    const connectionTest = await checkDatabaseConnection();
    if (!connectionTest.connected) {
      errors.push(`Database connection failed: ${connectionTest.error}`);
    }

    return {
      success: errors.length === 0,
      provider: config.provider,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      provider: 'unknown',
      errors,
      warnings,
    };
  }
}

/**
 * Check if database is ready for the application
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    // Test basic connection
    const connectionTest = await checkDatabaseConnection();
    if (!connectionTest.connected) {
      return false;
    }

    // Test if we can perform basic operations
    await prisma.$queryRaw`SELECT 1`;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database status information
 */
export async function getDatabaseStatus() {
  const config = getDatabaseConfig();
  const connectionTest = await checkDatabaseConnection();
  const providerValidation = validateProviderRequirements(config.provider, config.url);

  return {
    provider: config.provider,
    connected: connectionTest.connected,
    url: config.url.replace(/:[^:@]*@/, ':***@'), // Hide password in logs
    pooling: config.pooling,
    ssl: config.ssl,
    maxConnections: config.maxConnections,
    errors: providerValidation.errors,
    warnings: providerValidation.warnings,
    connectionError: connectionTest.error,
  };
}