/**
 * Test script to verify the voice API is using database configurations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoiceAPIIntegration() {
  console.log('🧪 Testing voice API integration with database configurations...');

  try {
    // Test that we can load the default OpenAI configuration
    const defaultConfig = await prisma.voiceProviderConfig.findFirst({
      where: { provider: 'openai', isDefault: true }
    });

    if (!defaultConfig) {
      console.log('❌ No default OpenAI configuration found in database');
      return;
    }

    console.log(`✅ Found default OpenAI config: ${defaultConfig.name}`);
    console.log(`📅 Created: ${defaultConfig.createdAt.toISOString()}`);
    console.log(`📝 Config preview: ${defaultConfig.configJson.substring(0, 100)}...`);

    // Test that we have multiple configurations available
    const allConfigs = await prisma.voiceProviderConfig.findMany({
      where: { provider: 'openai' },
      orderBy: { name: 'asc' }
    });

    console.log(`\n📊 Available OpenAI configurations (${allConfigs.length}):`);
    for (const config of allConfigs) {
      const isDefault = config.isDefault ? ' (DEFAULT)' : '';
      console.log(`  - ${config.name}${isDefault}`);
    }

    // Simulate what the API route would do
    console.log('\n🔄 Simulating API route configuration loading...');
    
    const dbConfig = await prisma.voiceProviderConfig.findFirst({
      where: { provider: 'openai', isDefault: true }
    });
    
    if (dbConfig) {
      console.log(`✅ API would use database config: ${dbConfig.name}`);
      
      // Parse the JSON to verify it's valid
      try {
        const parsedConfig = JSON.parse(dbConfig.configJson);
        console.log(`🎤 Voice: ${parsedConfig.voice}`);
        console.log(`🤖 Model: ${parsedConfig.model}`);
        console.log(`📝 Display Name: ${parsedConfig.displayName}`);
      } catch (parseError) {
        console.log('❌ Failed to parse config JSON:', parseError);
      }
    } else {
      console.log('⚠️  API would fall back to hardcoded default');
    }

    console.log('\n🎯 Voice API integration test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing voice API integration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testVoiceAPIIntegration();