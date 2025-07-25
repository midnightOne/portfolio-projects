/**
 * Database connection utilities with provider abstraction
 */

import { PrismaClient } from '@/generated/prisma';
import { getDatabaseConfig, validateDatabaseConfig, getConnectionString } from './config';

// Global Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Create Prisma client with provider-specific configuration
 */
function createPrismaClient(): PrismaClient {
  const config = getDatabaseConfig();
  
  // Only validate if not using placeholder URLs
  if (!config.url.includes('username:password@localhost') && 
      !config.url.includes('[password]') && 
      !config.url.includes('[host]')) {
    validateDatabaseConfig(config);
  }

  const connectionString = getConnectionString(config);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return prisma;
}

/**
 * Get or create Prisma client instance
 * Uses singleton pattern to prevent multiple connections in development
 */
export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return createPrismaClient();
  }

  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }

  return global.__prisma;
}

/**
 * Database connection health check
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  provider: string;
  error?: string;
}> {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    
    const config = getDatabaseConfig();
    
    return {
      connected: true,
      provider: config.provider,
    };
  } catch (error) {
    return {
      connected: false,
      provider: getDatabaseConfig().provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (global.__prisma) {
    await global.__prisma.$disconnect();
    global.__prisma = undefined;
  }
}

/**
 * Database transaction wrapper
 */
export async function withTransaction<T>(
  callback: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.$transaction(callback);
}

// Export a lazy-initialized Prisma client instance
let _prisma: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!_prisma) {
      _prisma = getPrismaClient();
    }
    return (_prisma as any)[prop];
  }
});

// Cleanup on process exit
if (typeof window === 'undefined') {
  process.on('beforeExit', () => {
    disconnectDatabase();
  });
}