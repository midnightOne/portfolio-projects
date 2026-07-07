/**
 * Environment validation utilities for AI configuration
 */

export interface AIEnvironmentConfig {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  AI_DEFAULT_PROVIDER?: 'openai' | 'anthropic' | 'google';
  AI_REQUEST_TIMEOUT?: string;
  AI_RATE_LIMIT_REQUESTS?: string;
}

interface ProviderKeyStatus {
  configured: boolean;
  keyPreview: string;
}

export interface AIConfigStatus {
  openai: ProviderKeyStatus;
  anthropic: ProviderKeyStatus;
  google: ProviderKeyStatus;
}

const PROVIDER_ENV_KEYS = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
} as const;

type ProviderName = keyof typeof PROVIDER_ENV_KEYS;

export class EnvironmentValidator {
  /**
   * Validates AI configuration from environment variables
   */
  static validateAIConfig(): AIConfigStatus {
    const status = {} as AIConfigStatus;
    for (const [provider, envKey] of Object.entries(PROVIDER_ENV_KEYS)) {
      status[provider as ProviderName] = {
        configured: !!process.env[envKey],
        keyPreview: this.maskApiKey(process.env[envKey]),
      };
    }
    return status;
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
    return Object.values(PROVIDER_ENV_KEYS).some((envKey) => !!process.env[envKey]);
  }

  /**
   * Gets configured AI providers
   */
  static getConfiguredProviders(): ProviderName[] {
    return (Object.entries(PROVIDER_ENV_KEYS) as Array<[ProviderName, string]>)
      .filter(([, envKey]) => !!process.env[envKey])
      .map(([provider]) => provider);
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
      isFullyConfigured: config.openai.configured && config.anthropic.configured && config.google.configured,
      warnings: this.getConfigurationWarnings(config)
    };
  }

  /**
   * Gets configuration warnings for missing or incomplete setup
   */
  private static getConfigurationWarnings(config: AIConfigStatus): string[] {
    const warnings: string[] = [];

    const anyConfigured = (Object.keys(PROVIDER_ENV_KEYS) as ProviderName[]).some(
      (p) => config[p].configured
    );
    if (!anyConfigured) {
      warnings.push('No AI providers configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY environment variables.');
      return warnings;
    }

    if (!config.openai.configured) {
      warnings.push('OpenAI not configured. Set OPENAI_API_KEY to enable OpenAI models.');
    }
    if (!config.anthropic.configured) {
      warnings.push('Anthropic not configured. Set ANTHROPIC_API_KEY to enable Claude models.');
    }
    if (!config.google.configured) {
      warnings.push('Google not configured. Set GOOGLE_API_KEY to enable Gemini models.');
    }

    return warnings;
  }
}
