#!/usr/bin/env npx tsx

/**
 * Test database connection speed and query performance
 * Run this to verify PgBouncer optimizations are working
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

import { getPrismaClient } from '../src/lib/database/connection';
import { profiler } from '../src/lib/utils/performance';

async function testConnectionSpeed() {
  console.log('🧪 Testing Database Connection Speed...\n');
  
  const prisma = getPrismaClient();
  
  // Test 1: Simple SELECT 1 (should be <10ms with proper pooling)
  console.log('Test 1: Simple SELECT 1');
  const start1 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const time1 = performance.now() - start1;
  console.log(`✅ SELECT 1: ${time1.toFixed(2)}ms\n`);
  
  // Test 2: Multiple quick queries (should not have 200ms+ DEALLOCATE overhead)
  console.log('Test 2: Multiple quick queries');
  const start2 = performance.now();
  await Promise.all([
    prisma.$queryRaw`SELECT 1`,
    prisma.$queryRaw`SELECT 2`,
    prisma.$queryRaw`SELECT 3`,
  ]);
  const time2 = performance.now() - start2;
  console.log(`✅ 3 parallel queries: ${time2.toFixed(2)}ms\n`);
  
  // Test 3: Project count (real query)
  console.log('Test 3: Real project count query');
  const start3 = performance.now();
  const projectCount = await prisma.project.count({
    where: { status: 'PUBLISHED', visibility: 'PUBLIC' }
  });
  const time3 = performance.now() - start3;
  console.log(`✅ Project count (${projectCount} projects): ${time3.toFixed(2)}ms\n`);
  
  // Test 4: Check if pgbouncer parameter is in connection string
  console.log('Test 4: Connection string analysis');
  // @ts-ignore - accessing internal URL for debugging
  const connectionUrl = prisma._engine?.connectionString || 'Unable to access connection string';
  const hasPgBouncer = connectionUrl.includes('pgbouncer=true');
  console.log(`✅ Connection URL includes pgbouncer=true: ${hasPgBouncer ? '✅ YES' : '❌ NO'}`);
  if (!hasPgBouncer) {
    console.log(`🔍 Connection string: ${connectionUrl}`);
  }
  console.log('');
  
  // Performance Summary
  console.log('📊 Performance Summary:');
  console.log(`- SELECT 1: ${time1.toFixed(2)}ms ${time1 < 20 ? '✅' : '❌ (should be <20ms)'}`);
  console.log(`- 3 parallel queries: ${time2.toFixed(2)}ms ${time2 < 50 ? '✅' : '❌ (should be <50ms)'}`);
  console.log(`- Real query: ${time3.toFixed(2)}ms ${time3 < 100 ? '✅' : '❌ (should be <100ms)'}`);
  console.log(`- PgBouncer enabled: ${hasPgBouncer ? '✅' : '❌'}`);
  
  if (time1 > 50 || time2 > 100 || time3 > 200) {
    console.log('\n⚠️  Still seeing slow queries. Check:');
    console.log('   1. DATABASE_URL includes pooler.supabase.com');
    console.log('   2. pgbouncer=true parameter is added');
    console.log('   3. Not creating new Prisma clients per request');
  } else {
    console.log('\n🎉 Database connection optimized! Queries are fast.');
  }
  
  await prisma.$disconnect();
}

testConnectionSpeed().catch(console.error); 