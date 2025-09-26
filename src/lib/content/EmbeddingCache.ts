/**
 * Embedding Cache Service
 * 
 * Caches OpenAI embeddings to avoid repeated API calls for the same queries.
 * Uses in-memory cache with LRU eviction and optional persistence.
 */

import crypto from 'crypto';

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  hitCount: number;
}

export class EmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxAge: number; // milliseconds

  constructor(options: {
    maxSize?: number;
    maxAgeMinutes?: number;
  } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxAge = (options.maxAgeMinutes || 60) * 60 * 1000; // default 1 hour
  }

  /**
   * Generate cache key from query text
   */
  private getCacheKey(query: string, model: string = 'text-embedding-3-small'): string {
    const normalized = query.trim().toLowerCase();
    return crypto.createHash('sha256').update(`${model}:${normalized}`).digest('hex');
  }

  /**
   * Get cached embedding if available and not expired
   */
  get(query: string, model?: string): number[] | null {
    const key = this.getCacheKey(query, model);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and timestamp for LRU
    entry.hitCount++;
    entry.timestamp = Date.now();

    return entry.embedding;
  }

  /**
   * Store embedding in cache
   */
  set(query: string, embedding: number[], model?: string): void {
    const key = this.getCacheKey(query, model);

    // If cache is full, remove least recently used entry
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hitCount: 1
    });
  }

  /**
   * Remove least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    let totalHits = 0;
    let totalEntries = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalEntries++;
      oldestTime = Math.min(oldestTime, entry.timestamp);
      newestTime = Math.max(newestTime, entry.timestamp);
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
      oldestEntry: totalEntries > 0 ? Date.now() - oldestTime : 0,
      newestEntry: totalEntries > 0 ? Date.now() - newestTime : 0
    };
  }

  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global singleton instance
export const embeddingCache = new EmbeddingCache({
  maxSize: 1000,
  maxAgeMinutes: 60
});