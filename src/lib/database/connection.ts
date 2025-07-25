/**
 * Database connection utilities with provider abstraction
 * OPTIMIZED VERSION with connection pooling and reduced transaction overhead
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Singleton pattern to prevent connection churn
 * - pgbouncer=true to disable prepared statements with transaction pooling
 * - Reduced logging and transaction timeouts
 * - Custom optimized queries to prevent N+1 problems
 */

import { PrismaClient } from '@prisma/client';
import { getDatabaseConfig, validateDatabaseConfig, getConnectionString } from './config';
import { profiler } from '@/lib/utils/performance';

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
    // OPTIMIZED: Minimal logging to reduce overhead
    log: process.env.NODE_ENV === 'development' 
      ? [{ emit: 'event', level: 'query' }]
      : [],
    // SERVERLESS OPTIMIZATION: Reduce connection overhead
    errorFormat: 'minimal',
    transactionOptions: {
      timeout: 10000, // 10 seconds
      maxWait: 2000,  // 2 seconds max wait for transaction
    },
  });

  // OPTIMIZED: Monitor slow queries (>50ms after optimizations) to detect issues
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e: any) => {
      if (e.duration > 50) { // With pgbouncer=true, queries should be much faster
        const severity = e.duration > 200 ? '🐌 VERY SLOW' : '⚠️  Slow';
        console.warn(`${severity} query (${e.duration}ms):`, e.query.substring(0, 80) + '...');
      }
    });
  }

  return prisma;
}

/**
 * Get or create Prisma client instance
 * Uses singleton pattern to prevent connection churn in serverless environments
 */
export function getPrismaClient(): PrismaClient {
  // ALWAYS use singleton pattern to prevent connection churn
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
  responseTime?: number;
}> {
  const startTime = performance.now();
  
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = performance.now() - startTime;
    const config = getDatabaseConfig();
    
    return {
      connected: true,
      provider: config.provider,
      responseTime: Number(responseTime.toFixed(2)),
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    return {
      connected: false,
      provider: getDatabaseConfig().provider,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Number(responseTime.toFixed(2)),
    };
  }
}

/**
 * Database query performance test
 */
export async function runDatabasePerformanceTest(): Promise<{
  simpleQuery: number;
  complexQuery: number;
  indexedQuery: number;
}> {
  const prisma = getPrismaClient();
  
  // Test simple query
  const simpleStart = performance.now();
  await prisma.project.count();
  const simpleTime = performance.now() - simpleStart;
  
  // Test optimized query (what our new projects API does)
  const complexStart = performance.now();
  await prisma.project.findMany({
    where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
    select: {
      id: true,
      title: true,
      tags: { select: { name: true }, take: 3 },
      _count: { select: { mediaItems: true } }
    },
    take: 5
  });
  const complexTime = performance.now() - complexStart;
  
  // Test indexed query
  const indexedStart = performance.now();
  await prisma.project.findMany({
    where: { 
      status: 'PUBLISHED',
      visibility: 'PUBLIC'
    },
    orderBy: { viewCount: 'desc' },
    take: 5
  });
  const indexedTime = performance.now() - indexedStart;
  
  return {
    simpleQuery: Number(simpleTime.toFixed(2)),
    complexQuery: Number(complexTime.toFixed(2)),
    indexedQuery: Number(indexedTime.toFixed(2)),
  };
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
 * Database transaction wrapper with performance tracking
 */
export async function withTransaction<T>(
  callback: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  const prisma = getPrismaClient();
  const startTime = performance.now();
  
  try {
    const result = await prisma.$transaction(callback, {
      maxWait: 2000, // 2s max wait
      timeout: 5000, // 5s timeout
    });
    const duration = performance.now() - startTime;
    
    if (process.env.NODE_ENV === 'development' && duration > 300) {
      console.warn(`🐌 Slow transaction (${duration.toFixed(2)}ms)`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ Transaction failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
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