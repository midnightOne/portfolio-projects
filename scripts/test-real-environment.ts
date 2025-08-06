#!/usr/bin/env tsx

/**
 * Test script to check the real environment configuration
 */

import { EnvironmentValidator } from '../src/lib/ai/environment';

console.log('🔍 Testing Real Environment Configuration...\n');

try {
  const status = EnvironmentValidator.getEnvironmentStatus();
  
  console.log('📊 Current Environment Status:');
  console.log(`   OpenAI configured: ${status.openai.configured}`);
  console.log(`   OpenAI key preview: ${status.openai.keyPreview}`);
  console.log(`   Anthropic configured: ${status.anthropic.configured}`);
  console.log(`   Anthropic key preview: ${status.anthropic.keyPreview}`);
  console.log(`   Has any provider: ${status.hasAnyProvider}`);
  console.log(`   Configured providers: [${status.configuredProviders.join(', ')}]`);
  console.log(`   Is fully configured: ${status.isFullyConfigured}`);
  console.log(`   Total configured: ${status.configuredProviders.length}/2`);
  
  if (status.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    status.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }
  
  console.log('\n🎯 API Response Preview:');
  const apiResponse = {
    success: true,
    data: {
      openai: {
        configured: status.openai.configured,
        keyPreview: status.openai.keyPreview,
        environmentVariable: 'OPENAI_API_KEY'
      },
      anthropic: {
        configured: status.anthropic.configured,
        keyPreview: status.anthropic.keyPreview,
        environmentVariable: 'ANTHROPIC_API_KEY'
      },
      summary: {
        hasAnyProvider: status.hasAnyProvider,
        configuredProviders: status.configuredProviders,
        isFullyConfigured: status.isFullyConfigured,
        totalConfigured: status.configuredProviders.length,
        totalAvailable: 2
      },
      warnings: status.warnings,
      setupInstructions: {
        openai: status.openai.configured ? null : {
          message: 'Set OPENAI_API_KEY environment variable',
          documentation: 'https://platform.openai.com/api-keys',
          example: 'OPENAI_API_KEY=sk-...'
        },
        anthropic: status.anthropic.configured ? null : {
          message: 'Set ANTHROPIC_API_KEY environment variable',
          documentation: 'https://console.anthropic.com/settings/keys',
          example: 'ANTHROPIC_API_KEY=sk-ant-...'
        }
      }
    },
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(apiResponse, null, 2));
  
} catch (error) {
  console.error('❌ Error testing environment:', error);
}