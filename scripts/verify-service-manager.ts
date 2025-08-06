/**
 * Verification script for AI Service Manager
 */

import { AIServiceManager } from '../src/lib/ai/service-manager';

async function verifyServiceManager() {
  console.log('🔍 Verifying AI Service Manager...\n');
  
  try {
    // Initialize service manager
    const serviceManager = new AIServiceManager();
    console.log('✅ Service Manager initialized successfully');
    
    // Test provider status
    console.log('\n📡 Checking provider status...');
    const providers = await serviceManager.getAvailableProviders();
    
    providers.forEach(provider => {
      const status = provider.configured ? '✅ Configured' : '❌ Not configured';
      const connection = provider.connected ? '🟢 Connected' : '🔴 Disconnected';
      console.log(`  ${provider.name}: ${status}, ${connection}`);
      if (provider.error) {
        console.log(`    Error: ${provider.error}`);
      }
      console.log(`    Models: ${provider.models.length} configured`);
    });
    
    // Test model configuration
    console.log('\n🎯 Checking model configuration...');
    const modelConfigs = await serviceManager.getConfiguredModels();
    
    if (modelConfigs.length === 0) {
      console.log('  No model configurations found in database');
    } else {
      modelConfigs.forEach(config => {
        console.log(`  ${config.provider}: ${config.models.length} models`);
        console.log(`    Models: ${config.models.join(', ')}`);
        if (config.defaultModel) {
          console.log(`    Default: ${config.defaultModel}`);
        }
      });
    }
    
    // Test model queries
    console.log('\n🔍 Testing model queries...');
    const openaiModels = serviceManager.getProviderModels('openai');
    const anthropicModels = serviceManager.getProviderModels('anthropic');
    
    console.log(`  OpenAI models: ${openaiModels.length} (${openaiModels.join(', ')})`);
    console.log(`  Anthropic models: ${anthropicModels.length} (${anthropicModels.join(', ')})`);
    
    // Test model lookup
    if (openaiModels.length > 0) {
      const testModel = openaiModels[0];
      const provider = serviceManager.getProviderForModel(testModel);
      const isConfigured = serviceManager.isModelConfigured(testModel);
      console.log(`  Model '${testModel}' -> Provider: ${provider}, Configured: ${isConfigured}`);
    }
    
    // Test dropdown format
    console.log('\n📋 Testing dropdown format...');
    const dropdownModels = await serviceManager.getModelsForDropdown();
    console.log(`  Total models for dropdown: ${dropdownModels.length}`);
    
    dropdownModels.slice(0, 3).forEach(model => {
      const availability = model.available ? '✅' : '❌';
      console.log(`    ${availability} ${model.provider}/${model.model}`);
    });
    
    if (dropdownModels.length > 3) {
      console.log(`    ... and ${dropdownModels.length - 3} more`);
    }
    
    console.log('\n🎉 Service Manager verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Service Manager verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyServiceManager().catch(console.error);