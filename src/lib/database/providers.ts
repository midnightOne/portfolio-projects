/**
 * Database provider-specific configurations and utilities
 */

import { DatabaseProvider } from './config';

export interface ProviderConfig {
  name: string;
  description: string;
  features: string[];
  connectionParams: Record<string, string>;
  migrationSupport: boolean;
  poolingSupport: boolean;
}

/**
 * Provider configurations
 */
export const PROVIDER_CONFIGS: Record<DatabaseProvider, ProviderConfig> = {
  supabase: {
    name: 'Supabase',
    description: 'Managed PostgreSQL with built-in auth and real-time features',
    features: [
      'Built-in authentication',
      'Real-time subscriptions',
      'Row Level Security (RLS)',
      'Connection pooling',
      'Automatic backups',
      'Dashboard UI'
    ],
    connectionParams: {
      sslmode: 'require',
      pgbouncer: 'true',
    },
    migrationSupport: true,
    poolingSupport: true,
  },
  
  vercel: {
    name: 'Vercel Postgres',
    description: 'Serverless PostgreSQL optimized for Vercel deployments',
    features: [
      'Serverless scaling',
      'Edge-optimized',
      'Vercel integration',
      'Connection pooling',
      'Automatic scaling'
    ],
    connectionParams: {
      sslmode: 'require',
      pgbouncer: 'true',
    },
    migrationSupport: true,
    poolingSupport: true,
  },
  
  local: {
    name: 'Local PostgreSQL',
    description: 'Local PostgreSQL instance for development',
    features: [
      'Full control',
      'No external dependencies',
      'Fast development',
      'Custom extensions'
    ],
    connectionParams: {},
    migrationSupport: true,
    poolingSupport: false,
  },
};

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: DatabaseProvider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * Validate provider-specific requirements
 */
export function validateProviderRequirements(provider: DatabaseProvider, url: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (provider) {
    case 'supabase':
      if (!url.includes('supabase.co')) {
        warnings.push('URL does not appear to be a Supabase URL');
      }
      if (!url.includes('?')) {
        warnings.push('Consider adding connection parameters for optimal performance');
      }
      break;

    case 'vercel':
      if (!url.includes('vercel-storage.com')) {
        warnings.push('URL does not appear to be a Vercel Postgres URL');
      }
      break;

    case 'local':
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // Valid local connection
      } else {
        warnings.push('Local provider selected but URL does not appear to be local');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate connection string with provider-specific optimizations
 */
export function optimizeConnectionString(provider: DatabaseProvider, baseUrl: string): string {
  const config = getProviderConfig(provider);
  const url = new URL(baseUrl);

  // Add provider-specific parameters
  Object.entries(config.connectionParams).forEach(([key, value]) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Get provider-specific migration options
 */
export function getMigrationOptions(provider: DatabaseProvider) {
  const config = getProviderConfig(provider);
  
  return {
    migrationSupport: config.migrationSupport,
    recommendedApproach: provider === 'local' ? 'migrate dev' : 'db push',
    poolingConsiderations: config.poolingSupport 
      ? 'Use connection pooling for better performance'
      : 'Direct connections recommended',
  };
}