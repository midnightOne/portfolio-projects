/**
 * Context Provider System
 * Secure context injection and management for AI agents
 * Integrates with reflink access control and caching systems
 */

import { contextManager, ContextSource, RelevantContent } from './context-manager';
import { reflinkManager } from './reflink-manager';
import { ReflinkInfo, BudgetStatus } from '@/lib/types/rate-limiting';

export interface ContextProviderConfig {
  maxTokens: number;
  includeProjects: boolean;
  includeAbout: boolean;
  includeResume: boolean;
  prioritizeRecent: boolean;
  minRelevanceScore: number;
  enableHiddenContext: boolean;
  contextDepth: 'minimal' | 'standard' | 'comprehensive';
}

export interface FilteredContext {
  systemPrompt: string;
  initialContext: string;
  hiddenContext: string;
  publicContext: string;
  contextSources: ContextSource[];
  relevantContent: RelevantContent[];
  accessLevel: AccessLevel;
  tokenCount: number;
  cacheKey: string;
}

export interface ContextFilter {
  reflinkId?: string;
  accessLevel: AccessLevel;
  enableVoiceAI: boolean;
  enableJobAnalysis: boolean;
  enableAdvancedNavigation: boolean;
  customContext?: string;
  recipientName?: string;
}

export type AccessLevel = 'no_access' | 'basic' | 'limited' | 'premium';

export interface ContextInjectionRequest {
  sessionId: string;
  query?: string;
  reflinkCode?: string;
  accessLevel?: AccessLevel;
  provider?: 'openai' | 'elevenlabs' | 'text';
  contextConfig?: Partial<ContextProviderConfig>;
}

export interface ContextInjectionResult {
  success: boolean;
  context: FilteredContext;
  ephemeralToken?: string;
  error?: string;
}

/**
 * Main Context Provider service class
 */
export class ContextProvider {
  private static instance: ContextProvider;
  private contextCache = new Map<string, { context: FilteredContext; expiresAt: Date }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  
  // Default configuration
  private readonly DEFAULT_CONFIG: ContextProviderConfig = {
    maxTokens: 4000,
    includeProjects: true,
    includeAbout: true,
    includeResume: true,
    prioritizeRecent: true,
    minRelevanceScore: 0.1,
    enableHiddenContext: true,
    contextDepth: 'standard'
  };

  static getInstance(): ContextProvider {
    if (!ContextProvider.instance) {
      ContextProvider.instance = new ContextProvider();
    }
    return ContextProvider.instance;
  }

  /**
   * Inject context with access control and filtering
   */
  async injectContext(request: ContextInjectionRequest): Promise<ContextInjectionResult> {
    try {
      // Determine access level and permissions
      const contextFilter = await this.determineContextFilter(request);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(request, contextFilter);
      const cached = this.getCachedContext(cacheKey);
      
      if (cached) {
        return {
          success: true,
          context: cached,
        };
      }

      // Build filtered context
      const context = await this.buildFilteredContext(request, contextFilter);
      
      // Cache the result
      this.setCachedContext(cacheKey, context);

      // Generate ephemeral token if needed for voice providers
      let ephemeralToken: string | undefined;
      if (request.provider && request.provider !== 'text' && contextFilter.enableVoiceAI) {
        ephemeralToken = await this.generateEphemeralToken(request.provider, context, contextFilter);
      }

      return {
        success: true,
        context,
        ephemeralToken,
      };

    } catch (error) {
      console.error('Context injection failed:', error);
      return {
        success: false,
        context: this.getEmptyContext(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load context on-demand with access control
   */
  async loadContextOnDemand(
    sessionId: string,
    query: string,
    reflinkCode?: string,
    options?: Partial<ContextProviderConfig>
  ): Promise<FilteredContext> {
    try {
      const request: ContextInjectionRequest = {
        sessionId,
        query,
        reflinkCode,
        contextConfig: options,
      };

      const result = await this.injectContext(request);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load context');
      }

      return result.context;

    } catch (error) {
      console.error('On-demand context loading failed:', error);
      // Return a basic context instead of throwing
      return this.getEmptyContext();
    }
  }

  /**
   * Determine context filter based on reflink and access level
   */
  private async determineContextFilter(request: ContextInjectionRequest): Promise<ContextFilter> {
    let contextFilter: ContextFilter = {
      accessLevel: request.accessLevel || 'basic',
      enableVoiceAI: false,
      enableJobAnalysis: false,
      enableAdvancedNavigation: false,
    };

    // If reflink code is provided, validate and get permissions
    if (request.reflinkCode) {
      const validation = await reflinkManager.validateReflinkWithBudget(request.reflinkCode);
      
      if (validation.valid && validation.reflink) {
        const reflink = validation.reflink;
        
        contextFilter = {
          reflinkId: reflink.id,
          accessLevel: 'premium',
          enableVoiceAI: reflink.enableVoiceAI,
          enableJobAnalysis: reflink.enableJobAnalysis,
          enableAdvancedNavigation: reflink.enableAdvancedNavigation,
          customContext: reflink.customContext,
          recipientName: reflink.recipientName,
        };
      }
    }

    return contextFilter;
  }

  /**
   * Build filtered context based on access level and permissions
   */
  private async buildFilteredContext(
    request: ContextInjectionRequest,
    filter: ContextFilter
  ): Promise<FilteredContext> {
    const config = { ...this.DEFAULT_CONFIG, ...request.contextConfig };
    
    // Adjust config based on access level
    const adjustedConfig = this.adjustConfigForAccessLevel(config, filter.accessLevel);

    // Build base context using context manager
    const sources: ContextSource[] = [];
    const query = request.query || 'general information';
    
    const baseContext = await contextManager.buildContext(sources, query, {
      maxTokens: adjustedConfig.maxTokens,
      includeProjects: adjustedConfig.includeProjects,
      includeAbout: adjustedConfig.includeAbout,
      includeResume: adjustedConfig.includeResume,
      prioritizeRecent: adjustedConfig.prioritizeRecent,
      minRelevanceScore: adjustedConfig.minRelevanceScore,
    });

    const relevantContent = await contextManager.searchRelevantContent(query, {
      includeProjects: adjustedConfig.includeProjects,
      includeAbout: adjustedConfig.includeAbout,
      includeResume: adjustedConfig.includeResume,
      minRelevanceScore: adjustedConfig.minRelevanceScore,
    });

    // Generate system prompt based on access level and permissions
    const systemPrompt = this.generateSystemPrompt(filter, adjustedConfig);
    
    // Generate initial context (publicly visible)
    const initialContext = this.generateInitialContext(baseContext, filter);
    
    // Generate hidden context (server-side only)
    const hiddenContext = this.generateHiddenContext(filter, adjustedConfig);
    
    // Generate public context (safe for client)
    const publicContext = this.generatePublicContext(baseContext, filter);

    const cacheKey = this.generateCacheKey(request, filter);

    const totalContent = systemPrompt + initialContext + hiddenContext;
    const tokenCount = Math.ceil(totalContent.length / 4); // Rough token estimation

    return {
      systemPrompt,
      initialContext,
      hiddenContext,
      publicContext,
      contextSources: sources,
      relevantContent,
      accessLevel: filter.accessLevel,
      tokenCount,
      cacheKey,
    };
  }

  /**
   * Adjust configuration based on access level
   */
  private adjustConfigForAccessLevel(
    config: ContextProviderConfig,
    accessLevel: AccessLevel
  ): ContextProviderConfig {
    switch (accessLevel) {
      case 'no_access':
        return {
          ...config,
          maxTokens: 0,
          includeProjects: false,
          includeAbout: false,
          includeResume: false,
          enableHiddenContext: false,
          contextDepth: 'minimal',
        };
      
      case 'basic':
        return {
          ...config,
          maxTokens: Math.min(config.maxTokens, 2000),
          enableHiddenContext: false,
          contextDepth: 'minimal',
        };
      
      case 'limited':
        return {
          ...config,
          maxTokens: Math.min(config.maxTokens, 3000),
          enableHiddenContext: false,
          contextDepth: 'standard',
        };
      
      case 'premium':
        return config; // Full access
      
      default:
        return config;
    }
  }

  /**
   * Generate system prompt based on access level and permissions
   */
  private generateSystemPrompt(filter: ContextFilter, config: ContextProviderConfig): string {
    const basePrompt = `You are an AI assistant for a portfolio website. You help visitors learn about the portfolio owner's background, projects, and expertise.

IMPORTANT GUIDELINES:
- You are the portfolio owner's assistant, not the owner themselves
- Speak about the portfolio owner in third person
- Only provide information based on the available portfolio content
- If you don't know something, clearly state that limitation
- Maintain a professional, helpful tone`;

    let accessPrompt = '';
    
    switch (filter.accessLevel) {
      case 'basic':
        accessPrompt = `
ACCESS LEVEL: Basic
- Provide general information about projects and background
- Keep responses concise and focused
- No advanced analysis or detailed technical discussions`;
        break;
      
      case 'limited':
        accessPrompt = `
ACCESS LEVEL: Limited
- Provide detailed information about projects and background
- Can discuss technical aspects in moderate detail
- Limited advanced features`;
        break;
      
      case 'premium':
        accessPrompt = `
ACCESS LEVEL: Premium
- Full access to all portfolio information
- Can provide detailed technical analysis
- Advanced navigation and interaction capabilities enabled`;
        
        if (filter.recipientName) {
          accessPrompt += `
- This session is personalized for ${filter.recipientName}`;
        }
        
        if (filter.customContext) {
          accessPrompt += `
- Additional context: ${filter.customContext}`;
        }
        break;
    }

    let capabilityPrompt = '';
    
    if (filter.enableVoiceAI) {
      capabilityPrompt += `
- Voice interaction capabilities enabled`;
    }
    
    if (filter.enableJobAnalysis) {
      capabilityPrompt += `
- Job specification analysis capabilities enabled`;
    }
    
    if (filter.enableAdvancedNavigation) {
      capabilityPrompt += `
- Advanced portfolio navigation capabilities enabled`;
    }

    return [basePrompt, accessPrompt, capabilityPrompt].filter(Boolean).join('\n');
  }

  /**
   * Generate initial context for AI
   */
  private generateInitialContext(baseContext: string, filter: ContextFilter): string {
    let context = baseContext;
    
    // Add access level specific context
    if (filter.accessLevel === 'premium' && filter.recipientName) {
      context = `This conversation is with ${filter.recipientName}.\n\n${context}`;
    }
    
    return context;
  }

  /**
   * Generate hidden context (server-side only)
   */
  private generateHiddenContext(filter: ContextFilter, config: ContextProviderConfig): string {
    if (!config.enableHiddenContext || filter.accessLevel === 'basic') {
      return '';
    }

    let hiddenContext = `HIDDEN CONTEXT (not visible to user):
- Access Level: ${filter.accessLevel}
- Voice AI: ${filter.enableVoiceAI ? 'enabled' : 'disabled'}
- Job Analysis: ${filter.enableJobAnalysis ? 'enabled' : 'disabled'}
- Advanced Navigation: ${filter.enableAdvancedNavigation ? 'enabled' : 'disabled'}`;

    if (filter.reflinkId) {
      hiddenContext += `
- Reflink ID: ${filter.reflinkId}`;
    }

    if (filter.customContext) {
      hiddenContext += `
- Custom Context: ${filter.customContext}`;
    }

    return hiddenContext;
  }

  /**
   * Generate public context (safe for client)
   */
  private generatePublicContext(baseContext: string, filter: ContextFilter): string {
    // Return a filtered version of context that's safe to send to client
    let publicContext = baseContext;
    
    // Add welcome message for premium users
    if (filter.accessLevel === 'premium' && filter.recipientName) {
      publicContext = `Welcome ${filter.recipientName}! You have access to enhanced AI features.\n\n${publicContext}`;
    }
    
    return publicContext;
  }

  /**
   * Generate ephemeral token for voice providers
   */
  private async generateEphemeralToken(
    provider: 'openai' | 'elevenlabs',
    context: FilteredContext,
    filter: ContextFilter
  ): Promise<string> {
    // This would integrate with the actual voice provider APIs
    // For now, return a placeholder token
    const tokenData = {
      provider,
      systemPrompt: context.systemPrompt,
      initialContext: context.initialContext,
      hiddenContext: context.hiddenContext,
      accessLevel: filter.accessLevel,
      capabilities: {
        voiceAI: filter.enableVoiceAI,
        jobAnalysis: filter.enableJobAnalysis,
        advancedNavigation: filter.enableAdvancedNavigation,
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };

    // In a real implementation, this would call the provider's API to create a session
    // with the injected context and return the ephemeral token
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  /**
   * Generate cache key for context
   */
  private generateCacheKey(request: ContextInjectionRequest, filter: ContextFilter): string {
    const keyParts = [
      request.sessionId,
      request.query || 'default',
      filter.accessLevel,
      filter.reflinkId || 'no-reflink',
      JSON.stringify(request.contextConfig || {}),
    ];
    
    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  /**
   * Get cached context
   */
  private getCachedContext(cacheKey: string): FilteredContext | null {
    const cached = this.contextCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cached.expiresAt.getTime()) {
      this.contextCache.delete(cacheKey);
      return null;
    }

    return cached.context;
  }

  /**
   * Set cached context
   */
  private setCachedContext(cacheKey: string, context: FilteredContext): void {
    const expiresAt = new Date(Date.now() + this.CACHE_TTL);
    this.contextCache.set(cacheKey, { context, expiresAt });
    
    // Clean up expired entries periodically
    this.cleanupExpiredCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.contextCache.entries()) {
      if (now > cached.expiresAt.getTime()) {
        this.contextCache.delete(key);
      }
    }
  }

  /**
   * Get empty context for error cases
   */
  private getEmptyContext(): FilteredContext {
    return {
      systemPrompt: 'You are an AI assistant. Please provide helpful responses.',
      initialContext: 'No context available.',
      hiddenContext: '',
      publicContext: 'Welcome! I can help answer questions about the portfolio.',
      contextSources: [],
      relevantContent: [],
      accessLevel: 'basic',
      tokenCount: 50,
      cacheKey: 'empty-context',
    };
  }

  /**
   * Clear cache for a specific session
   */
  clearSessionCache(sessionId: string): void {
    for (const [key, cached] of this.contextCache.entries()) {
      if (key.includes(sessionId)) {
        this.contextCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.contextCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; totalTokens: number } {
    let totalTokens = 0;
    
    for (const cached of this.contextCache.values()) {
      totalTokens += cached.context.tokenCount;
    }

    return {
      size: this.contextCache.size,
      keys: Array.from(this.contextCache.keys()),
      totalTokens,
    };
  }
}

// Export singleton instance
export const contextProvider = ContextProvider.getInstance();