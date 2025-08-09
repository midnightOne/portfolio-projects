/**
 * AI Status Cache
 * 
 * Implements in-memory caching for AI provider status to eliminate redundant
 * connection tests and improve performance.
 */

import { AIProviderStatus, AIProviderType } from './types';

export interface CachedStatus {
  status: AIProviderStatus;
  timestamp: Date;
  expiresAt: Date;
}

export interface CacheConfig {
  defaultTtlMinutes: number;
  backgroundRefreshEnabled: boolean;
  backgroundRefreshIntervalMinutes: number;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  lastRefresh: Date | null;
  nextBackgroundRefresh: Date | null;
}

/**
 * In-memory cache for AI provider status
 * Eliminates redundant connection tests and improves performance
 */
export class AIStatusCache {
  private static instance: AIStatusCache;
  private cache: Map<AIProviderType, CachedStatus> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private backgroundRefreshTimer: NodeJS.Timeout | null = null;
  private isUserActive = false;
  private lastUserActivity = new Date();

  private constructor() {
    // Get cache duration from environment variable (default: 10 minutes)
    const ttlMinutes = parseInt(process.env.AI_STATUS_CACHE_TTL_MINUTES || '10', 10);
    
    // Disable background refresh during tests to avoid interference
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    
    this.config = {
      defaultTtlMinutes: ttlMinutes,
      backgroundRefreshEnabled: !isTestEnvironment,
      backgroundRefreshIntervalMinutes: ttlMinutes // Same as TTL for now
    };

    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      lastRefresh: null,
      nextBackgroundRefresh: null
    };

    // Start background refresh if enabled
    if (this.config.backgroundRefreshEnabled) {
      this.startBackgroundRefresh();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIStatusCache {
    if (!AIStatusCache.instance) {
      AIStatusCache.instance = new AIStatusCache();
    }
    return AIStatusCache.instance;
  }

  /**
   * Get cached status for a provider or null if not cached/expired
   */
  get(providerType: AIProviderType): AIProviderStatus | null {
    this.stats.totalRequests++;
    this.updateStats();

    const cached = this.cache.get(providerType);
    
    if (!cached) {
      this.stats.cacheMisses++;
      this.updateStats();
      return null;
    }

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.cache.delete(providerType);
      this.stats.cacheMisses++;
      this.updateStats();
      return null;
    }

    this.stats.cacheHits++;
    this.updateStats();
    return cached.status;
  }

  /**
   * Set cached status for a provider
   */
  set(providerType: AIProviderType, status: AIProviderStatus): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.config.defaultTtlMinutes * 60 * 1000));

    this.cache.set(providerType, {
      status: { ...status, lastTested: now },
      timestamp: now,
      expiresAt
    });

    this.stats.lastRefresh = now;
  }

  /**
   * Get all cached statuses (only non-expired ones)
   */
  getAll(): Map<AIProviderType, AIProviderStatus> {
    const result = new Map<AIProviderType, AIProviderStatus>();
    const now = new Date();

    for (const [providerType, cached] of this.cache.entries()) {
      if (now <= cached.expiresAt) {
        result.set(providerType, cached.status);
      } else {
        // Clean up expired entries
        this.cache.delete(providerType);
      }
    }

    return result;
  }

  /**
   * Set multiple statuses at once
   */
  setAll(statuses: AIProviderStatus[]): void {
    for (const status of statuses) {
      this.set(status.name, status);
    }
  }

  /**
   * Check if a provider status is cached and valid
   */
  has(providerType: AIProviderType): boolean {
    const cached = this.cache.get(providerType);
    if (!cached) return false;
    
    return new Date() <= cached.expiresAt;
  }

  /**
   * Clear cache for a specific provider
   */
  delete(providerType: AIProviderType): void {
    this.cache.delete(providerType);
  }

  /**
   * Clear all cached statuses
   */
  clear(): void {
    this.cache.clear();
    this.stats.lastRefresh = null;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart background refresh if interval changed
    if (newConfig.backgroundRefreshIntervalMinutes && this.backgroundRefreshTimer) {
      this.stopBackgroundRefresh();
      this.startBackgroundRefresh();
    }
  }

  /**
   * Force refresh of all cached statuses
   * This will mark all entries as expired, forcing fresh API calls
   */
  forceRefresh(): void {
    const now = new Date();
    
    // Mark all entries as expired
    for (const [providerType, cached] of this.cache.entries()) {
      cached.expiresAt = new Date(now.getTime() - 1000); // 1 second ago
    }
  }

  /**
   * Get time until next expiration
   */
  getTimeUntilExpiration(providerType: AIProviderType): number | null {
    const cached = this.cache.get(providerType);
    if (!cached) return null;
    
    return Math.max(0, cached.expiresAt.getTime() - Date.now());
  }

  /**
   * Get all cached entries with their expiration info
   */
  getCacheEntries(): Array<{
    provider: AIProviderType;
    status: AIProviderStatus;
    cached: Date;
    expires: Date;
    timeUntilExpiration: number;
    isExpired: boolean;
  }> {
    const now = new Date();
    const entries: Array<{
      provider: AIProviderType;
      status: AIProviderStatus;
      cached: Date;
      expires: Date;
      timeUntilExpiration: number;
      isExpired: boolean;
    }> = [];

    for (const [providerType, cached] of this.cache.entries()) {
      entries.push({
        provider: providerType,
        status: cached.status,
        cached: cached.timestamp,
        expires: cached.expiresAt,
        timeUntilExpiration: Math.max(0, cached.expiresAt.getTime() - now.getTime()),
        isExpired: now > cached.expiresAt
      });
    }

    return entries;
  }

  /**
   * Mark user as active (for background refresh decisions)
   */
  markUserActive(): void {
    this.isUserActive = true;
    this.lastUserActivity = new Date();
  }

  /**
   * Check if user has been active recently
   */
  private isUserRecentlyActive(): boolean {
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    return (Date.now() - this.lastUserActivity.getTime()) < inactivityThreshold;
  }

  /**
   * Start background refresh timer
   */
  private startBackgroundRefresh(): void {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
    }

    const intervalMs = this.config.backgroundRefreshIntervalMinutes * 60 * 1000;
    
    this.backgroundRefreshTimer = setInterval(() => {
      // Only refresh if user is recently active
      if (this.isUserRecentlyActive()) {
        this.performBackgroundRefresh();
      }
    }, intervalMs);

    // Set next refresh time
    this.stats.nextBackgroundRefresh = new Date(Date.now() + intervalMs);
  }

  /**
   * Stop background refresh timer
   */
  private stopBackgroundRefresh(): void {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
    this.stats.nextBackgroundRefresh = null;
  }

  /**
   * Perform background refresh of expired entries
   */
  private async performBackgroundRefresh(): Promise<void> {
    try {
      // Only refresh expired entries to avoid unnecessary API calls
      const expiredProviders: AIProviderType[] = [];
      const now = new Date();

      for (const [providerType, cached] of this.cache.entries()) {
        if (now > cached.expiresAt) {
          expiredProviders.push(providerType);
        }
      }

      if (expiredProviders.length === 0) {
        return; // Nothing to refresh
      }

      // Import AIServiceManager dynamically to avoid circular dependencies
      const { AIServiceManager } = await import('./service-manager');
      const aiService = new AIServiceManager();
      
      // Refresh only expired providers
      const freshStatuses = await aiService.getAvailableProviders();
      
      // Update cache with fresh data
      for (const status of freshStatuses) {
        if (expiredProviders.includes(status.name)) {
          this.set(status.name, status);
        }
      }

      console.log(`Background refresh completed for ${expiredProviders.length} providers`);
    } catch (error) {
      console.warn('Background AI status refresh failed:', error);
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateStats(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = this.stats.cacheHits / this.stats.totalRequests;
    }
  }

  /**
   * Get cache size information
   */
  getCacheSize(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    const now = new Date();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const cached of this.cache.values()) {
      if (now <= cached.expiresAt) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = new Date();
    const expiredKeys: AIProviderType[] = [];

    for (const [providerType, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        expiredKeys.push(providerType);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Destroy the cache instance (for testing)
   */
  static destroy(): void {
    if (AIStatusCache.instance) {
      AIStatusCache.instance.stopBackgroundRefresh();
      AIStatusCache.instance.clear();
      AIStatusCache.instance = null as any;
    }
  }
}

/**
 * Utility function to get cached status or null
 */
export function getCachedAIStatus(providerType: AIProviderType): AIProviderStatus | null {
  const cache = AIStatusCache.getInstance();
  return cache.get(providerType);
}

/**
 * Utility function to cache AI status
 */
export function cacheAIStatus(providerType: AIProviderType, status: AIProviderStatus): void {
  const cache = AIStatusCache.getInstance();
  cache.set(providerType, status);
}

/**
 * Utility function to get all cached statuses
 */
export function getAllCachedAIStatuses(): Map<AIProviderType, AIProviderStatus> {
  const cache = AIStatusCache.getInstance();
  return cache.getAll();
}

/**
 * Utility function to force refresh of all cached statuses
 */
export function forceRefreshAIStatusCache(): void {
  const cache = AIStatusCache.getInstance();
  cache.forceRefresh();
}

/**
 * Utility function to mark user as active (for background refresh)
 */
export function markUserActiveForAICache(): void {
  const cache = AIStatusCache.getInstance();
  cache.markUserActive();
}