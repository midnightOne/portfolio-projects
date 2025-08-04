/**
 * AI Availability Checker
 * 
 * Provides utilities for checking AI service availability and implementing
 * graceful degradation when AI features are not available.
 */

import { AIServiceManager } from './service-manager';
import { AIProviderType } from './types';

export interface AIAvailabilityStatus {
  available: boolean;
  hasConfiguredProviders: boolean;
  hasConnectedProviders: boolean;
  availableModels: string[];
  unavailableReasons: string[];
  suggestions: string[];
}

export interface ProviderAvailability {
  provider: AIProviderType;
  configured: boolean;
  connected: boolean;
  models: string[];
  error?: string;
}

export class AIAvailabilityChecker {
  private static instance: AIAvailabilityChecker;
  private serviceManager: AIServiceManager;
  private lastCheck: Date | null = null;
  private cachedStatus: AIAvailabilityStatus | null = null;
  private cacheTimeout = 30000; // 30 seconds
  
  private constructor() {
    this.serviceManager = new AIServiceManager();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): AIAvailabilityChecker {
    if (!AIAvailabilityChecker.instance) {
      AIAvailabilityChecker.instance = new AIAvailabilityChecker();
    }
    return AIAvailabilityChecker.instance;
  }
  
  /**
   * Check overall AI availability status
   */
  async checkAvailability(forceRefresh = false): Promise<AIAvailabilityStatus> {
    // Return cached result if still valid
    if (!forceRefresh && this.cachedStatus && this.lastCheck) {
      const timeSinceCheck = Date.now() - this.lastCheck.getTime();
      if (timeSinceCheck < this.cacheTimeout) {
        return this.cachedStatus;
      }
    }
    
    try {
      // Get provider statuses
      const providerStatuses = await this.serviceManager.getAvailableProviders();
      
      // Analyze availability
      const configuredProviders = providerStatuses.filter(p => p.configured);
      const connectedProviders = providerStatuses.filter(p => p.configured && p.connected);
      
      // Get all available models
      const availableModels: string[] = [];
      connectedProviders.forEach(provider => {
        availableModels.push(...provider.models);
      });
      
      // Determine unavailable reasons and suggestions
      const unavailableReasons: string[] = [];
      const suggestions: string[] = [];
      
      if (configuredProviders.length === 0) {
        unavailableReasons.push('No AI providers are configured');
        suggestions.push('Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables');
        suggestions.push('Visit the AI Settings page to configure providers');
      } else if (connectedProviders.length === 0) {
        unavailableReasons.push('No AI providers are connected');
        configuredProviders.forEach(provider => {
          if (provider.error) {
            unavailableReasons.push(`${provider.name}: ${provider.error}`);
          }
        });
        suggestions.push('Check your API keys are valid and active');
        suggestions.push('Test connections in the AI Settings page');
      } else if (availableModels.length === 0) {
        unavailableReasons.push('No AI models are configured');
        suggestions.push('Configure models for your connected providers in AI Settings');
      }
      
      const status: AIAvailabilityStatus = {
        available: connectedProviders.length > 0 && availableModels.length > 0,
        hasConfiguredProviders: configuredProviders.length > 0,
        hasConnectedProviders: connectedProviders.length > 0,
        availableModels,
        unavailableReasons,
        suggestions
      };
      
      // Cache the result
      this.cachedStatus = status;
      this.lastCheck = new Date();
      
      return status;
    } catch (error) {
      console.error('Error checking AI availability:', error);
      
      const fallbackStatus: AIAvailabilityStatus = {
        available: false,
        hasConfiguredProviders: false,
        hasConnectedProviders: false,
        availableModels: [],
        unavailableReasons: ['Unable to check AI service status'],
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact support if the issue persists'
        ]
      };
      
      return fallbackStatus;
    }
  }
  
  /**
   * Check if AI features should be enabled
   */
  async isAIEnabled(): Promise<boolean> {
    const status = await this.checkAvailability();
    return status.available;
  }
  
  /**
   * Get availability status for a specific provider
   */
  async getProviderAvailability(providerType: AIProviderType): Promise<ProviderAvailability> {
    try {
      const providerStatuses = await this.serviceManager.getAvailableProviders();
      const providerStatus = providerStatuses.find(p => p.name === providerType);
      
      if (!providerStatus) {
        return {
          provider: providerType,
          configured: false,
          connected: false,
          models: [],
          error: 'Provider not found'
        };
      }
      
      return {
        provider: providerType,
        configured: providerStatus.configured,
        connected: providerStatus.connected,
        models: providerStatus.models,
        error: providerStatus.error
      };
    } catch (error) {
      return {
        provider: providerType,
        configured: false,
        connected: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get user-friendly status message
   */
  async getStatusMessage(): Promise<string> {
    const status = await this.checkAvailability();
    
    if (status.available) {
      const modelCount = status.availableModels.length;
      return `AI features are available with ${modelCount} model${modelCount === 1 ? '' : 's'}`;
    }
    
    if (!status.hasConfiguredProviders) {
      return 'AI features are disabled - no providers configured';
    }
    
    if (!status.hasConnectedProviders) {
      return 'AI features are disabled - connection issues';
    }
    
    return 'AI features are disabled - no models available';
  }
  
  /**
   * Get configuration guidance for users
   */
  async getConfigurationGuidance(): Promise<{
    title: string;
    message: string;
    actions: Array<{
      label: string;
      description: string;
      href?: string;
    }>;
  }> {
    const status = await this.checkAvailability();
    
    if (status.available) {
      return {
        title: 'AI Features Active',
        message: 'All AI features are working correctly.',
        actions: [
          {
            label: 'Manage Settings',
            description: 'Configure models and preferences',
            href: '/admin/ai-settings'
          }
        ]
      };
    }
    
    if (!status.hasConfiguredProviders) {
      return {
        title: 'AI Setup Required',
        message: 'AI features require API key configuration.',
        actions: [
          {
            label: 'Set Environment Variables',
            description: 'Add OPENAI_API_KEY or ANTHROPIC_API_KEY to your environment'
          },
          {
            label: 'Visit AI Settings',
            description: 'Check configuration status and test connections',
            href: '/admin/ai-settings'
          },
          {
            label: 'Get API Keys',
            description: 'Sign up for OpenAI or Anthropic API access'
          }
        ]
      };
    }
    
    if (!status.hasConnectedProviders) {
      return {
        title: 'Connection Issues',
        message: 'AI providers are configured but not connecting.',
        actions: [
          {
            label: 'Test Connections',
            description: 'Verify API keys and network connectivity',
            href: '/admin/ai-settings'
          },
          {
            label: 'Check API Keys',
            description: 'Ensure your API keys are valid and active'
          },
          {
            label: 'Review Errors',
            description: 'Check the AI Settings page for specific error messages'
          }
        ]
      };
    }
    
    return {
      title: 'Model Configuration Needed',
      message: 'AI providers are connected but no models are configured.',
      actions: [
        {
          label: 'Configure Models',
          description: 'Add model IDs in the AI Settings page',
          href: '/admin/ai-settings'
        },
        {
          label: 'Check Documentation',
          description: 'Review available models for your providers'
        }
      ]
    };
  }
  
  /**
   * Clear cached status (useful for testing or after configuration changes)
   */
  clearCache(): void {
    this.cachedStatus = null;
    this.lastCheck = null;
  }
  
  /**
   * Check if a specific model is available
   */
  async isModelAvailable(model: string): Promise<boolean> {
    const status = await this.checkAvailability();
    return status.availableModels.includes(model);
  }
  
  /**
   * Get fallback options when AI is unavailable
   */
  getFallbackOptions(): Array<{
    title: string;
    description: string;
    action?: string;
  }> {
    return [
      {
        title: 'Manual Editing',
        description: 'Continue editing your project content manually',
        action: 'Use the standard text editor without AI assistance'
      },
      {
        title: 'Save as Draft',
        description: 'Save your work and return when AI features are available',
        action: 'Your progress will be preserved'
      },
      {
        title: 'Configure AI',
        description: 'Set up AI providers to enable intelligent assistance',
        action: 'Visit AI Settings to get started'
      }
    ];
  }
}

/**
 * Hook for React components to check AI availability
 */
export function useAIAvailability() {
  const checker = AIAvailabilityChecker.getInstance();
  
  return {
    checkAvailability: (forceRefresh?: boolean) => checker.checkAvailability(forceRefresh),
    isAIEnabled: () => checker.isAIEnabled(),
    getStatusMessage: () => checker.getStatusMessage(),
    getConfigurationGuidance: () => checker.getConfigurationGuidance(),
    getFallbackOptions: () => checker.getFallbackOptions(),
    clearCache: () => checker.clearCache()
  };
}

/**
 * Utility function to check if AI should be disabled in components
 */
export async function shouldDisableAI(): Promise<boolean> {
  const checker = AIAvailabilityChecker.getInstance();
  return !(await checker.isAIEnabled());
}

/**
 * Get a user-friendly message explaining why AI is disabled
 */
export async function getAIDisabledMessage(): Promise<string> {
  const checker = AIAvailabilityChecker.getInstance();
  const status = await checker.checkAvailability();
  
  if (status.unavailableReasons.length > 0) {
    return status.unavailableReasons[0];
  }
  
  return 'AI features are currently unavailable';
}