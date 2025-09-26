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

// F-I-D Context Interfaces (matching design document)
export interface FIDContext {
  frame: {
    portfolioOwner: string;
    currentCapabilities: string[];
    uiContext: string;
  };
  index: {
    route: string;
    availableProjects: ProjectSummary[];
    currentProject?: string;
    visibleSections: string[];
  };
  details: {
    projectSummary?: string;
    intentBasedContent?: ContentSearchResult[];
    selectedText?: string;
  };
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
   */
  async getOrFetchContext(uiState: UIState): Promise<FIDContext> {
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

      // Cache miss or expired - fetch from server
      debugEventEmitter.emit('fid-context-cache-miss', {
        cacheKey,
        route: uiState.currentRoute,
        projectId: uiState.currentProject,
        expired: cached ? !this.isCacheValid(cached) : false,
        timestamp: Date.now()
      });

      const context = await this.fetchFromServer(uiState);
      
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
      return this.getMinimalFallbackContext(uiState);
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
      
      debugEventEmitter.emit('fid-cache-cleared', {
        type: 'project-specific',
        projectId,
        clearedCount: keysToDelete.length,
        timestamp: Date.now()
      });
    } else {
      // Clear entire cache
      const cacheSize = this.cache.size;
      this.cache.clear();
      
      debugEventEmitter.emit('fid-cache-cleared', {
        type: 'full',
        clearedCount: cacheSize,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number;
    memoryUsage: string;
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
    const estimatedMemory = this.cache.size * 2; // ~2KB per entry estimate

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestEntry: oldestTimestamp,
      memoryUsage: `~${estimatedMemory}KB`
    };
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

    const response = await fetch('/api/ai/context/fid', {
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
    return this.convertServerResponseToFIDContext(apiResponse.data, uiState);
  }

  /**
   * Convert server API response to FIDContext format
   */
  private convertServerResponseToFIDContext(serverData: any, uiState: UIState): FIDContext {
    // Extract frame context
    const frame = serverData.frame || {};
    
    // Extract index context
    const index = serverData.index || {};
    
    // Extract details context
    const details = serverData.details || {};

    return {
      frame: {
        portfolioOwner: frame.systemRules?.includes('portfolio') ? 'Portfolio Owner' : 'AI Assistant',
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
  private getMinimalFallbackContext(uiState: UIState): FIDContext {
    return {
      frame: {
        portfolioOwner: 'Portfolio Owner',
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