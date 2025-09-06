#!/usr/bin/env tsx
/**
 * Staging Migration Script
 * Safely applies migrations to staging database
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load staging environment
config({ path: '.env.staging' });

async function migrateStaging() {
  console.log('🚀 Starting staging migration...');
  
  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Apply migrations
    console.log('🔄 Applying migrations to staging...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Staging migration completed successfully!');
  } catch (error) {
    console.error('❌ Staging migration failed:', error);
    process.exit(1);
  }
}

migrateStaging();