/**
 * Database setup utilities for AI configuration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DefaultAIConfig {
  modelConfig: {
    openai: string;
    anthropic: string;
  };
  generalSettings: {
    defaultProvider: 'openai' | 'anthropic';
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
}

export const DEFAULT_AI_CONFIG: DefaultAIConfig = {
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

/**
 * Initializes the AI configuration tables with default values
 */
export async function initializeAIConfiguration(): Promise<void> {
  try {
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

    console.log('AI configuration initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AI configuration:', error);
    throw error;
  }
}

/**
 * Cleans up old AI configuration data (for migration purposes)
 */
export async function cleanupOldAIData(): Promise<void> {
  try {
    // Note: The old tables (ai_settings, ai_conversations, ai_messages, content_versions)
    // should have been dropped by the migration script
    console.log('Old AI data cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup old AI data:', error);
    throw error;
  }
}

/**
 * Validates that the AI configuration tables exist and have default data
 */
export async function validateAIConfiguration(): Promise<boolean> {
  try {
    // Check if model configurations exist
    const openaiConfig = await prisma.aIModelConfig.findUnique({
      where: { provider: 'openai' }
    });

    const anthropicConfig = await prisma.aIModelConfig.findUnique({
      where: { provider: 'anthropic' }
    });

    // Check if general settings exist
    const generalSettings = await prisma.aIGeneralSettings.findUnique({
      where: { id: 'default' }
    });

    return !!(openaiConfig && anthropicConfig && generalSettings);
  } catch (error) {
    console.error('Failed to validate AI configuration:', error);
    return false;
  }
}

/**
 * Gets the current AI configuration from the database
 */
export async function getAIConfiguration() {
  try {
    const [openaiConfig, anthropicConfig, generalSettings] = await Promise.all([
      prisma.aIModelConfig.findUnique({ where: { provider: 'openai' } }),
      prisma.aIModelConfig.findUnique({ where: { provider: 'anthropic' } }),
      prisma.aIGeneralSettings.findUnique({ where: { id: 'default' } })
    ]);

    return {
      modelConfig: {
        openai: openaiConfig?.models || '',
        anthropic: anthropicConfig?.models || ''
      },
      generalSettings: generalSettings ? {
        defaultProvider: generalSettings.defaultProvider as 'openai' | 'anthropic',
        systemPrompt: generalSettings.systemPrompt,
        temperature: generalSettings.temperature,
        maxTokens: generalSettings.maxTokens
      } : DEFAULT_AI_CONFIG.generalSettings
    };
  } catch (error) {
    console.error('Failed to get AI configuration:', error);
    return DEFAULT_AI_CONFIG;
  }
}