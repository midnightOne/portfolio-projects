/**
 * Database setup utilities for AI configuration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DefaultAIConfig {
  modelConfig: {
    openai: string;
    anthropic: string;
    google: string;
  };
  generalSettings: {
    defaultProvider: 'openai' | 'anthropic' | 'google';
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
}

// Config-layer seeds only (ai-admin 1.2): dropdown starting points, refreshed from
// the providers' live model APIs — the run path resolves via the alias registry.
export const DEFAULT_AI_CONFIG: DefaultAIConfig = {
  modelConfig: {
    openai: 'gpt-4o,gpt-4o-mini',
    anthropic: 'claude-sonnet-4-5-20250929,claude-haiku-4-5-20251001',
    google: 'gemini-2.5-pro,gemini-2.5-flash'
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
    // Initialize model configuration for every provider
    for (const [provider, models] of Object.entries(DEFAULT_AI_CONFIG.modelConfig)) {
      await prisma.aIModelConfig.upsert({
        where: { provider },
        update: { models },
        create: { provider, models }
      });
    }

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
    const [openaiConfig, anthropicConfig, googleConfig, generalSettings] = await Promise.all([
      prisma.aIModelConfig.findUnique({ where: { provider: 'openai' } }),
      prisma.aIModelConfig.findUnique({ where: { provider: 'anthropic' } }),
      prisma.aIModelConfig.findUnique({ where: { provider: 'google' } }),
      prisma.aIGeneralSettings.findUnique({ where: { id: 'default' } })
    ]);

    return {
      modelConfig: {
        openai: openaiConfig?.models || '',
        anthropic: anthropicConfig?.models || '',
        google: googleConfig?.models || ''
      },
      generalSettings: generalSettings ? {
        defaultProvider: generalSettings.defaultProvider as 'openai' | 'anthropic' | 'google',
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