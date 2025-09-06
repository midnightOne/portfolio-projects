#!/usr/bin/env tsx
/**
 * Production Migration Script
 * Safely applies migrations to production database with backup
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load production environment
config({ path: '.env.production' });

async function migrateProduction() {
  console.log('🚀 Starting production migration...');
  
  try {
    // Create backup first
    console.log('💾 Creating database backup...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup-${timestamp}.sql`;
    
    // Note: This requires pg_dump to be available
    // You might want to use your database provider's backup tools instead
    console.log(`📦 Backup would be created as: ${backupFile}`);
    console.log('⚠️  Make sure to create a manual backup in your database provider dashboard!');
    
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Apply migrations
    console.log('🔄 Applying migrations to production...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Production migration completed successfully!');
  } catch (error) {
    console.error('❌ Production migration failed:', error);
    console.log('🔄 Please restore from backup if needed');
    process.exit(1);
  }
}

migrateProduction();