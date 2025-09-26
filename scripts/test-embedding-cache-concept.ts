#!/usr/bin/env tsx

/**
 * Test Concept: Query Embedding Cache
 * 
 * This demonstrates how we could cache query embeddings to improve performance.
 */

interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
  hitCount: number;
}

class QueryEmbeddingCache {
  private cache = new Map<string, EmbeddingCacheEntry>();
  private maxAge = 24 * 60 * 60 * 1000; // 24 hours
  private maxSize = 1000; // Max cached queries

  // Normalize query for better cache hits
  private normalizeQuery(query: string): string {
    return query.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, ''); // Remove punctuation
  }

  // Check if we have a cached embedding
  getCachedEmbedding(query: string): number[] | null {
    const normalizedQuery = this.normalizeQuery(query);
    const entry = this.cache.get(normalizedQuery);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(normalizedQuery);
      return null;
    }
    
    // Update hit count
    entry.hitCount++;
    return entry.embedding;
  }

  // Cache an embedding
  cacheEmbedding(query: string, embedding: number[]): void {
    const normalizedQuery = this.normalizeQuery(query);
    
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanupCache();
    }
    
    this.cache.set(normalizedQuery, {
      embedding,
      timestamp: Date.now(),
      hitCount: 1
    });
  }

  // Clean up least used entries
  private cleanupCache(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].hitCount - b[1].hitCount);
    
    // Remove bottom 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  // Get cache stats
  getStats() {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const avgHits = entries.length > 0 ? totalHits / entries.length : 0;
    
    return {
      size: this.cache.size,
      totalHits,
      avgHits: Math.round(avgHits * 100) / 100,
      oldestEntry: entries.length > 0 ? 
        Math.min(...entries.map(e => e.timestamp)) : null
    };
  }
}

// Test the concept
async function testEmbeddingCache() {
  console.log('🧪 Testing Query Embedding Cache Concept\n');
  
  const cache = new QueryEmbeddingCache();
  
  // Simulate some queries
  const testQueries = [
    'technical implementation details',
    'Technical Implementation Details', // Should hit cache (normalized)
    'react components and hooks',
    'React components and hooks', // Should hit cache
    'database architecture design',
    'technical implementation details', // Should hit cache
    'machine learning algorithms',
    'react components and hooks', // Should hit cache again
  ];
  
  let cacheHits = 0;
  let cacheMisses = 0;
  
  for (const query of testQueries) {
    const cached = cache.getCachedEmbedding(query);
    
    if (cached) {
      console.log(`✅ Cache HIT: "${query}"`);
      cacheHits++;
    } else {
      console.log(`❌ Cache MISS: "${query}"`);
      cacheMisses++;
      
      // Simulate generating embedding (normally would call OpenAI)
      const fakeEmbedding = new Array(1536).fill(0).map(() => Math.random());
      cache.cacheEmbedding(query, fakeEmbedding);
    }
  }
  
  console.log('\n📊 Cache Performance:');
  console.log(`   Cache Hits: ${cacheHits}`);
  console.log(`   Cache Misses: ${cacheMisses}`);
  console.log(`   Hit Rate: ${Math.round((cacheHits / testQueries.length) * 100)}%`);
  
  const stats = cache.getStats();
  console.log('\n📈 Cache Stats:');
  console.log(`   Cached Queries: ${stats.size}`);
  console.log(`   Total Hits: ${stats.totalHits}`);
  console.log(`   Average Hits per Query: ${stats.avgHits}`);
  
  console.log('\n💡 Potential Performance Improvement:');
  console.log(`   Queries that would skip OpenAI API: ${cacheHits}`);
  console.log(`   Estimated time saved: ${cacheHits * 400}ms (avg 400ms per embedding)`);
  console.log(`   Cache hit rate: ${Math.round((cacheHits / testQueries.length) * 100)}%`);
}

if (require.main === module) {
  testEmbeddingCache().catch(console.error);
}