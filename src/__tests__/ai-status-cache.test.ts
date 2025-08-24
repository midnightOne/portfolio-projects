/**
 * AI Status Cache Tests
 * 
 * Tests the AI status caching functionality to ensure it eliminates
 * redundant connection tests and improves performance.
 */

import { AIStatusCache } from '@/lib/ai/status-cache';
import { AIProviderStatus, AIProviderType } from '@/lib/ai/types';

// Mock environment variable
const originalEnv = process.env.AI_STATUS_CACHE_TTL_MINUTES;

describe('AIStatusCache', () => {
  let cache: AIStatusCache;

  beforeEach(() => {
    // Clean up any existing instance
    AIStatusCache.destroy();
    
    // Set test environment
    process.env.AI_STATUS_CACHE_TTL_MINUTES = '1'; // 1 minute for testing
    
    cache = AIStatusCache.getInstance();
  });

  afterEach(() => {
    // Clean up
    AIStatusCache.destroy();
    
    // Restore environment
    if (originalEnv) {
      process.env.AI_STATUS_CACHE_TTL_MINUTES = originalEnv;
    } else {
      delete process.env.AI_STATUS_CACHE_TTL_MINUTES;
    }
  });

  describe('Basic Cache Operations', () => {
    it('should return null for non-existent cache entries', () => {
      const result = cache.get('openai');
      expect(result).toBeNull();
    });

    it('should store and retrieve cached status', () => {
      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o', 'gpt-3.5-turbo'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      const retrieved = cache.get('openai');

      expect(retrieved).toEqual(expect.objectContaining({
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o', 'gpt-3.5-turbo']
      }));
    });

    it('should check if provider status is cached', () => {
      const status: AIProviderStatus = {
        name: 'anthropic',
        configured: true,
        connected: false,
        error: 'Invalid API key',
        models: [],
        lastTested: new Date()
      };

      expect(cache.has('anthropic')).toBe(false);
      
      cache.set('anthropic', status);
      expect(cache.has('anthropic')).toBe(true);
    });

    it('should delete specific cache entries', () => {
      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      expect(cache.has('openai')).toBe(true);

      cache.delete('openai');
      expect(cache.has('openai')).toBe(false);
    });

    it('should clear all cache entries', () => {
      const openaiStatus: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      const anthropicStatus: AIProviderStatus = {
        name: 'anthropic',
        configured: true,
        connected: true,
        models: ['claude-3-5-sonnet-20241022'],
        lastTested: new Date()
      };

      cache.set('openai', openaiStatus);
      cache.set('anthropic', anthropicStatus);

      expect(cache.has('openai')).toBe(true);
      expect(cache.has('anthropic')).toBe(true);

      cache.clear();

      expect(cache.has('openai')).toBe(false);
      expect(cache.has('anthropic')).toBe(false);
    });
  });

  describe('Cache Expiration', () => {
    it('should return null for expired cache entries', async () => {
      // Set very short TTL for testing
      process.env.AI_STATUS_CACHE_TTL_MINUTES = '0.01'; // ~0.6 seconds
      AIStatusCache.destroy();
      cache = AIStatusCache.getInstance();

      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      expect(cache.get('openai')).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 700));

      expect(cache.get('openai')).toBeNull();
    });

    it('should clean up expired entries', async () => {
      // Set very short TTL for testing
      process.env.AI_STATUS_CACHE_TTL_MINUTES = '0.01'; // ~0.6 seconds
      AIStatusCache.destroy();
      cache = AIStatusCache.getInstance();

      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      
      const sizeBefore = cache.getCacheSize();
      expect(sizeBefore.totalEntries).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 700));

      // Trigger cleanup by accessing cache
      cache.get('openai');
      cache.cleanup();

      const sizeAfter = cache.getCacheSize();
      expect(sizeAfter.totalEntries).toBe(0);
    });

    it('should force refresh by marking entries as expired', () => {
      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      expect(cache.get('openai')).not.toBeNull();

      cache.forceRefresh();
      expect(cache.get('openai')).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', () => {
      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      // Initial stats
      let stats = cache.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);

      // Cache miss
      cache.get('openai');
      stats = cache.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0);

      // Set and hit
      cache.set('openai', status);
      cache.get('openai');
      stats = cache.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should provide cache size information', () => {
      const openaiStatus: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      const anthropicStatus: AIProviderStatus = {
        name: 'anthropic',
        configured: false,
        connected: false,
        error: 'No API key',
        models: [],
        lastTested: new Date()
      };

      cache.set('openai', openaiStatus);
      cache.set('anthropic', anthropicStatus);

      const size = cache.getCacheSize();
      expect(size.totalEntries).toBe(2);
      expect(size.validEntries).toBe(2);
      expect(size.expiredEntries).toBe(0);
    });
  });

  describe('Multiple Providers', () => {
    it('should handle multiple providers independently', () => {
      const openaiStatus: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o', 'gpt-3.5-turbo'],
        lastTested: new Date()
      };

      const anthropicStatus: AIProviderStatus = {
        name: 'anthropic',
        configured: true,
        connected: false,
        error: 'Rate limited',
        models: ['claude-3-5-sonnet-20241022'],
        lastTested: new Date()
      };

      cache.set('openai', openaiStatus);
      cache.set('anthropic', anthropicStatus);

      const retrievedOpenai = cache.get('openai');
      const retrievedAnthropic = cache.get('anthropic');

      expect(retrievedOpenai?.connected).toBe(true);
      expect(retrievedAnthropic?.connected).toBe(false);
      expect(retrievedAnthropic?.error).toBe('Rate limited');
    });

    it('should set and get all statuses at once', () => {
      const statuses: AIProviderStatus[] = [
        {
          name: 'openai',
          configured: true,
          connected: true,
          models: ['gpt-4o'],
          lastTested: new Date()
        },
        {
          name: 'anthropic',
          configured: true,
          connected: true,
          models: ['claude-3-5-sonnet-20241022'],
          lastTested: new Date()
        }
      ];

      cache.setAll(statuses);

      const allCached = cache.getAll();
      expect(allCached.size).toBe(2);
      expect(allCached.has('openai')).toBe(true);
      expect(allCached.has('anthropic')).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use environment variable for TTL', () => {
      process.env.AI_STATUS_CACHE_TTL_MINUTES = '15';
      AIStatusCache.destroy();
      cache = AIStatusCache.getInstance();

      const config = cache.getConfig();
      expect(config.defaultTtlMinutes).toBe(15);
    });

    it('should use default TTL when environment variable is not set', () => {
      delete process.env.AI_STATUS_CACHE_TTL_MINUTES;
      AIStatusCache.destroy();
      cache = AIStatusCache.getInstance();

      const config = cache.getConfig();
      expect(config.defaultTtlMinutes).toBe(10); // Default value
    });

    it('should update configuration', () => {
      const newConfig = {
        defaultTtlMinutes: 20,
        backgroundRefreshEnabled: false
      };

      cache.updateConfig(newConfig);
      const config = cache.getConfig();

      expect(config.defaultTtlMinutes).toBe(20);
      expect(config.backgroundRefreshEnabled).toBe(false);
    });
  });

  describe('User Activity Tracking', () => {
    it('should track user activity', () => {
      cache.markUserActive();
      
      // This is mainly for background refresh decisions
      // We can't easily test the private isUserRecentlyActive method
      // but we can verify the method exists and doesn't throw
      expect(() => cache.markUserActive()).not.toThrow();
    });
  });

  describe('Cache Entries Information', () => {
    it('should provide detailed cache entry information', () => {
      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      const entries = cache.getCacheEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(expect.objectContaining({
        provider: 'openai',
        status: expect.objectContaining({
          name: 'openai',
          configured: true,
          connected: true
        }),
        isExpired: false
      }));

      expect(entries[0].timeUntilExpiration).toBeGreaterThan(0);
    });

    it('should calculate time until expiration', () => {
      const status: AIProviderStatus = {
        name: 'openai',
        configured: true,
        connected: true,
        models: ['gpt-4o'],
        lastTested: new Date()
      };

      cache.set('openai', status);
      const timeUntilExpiration = cache.getTimeUntilExpiration('openai');

      expect(timeUntilExpiration).toBeGreaterThan(0);
      expect(timeUntilExpiration).toBeLessThanOrEqual(60 * 1000); // 1 minute in ms
    });

    it('should return null for non-existent entries when checking expiration', () => {
      const timeUntilExpiration = cache.getTimeUntilExpiration('nonexistent' as AIProviderType);
      expect(timeUntilExpiration).toBeNull();
    });
  });
});