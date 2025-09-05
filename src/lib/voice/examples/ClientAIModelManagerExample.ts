/**
 * ClientAIModelManager Usage Examples
 * 
 * This file demonstrates how to use the ClientAIModelManager for managing
 * voice AI provider configurations with database-backed JSON storage.
 */

import { PrismaClient } from '@prisma/client';
import { 
  ClientAIModelManager, 
  getClientAIModelManager 
} from '../ClientAIModelManager';
import { OpenAIRealtimeSerializer } from '../config-serializers/OpenAIRealtimeSerializer';
import { ElevenLabsSerializer } from '../config-serializers/ElevenLabsSerializer';

// Example: Basic Usage
export async function basicUsageExample() {
  console.log('=== ClientAIModelManager Basic Usage Example ===\n');
  
  // Get the singleton instance
  const manager = getClientAIModelManager();
  
  try {
    // 1. Create and save OpenAI configuration
    console.log('1. Creating OpenAI configuration...');
    const openaiSerializer = new OpenAIRealtimeSerializer();
    const openaiConfig = openaiSerializer.getDefaultConfig();
    
    // Customize the configuration
    openaiConfig.displayName = 'Professional Assistant';
    openaiConfig.description = 'Professional voice assistant for business interactions';
    openaiConfig.temperature = 0.5;
    openaiConfig.voice = 'nova';
    openaiConfig.instructions = 'You are a professional assistant helping visitors learn about this portfolio. Be concise and informative.';
    
    const savedOpenAI = await manager.saveProviderConfig('openai', 'Professional', openaiConfig, true);
    console.log('✓ OpenAI config saved:', savedOpenAI.name, '(Default:', savedOpenAI.isDefault, ')');
    
    // 2. Create and save ElevenLabs configuration
    console.log('\n2. Creating ElevenLabs configuration...');
    const elevenLabsSerializer = new ElevenLabsSerializer();
    const elevenLabsConfig = elevenLabsSerializer.getDefaultConfig();
    
    // Customize the configuration
    elevenLabsConfig.displayName = 'Casual Assistant';
    elevenLabsConfig.description = 'Casual voice assistant for friendly interactions';
    elevenLabsConfig.agentId = 'your-agent-id-here';
    elevenLabsConfig.voiceId = 'your-voice-id-here';
    elevenLabsConfig.voiceSettings.stability = 0.7;
    elevenLabsConfig.context.systemPrompt = 'You are a friendly assistant. Be conversational and approachable.';
    
    const savedElevenLabs = await manager.saveProviderConfig('elevenlabs', 'Casual', elevenLabsConfig, false);
    console.log('✓ ElevenLabs config saved:', savedElevenLabs.name, '(Default:', savedElevenLabs.isDefault, ')');
    
    // 3. Retrieve configurations
    console.log('\n3. Retrieving configurations...');
    
    // Get default OpenAI config
    const defaultOpenAI = await manager.getProviderConfig('openai');
    console.log('✓ Default OpenAI config:', defaultOpenAI?.name);
    
    // Get specific ElevenLabs config
    const casualElevenLabs = await manager.getProviderConfig('elevenlabs', 'Casual');
    console.log('✓ Casual ElevenLabs config:', casualElevenLabs?.name);
    
    // Get all OpenAI configs
    const allOpenAIConfigs = await manager.getAllProviderConfigs('openai');
    console.log('✓ All OpenAI configs:', allOpenAIConfigs.map(c => c.name));
    
    // 4. Get default provider
    const defaultProvider = await manager.getDefaultProvider();
    console.log('\n4. Default provider:', defaultProvider);
    
    // 5. Get statistics
    const stats = await manager.getConfigurationStats();
    console.log('\n5. Configuration statistics:');
    console.log('   Total configs:', stats.totalConfigs);
    console.log('   OpenAI configs:', stats.configsByProvider.openai);
    console.log('   ElevenLabs configs:', stats.configsByProvider.elevenlabs);
    console.log('   Default configs:', stats.defaultConfigs);
    console.log('   Cache size:', stats.cacheSize);
    
  } catch (error) {
    console.error('Error in basic usage example:', error);
  }
}

// Example: Configuration Validation
export async function validationExample() {
  console.log('\n=== Configuration Validation Example ===\n');
  
  const manager = getClientAIModelManager();
  
  // Valid configuration
  console.log('1. Validating valid OpenAI configuration...');
  const openaiSerializer = new OpenAIRealtimeSerializer();
  const validConfig = openaiSerializer.getDefaultConfig();
  
  const validResult = manager.validateConfig('openai', validConfig);
  console.log('✓ Valid config result:', validResult.valid);
  
  // Invalid configuration
  console.log('\n2. Validating invalid configuration...');
  const invalidConfig = {
    provider: 'openai',
    enabled: true,
    displayName: '', // Invalid: empty
    description: 'Test',
    temperature: 5.0 // Invalid: out of range
  } as any;
  
  const invalidResult = manager.validateConfig('openai', invalidConfig);
  console.log('✗ Invalid config result:', invalidResult.valid);
  console.log('  Errors:', invalidResult.errors);
}

// Example: Multiple Named Configurations
export async function multipleConfigsExample() {
  console.log('\n=== Multiple Named Configurations Example ===\n');
  
  const manager = getClientAIModelManager();
  
  try {
    const openaiSerializer = new OpenAIRealtimeSerializer();
    
    // Create multiple configurations for different use cases
    const configs = [
      {
        name: 'Technical',
        config: {
          ...openaiSerializer.getDefaultConfig(),
          displayName: 'Technical Assistant',
          description: 'Technical voice assistant for developer interactions',
          temperature: 0.3,
          voice: 'echo' as const,
          instructions: 'You are a technical assistant. Provide detailed, accurate technical information about projects and technologies.'
        }
      },
      {
        name: 'Business',
        config: {
          ...openaiSerializer.getDefaultConfig(),
          displayName: 'Business Assistant',
          description: 'Business voice assistant for professional interactions',
          temperature: 0.7,
          voice: 'nova' as const,
          instructions: 'You are a business assistant. Focus on professional achievements, business value, and career highlights.'
        }
      },
      {
        name: 'Casual',
        config: {
          ...openaiSerializer.getDefaultConfig(),
          displayName: 'Casual Assistant',
          description: 'Casual voice assistant for friendly interactions',
          temperature: 0.9,
          voice: 'alloy' as const,
          instructions: 'You are a friendly assistant. Be conversational, approachable, and engaging while discussing the portfolio.'
        }
      }
    ];
    
    // Save all configurations
    for (const { name, config } of configs) {
      const isDefault = name === 'Business'; // Make Business the default
      await manager.saveProviderConfig('openai', name, config, isDefault);
      console.log(`✓ Saved ${name} configuration (Default: ${isDefault})`);
    }
    
    // Retrieve and display all configurations
    console.log('\nAll OpenAI configurations:');
    const allConfigs = await manager.getAllProviderConfigs('openai');
    
    for (const config of allConfigs) {
      console.log(`  - ${config.name}: ${config.config.displayName} (Default: ${config.isDefault})`);
      console.log(`    Temperature: ${config.config.temperature}, Voice: ${config.config.voice}`);
    }
    
    // Switch default configuration
    console.log('\nSwitching default to Technical...');
    await manager.setDefaultProvider('openai', 'Technical');
    
    const newDefault = await manager.getProviderConfig('openai');
    console.log('✓ New default configuration:', newDefault?.name);
    
  } catch (error) {
    console.error('Error in multiple configs example:', error);
  }
}

// Example: Hot Reload and Caching
export async function cachingExample() {
  console.log('\n=== Caching and Hot Reload Example ===\n');
  
  const manager = getClientAIModelManager();
  
  try {
    // Create a configuration
    const openaiSerializer = new OpenAIRealtimeSerializer();
    const config = openaiSerializer.getDefaultConfig();
    config.displayName = 'Cache Test';
    
    await manager.saveProviderConfig('openai', 'CacheTest', config);
    console.log('✓ Configuration saved');
    
    // First retrieval (hits database)
    console.log('\n1. First retrieval (database hit)...');
    const start1 = Date.now();
    const config1 = await manager.getProviderConfig('openai', 'CacheTest');
    const time1 = Date.now() - start1;
    console.log(`✓ Retrieved in ${time1}ms:`, config1?.name);
    
    // Second retrieval (hits cache)
    console.log('\n2. Second retrieval (cache hit)...');
    const start2 = Date.now();
    const config2 = await manager.getProviderConfig('openai', 'CacheTest');
    const time2 = Date.now() - start2;
    console.log(`✓ Retrieved in ${time2}ms:`, config2?.name);
    console.log(`Cache speedup: ${time1 / time2}x faster`);
    
    // Hot reload configuration
    console.log('\n3. Hot reloading configuration...');
    await manager.reloadConfiguration();
    console.log('✓ Configuration reloaded');
    
    // Get statistics
    const stats = await manager.getConfigurationStats();
    console.log('\n4. Cache statistics:');
    console.log('   Cache size:', stats.cacheSize);
    
  } catch (error) {
    console.error('Error in caching example:', error);
  }
}

// Example: Error Handling
export async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');
  
  const manager = getClientAIModelManager();
  
  try {
    // Try to get non-existent configuration
    console.log('1. Attempting to get non-existent configuration...');
    const nonExistent = await manager.getProviderConfig('openai', 'NonExistent');
    console.log('✓ Non-existent config result:', nonExistent === null ? 'null (expected)' : 'unexpected');
    
    // Try to save invalid configuration
    console.log('\n2. Attempting to save invalid configuration...');
    try {
      const invalidConfig = {
        provider: 'openai',
        enabled: 'invalid', // Should be boolean
        displayName: '',    // Should not be empty
        description: 'Test'
      } as any;
      
      await manager.saveProviderConfig('openai', 'Invalid', invalidConfig);
      console.log('✗ Unexpected: Invalid config was saved');
    } catch (error) {
      console.log('✓ Expected error caught:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Try to delete non-existent configuration
    console.log('\n3. Attempting to delete non-existent configuration...');
    const deleteResult = await manager.deleteProviderConfig('openai', 'NonExistent');
    console.log('✓ Delete non-existent result:', deleteResult === false ? 'false (expected)' : 'unexpected');
    
  } catch (error) {
    console.error('Error in error handling example:', error);
  }
}

// Main example runner
export async function runAllExamples() {
  console.log('ClientAIModelManager Examples\n');
  console.log('==============================\n');
  
  try {
    await basicUsageExample();
    await validationExample();
    await multipleConfigsExample();
    await cachingExample();
    await errorHandlingExample();
    
    console.log('\n=== All Examples Completed Successfully ===');
    
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Clean up singleton
    const manager = getClientAIModelManager();
    manager.destroy();
  }
}

// Export individual examples for selective running
export {
  basicUsageExample,
  validationExample,
  multipleConfigsExample,
  cachingExample,
  errorHandlingExample
};