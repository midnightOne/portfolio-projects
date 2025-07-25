/**
 * Database setup script
 * Applies schema and sets up full-text search
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma, initializeDatabase } from '../src/lib/database';

async function setupDatabase() {
  console.log('🚀 Setting up database...\n');

  try {
    // Initialize and test connection
    console.log('1. Testing database connection...');
    const initResult = await initializeDatabase();
    
    if (!initResult.success) {
      console.error('❌ Database connection failed:');
      initResult.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    
    console.log(`✅ Connected to ${initResult.provider} database`);
    
    if (initResult.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      initResult.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    // Generate Prisma client
    console.log('\n2. Generating Prisma client...');
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated');

    // Push schema to database
    console.log('\n3. Pushing schema to database...');
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
    console.log('✅ Schema pushed to database');

    // Apply full-text search setup
    console.log('\n4. Setting up full-text search...');
    const searchSetupSQL = readFileSync(
      join(process.cwd(), 'prisma/migrations/001_setup_fulltext_search.sql'),
      'utf-8'
    );
    
    await prisma.$executeRawUnsafe(searchSetupSQL);
    console.log('✅ Full-text search configured');

    // Verify setup
    console.log('\n5. Verifying database setup...');
    
    // Test basic operations
    const testResult = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic query test passed');
    
    // Test search functionality
    const searchTest = await prisma.$queryRaw`
      SELECT to_tsvector('english', 'test project') as search_vector
    `;
    console.log('✅ Full-text search test passed');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('  - Run "npm run db:seed" to add sample data');
    console.log('  - Run "npm run dev" to start the development server');

  } catch (error) {
    console.error('\n💥 Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run setup
setupDatabase();