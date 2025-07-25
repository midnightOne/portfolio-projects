#!/usr/bin/env npx tsx

/**
 * Debug connection string and Prisma configuration
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

import { getDatabaseConfig, getConnectionString } from '../src/lib/database/config';

async function debugConnection() {
  console.log('🔍 Database Connection Debug\n');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER || 'default (supabase)'}`);
  console.log('');
  
  // Check config
  try {
    const config = getDatabaseConfig();
    console.log('Database Config:');
    console.log(`Provider: ${config.provider}`);
    console.log(`Pooling: ${config.pooling}`);
    console.log(`SSL: ${config.ssl}`);
    console.log(`Max Connections: ${config.maxConnections}`);
    console.log('');
    
    // Check final connection string
    const finalUrl = getConnectionString(config);
    console.log('Final Connection String Analysis:');
    
    // Parse URL to check parameters
    const url = new URL(finalUrl);
    console.log(`Host: ${url.hostname}`);
    console.log(`Port: ${url.port}`);
    console.log(`Database: ${url.pathname}`);
    console.log('');
    
    console.log('URL Parameters:');
    url.searchParams.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('');
    
    // Check critical parameters
    const hasPgBouncer = url.searchParams.get('pgbouncer') === 'true';
    const hasPooler = url.hostname.includes('pooler.supabase.com');
    const port = url.port;
    
    console.log('Critical Checks:');
    console.log(`✅ pgbouncer=true: ${hasPgBouncer ? '✅ YES' : '❌ NO'}`);
    console.log(`✅ pooler.supabase.com: ${hasPooler ? '✅ YES' : '❌ NO'}`);
    console.log(`✅ Port 6543 (transaction pooling): ${port === '6543' ? '✅ YES' : '❌ NO (port: ' + port + ')'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugConnection().catch(console.error); 