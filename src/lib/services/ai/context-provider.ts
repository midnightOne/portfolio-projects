/**
 * Context Provider System
 * Secure context injection and management for AI agents
 * Integrates with reflink access control and caching systems
 *
 * Phase 3 Wave 3: the Gen-1 context-manager was deleted — base context now comes
 * from contentSourceManager (search) directly; the thin context-injector wrapper
 * was folded in below (token generation, system-prompt injection, reflink
 * validation, ElevenLabs prompt assembly).
 */

import { contentSourceManager, ContextSource, RelevantContent } from './content-source-manager';
import { reflinkManager } from './reflink-manager';

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

    // Build base context from the content-source system (Gen-1 context-manager removed)
    const sources: ContextSource[] = [];
    const query = request.query || 'general information';

    await contentSourceManager.autoDiscoverSources();
    const relevantContent = await contentSourceManager.searchContent(query, {
      maxResults: 50,
      minRelevanceScore: adjustedConfig.minRelevanceScore,
      sortBy: 'relevance',
    });

    const baseContext = this.buildContextString(relevantContent, adjustedConfig.maxTokens);

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

  /**
   * Build a bounded context string from search results
   * (ported from the deleted Gen-1 context-manager)
   */
  private buildContextString(content: RelevantContent[], maxTokens: number): string {
    const contextParts: string[] = ['=== PORTFOLIO CONTEXT ===\n'];
    let currentTokens = this.estimateTokens(contextParts[0]);

    for (const item of content) {
      const sectionParts = [
        `## ${item.title} (${item.type.toUpperCase()})`,
        '',
      ];
      if (item.summary && item.summary !== item.content) {
        sectionParts.push(`Summary: ${item.summary}`, '');
      }
      sectionParts.push(`Content: ${item.content}`);
      if (item.keywords.length > 0) {
        sectionParts.push(`Keywords: ${item.keywords.join(', ')}`);
      }
      sectionParts.push('---', '');
      const section = sectionParts.join('\n');

      const sectionTokens = this.estimateTokens(section);
      if (currentTokens + sectionTokens > maxTokens) {
        break;
      }
      contextParts.push(section);
      currentTokens += sectionTokens;
    }

    return contextParts.join('\n');
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // ---------------------------------------------------------------------------
  // Folded context-injector surface (Phase 3 task 2.2) — the thin wrapper that
  // token/session routes consume: reflink validation, ephemeral session tokens,
  // and provider prompt assembly.
  // ---------------------------------------------------------------------------

  /**
   * Generate ephemeral token with injected context for voice providers
   */
  async generateSessionToken(request: TokenGenerationRequest): Promise<TokenGenerationResult> {
    try {
      const result = await this.injectContext({
        sessionId: request.sessionId,
        query: request.query,
        reflinkCode: request.reflinkCode,
        provider: request.provider,
        contextConfig: request.contextConfig,
      });

      if (!result.success) {
        return { success: false, error: result.error || 'Context injection failed' };
      }

      const welcomeMessage = await this.generateWelcomeMessage(request.reflinkCode);

      let budgetStatus;
      if (request.reflinkCode) {
        const validation = await reflinkManager.validateReflinkWithBudget(request.reflinkCode);
        budgetStatus = validation.budgetStatus;
      }

      return {
        success: true,
        ephemeralToken: result.ephemeralToken,
        publicContext: result.context.publicContext,
        welcomeMessage,
        accessLevel: result.context.accessLevel,
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
   * Validate and filter context based on reflink permissions
   */
  async validateAndFilterContext(
    sessionId: string,
    reflinkCode?: string
  ): Promise<{
    valid: boolean;
    accessLevel: string;
    capabilities: { voiceAI: boolean; jobAnalysis: boolean; advancedNavigation: boolean };
    welcomeMessage?: string;
    error?: string;
  }> {
    const noCapabilities = { voiceAI: false, jobAnalysis: false, advancedNavigation: false };
    try {
      if (!reflinkCode) {
        return { valid: true, accessLevel: 'basic', capabilities: noCapabilities };
      }

      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);

      if (!validation.valid) {
        return {
          valid: false,
          accessLevel: 'no_access',
          capabilities: noCapabilities,
          error: this.getValidationErrorMessage(validation.reason),
        };
      }

      const reflink = validation.reflink!;
      return {
        valid: true,
        accessLevel: 'premium',
        capabilities: {
          voiceAI: reflink.enableVoiceAI,
          jobAnalysis: reflink.enableJobAnalysis,
          advancedNavigation: reflink.enableAdvancedNavigation,
        },
        welcomeMessage: validation.welcomeMessage,
      };
    } catch (error) {
      console.error('Context validation failed:', error);
      return {
        valid: false,
        accessLevel: 'no_access',
        capabilities: noCapabilities,
        error: 'Validation failed',
      };
    }
  }

  /**
   * Generate ElevenLabs prompt with dynamic context injection
   */
  async generateElevenLabsPrompt(
    sessionId: string,
    reflinkCode?: string,
    query?: string
  ): Promise<{
    agent_prompt: string;
    first_message: string;
    language: string;
    capabilities: { voiceAI: boolean; jobAnalysis: boolean; advancedNavigation: boolean };
    welcomeMessage?: string;
  }> {
    try {
      const result = await this.injectContext({
        sessionId,
        query: query || 'Initial conversation setup',
        reflinkCode,
        provider: 'elevenlabs',
      });

      if (!result.success) {
        throw new Error(result.error || 'Context injection failed');
      }

      const context = result.context;
      const capabilities = await this.determineCapabilities(reflinkCode);
      const welcomeMessage = await this.generateWelcomeMessage(reflinkCode);

      const agent_prompt = `You are a helpful AI assistant for a portfolio website.
You can help visitors learn about the portfolio owner's background, projects, and experience.
You have access to navigation tools to show relevant content and guide users through the portfolio.

${context.systemPrompt}

${context.hiddenContext ? `\nAdditional Context:\n${context.hiddenContext}` : ''}

Key capabilities:
- Answer questions about projects and experience using server tools (loadProjectContext, searchProjects)
- Navigate users to relevant portfolio sections using declarative navigation tools
- Highlight important content and provide visual guidance
- Provide technical explanations with contextual demonstrations
${capabilities.jobAnalysis ? '- Analyze job requirements against the portfolio owner\'s background' : ''}
${capabilities.advancedNavigation ? '- Provide advanced navigation and content discovery' : ''}

Navigation Tools Usage:
- Use ui_describe to understand current UI state and available navigation options
- Use ui_intent for goal-based navigation (e.g., show specific projects, scroll to sections)
- Use highlightText and scrollIntoView for visual emphasis and guidance

Always be helpful, professional, and accurate. If you don't know something, say so rather than guessing.

When guiding users through content:
1. First use ui_describe to understand the current state
2. Use ui_intent for complex navigation goals (opening projects, navigating to sections)
3. Use highlighting tools to draw attention to relevant content
4. Provide context and explanations while navigating

${context.initialContext ? `\nCurrent Context:\n${context.initialContext}` : ''}`;

      const first_message = welcomeMessage ||
        "Hello! I'm here to help you learn about this portfolio. I can answer questions about projects, experience, and background. I can also guide you through relevant sections using interactive navigation. What would you like to know?";

      return { agent_prompt, first_message, language: 'en', capabilities, welcomeMessage };
    } catch (error) {
      console.error('ElevenLabs prompt generation failed:', error);
      return {
        agent_prompt: `You are a helpful AI assistant for a portfolio website.
You can help visitors learn about the portfolio owner's background, projects, and experience.
Always be helpful, professional, and accurate. If you don't know something, say so rather than guessing.`,
        first_message: "Hello! I'm here to help you learn about this portfolio. What would you like to know?",
        language: 'en',
        capabilities: { voiceAI: false, jobAnalysis: false, advancedNavigation: false },
      };
    }
  }

  private async generateWelcomeMessage(reflinkCode?: string): Promise<string> {
    const fallback = 'Welcome! You can ask me questions about the portfolio owner\'s background and projects.';
    if (!reflinkCode) return fallback;

    try {
      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);
      if (validation.valid && validation.welcomeMessage) {
        return validation.welcomeMessage;
      }
      return 'Welcome! You have access to enhanced AI features.';
    } catch (error) {
      console.error('Welcome message generation failed:', error);
      return fallback;
    }
  }

  private async determineCapabilities(reflinkCode?: string): Promise<{
    voiceAI: boolean;
    jobAnalysis: boolean;
    advancedNavigation: boolean;
  }> {
    const none = { voiceAI: false, jobAnalysis: false, advancedNavigation: false };
    if (!reflinkCode) return none;

    try {
      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);
      if (validation.valid && validation.reflink) {
        return {
          voiceAI: validation.reflink.enableVoiceAI,
          jobAnalysis: validation.reflink.enableJobAnalysis,
          advancedNavigation: validation.reflink.enableAdvancedNavigation,
        };
      }
      return none;
    } catch (error) {
      console.error('Capability determination failed:', error);
      return none;
    }
  }

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
}

// Folded context-injector request/result types (Phase 3 task 2.2)
export interface TokenGenerationRequest {
  sessionId: string;
  provider: 'openai' | 'elevenlabs';
  reflinkCode?: string;
  query?: string;
  contextConfig?: Partial<ContextProviderConfig>;
}

export interface TokenGenerationResult {
  success: boolean;
  ephemeralToken?: string;
  publicContext?: string;
  welcomeMessage?: string;
  accessLevel?: string;
  budgetStatus?: unknown;
  error?: string;
}

// Export singleton instance
export const contextProvider = ContextProvider.getInstance();