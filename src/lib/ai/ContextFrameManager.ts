/**
 * Context Frame Manager - F-I-D Pattern Implementation
 * 
 * Implements the Frame/Index/Details (F-I-D) pattern for efficient context management
 * with controlled token usage and UIManager integration.
 * 
 * Pattern Overview:
 * - Frame (≤400 tokens): System rules, voice settings, routing primer - always loaded
 * - Index (≤400-600 tokens): Route-aware metadata and project summaries - swappable
 * - Details (≤1000 tokens): On-demand content via content.search/content.get
 * 
 * Features:
 * - Context budget management with automatic tier escalation
 * - Route-based context swapping for optimal relevance
 * - UIManager integration for enhanced navigation planning
 * - Graceful degradation when context limits are exceeded
 * - Raw SQL queries for pgvector integration
 */

import { debugEventEmitter } from '../debug/debugEventEmitter';
import { ContentSearchService } from '../content/ContentSearchService';
import { NavigationContext } from '../navigation/UIManager';
import { OPENAI_REALTIME_MODEL } from '@/types/voice-config';

// Environment detection
const isServer = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

// Conditional Prisma import for server-side only
let prisma: any = null;
if (isServer) {
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  } catch (error) {
    console.warn('Prisma not available in this environment');
  }
}

// F-I-D Context Interfaces
export interface FrameContext {
  systemRules: string;
  voiceSettings: VoiceSettings;
  routingPrimer: string;
  tokenCount: number;
}

export interface IndexContext {
  route: string;
  projectSummaries: ProjectSummary[];
  routeMetadata: RouteMetadata;
  availableTransitions: string[];
  tokenCount: number;
}

export interface DetailsContext {
  contentChunks: ContentChunk[];
  searchResults: SearchResult[];
  tokenCount: number;
  truncated: boolean;
}

export interface VoiceSettings {
  provider: 'openai' | 'elevenlabs';
  model: string;
  voice: string;
  temperature: number;
  maxTokens: number;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  technologies: string[];
  tier1Summary: string; // T1 content
  importance: number;
}

export interface RouteMetadata {
  route: string;
  title: string;
  description: string;
  availableSections: string[];
  contextualHints: string[];
}

export interface ContentChunk {
  id: string;
  entityId: string;
  entityType: string;
  tier: number;
  title: string | null;
  content: string;
  tokenCount: number;
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  navTarget: any;
}

// F-I-D Context Budget Configuration
export interface ContextBudget {
  frameMaxTokens: number;    // ≤400 tokens
  indexMaxTokens: number;    // ≤400-600 tokens  
  detailsMaxTokens: number;  // ≤1000 tokens
  totalMaxTokens: number;    // Total budget limit
}

// Enhanced Navigation Context with F-I-D integration
export interface FIDNavigationContext extends NavigationContext {
  fidContext?: {
    focus: string[];          // Currently focused content
    interest: string[];       // User's demonstrated interests  
    domain: string[];         // Current domain/project context
  };
}

// Context swapping configuration
export interface ContextSwapConfig {
  route: string;
  modalState?: string;
  projectId?: string;
  userIntent?: string;
  lastActions?: string[];
}

export class ContextFrameManager {
  private static instance: ContextFrameManager;

  // Only assigned on the server (see constructor) — callers behind isServer
  private contentSearchService!: ContentSearchService;
  private currentFrameContext: FrameContext | null = null;
  private currentIndexContext: IndexContext | null = null;
  private currentDetailsContext: DetailsContext | null = null;

  // Context budget configuration
  private contextBudget: ContextBudget = {
    frameMaxTokens: 400,
    indexMaxTokens: 600,
    detailsMaxTokens: 1000,
    totalMaxTokens: 2000
  };

  // Context cache for performance
  private frameCache: Map<string, FrameContext> = new Map();
  private indexCache: Map<string, IndexContext> = new Map();
  private detailsCache: Map<string, DetailsContext> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Token estimation (rough approximation)
  private readonly TOKENS_PER_CHAR = 0.25;

  private constructor() {
    // Only initialize ContentSearchService on server side
    if (isServer) {
      this.contentSearchService = new ContentSearchService();
    }
    this.initializeFrameContext();
  }

  static getInstance(): ContextFrameManager {
    if (!ContextFrameManager.instance) {
      ContextFrameManager.instance = new ContextFrameManager();
    }
    return ContextFrameManager.instance;
  }

  /**
   * Get complete F-I-D context for AI agents
   */
  async getCompleteContext(config: ContextSwapConfig): Promise<{
    frame: FrameContext;
    index: IndexContext;
    details: DetailsContext;
    totalTokens: number;
    budgetExceeded: boolean;
  }> {
    const startTime = Date.now();

    try {
      // If in browser environment, fetch from API
      if (isBrowser) {
        return await this.fetchContextFromAPI(config, 'complete');
      }

      // Server-side processing
      // Load Frame context (always loaded, cached)
      const frame = await this.getFrameContext();

      // Load Index context (route-aware, swappable)
      const index = await this.getIndexContext(config);

      // Load Details context (on-demand, budget-controlled)
      const details = await this.getDetailsContext(config, {
        remainingBudget: this.contextBudget.totalMaxTokens - frame.tokenCount - index.tokenCount
      });

      const totalTokens = frame.tokenCount + index.tokenCount + details.tokenCount;
      const budgetExceeded = totalTokens > this.contextBudget.totalMaxTokens;

      debugEventEmitter.emit('fid-context-loaded', {
        route: config.route,
        projectId: config.projectId,
        frameTokens: frame.tokenCount,
        indexTokens: index.tokenCount,
        detailsTokens: details.tokenCount,
        totalTokens,
        budgetExceeded,
        loadTime: Date.now() - startTime,
        timestamp: Date.now()
      });

      return {
        frame,
        index,
        details,
        totalTokens,
        budgetExceeded
      };

    } catch (error) {
      const errorMsg = `F-I-D context loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

      debugEventEmitter.emit('fid-context-error', {
        config,
        error: errorMsg,
        timestamp: Date.now()
      });

      // Return minimal context on error
      return {
        frame: await this.getMinimalFrameContext(),
        index: await this.getMinimalIndexContext(config.route),
        details: { contentChunks: [], searchResults: [], tokenCount: 0, truncated: false },
        totalTokens: 0,
        budgetExceeded: false
      };
    }
  }

  /**
   * Get Frame context (≤400 tokens) - System rules, voice settings, routing primer
   */
  async getFrameContext(): Promise<FrameContext> {
    // If in browser environment, fetch from API
    if (isBrowser) {
      const result = await this.fetchContextFromAPI({}, 'frame');
      return result.frame;
    }

    const cacheKey = 'frame-context';
    const cached = this.frameCache.get(cacheKey);

    if (cached && this.isCacheValid(cached as any)) {
      return cached;
    }

    try {
      // Load system configuration
      const systemRules = await this.loadSystemRules();
      const voiceSettings = await this.loadVoiceSettings();
      const routingPrimer = await this.loadRoutingPrimer();

      const frameContext: FrameContext = {
        systemRules,
        voiceSettings,
        routingPrimer,
        tokenCount: this.estimateTokenCount(systemRules + routingPrimer + JSON.stringify(voiceSettings))
      };

      // Ensure frame context stays within budget
      if (frameContext.tokenCount > this.contextBudget.frameMaxTokens) {
        frameContext.systemRules = this.truncateContent(frameContext.systemRules, 200);
        frameContext.routingPrimer = this.truncateContent(frameContext.routingPrimer, 150);
        frameContext.tokenCount = this.contextBudget.frameMaxTokens;
      }

      // Cache the result
      this.frameCache.set(cacheKey, frameContext);

      debugEventEmitter.emit('frame-context-loaded', {
        tokenCount: frameContext.tokenCount,
        cached: false,
        timestamp: Date.now()
      });

      return frameContext;

    } catch (error) {
      console.error('Failed to load frame context:', error);
      return this.getMinimalFrameContext();
    }
  }

  /**
   * Get Index context (≤400-600 tokens) - Route-aware metadata and project summaries
   */
  async getIndexContext(config: ContextSwapConfig): Promise<IndexContext> {
    // If in browser environment, fetch from API
    if (isBrowser) {
      const result = await this.fetchContextFromAPI(config, 'index');
      return result.index;
    }

    const cacheKey = `index-${config.route}-${config.projectId || 'none'}`;
    const cached = this.indexCache.get(cacheKey);

    if (cached && this.isCacheValid(cached as any)) {
      return cached;
    }

    try {
      // Load route-specific metadata
      const routeMetadata = await this.loadRouteMetadata(config.route);

      // Load relevant project summaries based on route and context
      const projectSummaries = await this.loadProjectSummaries(config);

      // Get available transitions for current context
      const availableTransitions = await this.getAvailableTransitions(config);

      const indexContext: IndexContext = {
        route: config.route,
        projectSummaries,
        routeMetadata,
        availableTransitions,
        tokenCount: this.estimateTokenCount(
          JSON.stringify(routeMetadata) +
          JSON.stringify(projectSummaries) +
          JSON.stringify(availableTransitions)
        )
      };

      // Apply budget management with tier escalation
      if (indexContext.tokenCount > this.contextBudget.indexMaxTokens) {
        indexContext.projectSummaries = await this.applyTierEscalation(
          indexContext.projectSummaries,
          this.contextBudget.indexMaxTokens - 200 // Reserve 200 tokens for metadata
        );
        indexContext.tokenCount = this.contextBudget.indexMaxTokens;
      }

      // Cache the result
      this.indexCache.set(cacheKey, indexContext);

      debugEventEmitter.emit('index-context-loaded', {
        route: config.route,
        projectId: config.projectId,
        projectCount: projectSummaries.length,
        tokenCount: indexContext.tokenCount,
        cached: false,
        timestamp: Date.now()
      });

      return indexContext;

    } catch (error) {
      console.error('Failed to load index context:', error);
      return this.getMinimalIndexContext(config.route);
    }
  }

  /**
   * Get Details context (≤1000 tokens) - On-demand content via content.search/content.get
   */
  async getDetailsContext(
    config: ContextSwapConfig,
    options: { remainingBudget: number }
  ): Promise<DetailsContext> {
    const maxTokens = Math.min(this.contextBudget.detailsMaxTokens, options.remainingBudget);

    if (maxTokens <= 0) {
      return { contentChunks: [], searchResults: [], tokenCount: 0, truncated: true };
    }

    const cacheKey = `details-${config.route}-${config.projectId || 'none'}-${config.userIntent || 'none'}`;
    const cached = this.detailsCache.get(cacheKey);

    if (cached && this.isCacheValid(cached as any) && cached.tokenCount <= maxTokens) {
      return cached;
    }

    try {
      let contentChunks: ContentChunk[] = [];
      let searchResults: SearchResult[] = [];
      let totalTokens = 0;
      let truncated = false;

      // If user intent is provided, search for relevant content (server-side only)
      if (config.userIntent && isServer && this.contentSearchService) {
        const searchResult = await this.contentSearchService.searchContent({
          query: config.userIntent,
          scope: {
            projectId: config.projectId
          },
          k: 5,
          maxTier: 3
        });

        searchResults = searchResult.items.map(item => ({
          id: item.id,
          title: item.title,
          snippet: item.oneLiner,
          relevanceScore: item.score,
          navTarget: item.navTarget
        }));

        // Get detailed content for top results within budget
        const topResultIds = searchResult.items.slice(0, 3).map(item => item.id);
        if (topResultIds.length > 0) {
          const contentResult = await this.contentSearchService.getContent({
            ids: topResultIds,
            maxTokens: Math.floor(maxTokens * 0.7), // Reserve 30% for search results
            includeTiers: [1, 2, 3]
          });

          contentChunks = contentResult.items.map(item => ({
            id: item.id,
            entityId: '', // Will be populated from database
            entityType: '',
            tier: item.tier,
            title: item.title ?? null,
            content: item.content,
            tokenCount: item.tokenEstimate,
            metadata: item.metadata
          }));

          totalTokens += contentResult.totalTokens;
          truncated = contentResult.truncated;
        }
      }

      // If no user intent or remaining budget, load contextual content
      if (!config.userIntent || totalTokens < maxTokens * 0.5) {
        const contextualContent = await this.loadContextualContent(config, maxTokens - totalTokens);
        contentChunks.push(...contextualContent.chunks);
        totalTokens += contextualContent.tokenCount;
        truncated = truncated || contextualContent.truncated;
      }

      const detailsContext: DetailsContext = {
        contentChunks,
        searchResults,
        tokenCount: totalTokens,
        truncated
      };

      // Cache the result
      this.detailsCache.set(cacheKey, detailsContext);

      debugEventEmitter.emit('details-context-loaded', {
        route: config.route,
        projectId: config.projectId,
        userIntent: config.userIntent,
        contentChunks: contentChunks.length,
        searchResults: searchResults.length,
        tokenCount: totalTokens,
        truncated,
        cached: false,
        timestamp: Date.now()
      });

      return detailsContext;

    } catch (error) {
      console.error('Failed to load details context:', error);
      return { contentChunks: [], searchResults: [], tokenCount: 0, truncated: false };
    }
  }

  /**
   * Update F-I-D context based on navigation changes (async, non-interrupting)
   */
  async updateContextForNavigation(
    navigationContext: FIDNavigationContext,
    userIntent?: string
  ): Promise<void> {
    try {
      const config: ContextSwapConfig = {
        route: navigationContext.currentRoute,
        projectId: navigationContext.currentProject || undefined,
        userIntent,
        lastActions: navigationContext.fidContext?.focus || []
      };

      // Async context loading - don't block navigation
      setTimeout(async () => {
        try {
          // Invalidate relevant caches
          this.invalidateContextCache(config);

          // Pre-load new context
          await this.getCompleteContext(config);

          debugEventEmitter.emit('fid-context-updated', {
            route: config.route,
            projectId: config.projectId,
            userIntent,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Background context update failed:', error);
        }
      }, 100); // Small delay to not interfere with navigation

    } catch (error) {
      console.error('Failed to update F-I-D context:', error);
    }
  }

  /**
   * Get enhanced navigation context with F-I-D integration
   */
  getEnhancedNavigationContext(baseContext: NavigationContext): FIDNavigationContext {
    const enhanced: FIDNavigationContext = {
      ...baseContext,
      fidContext: {
        focus: this.extractFocusFromContext(),
        interest: this.extractInterestFromContext(),
        domain: this.extractDomainFromContext(baseContext)
      }
    };

    return enhanced;
  }

  /**
   * Configure context budget limits
   */
  configureContextBudget(budget: Partial<ContextBudget>): void {
    this.contextBudget = { ...this.contextBudget, ...budget };

    // Clear caches when budget changes
    this.clearAllCaches();

    debugEventEmitter.emit('fid-budget-configured', {
      budget: this.contextBudget,
      timestamp: Date.now()
    });
  }

  /**
   * Get context statistics for monitoring
   */
  getContextStats(): {
    frameTokens: number;
    indexTokens: number;
    detailsTokens: number;
    totalTokens: number;
    cacheStats: {
      frameCache: number;
      indexCache: number;
      detailsCache: number;
    };
    budgetUtilization: number;
  } {
    const frameTokens = this.currentFrameContext?.tokenCount || 0;
    const indexTokens = this.currentIndexContext?.tokenCount || 0;
    const detailsTokens = this.currentDetailsContext?.tokenCount || 0;
    const totalTokens = frameTokens + indexTokens + detailsTokens;

    return {
      frameTokens,
      indexTokens,
      detailsTokens,
      totalTokens,
      cacheStats: {
        frameCache: this.frameCache.size,
        indexCache: this.indexCache.size,
        detailsCache: this.detailsCache.size
      },
      budgetUtilization: totalTokens / this.contextBudget.totalMaxTokens
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Initialize frame context on startup
   */
  private async initializeFrameContext(): Promise<void> {
    try {
      this.currentFrameContext = await this.getFrameContext();
      console.log('ContextFrameManager initialized with frame context');
    } catch (error) {
      console.error('Failed to initialize frame context:', error);
    }
  }

  /**
   * Load system rules for frame context
   */
  private async loadSystemRules(): Promise<string> {
    try {
      // Only attempt database access on server side
      if (isServer && prisma) {
        const settings = await prisma.aIGeneralSettings.findFirst();

        const baseRules = `You are an AI assistant for a portfolio website. You help visitors learn about the portfolio owner's background, projects, and expertise. Always maintain a professional, helpful tone and provide accurate information based only on available content.`;

        return settings?.systemPrompt || baseRules;
      }

      // Browser fallback
      return `You are an AI assistant for a portfolio website. You help visitors learn about the portfolio owner's background, projects, and expertise. Always maintain a professional, helpful tone and provide accurate information based only on available content.`;
    } catch (error) {
      console.error('Failed to load system rules:', error);
      return `You are an AI assistant for a portfolio website. Provide helpful, accurate information about the portfolio owner's work and background.`;
    }
  }

  /**
   * Load voice settings for frame context
   */
  private async loadVoiceSettings(): Promise<VoiceSettings> {
    try {
      // Only attempt database access on server side
      if (isServer && prisma) {
        const voiceConfig = await prisma.voiceProviderConfig.findFirst({
          where: { isDefault: true }
        });

        if (voiceConfig) {
          const config = JSON.parse(voiceConfig.configJson);
          return {
            provider: voiceConfig.provider as 'openai' | 'elevenlabs',
            model: config.model || OPENAI_REALTIME_MODEL,
            voice: config.voice || 'alloy',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000
          };
        }
      }

      // Default settings for both server and browser
      return {
        provider: 'openai',
        model: OPENAI_REALTIME_MODEL,
        voice: 'alloy',
        temperature: 0.7,
        maxTokens: 4000
      };
    } catch (error) {
      console.error('Failed to load voice settings:', error);
      return {
        provider: 'openai',
        model: OPENAI_REALTIME_MODEL,
        voice: 'alloy',
        temperature: 0.7,
        maxTokens: 4000
      };
    }
  }

  /**
   * Load routing primer for frame context
   */
  private async loadRoutingPrimer(): Promise<string> {
    return `Available routes: home (/), projects (/projects), about (/about). Use navigation tools to guide users through relevant content. Always provide context about what you're showing and why it's relevant.`;
  }

  /**
   * Load route-specific metadata for index context
   */
  private async loadRouteMetadata(route: string): Promise<RouteMetadata> {
    const routeConfigs: Record<string, RouteMetadata> = {
      home: {
        route: 'home',
        title: 'Portfolio Home',
        description: 'Main portfolio landing page with overview and highlights',
        availableSections: ['hero', 'featured-projects', 'skills', 'contact'],
        contextualHints: ['Welcome visitors', 'Highlight key projects', 'Show expertise areas']
      },
      projects: {
        route: 'projects',
        title: 'Projects Gallery',
        description: 'Complete portfolio of projects and case studies',
        availableSections: ['project-grid', 'filters', 'categories'],
        contextualHints: ['Browse projects', 'Filter by technology', 'Show project details']
      },
      about: {
        route: 'about',
        title: 'About & Background',
        description: 'Professional background, experience, and personal information',
        availableSections: ['bio', 'experience', 'education', 'skills'],
        contextualHints: ['Professional background', 'Work experience', 'Technical skills']
      }
    };

    return routeConfigs[route] || {
      route,
      title: `${route.charAt(0).toUpperCase() + route.slice(1)} Page`,
      description: `Content for ${route} section`,
      availableSections: [],
      contextualHints: []
    };
  }

  /**
   * Load project summaries for index context using raw SQL for pgvector
   */
  private async loadProjectSummaries(config: ContextSwapConfig): Promise<ProjectSummary[]> {
    try {
      // Only attempt database access on server side
      if (!isServer || !prisma) {
        // Browser fallback - return mock data or empty array
        return this.getMockProjectSummaries(config);
      }

      let whereClause = '';
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by specific project if provided
      if (config.projectId) {
        whereClause = `WHERE e.slug = $${paramIndex}`;
        params.push(config.projectId);
        paramIndex++;
      }

      // Raw SQL query to get project summaries with T1 content
      const sql = `
        SELECT 
          e.id,
          e.slug,
          e.title,
          e.description,
          e.tags,
          e.technologies,
          c.content as tier1_summary,
          COALESCE((c.metadata->>'importance')::float, 0.5) as importance
        FROM content_entities e
        LEFT JOIN context_chunks c ON e.id = c.entity_id AND c.tier = 1
        ${whereClause}
        AND e."entityType" = 'PROJECT'
        ORDER BY importance DESC, e."updated_at" DESC
        LIMIT 10
      `;

      const results = await prisma.$queryRawUnsafe(sql, ...params) as any[];

      return results.map(row => ({
        id: row.id,
        slug: row.slug,
        title: row.title || 'Untitled Project',
        description: row.description || '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        technologies: Array.isArray(row.technologies) ? row.technologies : [],
        tier1Summary: row.tier1_summary || row.description || 'No summary available',
        importance: row.importance || 0.5
      }));

    } catch (error) {
      console.error('Failed to load project summaries:', error);
      return [];
    }
  }

  /**
   * Get available transitions for current context
   */
  private async getAvailableTransitions(config: ContextSwapConfig): Promise<string[]> {
    const transitions: string[] = [];

    // Add route-based transitions
    if (config.route === 'home') {
      transitions.push('navigate-to-projects', 'navigate-to-about', 'open-contact');
    } else if (config.route === 'projects') {
      transitions.push('open-project-modal', 'filter-projects', 'navigate-to-home');
    } else if (config.route === 'about') {
      transitions.push('navigate-to-projects', 'navigate-to-home', 'open-contact');
    }

    // Add project-specific transitions
    if (config.projectId) {
      transitions.push('show-technical-details', 'show-gallery', 'show-related-projects');
    }

    return transitions;
  }

  /**
   * Load contextual content for details context using raw SQL
   */
  private async loadContextualContent(
    config: ContextSwapConfig,
    maxTokens: number
  ): Promise<{ chunks: ContentChunk[]; tokenCount: number; truncated: boolean }> {
    try {
      // Only attempt database access on server side
      if (!isServer || !prisma) {
        // Browser fallback
        return { chunks: [], tokenCount: 0, truncated: false };
      }

      let whereClause = 'WHERE c.tier <= 3'; // Load T1-T3 content
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by route context
      if (config.route === 'projects' && config.projectId) {
        whereClause += ` AND e.slug = $${paramIndex} AND e."entityType" = 'PROJECT'`;
        params.push(config.projectId);
        paramIndex++;
      } else if (config.route === 'about') {
        whereClause += ` AND e."entityType" IN ('BIO', 'RESUME', 'EXPERIENCE')`;
      }

      const sql = `
        SELECT 
          c.id,
          c.entity_id as "entityId",
          c.tier,
          c.title,
          c.content,
          c.token_count as "tokenCount",
          c.metadata,
          e."entityType"
        FROM context_chunks c
        JOIN content_entities e ON c.entity_id = e.id
        ${whereClause}
        ORDER BY c.tier ASC, c.token_count ASC
        LIMIT 20
      `;

      const results = await prisma.$queryRawUnsafe(sql, ...params) as any[];

      const chunks: ContentChunk[] = [];
      let totalTokens = 0;
      let truncated = false;

      for (const row of results) {
        const tokenCount = row.tokenCount || this.estimateTokenCount(row.content);

        if (totalTokens + tokenCount > maxTokens) {
          truncated = true;
          break;
        }

        chunks.push({
          id: row.id,
          entityId: row.entityId,
          entityType: row.entityType,
          tier: row.tier,
          title: row.title,
          content: row.content,
          tokenCount,
          metadata: row.metadata || {}
        });

        totalTokens += tokenCount;
      }

      return { chunks, tokenCount: totalTokens, truncated };

    } catch (error) {
      console.error('Failed to load contextual content:', error);
      return { chunks: [], tokenCount: 0, truncated: false };
    }
  }

  /**
   * Apply tier escalation to manage token budget
   */
  private async applyTierEscalation(
    summaries: ProjectSummary[],
    maxTokens: number
  ): Promise<ProjectSummary[]> {
    const result: ProjectSummary[] = [];
    let totalTokens = 0;

    // Sort by importance and include highest priority items first
    const sortedSummaries = [...summaries].sort((a, b) => b.importance - a.importance);

    for (const summary of sortedSummaries) {
      const estimatedTokens = this.estimateTokenCount(
        summary.title + summary.description + summary.tier1Summary
      );

      if (totalTokens + estimatedTokens > maxTokens) {
        // Try with truncated content
        const truncatedSummary = {
          ...summary,
          tier1Summary: this.truncateContent(summary.tier1Summary, 50),
          description: this.truncateContent(summary.description, 30)
        };

        const truncatedTokens = this.estimateTokenCount(
          truncatedSummary.title + truncatedSummary.description + truncatedSummary.tier1Summary
        );

        if (totalTokens + truncatedTokens <= maxTokens) {
          result.push(truncatedSummary);
          totalTokens += truncatedTokens;
        } else {
          break; // Can't fit any more
        }
      } else {
        result.push(summary);
        totalTokens += estimatedTokens;
      }
    }

    return result;
  }

  /**
   * Extract focus context from current state
   */
  private extractFocusFromContext(): string[] {
    const focus: string[] = [];

    if (this.currentIndexContext) {
      focus.push(this.currentIndexContext.route);
      if (this.currentIndexContext.projectSummaries.length > 0) {
        focus.push(...this.currentIndexContext.projectSummaries.slice(0, 3).map(p => p.slug));
      }
    }

    return focus;
  }

  /**
   * Extract interest context from current state
   */
  private extractInterestFromContext(): string[] {
    const interests: string[] = [];

    if (this.currentDetailsContext) {
      // Extract technologies and tags from content
      for (const chunk of this.currentDetailsContext.contentChunks) {
        if (chunk.metadata.tags) {
          interests.push(...chunk.metadata.tags);
        }
        if (chunk.metadata.technologies) {
          interests.push(...chunk.metadata.technologies);
        }
      }
    }

    return [...new Set(interests)]; // Remove duplicates
  }

  /**
   * Extract domain context from navigation context
   */
  private extractDomainFromContext(context: NavigationContext): string[] {
    const domain: string[] = [context.currentRoute];

    if (context.currentProject) {
      domain.push(context.currentProject);
    }

    return domain;
  }

  /**
   * Get minimal frame context for error cases
   */
  private async getMinimalFrameContext(): Promise<FrameContext> {
    return {
      systemRules: 'You are an AI assistant for a portfolio website.',
      voiceSettings: {
        provider: 'openai',
        model: OPENAI_REALTIME_MODEL,
        voice: 'alloy',
        temperature: 0.7,
        maxTokens: 4000
      },
      routingPrimer: 'Available routes: home, projects, about.',
      tokenCount: 50
    };
  }

  /**
   * Get minimal index context for error cases
   */
  private async getMinimalIndexContext(route: string): Promise<IndexContext> {
    return {
      route,
      projectSummaries: [],
      routeMetadata: {
        route,
        title: route,
        description: `${route} page`,
        availableSections: [],
        contextualHints: []
      },
      availableTransitions: [],
      tokenCount: 20
    };
  }

  /**
   * Estimate token count for content
   */
  private estimateTokenCount(content: string): number {
    return Math.ceil(content.length * this.TOKENS_PER_CHAR);
  }

  /**
   * Truncate content to fit within token limit
   */
  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = Math.floor(maxTokens / this.TOKENS_PER_CHAR);
    if (content.length <= maxChars) {
      return content;
    }
    return content.substring(0, maxChars - 3) + '...';
  }

  /**
   * Check if cached context is still valid
   */
  private isCacheValid(cached: { timestamp?: number }): boolean {
    if (!cached.timestamp) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  /**
   * Invalidate context cache for specific configuration
   */
  private invalidateContextCache(config: ContextSwapConfig): void {
    const indexKey = `index-${config.route}-${config.projectId || 'none'}`;
    const detailsKey = `details-${config.route}-${config.projectId || 'none'}-${config.userIntent || 'none'}`;

    this.indexCache.delete(indexKey);
    this.detailsCache.delete(detailsKey);
  }

  /**
   * Clear all context caches
   */
  private clearAllCaches(): void {
    this.frameCache.clear();
    this.indexCache.clear();
    this.detailsCache.clear();
  }

  /**
   * Fetch F-I-D context from API (browser environment)
   */
  private async fetchContextFromAPI(
    config: Partial<ContextSwapConfig>,
    contextType: 'frame' | 'index' | 'details' | 'complete' = 'complete'
  ): Promise<any> {
    try {
      const response = await fetch('/api/ai/context/fid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: config.route || 'home',
          projectId: config.projectId,
          userIntent: config.userIntent,
          lastActions: config.lastActions || [],
          contextType
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      return result.data;

    } catch (error) {
      console.error('Failed to fetch F-I-D context from API:', error);

      // Return fallback data based on context type
      switch (contextType) {
        case 'frame':
          return {
            frame: await this.getMinimalFrameContext()
          };
        case 'index':
          return {
            index: await this.getMinimalIndexContext(config.route || 'home')
          };
        case 'details':
          return {
            details: { contentChunks: [], searchResults: [], tokenCount: 0, truncated: false }
          };
        case 'complete':
        default:
          return {
            frame: await this.getMinimalFrameContext(),
            index: await this.getMinimalIndexContext(config.route || 'home'),
            details: { contentChunks: [], searchResults: [], tokenCount: 0, truncated: false },
            totalTokens: 0,
            budgetExceeded: false
          };
      }
    }
  }

  /**
   * Get mock project summaries for browser environment
   */
  private getMockProjectSummaries(config: ContextSwapConfig): ProjectSummary[] {
    // Return basic mock data for browser environments
    const mockProjects: ProjectSummary[] = [
      {
        id: 'mock-1',
        slug: 'portfolio-website',
        title: 'Portfolio Website',
        description: 'Personal portfolio showcasing projects and skills',
        tags: ['React', 'Next.js', 'TypeScript'],
        technologies: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
        tier1Summary: 'A modern portfolio website built with Next.js and React',
        importance: 0.9
      },
      {
        id: 'mock-2',
        slug: 'task-management-app',
        title: 'Task Management App',
        description: 'Full-stack task management application',
        tags: ['React', 'Node.js', 'MongoDB'],
        technologies: ['React', 'Node.js', 'MongoDB', 'Express'],
        tier1Summary: 'A comprehensive task management solution with real-time updates',
        importance: 0.8
      }
    ];

    // Filter by project if specified
    if (config.projectId) {
      return mockProjects.filter(p => p.slug === config.projectId);
    }

    return mockProjects;
  }
}

// Export singleton instance
export const contextFrameManager = ContextFrameManager.getInstance();