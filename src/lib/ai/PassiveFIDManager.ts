/**
 * Passive F-I-D Manager - Client-Side Implementation
 * 
 * Provides client-side F-I-D (Frame/Index/Details) context management with intelligent caching.
 * This is a client-side conversion of the server-side ContextFrameManager, designed for
 * browser environments with session-based caching and server API integration.
 * 
 * Key Features:
 * - Session-based caching using Map<string, FIDContext> storage
 * - Cache-first strategy with automatic server fallback
 * - Intelligent cache key generation: ${route}-${projectId}-${intentHash}
 * - Automatic cache cleanup with 20min TTL and memory management
 * - Optional proactive content search functionality
 * - Integration with /api/ai/context/fid endpoint
 */

import { debugEventEmitter } from '../debug/debugEventEmitter';
import { UIState } from './tools/types';

// F-I-D Context Interfaces (enhanced for comprehensive passive system)
export interface FIDContext {
  frame: {
    portfolioOwner: string;
    currentCapabilities: string[];
    uiContext: string;
  };
  index: {
    route: string;
    availableProjects: ProjectSummary[]; // Homepage: top 10 projects
    currentProject?: string;
    visibleSections: string[];
    projectSemanticItems?: SemanticItem[]; // Project modal: semantic one-liners for tiered retrieval
  };
  details: {
    clientProjectSummary?: string; // Always present when viewing a project (from client data)
    projectSummary?: string; // Server project summary (legacy)
    intentBasedContent?: ContentSearchResult[]; // Intent-based content when user intent is set
    selectedText?: string;
  };
}

// Semantic items for project modal index (tiered retrieval support)
export interface SemanticItem {
  id: string;
  oneLiner: string;
  type: 'content' | 'technical' | 'media' | 'example';
  projectId: string;
  tier: number; // For tiered retrieval with content_get
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  technologies: string[];
  tier1Summary: string;
  importance: number;
}

export interface ContentSearchResult {
  id: string;
  project?: string;
  title: string;
  oneLiner: string;
  why: string;
  navTarget: any;
  score: number;
  facets: { tech: string[]; year?: number; type: string };
}

// Cache entry with TTL tracking
interface CacheEntry {
  context: FIDContext;
  timestamp: number;
  ttl: number;
}

// Server API response format
interface FIDContextAPIResponse {
  success: boolean;
  data: {
    frame?: any;
    index?: any;
    details?: any;
    totalTokens?: number;
    budgetExceeded?: boolean;
    type: string;
  };
  timestamp: number;
  error?: string;
}

export class PassiveFIDManager {
  private static instance: PassiveFIDManager;

  // Session-based caching with Map storage
  private cache: Map<string, CacheEntry> = new Map();

  // Optional user intent for proactive content search
  private userIntent: string | null = null;

  // Session-based user profile cache
  private userProfileCache: { profile: any; timestamp: number } | null = null;

  // Session-level caches (valid for entire client session)
  private homepageProjectsCache: { projects: ProjectSummary[]; timestamp: number } | null = null;
  private projectSemanticCache: Map<string, { items: SemanticItem[]; timestamp: number }> = new Map();
  
  // Intent-based content cache (specific to intent + UI state combination)
  private intentContentCache: Map<string, { content: ContentSearchResult[]; timestamp: number }> = new Map();

  // Cache configuration
  private readonly DEFAULT_TTL = 20 * 60 * 1000; // 20 minutes
  protected readonly MAX_CACHE_SIZE = 50; // Memory management limit
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Cleanup timer
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanupTimer();

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy();
      });
    }
  }

  static getInstance(): PassiveFIDManager {
    if (!PassiveFIDManager.instance) {
      PassiveFIDManager.instance = new PassiveFIDManager();
    }
    return PassiveFIDManager.instance;
  }

  /**
   * Get or fetch F-I-D context with cache-first strategy
   * Now supports client-side project data for efficient context generation
   */
  async getOrFetchContext(uiState: UIState, clientProjectData?: any): Promise<FIDContext> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(uiState);

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        debugEventEmitter.emit('fid-context-cache-hit', {
          cacheKey,
          route: uiState.currentRoute,
          projectId: uiState.currentProject,
          timestamp: Date.now()
        });

        return cached.context;
      }

      // Cache miss or expired - try client-side data first, then server
      debugEventEmitter.emit('fid-context-cache-miss', {
        cacheKey,
        route: uiState.currentRoute,
        projectId: uiState.currentProject,
        expired: cached ? !this.isCacheValid(cached) : false,
        hasClientData: !!clientProjectData,
        timestamp: Date.now()
      });

      const context = await this.generateContextWithClientData(uiState, clientProjectData);

      // Store in cache
      this.setCache(cacheKey, context);

      debugEventEmitter.emit('fid-context-loaded', {
        cacheKey,
        route: uiState.currentRoute,
        projectId: uiState.currentProject,
        userIntent: this.userIntent,
        loadTime: Date.now() - startTime,
        cached: false,
        timestamp: Date.now()
      });

      return context;

    } catch (error) {
      const errorMsg = `F-I-D context loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

      debugEventEmitter.emit('fid-context-error', {
        cacheKey,
        route: uiState.currentRoute,
        projectId: uiState.currentProject,
        error: errorMsg,
        timestamp: Date.now()
      });

      // Return minimal fallback context on error
      return await this.getMinimalFallbackContext(uiState);
    }
  }

  /**
   * Set user intent for optional proactive content search functionality
   */
  setUserIntent(intent: string): void {
    this.userIntent = intent;

    debugEventEmitter.emit('fid-user-intent-set', {
      intent,
      timestamp: Date.now()
    });

    // Optionally invalidate cache when intent changes significantly
    if (intent && intent.length > 10) {
      this.invalidateIntentBasedCache();
    }
  }

  /**
   * Get user profile with session caching
   */
  private async getUserProfile(): Promise<string> {
    // Check cache first
    if (this.userProfileCache && 
        (Date.now() - this.userProfileCache.timestamp) < this.DEFAULT_TTL) {
      return (this.userProfileCache.profile?.name || this.userProfileCache.profile?.fullName || 'Kirill Prymachov') + (', ' + this.userProfileCache.profile?.bio);
    }

    try {
      // Fetch user profile from server
      const response = await fetch(`${this.getBaseUrl()}/api/ai/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: 'loadUserProfile',
          parameters: {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Cache the profile
          this.userProfileCache = {
            profile: result.data,
            timestamp: Date.now()
          };
          
          return (result.data.name || result.data.fullName || 'Kirill Prymachov')+ (', ' + result.data.bio);
        }
      }
    } catch (error) {
      console.warn('Failed to load user profile:', error);
    }

    // Fallback to default
    return 'Kirill Prymachov';
  }

  /**
   * Get base URL for API calls
   */
  private getBaseUrl(): string {
    return typeof window !== 'undefined'
      ? '' // Browser environment - use relative URL
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Node.js environment
  }

  /**
   * Clear cache with optional project-specific targeting
   */
  clearCache(projectId?: string): void {
    if (projectId) {
      // Clear cache entries for specific project
      const keysToDelete: string[] = [];

      for (const [key] of Array.from(this.cache.entries())) {
        if (key.includes(`-${projectId}-`) || key.includes(`-${projectId}:`)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));

      // Clear project-specific semantic cache
      this.projectSemanticCache.delete(projectId);

      // Clear intent cache entries for this project
      const intentKeysToDelete: string[] = [];
      for (const [key] of Array.from(this.intentContentCache.keys())) {
        if (key.includes(`-${projectId}`)) {
          intentKeysToDelete.push(key);
        }
      }
      intentKeysToDelete.forEach(key => this.intentContentCache.delete(key));

      debugEventEmitter.emit('fid-cache-cleared', {
        type: 'project-specific',
        projectId,
        clearedCount: keysToDelete.length + 1 + intentKeysToDelete.length,
        timestamp: Date.now()
      });
    } else {
      // Clear entire cache including all session caches
      const cacheSize = this.cache.size;
      this.cache.clear();
      this.userProfileCache = null;
      this.homepageProjectsCache = null;
      this.projectSemanticCache.clear();
      this.intentContentCache.clear();

      debugEventEmitter.emit('fid-cache-cleared', {
        type: 'full',
        clearedCount: cacheSize,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get comprehensive cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number;
    memoryUsage: string;
    sessionCaches: {
      homepageProjects: boolean;
      projectSemanticItems: number;
      intentBasedContent: number;
    };
  } {
    let oldestTimestamp = Date.now();
    let totalHits = 0;
    let totalRequests = 0;

    for (const [, entry] of Array.from(this.cache.entries())) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    // Estimate memory usage (rough approximation)
    const baseMemory = this.cache.size * 2; // ~2KB per entry estimate
    const sessionMemory = (this.homepageProjectsCache ? 5 : 0) + 
                         (this.projectSemanticCache.size * 3) + 
                         (this.intentContentCache.size * 2);
    const totalMemory = baseMemory + sessionMemory;

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestEntry: oldestTimestamp,
      memoryUsage: `~${totalMemory}KB`,
      sessionCaches: {
        homepageProjects: !!this.homepageProjectsCache,
        projectSemanticItems: this.projectSemanticCache.size,
        intentBasedContent: this.intentContentCache.size
      }
    };
  }

  /**
   * Get homepage projects (cached for session)
   */
  private async getHomepageProjects(): Promise<ProjectSummary[]> {
    // Check session cache first
    if (this.homepageProjectsCache && 
        (Date.now() - this.homepageProjectsCache.timestamp) < (60 * 60 * 1000)) { // 1 hour cache
      console.log('📦 Using cached homepage projects');
      return this.homepageProjectsCache.projects;
    }

    console.log('🌐 Fetching homepage projects from server');
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'searchProjects',
          parameters: { limit: 10, sortBy: 'importance' }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.projects) {
          const projects = result.data.projects.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            description: p.description || p.briefOverview || '',
            tags: p.tags || [],
            technologies: p.technologies || [],
            tier1Summary: p.tier1Summary || p.briefOverview || p.description || '',
            importance: p.importance || 0
          }));

          // Cache for session
          this.homepageProjectsCache = {
            projects,
            timestamp: Date.now()
          };

          console.log('📦 Cached homepage projects for session:', projects.length);
          return projects;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch homepage projects:', error);
    }

    return [];
  }

  /**
   * Get project semantic items for tiered retrieval (cached per project)
   */
  private async getProjectSemanticItems(projectId: string): Promise<SemanticItem[]> {
    // Check project-specific cache
    const cached = this.projectSemanticCache.get(projectId);
    if (cached && (Date.now() - cached.timestamp) < (30 * 60 * 1000)) { // 30 min cache
      console.log('📦 Using cached semantic items for project:', projectId);
      return cached.items;
    }

    console.log('🌐 Fetching semantic items for project:', projectId);
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/ai/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'loadProjectContext',
          parameters: { projectId, includeSemanticItems: true }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.semanticItems) {
          const items: SemanticItem[] = result.data.semanticItems.map((item: any) => ({
            id: item.id,
            oneLiner: item.oneLiner || item.title || '',
            type: item.type || 'content',
            projectId,
            tier: item.tier || 1
          }));

          // Cache for project
          this.projectSemanticCache.set(projectId, {
            items,
            timestamp: Date.now()
          });

          console.log('📦 Cached semantic items for project:', projectId, items.length);
          return items;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch semantic items for project:', projectId, error);
    }

    return [];
  }

  /**
   * Get intent-based content (cached by intent + UI state)
   */
  private async getIntentBasedContent(uiState: UIState, userIntent: string): Promise<ContentSearchResult[]> {
    const cacheKey = `${userIntent}-${uiState.currentRoute}-${uiState.currentProject || 'none'}`;
    
    // Check intent-specific cache
    const cached = this.intentContentCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < (10 * 60 * 1000)) { // 10 min cache
      console.log('📦 Using cached intent-based content for:', userIntent);
      return cached.content;
    }

    console.log('🌐 Fetching intent-based content for:', userIntent);
    try {
      // Use the existing server FID endpoint for intent-based content
      const serverContext = await this.fetchFromServer(uiState);
      const content = serverContext.details.intentBasedContent || [];

      // Cache the intent-based content
      this.intentContentCache.set(cacheKey, {
        content,
        timestamp: Date.now()
      });

      console.log('📦 Cached intent-based content:', userIntent, content.length);
      return content;
    } catch (error) {
      console.warn('Failed to fetch intent-based content:', error);
      return [];
    }
  }

  /**
   * Extract client project summary (prefer longer content)
   */
  private extractClientProjectSummary(clientProjectData: any): string | undefined {
    if (!clientProjectData) return undefined;

    const briefOverview = clientProjectData.briefOverview || '';
    const description = clientProjectData.description || '';
    
    // Use whichever is longer, or fallback to title
    if (briefOverview.length > description.length && briefOverview.length > 0) {
      return briefOverview;
    } else if (description.length > 0) {
      return description;
    } else if (clientProjectData.title) {
      return `${clientProjectData.title} - A project in Kirill's portfolio`;
    }
    
    return undefined;
  }

  /**
   * Get source of client summary for logging
   */
  private getClientSummarySource(clientProjectData: any): string {
    if (!clientProjectData) return 'none';
    
    const briefOverview = clientProjectData.briefOverview || '';
    const description = clientProjectData.description || '';
    
    if (briefOverview.length > description.length && briefOverview.length > 0) {
      return 'briefOverview';
    } else if (description.length > 0) {
      return 'description';
    } else {
      return 'fallback';
    }
  }

  /**
   * Destroy manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.cache.clear();
    this.userProfileCache = null;
    this.homepageProjectsCache = null;
    this.projectSemanticCache.clear();
    this.intentContentCache.clear();

    debugEventEmitter.emit('fid-manager-destroyed', {
      timestamp: Date.now()
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Generate cache key: ${route}-${projectId}-${intentHash} format
   */
  private generateCacheKey(uiState: UIState): string {
    const route = uiState.currentRoute || 'home';
    const projectId = uiState.currentProject || 'none';

    // Generate intent hash for cache key
    let intentHash = 'none';
    if (this.userIntent) {
      // Simple hash function for intent
      intentHash = this.simpleHash(this.userIntent).toString(36);
    }

    // Include visible anchors for more specific caching
    const anchorsHash = uiState.visibleAnchors?.length > 0
      ? this.simpleHash(uiState.visibleAnchors.join(','))
      : 0;

    return `${route}-${projectId}-${intentHash}:${anchorsHash}`;
  }

  /**
   * Generate comprehensive F-I-D context with intelligent caching and client data integration
   */
  private async generateContextWithClientData(uiState: UIState, clientProjectData?: any): Promise<FIDContext> {
    console.log('🧠 Generating comprehensive FID context with intelligent caching');
    
    const portfolioOwner = await this.getUserProfile();
    
    // Build Frame (always generated fresh)
    const frame = {
      portfolioOwner,
      currentCapabilities: ['navigation', 'project-information', 'technical-discussion', 'content-retrieval'],
      uiContext: this.buildUIContext(uiState)
    };

    // Build Index based on current route
    const index = await this.buildIntelligentIndex(uiState);

    // Build Details with client data + intent-based content
    const details = await this.buildIntelligentDetails(uiState, clientProjectData);

    return {
      frame,
      index,
      details
    };
  }

  /**
   * Build intelligent Index based on current UI state
   */
  private async buildIntelligentIndex(uiState: UIState): Promise<FIDContext['index']> {
    const baseIndex = {
      route: uiState.currentRoute || 'home',
      currentProject: uiState.currentProject,
      visibleSections: uiState.visibleAnchors || []
    };

    if (uiState.currentRoute === 'home') {
      // Homepage: Get top 10 project summaries (cached for session)
      console.log('🏠 Building homepage index with top 10 projects');
      const availableProjects = await this.getHomepageProjects();
      return {
        ...baseIndex,
        availableProjects,
        projectSemanticItems: undefined
      };
    } else if (uiState.currentProject) {
      // Project modal: Get semantic one-liners for tiered retrieval
      console.log('📋 Building project modal index with semantic items for:', uiState.currentProject);
      const projectSemanticItems = await this.getProjectSemanticItems(uiState.currentProject);
      return {
        ...baseIndex,
        availableProjects: [],
        projectSemanticItems
      };
    } else {
      // Other routes: Basic index
      return {
        ...baseIndex,
        availableProjects: [],
        projectSemanticItems: undefined
      };
    }
  }

  /**
   * Build intelligent Details with client data + intent-based content
   */
  private async buildIntelligentDetails(uiState: UIState, clientProjectData?: any): Promise<FIDContext['details']> {
    const details: FIDContext['details'] = {};

    // Always include client project summary when viewing a project
    if (uiState.currentProject && clientProjectData) {
      const clientProjectSummary = this.extractClientProjectSummary(clientProjectData);
      if (clientProjectSummary) {
        details.clientProjectSummary = clientProjectSummary;
        console.log('📝 Added client project summary to details:', {
          source: this.getClientSummarySource(clientProjectData),
          length: clientProjectSummary.length
        });
      }
    }

    // Add intent-based content if user intent is set
    if (this.userIntent) {
      console.log('🎯 User intent detected, fetching intent-based content:', this.userIntent);
      const intentBasedContent = await this.getIntentBasedContent(uiState, this.userIntent);
      details.intentBasedContent = intentBasedContent;
    }

    return details;
  }



  /**
   * Fetch F-I-D context from server API
   */
  private async fetchFromServer(uiState: UIState): Promise<FIDContext> {
    const requestBody = {
      route: uiState.currentRoute || 'home',
      projectId: uiState.currentProject,
      userIntent: this.userIntent,
      lastActions: uiState.visibleAnchors || [],
      contextType: 'complete'
    };

    // Determine the correct URL based on environment
    const baseUrl = typeof window !== 'undefined'
      ? '' // Browser environment - use relative URL
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Node.js environment - use configurable URL

    const apiUrl = `${baseUrl}/api/ai/context/fid`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Server request failed: ${response.status} ${response.statusText}`);
    }

    const apiResponse: FIDContextAPIResponse = await response.json();

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Server returned error');
    }

    // Convert server response to FIDContext format
    return await this.convertServerResponseToFIDContext(apiResponse.data, uiState);
  }

  /**
   * Convert server API response to FIDContext format
   */
  private async convertServerResponseToFIDContext(serverData: any, uiState: UIState): Promise<FIDContext> {
    // Extract frame context
    const frame = serverData.frame || {};

    // Extract index context
    const index = serverData.index || {};

    // Extract details context
    const details = serverData.details || {};

    // Get user profile with caching
    const portfolioOwner = await this.getUserProfile();

    return {
      frame: {
        portfolioOwner,
        currentCapabilities: this.extractCapabilities(frame),
        uiContext: this.buildUIContext(uiState)
      },
      index: {
        route: uiState.currentRoute || 'home',
        availableProjects: index.projectSummaries || [],
        currentProject: uiState.currentProject,
        visibleSections: uiState.visibleAnchors || []
      },
      details: {
        projectSummary: this.extractProjectSummary(details, uiState.currentProject),
        intentBasedContent: this.convertSearchResults(details.searchResults || []),
        selectedText: undefined // Not implemented in current server response
      }
    };
  }

  /**
   * Extract capabilities from frame context
   */
  private extractCapabilities(frame: any): string[] {
    const capabilities = ['navigation', 'project-information', 'technical-discussion'];

    if (frame.voiceSettings) {
      capabilities.push('voice-interaction');
    }

    return capabilities;
  }

  /**
   * Build UI context string from current state
   */
  private buildUIContext(uiState: UIState): string {
    const parts = [];

    if (uiState.currentRoute) {
      parts.push(`Currently on ${uiState.currentRoute} page`);
    }

    if (uiState.currentProject) {
      parts.push(`Viewing project: ${uiState.currentProject}`);
    }

    if (uiState.currentModal) {
      parts.push(`Modal open: ${uiState.currentModal}`);
    }

    if (uiState.visibleAnchors?.length > 0) {
      parts.push(`Visible sections: ${uiState.visibleAnchors.slice(0, 3).join(', ')}`);
    }

    return parts.join('. ') || 'Portfolio homepage';
  }

  /**
   * Extract project summary from details context
   */
  private extractProjectSummary(details: any, projectId?: string): string | undefined {
    if (!projectId || !details.contentChunks) {
      return undefined;
    }

    // Find project summary from content chunks
    const projectChunk = details.contentChunks.find((chunk: any) =>
      chunk.entityId === projectId || chunk.title?.toLowerCase().includes(projectId)
    );

    return projectChunk?.content || undefined;
  }

  /**
   * Convert server search results to ContentSearchResult format
   */
  private convertSearchResults(searchResults: any[]): ContentSearchResult[] {
    return searchResults.map(result => ({
      id: result.id || '',
      project: result.project,
      title: result.title || '',
      oneLiner: result.snippet || result.oneLiner || '',
      why: result.why || 'Relevant to current context',
      navTarget: result.navTarget || null,
      score: result.relevanceScore || result.score || 0,
      facets: {
        tech: result.facets?.tech || [],
        year: result.facets?.year,
        type: result.facets?.type || 'content'
      }
    }));
  }

  /**
   * Get minimal fallback context for error cases
   */
  private async getMinimalFallbackContext(uiState: UIState): Promise<FIDContext> {
    const portfolioOwner = await this.getUserProfile();
    
    return {
      frame: {
        portfolioOwner,
        currentCapabilities: ['navigation', 'basic-information'],
        uiContext: this.buildUIContext(uiState)
      },
      index: {
        route: uiState.currentRoute || 'home',
        availableProjects: [],
        currentProject: uiState.currentProject,
        visibleSections: uiState.visibleAnchors || []
      },
      details: {
        projectSummary: undefined,
        intentBasedContent: [],
        selectedText: undefined
      }
    };
  }

  /**
   * Set cache entry with TTL
   */
  private setCache(key: string, context: FIDContext, ttl: number = this.DEFAULT_TTL): void {
    // Enforce cache size limit before adding new entry
    while (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestEntries(1);
    }

    this.cache.set(key, {
      context,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    return (Date.now() - entry.timestamp) < entry.ttl;
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Invalidate cache entries that might be affected by intent changes
   */
  private invalidateIntentBasedCache(): void {
    const keysToDelete: string[] = [];

    for (const [key] of Array.from(this.cache.entries())) {
      // Invalidate entries that don't have 'none' as intent hash
      if (!key.includes('-none:')) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Start automatic cache cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCacheCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Perform automatic cache cleanup (remove expired entries)
   */
  private performCacheCleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (!this.isCacheValid(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      debugEventEmitter.emit('fid-cache-cleanup', {
        expiredCount: keysToDelete.length,
        remainingCount: this.cache.size,
        timestamp: now
      });
    }
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const passiveFIDManager = PassiveFIDManager.getInstance();