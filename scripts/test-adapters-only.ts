/**
 * Test script for database adapters without actual connection
 * Tests adapter functionality and configuration
 */

import { config } from 'dotenv';
config(); // Load environment variables

import { getDatabaseConfig } from '../src/lib/database/config';
import { getProviderConfig, validateProviderRequirements } from '../src/lib/database/providers';
import { createDatabaseAdapter } from '../src/lib/database/adapters/factory';

async function testAdaptersOnly() {
  console.log('🧪 Testing database adapters (configuration only)...\n');

  try {
    // Test configuration
    console.log('1. Testing database configuration...');
    const config = getDatabaseConfig();
    
    console.log(`   Provider: ${config.provider}`);
    console.log(`   URL: ${config.url.replace(/:[^:@]*@/, ':***@')}`); // Hide password
    console.log(`   Pooling: ${config.pooling}`);
    console.log(`   SSL: ${config.ssl}`);
    console.log(`   Max Connections: ${config.maxConnections}`);

    // Test provider configuration
    console.log('\n2. Testing provider configuration...');
    const providerConfig = getProviderConfig(config.provider);
    
    console.log(`   Name: ${providerConfig.name}`);
    console.log(`   Description: ${providerConfig.description}`);
    console.log(`   Features: ${providerConfig.features.join(', ')}`);
    console.log(`   Migration Support: ${providerConfig.migrationSupport}`);
    console.log(`   Pooling Support: ${providerConfig.poolingSupport}`);

    // Test provider validation
    console.log('\n3. Testing provider validation...');
    const validation = validateProviderRequirements(config.provider, config.url);
    
    console.log(`   Valid: ${validation.valid}`);
    
    if (validation.errors.length > 0) {
      console.log('   Errors:');
      validation.errors.forEach(error => console.log(`     ❌ ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('   Warnings:');
      validation.warnings.forEach(warning => console.log(`     ⚠️  ${warning}`));
    }

    // Test adapter creation (without connection)
    console.log('\n4. Testing adapter creation...');
    
    // Create a mock Prisma client for testing
    const mockPrismaClient = {} as any;
    
    try {
      const adapter = createDatabaseAdapter(config.provider, mockPrismaClient, config);
      
      console.log(`   Adapter Name: ${adapter.name}`);
      console.log(`   Adapter Provider: ${adapter.provider}`);
      console.log(`   Adapter Features: ${adapter.features.join(', ')}`);
      console.log(`   Can Migrate: ${adapter.canMigrate()}`);
      
      // Test configuration validation
      const adapterValidation = adapter.validateConfiguration();
      console.log(`   Configuration Valid: ${adapterValidation.valid}`);
      
      if (adapterValidation.errors.length > 0) {
        console.log('   Configuration Errors:');
        adapterValidation.errors.forEach(error => console.log(`     ❌ ${error}`));
      }
      
      if (adapterValidation.warnings.length > 0) {
        console.log('   Configuration Warnings:');
        adapterValidation.warnings.forEach(warning => console.log(`     ⚠️  ${warning}`));
      }
      
      if (adapterValidation.recommendations.length > 0) {
        console.log('   Configuration Recommendations:');
        adapterValidation.recommendations.forEach(rec => console.log(`     💡 ${rec}`));
      }
      
    } catch (error) {
      console.log(`   ❌ Adapter creation failed: ${error}`);
    }

    // Test all provider types
    console.log('\n5. Testing all provider types...');
    const providers: Array<'supabase' | 'vercel' | 'local'> = ['supabase', 'vercel', 'local'];
    
    for (const provider of providers) {
      console.log(`\n   Testing ${provider} provider:`);
      
      try {
        const testConfig = { ...config, provider };
        const testAdapter = createDatabaseAdapter(provider, mockPrismaClient, testConfig);
        
        console.log(`     ✅ ${testAdapter.name} adapter created successfully`);
        console.log(`     Features: ${testAdapter.features.slice(0, 3).join(', ')}${testAdapter.features.length > 3 ? '...' : ''}`);
        
        const testValidation = testAdapter.validateConfiguration();
        console.log(`     Configuration: ${testValidation.valid ? '✅ Valid' : '❌ Invalid'}`);
        
      } catch (error) {
        console.log(`     ❌ Failed to create ${provider} adapter: ${error}`);
      }
    }

    console.log('\n🎉 Database adapter configuration tests completed successfully!');
    console.log('\nNote: These tests only verify adapter configuration and creation.');
    console.log('To test actual database connections, update DATABASE_URL with real credentials.');

  } catch (error) {
    console.error('\n💥 Database adapter tests failed:', error);
    process.exit(1);
  }
}

// Run tests
testAdaptersOnly();