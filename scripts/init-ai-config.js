/**
 * Script to initialize AI configuration in the database
 * Run with: node scripts/init-ai-config.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_AI_CONFIG = {
    modelConfig: {
        openai: 'gpt-4o,gpt-4o-mini,gpt-3.5-turbo',
        anthropic: 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022'
    },
    generalSettings: {
        defaultProvider: 'openai',
        systemPrompt: 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author\'s voice and style.',
        temperature: 0.7,
        maxTokens: 4000
    }
};

async function initializeAIConfiguration() {
    try {
        console.log('Initializing AI configuration...');

        // Initialize model configuration for OpenAI
        await prisma.aIModelConfig.upsert({
            where: { provider: 'openai' },
            update: {
                models: DEFAULT_AI_CONFIG.modelConfig.openai
            },
            create: {
                provider: 'openai',
                models: DEFAULT_AI_CONFIG.modelConfig.openai
            }
        });
        console.log('✓ OpenAI models configured:', DEFAULT_AI_CONFIG.modelConfig.openai);

        // Initialize model configuration for Anthropic
        await prisma.aIModelConfig.upsert({
            where: { provider: 'anthropic' },
            update: {
                models: DEFAULT_AI_CONFIG.modelConfig.anthropic
            },
            create: {
                provider: 'anthropic',
                models: DEFAULT_AI_CONFIG.modelConfig.anthropic
            }
        });
        console.log('✓ Anthropic models configured:', DEFAULT_AI_CONFIG.modelConfig.anthropic);

        // Initialize general settings
        await prisma.aIGeneralSettings.upsert({
            where: { id: 'default' },
            update: {
                defaultProvider: DEFAULT_AI_CONFIG.generalSettings.defaultProvider,
                systemPrompt: DEFAULT_AI_CONFIG.generalSettings.systemPrompt,
                temperature: DEFAULT_AI_CONFIG.generalSettings.temperature,
                maxTokens: DEFAULT_AI_CONFIG.generalSettings.maxTokens
            },
            create: {
                id: 'default',
                defaultProvider: DEFAULT_AI_CONFIG.generalSettings.defaultProvider,
                systemPrompt: DEFAULT_AI_CONFIG.generalSettings.systemPrompt,
                temperature: DEFAULT_AI_CONFIG.generalSettings.temperature,
                maxTokens: DEFAULT_AI_CONFIG.generalSettings.maxTokens
            }
        });
        console.log('✓ General settings configured');

        console.log('\n🎉 AI configuration initialized successfully!');
        console.log('\nConfigured models:');
        console.log('- OpenAI:', DEFAULT_AI_CONFIG.modelConfig.openai);
        console.log('- Anthropic:', DEFAULT_AI_CONFIG.modelConfig.anthropic);
        console.log('\nYou can now use the AI features in your application.');

    } catch (error) {
        console.error('❌ Failed to initialize AI configuration:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the initialization
initializeAIConfiguration();