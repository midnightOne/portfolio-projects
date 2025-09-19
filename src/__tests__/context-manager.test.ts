/**
 * Context Manager Tests
 * Tests for the AI context building and caching system
 */

import { contextManager, ContextManager, ContextSource, RelevantContent } from '@/lib/services/ai/context-manager';

// Mock the project indexer
jest.mock('@/lib/services/project-indexer', () => ({
  projectIndexer: {
    searchRelevantContent: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = ContextManager.getInstance();
    manager.clearAllCache();
    jest.clearAllMocks();
  });

  describe('buildContext', () => {
    it('should build context from sources and query', async () => {
      const sources: ContextSource[] = [
        {
          id: 'test-source',
          type: 'project',
          title: 'Test Project',
          enabled: true,
          summary: 'A test project',
          lastUpdated: new Date(),
          priority: 1
        }
      ];

      // Mock API responses
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              projects: [
                { id: 'project-1', title: 'Test Project', slug: 'test-project' }
              ]
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              config: {
                sections: [
                  {
                    type: 'about',
                    enabled: true,
                    config: {
                      content: 'I am a developer',
                      skills: ['React', 'TypeScript']
                    }
                  }
                ]
              }
            }
          })
        });

      const context = await manager.buildContext(sources, 'React developer');

      expect(context).toContain('PORTFOLIO CONTEXT');
      expect(typeof context).toBe('string');
    });

    it('should handle empty sources gracefully', async () => {
      const context = await manager.buildContext([], 'test query');
      
      expect(context).toContain('PORTFOLIO CONTEXT');
      expect(typeof context).toBe('string');
    });

    it('should respect token limits', async () => {
      const sources: ContextSource[] = [];
      const options = { maxTokens: 100 };

      const context = await manager.buildContext(sources, 'test', options);
      const estimatedTokens = Math.ceil(context.length / 4);

      expect(estimatedTokens).toBeLessThanOrEqual(100);
    });
  });

  describe('caching', () => {
    it('should cache context per session', async () => {
      const sessionId = 'test-session';
      const sources: ContextSource[] = [];
      const query = 'test query';

      // Mock empty responses
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { projects: [] } })
      });

      // First call should build context
      const result1 = await manager.buildContextWithCaching(sessionId, sources, query);
      expect(result1.fromCache).toBe(false);

      // Second call should use cache
      const result2 = await manager.buildContextWithCaching(sessionId, sources, query);
      expect(result2.fromCache).toBe(true);
      expect(result2.context).toBe(result1.context);
    });

    it('should return null for non-existent cache', async () => {
      const cached = await manager.getCachedContext('non-existent');
      expect(cached).toBeNull();
    });

    it('should clear session cache', async () => {
      const sessionId = 'test-session';
      const sources: ContextSource[] = [];
      const query = 'test query';

      // Mock empty responses
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { projects: [] } })
      });

      // Build and cache context
      await manager.buildContextWithCaching(sessionId, sources, query);
      
      // Verify cache exists
      let cached = await manager.getCachedContext(sessionId);
      expect(cached).not.toBeNull();

      // Clear cache
      manager.clearSessionCache(sessionId);

      // Verify cache is cleared
      cached = await manager.getCachedContext(sessionId);
      expect(cached).toBeNull();
    });

    it('should provide cache statistics', () => {
      const stats = manager.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('sessions');
      expect(stats).toHaveProperty('totalTokens');
      expect(Array.isArray(stats.sessions)).toBe(true);
    });
  });

  describe('content prioritization', () => {
    it('should prioritize content by relevance score', () => {
      const content: RelevantContent[] = [
        {
          id: '1',
          type: 'project',
          title: 'Low Relevance',
          content: 'Content 1',
          summary: 'Summary 1',
          relevanceScore: 0.3,
          keywords: []
        },
        {
          id: '2',
          type: 'about',
          title: 'High Relevance',
          content: 'Content 2',
          summary: 'Summary 2',
          relevanceScore: 0.8,
          keywords: []
        },
        {
          id: '3',
          type: 'project',
          title: 'Medium Relevance',
          content: 'Content 3',
          summary: 'Summary 3',
          relevanceScore: 0.5,
          keywords: []
        }
      ];

      const prioritized = manager.prioritizeContent(content, 'test query');

      expect(prioritized[0].relevanceScore).toBe(0.8);
      expect(prioritized[1].relevanceScore).toBe(0.5);
      expect(prioritized[2].relevanceScore).toBe(0.3);
    });

    it('should prioritize about content over projects when relevance is equal', () => {
      const content: RelevantContent[] = [
        {
          id: '1',
          type: 'project',
          title: 'Project',
          content: 'Content 1',
          summary: 'Summary 1',
          relevanceScore: 0.5,
          keywords: []
        },
        {
          id: '2',
          type: 'about',
          title: 'About',
          content: 'Content 2',
          summary: 'Summary 2',
          relevanceScore: 0.5,
          keywords: []
        }
      ];

      const prioritized = manager.prioritizeContent(content, 'test query');

      expect(prioritized[0].type).toBe('about');
      expect(prioritized[1].type).toBe('project');
    });
  });

  describe('context optimization', () => {
    it('should optimize context size to fit token limits', () => {
      const longContext = 'This is a very long context that exceeds the token limit. '.repeat(100);
      const maxTokens = 50;

      const optimized = manager.optimizeContextSize(longContext, maxTokens);
      const estimatedTokens = Math.ceil(optimized.length / 4);

      expect(estimatedTokens).toBeLessThanOrEqual(maxTokens);
    });

    it('should return original context if within limits', () => {
      const shortContext = 'Short context';
      const maxTokens = 100;

      const optimized = manager.optimizeContextSize(shortContext, maxTokens);

      expect(optimized).toBe(shortContext);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock failed API response
      (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      const sources: ContextSource[] = [];
      
      // Should not throw, but return empty context
      const context = await manager.buildContext(sources, 'test query');
      expect(context).toContain('PORTFOLIO CONTEXT');
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed response
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      const sources: ContextSource[] = [];
      
      const context = await manager.buildContext(sources, 'test query');
      expect(context).toContain('PORTFOLIO CONTEXT');
    });
  });
});