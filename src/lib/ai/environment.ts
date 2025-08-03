/**
 * Environment validation utilities for AI configuration
 */

export interface AIEnvironmentConfig {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_DEFAULT_PROVIDER?: 'openai' | 'anthropic';
  AI_REQUEST_TIMEOUT?: string;
  AI_RATE_LIMIT_REQUESTS?: string;
}

export interface AIConfigStatus {
  openai: {
    configured: boolean;
    keyPreview: string;
  };
  anthropic: {
    configured: boolean;
    keyPreview: string;
  };
}

export class EnvironmentValidator {
  /**
   * Validates AI configuration from environment variables
   */
  static validateAIConfig(): AIConfigStatus {
    return {
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        keyPreview: this.maskApiKey(process.env.OPENAI_API_KEY)
      },
      anthropic: {
        configured: !!process.env.ANTHROPIC_API_KEY,
        keyPreview: this.maskApiKey(process.env.ANTHROPIC_API_KEY)
      }
    };
  }

  /**
   * Masks API key for safe display
   */
  private static maskApiKey(key?: string): string {
    if (!key) return 'Not configured';
    if (key.length <= 8) return key;
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Checks if at least one AI provider is configured
   */
  static hasAnyAIProvider(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  }

  /**
   * Gets configured AI providers
   */
  static getConfiguredProviders(): ('openai' | 'anthropic')[] {
    const providers: ('openai' | 'anthropic')[] = [];
    
    if (process.env.OPENAI_API_KEY) {
      providers.push('openai');
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push('anthropic');
    }
    
    return providers;
  }

  /**
   * Validates environment configuration and returns detailed status
   */
  static getEnvironmentStatus() {
    const config = this.validateAIConfig();
    const hasAnyProvider = this.hasAnyAIProvider();
    const configuredProviders = this.getConfiguredProviders();

    return {
      ...config,
      hasAnyProvider,
      configuredProviders,
      isFullyConfigured: config.openai.configured && config.anthropic.configured,
      warnings: this.getConfigurationWarnings(config)
    };
  }

  /**
   * Gets configuration warnings for missing or incomplete setup
   */
  private static getConfigurationWarnings(config: AIConfigStatus): string[] {
    const warnings: string[] = [];

    if (!config.openai.configured && !config.anthropic.configured) {
      warnings.push('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.');
    } else {
      if (!config.openai.configured) {
        warnings.push('OpenAI not configured. Set OPENAI_API_KEY to enable OpenAI models.');
      }
      if (!config.anthropic.configured) {
        warnings.push('Anthropic not configured. Set ANTHROPIC_API_KEY to enable Claude models.');
      }
    }

    return warnings;
  }
}