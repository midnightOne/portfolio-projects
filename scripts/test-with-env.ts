#!/usr/bin/env tsx

/**
 * Test script that properly loads environment variables from .env.local
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: join(process.cwd(), '.env.local') });

import { EnvironmentValidator } from '../src/lib/ai/environment';

console.log('🔍 Testing Environment with Loaded .env.local...\n');

console.log('🔧 Environment Variables Check:');
console.log(`   OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
console.log(`   ANTHROPIC_API_KEY exists: ${!!process.env.ANTHROPIC_API_KEY}`);

if (process.env.OPENAI_API_KEY) {
  const key = process.env.OPENAI_API_KEY;
  const preview = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : key;
  console.log(`   OPENAI_API_KEY preview: ${preview}`);
}

console.log('\n📊 Environment Status:');

try {
  const status = EnvironmentValidator.getEnvironmentStatus();
  
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
  
  console.log('\n🎯 What the API endpoint would return:');
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
  
  if (status.openai.configured) {
    console.log('\n🎉 Great! Your OPENAI_API_KEY is properly configured and detected!');
    console.log('   The Environment Status API is working correctly with your setup.');
  }
  
} catch (error) {
  console.error('❌ Error testing environment:', error);
}