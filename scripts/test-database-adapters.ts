/**
 * Test script for database adapters
 * Tests all provider adapters and their functionality
 */

import { databaseManager, DatabaseAdapterManager } from '../src/lib/database/adapters';
import { getDatabaseConfig } from '../src/lib/database/config';
import process from 'process';

async function testDatabaseAdapters() {
  console.log('🧪 Testing database adapters...\n');

  try {
    // Test current adapter
    console.log('1. Testing current adapter...');
    const currentStatus = await databaseManager.getStatus();

    console.log(`   Adapter: ${currentStatus.adapter.name}`);
    console.log(`   Provider: ${currentStatus.adapter.provider}`);
    console.log(`   Features: ${currentStatus.adapter.features.join(', ')}`);
    console.log(`   Health: ${currentStatus.health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

    if (currentStatus.health.latency) {
      console.log(`   Latency: ${currentStatus.health.latency}ms`);
    }

    if (currentStatus.validation.errors.length > 0) {
      console.log('   Validation Errors:');
      currentStatus.validation.errors.forEach((error: any) => console.log(`     ❌ ${error}`));
    }

    if (currentStatus.validation.warnings.length > 0) {
      console.log('   Validation Warnings:');
      currentStatus.validation.warnings.forEach((warning: any) => console.log(`     ⚠️  ${warning}`));
    }

    // Test initialization
    console.log('\n2. Testing adapter initialization...');
    const initResult = await databaseManager.initialize();

    console.log(`   Success: ${initResult.success ? '✅' : '❌'}`);
    console.log(`   Provider: ${initResult.provider}`);

    if (initResult.errors.length > 0) {
      console.log('   Errors:');
      initResult.errors.forEach(error => console.log(`     ❌ ${error}`));
    }

    if (initResult.warnings.length > 0) {
      console.log('   Warnings:');
      initResult.warnings.forEach(warning => console.log(`     ⚠️  ${warning}`));
    }

    // Test maintenance operations
    console.log('\n3. Testing maintenance operations...');
    const maintenanceResult = await databaseManager.runMaintenance();

    console.log(`   Success: ${maintenanceResult.success ? '✅' : '❌'}`);

    if (maintenanceResult.operations.length > 0) {
      console.log('   Operations completed:');
      maintenanceResult.operations.forEach(op => console.log(`     ✅ ${op}`));
    }

    if (maintenanceResult.errors.length > 0) {
      console.log('   Errors:');
      maintenanceResult.errors.forEach(error => console.log(`     ❌ ${error}`));
    }

    // Test adapter comparison
    console.log('\n4. Testing adapter comparison...');
    const config = getDatabaseConfig();
    const currentProvider = config.provider;

    const otherProviders = ['supabase', 'vercel', 'local'].filter(p => p !== currentProvider);

    for (const targetProvider of otherProviders) {
      console.log(`\n   Comparing ${currentProvider} → ${targetProvider}:`);

      try {
        const comparison = await DatabaseAdapterManager.compareAdapters(
          currentProvider as any,
          targetProvider as any
        );

        console.log(`     Compatible: ${comparison.compatible ? '✅' : '❌'}`);

        if (comparison.differences.length > 0) {
          console.log('     Differences:');
          comparison.differences.forEach(diff => console.log(`       • ${diff}`));
        }

        if (comparison.recommendations.length > 0) {
          console.log('     Recommendations:');
          comparison.recommendations.forEach(rec => console.log(`       💡 ${rec}`));
        }
      } catch (error) {
        console.log(`     ❌ Comparison failed: ${error}`);
      }
    }

    // Test provider-specific features
    console.log('\n5. Testing provider-specific features...');
    const adapter = databaseManager.getAdapter();

    console.log(`   Testing ${adapter.name} specific features...`);

    // Test migration capability
    const canMigrate = adapter.canMigrate();
    console.log(`   Migration support: ${canMigrate ? '✅' : '❌'}`);

    // Test configuration validation
    const validation = adapter.validateConfiguration();
    console.log(`   Configuration valid: ${validation.valid ? '✅' : '❌'}`);

    if (validation.recommendations.length > 0) {
      console.log('   Recommendations:');
      validation.recommendations.forEach(rec => console.log(`     💡 ${rec}`));
    }

    // Provider-specific tests
    if (adapter.provider === 'vercel') {
      const vercelAdapter = adapter as any;
      if (vercelAdapter.isVercelEnvironment) {
        const vercelEnv = vercelAdapter.getVercelEnvironment();
        console.log(`   Vercel Environment: ${vercelEnv.isVercel ? '✅' : '❌'}`);
        if (vercelEnv.environment) {
          console.log(`   Vercel Env: ${vercelEnv.environment}`);
        }
      }
    }

    if (adapter.provider === 'local') {
      const localAdapter = adapter as any;
      if (localAdapter.getDevelopmentStats) {
        try {
          const stats = await localAdapter.getDevelopmentStats();
          console.log(`   Database tables: ${stats.tableStats.length}`);
          console.log(`   Database indexes: ${stats.indexStats.length}`);
        } catch (error) {
          console.log(`   ⚠️  Could not get development stats: ${error}`);
        }
      }
    }

    console.log('\n🎉 Database adapter tests completed!');

    if (!initResult.success) {
      console.log('\n⚠️  Some tests failed. Check the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Database adapter tests failed:', error);
    process.exit(1);
  }
}

// Run tests
testDatabaseAdapters();