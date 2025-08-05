/**
 * Script to verify AI configuration and test connections
 * Run with: node scripts/verify-ai-config.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAIConfiguration() {
  try {
    console.log('Verifying AI configuration...\n');

    // Check model configurations
    const openaiConfig = await prisma.aIModelConfig.findUnique({
      where: { provider: 'openai' }
    });

    const anthropicConfig = await prisma.aIModelConfig.findUnique({
      where: { provider: 'anthropic' }
    });

    // Check general settings
    const generalSettings = await prisma.aIGeneralSettings.findUnique({
      where: { id: 'default' }
    });

    console.log('📊 Database Configuration:');
    console.log('OpenAI models:', openaiConfig?.models || 'Not configured');
    console.log('Anthropic models:', anthropicConfig?.models || 'Not configured');
    console.log('Default provider:', generalSettings?.defaultProvider || 'Not set');
    console.log('Temperature:', generalSettings?.temperature || 'Not set');
    console.log('Max tokens:', generalSettings?.maxTokens || 'Not set');

    // Check environment variables
    console.log('\n🔑 Environment Variables:');
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '❌ Not set');
    console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✓ Set' : '❌ Not set');

    // Verify configuration completeness
    const isConfigured = !!(openaiConfig && anthropicConfig && generalSettings);
    const hasApiKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

    console.log('\n🎯 Status:');
    console.log('Database configured:', isConfigured ? '✓ Yes' : '❌ No');
    console.log('API keys available:', hasApiKeys ? '✓ Yes' : '❌ No');

    if (isConfigured && hasApiKeys) {
      console.log('\n🎉 AI configuration is complete and ready to use!');
      
      // Show available models
      const openaiModels = openaiConfig.models.split(',').map(m => m.trim()).filter(Boolean);
      const anthropicModels = anthropicConfig.models.split(',').map(m => m.trim()).filter(Boolean);
      
      console.log('\n📋 Available Models:');
      if (process.env.OPENAI_API_KEY && openaiModels.length > 0) {
        console.log('OpenAI:');
        openaiModels.forEach(model => console.log(`  - ${model}`));
      }
      if (process.env.ANTHROPIC_API_KEY && anthropicModels.length > 0) {
        console.log('Anthropic:');
        anthropicModels.forEach(model => console.log(`  - ${model}`));
      }
    } else {
      console.log('\n⚠️  Configuration incomplete:');
      if (!isConfigured) {
        console.log('- Run: node scripts/init-ai-config.js');
      }
      if (!hasApiKeys) {
        console.log('- Add OPENAI_API_KEY and/or ANTHROPIC_API_KEY to .env.local');
      }
    }

  } catch (error) {
    console.error('❌ Failed to verify AI configuration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyAIConfiguration();