/**
 * Context Manager Integration Tests
 * Tests the full integration between context manager and API endpoints
 */

import { contextManager } from '@/lib/services/ai/context-manager';

// Mock fetch for external API calls
global.fetch = jest.fn();

describe('Context Manager Integration', () => {
  beforeEach(() => {
    contextManager.clearAllCache();
    jest.clearAllMocks();
  });

  it('should integrate with project indexer for content search', async () => {
    // Mock API responses
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            projects: [
              { 
                id: 'project-1', 
                title: 'React Portfolio', 
                slug: 'react-portfolio',
                briefOverview: 'A portfolio built with React'
              }
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
                    content: 'I am a React developer with 5 years of experience',
                    skills: ['React', 'TypeScript', 'Node.js']
                  }
                }
              ]
            }
          }
        })
      });

    const context = await contextManager.buildContext(
      [],
      'React developer experience',
      { maxTokens: 2000 }
    );

    expect(context).toContain('PORTFOLIO CONTEXT');
    expect(context).toContain('React developer');
    expect(typeof context).toBe('string');
    
    // Verify API calls were made
    expect(fetch).toHaveBeenCalledWith('/api/projects?status=PUBLISHED&visibility=PUBLIC&limit=100');
    expect(fetch).toHaveBeenCalledWith('/api/homepage-config-public');
  });

  it('should cache context effectively', async () => {
    const sessionId = 'integration-test-session';
    const query = 'TypeScript development';

    // Mock API responses
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: { projects: [] }
      })
    });

    // First call should build context
    const result1 = await contextManager.buildContextWithCaching(
      sessionId,
      [],
      query
    );

    expect(result1.fromCache).toBe(false);
    expect(result1.context).toContain('PORTFOLIO CONTEXT');

    // Second call should use cache
    const result2 = await contextManager.buildContextWithCaching(
      sessionId,
      [],
      query
    );

    expect(result2.fromCache).toBe(true);
    expect(result2.context).toBe(result1.context);

    // Verify cache statistics
    const stats = contextManager.getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.sessions).toContain(sessionId);
  });

  it('should handle content prioritization correctly', async () => {
    // Mock API responses with different content types
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { projects: [] }
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
                    content: 'I specialize in React and TypeScript development',
                    skills: ['React', 'TypeScript', 'Next.js']
                  }
                }
              ]
            }
          }
        })
      });

    const context = await contextManager.buildContext(
      [],
      'React TypeScript',
      { maxTokens: 1000 }
    );

    // Should contain relevant content
    expect(context).toContain('React');
    expect(context).toContain('TypeScript');
    expect(context).toContain('ABOUT');
  });

  it('should optimize context size within token limits', async () => {
    // Mock API response with large content
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { projects: [] }
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
                    content: 'Very long content that would exceed token limits. '.repeat(200),
                    skills: ['React', 'TypeScript']
                  }
                }
              ]
            }
          }
        })
      });

    const maxTokens = 100;
    const context = await contextManager.buildContext(
      [],
      'development',
      { maxTokens }
    );

    const estimatedTokens = Math.ceil(context.length / 4);
    expect(estimatedTokens).toBeLessThanOrEqual(maxTokens);
  });

  it('should handle API errors gracefully', async () => {
    // Mock API failure
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const context = await contextManager.buildContext(
      [],
      'test query'
    );

    // Should still return valid context structure
    expect(context).toContain('PORTFOLIO CONTEXT');
    expect(typeof context).toBe('string');
  });
});