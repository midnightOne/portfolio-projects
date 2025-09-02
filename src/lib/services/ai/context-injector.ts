/**
 * Context Injector Service
 * Handles secure context injection for AI agents using the Context Provider system
 * Manages ephemeral token generation and system prompt injection
 */

import { contextProvider, ContextInjectionRequest, ContextInjectionResult, FilteredContext } from './context-provider';
import { reflinkManager } from './reflink-manager';
import { ReflinkInfo } from '@/lib/types/rate-limiting';

export interface TokenGenerationRequest {
  sessionId: string;
  provider: 'openai' | 'elevenlabs';
  reflinkCode?: string;
  query?: string;
  contextConfig?: any;
}

export interface TokenGenerationResult {
  success: boolean;
  ephemeralToken?: string;
  publicContext?: string;
  welcomeMessage?: string;
  accessLevel?: string;
  budgetStatus?: any;
  error?: string;
}

export interface SystemPromptInjection {
  systemPrompt: string;
  initialContext: string;
  hiddenInstructions: string;
  capabilities: {
    voiceAI: boolean;
    jobAnalysis: boolean;
    advancedNavigation: boolean;
  };
}

/**
 * Context Injector service class
 */
export class ContextInjector {
  private static instance: ContextInjector;

  static getInstance(): ContextInjector {
    if (!ContextInjector.instance) {
      ContextInjector.instance = new ContextInjector();
    }
    return ContextInjector.instance;
  }

  /**
   * Generate ephemeral token with injected context for voice providers
   */
  async generateEphemeralToken(request: TokenGenerationRequest): Promise<TokenGenerationResult> {
    try {
      // Build context injection request
      const contextRequest: ContextInjectionRequest = {
        sessionId: request.sessionId,
        query: request.query,
        reflinkCode: request.reflinkCode,
        provider: request.provider,
        contextConfig: request.contextConfig,
      };

      // Inject context using Context Provider
      const result = await contextProvider.injectContext(contextRequest);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Context injection failed',
        };
      }

      const context = result.context;

      // Generate welcome message
      const welcomeMessage = await this.generateWelcomeMessage(request.reflinkCode);

      // Get budget status if reflink is provided
      let budgetStatus;
      if (request.reflinkCode) {
        const validation = await reflinkManager.validateReflinkWithBudget(request.reflinkCode);
        budgetStatus = validation.budgetStatus;
      }

      return {
        success: true,
        ephemeralToken: result.ephemeralToken,
        publicContext: context.publicContext,
        welcomeMessage,
        accessLevel: context.accessLevel,
        budgetStatus,
      };

    } catch (error) {
      console.error('Token generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Inject system prompt and context for text-based AI agents
   */
  async injectSystemPrompt(
    sessionId: string,
    query: string,
    reflinkCode?: string
  ): Promise<SystemPromptInjection> {
    try {
      const contextRequest: ContextInjectionRequest = {
        sessionId,
        query,
        reflinkCode,
        provider: 'text',
      };

      const result = await contextProvider.injectContext(contextRequest);

      if (!result.success) {
        throw new Error(result.error || 'Context injection failed');
      }

      const context = result.context;

      // Determine capabilities based on access level
      const capabilities = await this.determineCapabilities(reflinkCode);

      return {
        systemPrompt: context.systemPrompt,
        initialContext: context.initialContext,
        hiddenInstructions: context.hiddenContext,
        capabilities,
      };

    } catch (error) {
      console.error('System prompt injection failed:', error);
      
      // Return minimal context for error cases
      return {
        systemPrompt: 'You are an AI assistant for a portfolio website. Provide helpful responses based on available information.',
        initialContext: '',
        hiddenInstructions: '',
        capabilities: {
          voiceAI: false,
          jobAnalysis: false,
          advancedNavigation: false,
        },
      };
    }
  }

  /**
   * Load filtered context on-demand with access control
   */
  async loadFilteredContext(
    sessionId: string,
    query: string,
    reflinkCode?: string,
    options?: any
  ): Promise<FilteredContext> {
    try {
      return await contextProvider.loadContextOnDemand(sessionId, query, reflinkCode, options);
    } catch (error) {
      console.error('Filtered context loading failed:', error);
      throw error;
    }
  }

  /**
   * Validate and filter context based on reflink permissions
   */
  async validateAndFilterContext(
    sessionId: string,
    reflinkCode?: string
  ): Promise<{
    valid: boolean;
    accessLevel: string;
    capabilities: any;
    welcomeMessage?: string;
    error?: string;
  }> {
    try {
      if (!reflinkCode) {
        return {
          valid: true,
          accessLevel: 'basic',
          capabilities: {
            voiceAI: false,
            jobAnalysis: false,
            advancedNavigation: false,
          },
        };
      }

      // Validate reflink
      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);

      if (!validation.valid) {
        return {
          valid: false,
          accessLevel: 'no_access',
          capabilities: {
            voiceAI: false,
            jobAnalysis: false,
            advancedNavigation: false,
          },
          error: this.getValidationErrorMessage(validation.reason),
        };
      }

      const reflink = validation.reflink!;
      const capabilities = {
        voiceAI: reflink.enableVoiceAI,
        jobAnalysis: reflink.enableJobAnalysis,
        advancedNavigation: reflink.enableAdvancedNavigation,
      };

      const welcomeMessage = validation.welcomeMessage;

      return {
        valid: true,
        accessLevel: 'premium',
        capabilities,
        welcomeMessage,
      };

    } catch (error) {
      console.error('Context validation failed:', error);
      return {
        valid: false,
        accessLevel: 'no_access',
        capabilities: {
          voiceAI: false,
          jobAnalysis: false,
          advancedNavigation: false,
        },
        error: 'Validation failed',
      };
    }
  }

  /**
   * Generate welcome message based on reflink
   */
  private async generateWelcomeMessage(reflinkCode?: string): Promise<string> {
    if (!reflinkCode) {
      return 'Welcome! You can ask me questions about the portfolio owner\'s background and projects.';
    }

    try {
      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);
      
      if (validation.valid && validation.welcomeMessage) {
        return validation.welcomeMessage;
      }

      return 'Welcome! You have access to enhanced AI features.';

    } catch (error) {
      console.error('Welcome message generation failed:', error);
      return 'Welcome! You can ask me questions about the portfolio owner\'s background and projects.';
    }
  }

  /**
   * Determine capabilities based on reflink
   */
  private async determineCapabilities(reflinkCode?: string): Promise<{
    voiceAI: boolean;
    jobAnalysis: boolean;
    advancedNavigation: boolean;
  }> {
    if (!reflinkCode) {
      return {
        voiceAI: false,
        jobAnalysis: false,
        advancedNavigation: false,
      };
    }

    try {
      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);
      
      if (validation.valid && validation.reflink) {
        const reflink = validation.reflink;
        return {
          voiceAI: reflink.enableVoiceAI,
          jobAnalysis: reflink.enableJobAnalysis,
          advancedNavigation: reflink.enableAdvancedNavigation,
        };
      }

      return {
        voiceAI: false,
        jobAnalysis: false,
        advancedNavigation: false,
      };

    } catch (error) {
      console.error('Capability determination failed:', error);
      return {
        voiceAI: false,
        jobAnalysis: false,
        advancedNavigation: false,
      };
    }
  }

  /**
   * Get validation error message
   */
  private getValidationErrorMessage(reason?: string): string {
    switch (reason) {
      case 'not_found':
        return 'Invalid reflink code';
      case 'expired':
        return 'Reflink has expired. Please contact the portfolio owner for a new one.';
      case 'budget_exhausted':
        return 'Reflink budget has been exhausted. Please contact the portfolio owner.';
      case 'inactive':
        return 'Reflink is inactive';
      default:
        return 'Reflink validation failed';
    }
  }

  /**
   * Clear context cache for session
   */
  clearSessionCache(sessionId: string): void {
    contextProvider.clearSessionCache(sessionId);
  }

  /**
   * Get context cache statistics
   */
  getCacheStats(): any {
    return contextProvider.getCacheStats();
  }
}

// Export singleton instance
export const contextInjector = ContextInjector.getInstance();