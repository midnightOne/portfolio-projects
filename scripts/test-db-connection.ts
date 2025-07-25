/**
 * Test script for database connection
 * Run with: npx tsx scripts/test-db-connection.ts
 */

import { initializeDatabase, getDatabaseStatus } from '../src/lib/database';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');

  try {
    // Initialize database
    const initResult = await initializeDatabase();
    
    console.log('📊 Initialization Result:');
    console.log(`  Success: ${initResult.success}`);
    console.log(`  Provider: ${initResult.provider}`);
    
    if (initResult.warnings.length > 0) {
      console.log('  Warnings:');
      initResult.warnings.forEach(warning => console.log(`    ⚠️  ${warning}`));
    }
    
    if (initResult.errors.length > 0) {
      console.log('  Errors:');
      initResult.errors.forEach(error => console.log(`    ❌ ${error}`));
    }

    // Get detailed status
    const status = await getDatabaseStatus();
    
    console.log('\n📋 Database Status:');
    console.log(`  Provider: ${status.provider}`);
    console.log(`  Connected: ${status.connected}`);
    console.log(`  URL: ${status.url}`);
    console.log(`  Pooling: ${status.pooling}`);
    console.log(`  SSL: ${status.ssl}`);
    console.log(`  Max Connections: ${status.maxConnections}`);
    
    if (status.connectionError) {
      console.log(`  Connection Error: ${status.connectionError}`);
    }

    if (initResult.success) {
      console.log('\n✅ Database connection test passed!');
    } else {
      console.log('\n❌ Database connection test failed!');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();