/**
 * Database configuration utilities
 * Supports multiple database providers with environment-based switching
 */

export type DatabaseProvider = 'supabase' | 'vercel' | 'local';

export interface DatabaseConfig {
  provider: DatabaseProvider;
  url: string;
  directUrl?: string;
  pooling: boolean;
  ssl: boolean;
  maxConnections?: number;
}

/**
 * Get database configuration based on environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  const provider = (process.env.DATABASE_PROVIDER || 'supabase') as DatabaseProvider;
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const config: DatabaseConfig = {
    provider,
    url: databaseUrl,
    directUrl,
    pooling: false,
    ssl: false,
  };

  // Provider-specific configurations
  switch (provider) {
    case 'supabase':
      config.pooling = true;
      config.ssl = true;
      config.maxConnections = 20;
      break;
    
    case 'vercel':
      config.pooling = true;
      config.ssl = true;
      config.maxConnections = 10;
      break;
    
    case 'local':
      config.pooling = false;
      config.ssl = false;
      config.maxConnections = 5;
      break;
  }

  return config;
}

/**
 * Validate database connection configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.url) {
    throw new Error('Database URL is required');
  }

  // Validate URL format based on provider
  const urlPattern = /^postgres(ql)?:\/\/.+/;
  if (!urlPattern.test(config.url)) {
    throw new Error('Invalid PostgreSQL connection URL format');
  }

  // Skip validation for placeholder URLs in development
  if (config.url.includes('username:password@localhost') || 
      config.url.includes('[password]') || 
      config.url.includes('[host]')) {
    console.warn('Using placeholder database URL - update with real credentials for actual connection');
    return;
  }

  // Provider-specific validations
  if (config.provider === 'supabase' && !config.url.includes('supabase.co')) {
    console.warn('Supabase provider selected but URL does not appear to be a Supabase URL');
  }

  if (config.provider === 'vercel' && !config.url.includes('vercel-storage.com')) {
    console.warn('Vercel provider selected but URL does not appear to be a Vercel Postgres URL');
  }
}

/**
 * Get connection string with provider-specific optimizations
 */
export function getConnectionString(config: DatabaseConfig): string {
  let connectionString = config.url;

  // Parse existing URL to avoid duplicating parameters
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch (error) {
    console.warn('Invalid database URL format, using as-is');
    return connectionString;
  }

  // CRITICAL: Ensure pgbouncer=true is set for pooled connections
  // This prevents DEALLOCATE ALL overhead that causes 200-600ms per query
  if (config.pooling || connectionString.includes('pooler.supabase.com')) {
    url.searchParams.set('pgbouncer', 'true');
  }

  // For Supabase pooler URLs, optimize connection settings
  if (config.provider === 'supabase' && connectionString.includes('pooler.supabase.com')) {
    url.searchParams.set('pgbouncer', 'true');
    // Don't set connection_limit=1 as it may cause issues
    // Let Supabase handle connection pooling optimally
  }

  // Set SSL mode if required and not already set
  if (config.ssl && !url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  // Set connection limit for non-Supabase providers
  if (config.maxConnections && config.provider !== 'supabase' && !url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', config.maxConnections.toString());
  }

  return url.toString();
}