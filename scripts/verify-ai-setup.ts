/**
 * Verification script to check AI configuration setup
 */

import { PrismaClient } from '@prisma/client';
import { EnvironmentValidator } from '../src/lib/ai/environment';
import { getAIConfiguration, validateAIConfiguration } from '../src/lib/ai/database-setup';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying AI Configuration Setup...\n');
  
  // 1. Check environment variables
  console.log('1. Environment Variables:');
  const envStatus = EnvironmentValidator.getEnvironmentStatus();
  console.log(`   OpenAI configured: ${envStatus.openai.configured} (${envStatus.openai.keyPreview})`);
  console.log(`   Anthropic configured: ${envStatus.anthropic.configured} (${envStatus.anthropic.keyPreview})`);
  console.log(`   Has any provider: ${envStatus.hasAnyProvider}`);
  console.log(`   Configured providers: ${envStatus.configuredProviders.join(', ')}`);
  
  if (envStatus.warnings.length > 0) {
    console.log('   Warnings:');
    envStatus.warnings.forEach(warning => console.log(`     - ${warning}`));
  }
  console.log();
  
  // 2. Check database tables
  console.log('2. Database Tables:');
  try {
    const modelConfigs = await prisma.aIModelConfig.findMany();
    const generalSettings = await prisma.aIGeneralSettings.findMany();
    
    console.log(`   AI Model Config records: ${modelConfigs.length}`);
    modelConfigs.forEach(config => {
      console.log(`     - ${config.provider}: ${config.models}`);
    });
    
    console.log(`   AI General Settings records: ${generalSettings.length}`);
    generalSettings.forEach(settings => {
      console.log(`     - Default provider: ${settings.defaultProvider}`);
      console.log(`     - Temperature: ${settings.temperature}`);
      console.log(`     - Max tokens: ${settings.maxTokens}`);
    });
    console.log();
  } catch (error) {
    console.error('   ❌ Error accessing database tables:', error);
    console.log();
  }
  
  // 3. Validate configuration
  console.log('3. Configuration Validation:');
  const isValid = await validateAIConfiguration();
  console.log(`   Configuration valid: ${isValid ? '✅' : '❌'}`);
  console.log();
  
  // 4. Get current configuration
  console.log('4. Current Configuration:');
  const config = await getAIConfiguration();
  console.log('   Model Config:');
  console.log(`     OpenAI: ${config.modelConfig.openai}`);
  console.log(`     Anthropic: ${config.modelConfig.anthropic}`);
  console.log('   General Settings:');
  console.log(`     Default provider: ${config.generalSettings.defaultProvider}`);
  console.log(`     Temperature: ${config.generalSettings.temperature}`);
  console.log(`     Max tokens: ${config.generalSettings.maxTokens}`);
  console.log(`     System prompt: ${config.generalSettings.systemPrompt.substring(0, 50)}...`);
  
  console.log('\n✅ AI Configuration Setup Verification Complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());