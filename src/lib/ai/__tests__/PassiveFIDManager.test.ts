/**
 * PassiveFIDManager Tests
 * 
 * Tests for client-side F-I-D context management with caching and server integration.
 */

import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { expect } from 'playwright/test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { PassiveFIDManager } from '../PassiveFIDManager';
import { UIState } from '../tools/types';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock debug event emitter
jest.mock('../../debug/debugEventEmitter', () => ({
  debugEventEmitter: {
    emit: jest.fn()
  }
}));

describe('PassiveFIDManager', () => {
  let manager: PassiveFIDManager;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    // Reset singleton instance for each test
    (PassiveFIDManager as any).instance = null;
    manager = PassiveFIDManager.getInstance();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  afterEach(() => {
    manager.destroy();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PassiveFIDManager.getInstance();
      const instance2 = PassiveFIDManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: ['section1', 'section2'],
        currentRoute: 'home',
        currentProject: 'test-project'
      };

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            frame: { systemRules: 'test' },
            index: { projectSummaries: [] },
            details: { contentChunks: [] },
            type: 'complete'
          },
          timestamp: Date.now()
        })
      } as Response);

      await manager.getOrFetchContext(uiState);

      // Second call with same state should hit cache
      mockFetch.mockClear();
      await manager.getOrFetchContext(uiState);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should generate different cache keys for different states', async () => {
      const uiState1: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home'
      };

      const uiState2: UIState = {
        breadcrumbPath: 'projects',
        visibleAnchors: [],
        currentRoute: 'projects'
      };

      // Mock successful API responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            frame: { systemRules: 'test' },
            index: { projectSummaries: [] },
            details: { contentChunks: [] },
            type: 'complete'
          },
          timestamp: Date.now()
        })
      } as Response);

      await manager.getOrFetchContext(uiState1);
      await manager.getOrFetchContext(uiState2);

      // Should have made 2 API calls (different cache keys)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Server Integration', () => {
    it('should fetch context from server API', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: ['hero'],
        currentRoute: 'home'
      };

      const mockResponse = {
        success: true,
        data: {
          frame: {
            systemRules: 'You are a portfolio assistant',
            voiceSettings: { provider: 'openai' }
          },
          index: {
            projectSummaries: [
              {
                id: '1',
                slug: 'test-project',
                title: 'Test Project',
                description: 'A test project',
                tags: ['test'],
                technologies: ['typescript'],
                tier1Summary: 'Test summary',
                importance: 0.8
              }
            ]
          },
          details: {
            contentChunks: [],
            searchResults: []
          },
          type: 'complete'
        },
        timestamp: Date.now()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const context = await manager.getOrFetchContext(uiState);

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/context/fid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'home',
          projectId: undefined,
          userIntent: null,
          lastActions: ['hero'],
          contextType: 'complete'
        })
      });

      expect(context).toMatchObject({
        frame: {
          portfolioOwner: expect.any(String),
          currentCapabilities: expect.arrayContaining(['navigation', 'voice-interaction']),
          uiContext: expect.stringContaining('home')
        },
        index: {
          route: 'home',
          availableProjects: expect.arrayContaining([
            expect.objectContaining({
              slug: 'test-project',
              title: 'Test Project'
            })
          ]),
          visibleSections: ['hero']
        },
        details: expect.any(Object)
      });
    });

    it('should handle server errors gracefully', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const context = await manager.getOrFetchContext(uiState);

      // Should return minimal fallback context
      expect(context).toMatchObject({
        frame: {
          portfolioOwner: 'Portfolio Owner',
          currentCapabilities: ['navigation', 'basic-information'],
          uiContext: expect.any(String)
        },
        index: {
          route: 'home',
          availableProjects: [],
          visibleSections: []
        },
        details: {
          projectSummary: undefined,
          intentBasedContent: [],
          selectedText: undefined
        }
      });
    });
  });

  describe('User Intent Management', () => {
    it('should set and use user intent', async () => {
      const intent = 'Show me technical projects';
      manager.setUserIntent(intent);

      const uiState: UIState = {
        breadcrumbPath: 'projects',
        visibleAnchors: [],
        currentRoute: 'projects'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            frame: { systemRules: 'test' },
            index: { projectSummaries: [] },
            details: { contentChunks: [] },
            type: 'complete'
          },
          timestamp: Date.now()
        })
      } as Response);

      await manager.getOrFetchContext(uiState);

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/context/fid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'projects',
          projectId: undefined,
          userIntent: intent,
          lastActions: [],
          contextType: 'complete'
        })
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific project', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'projects.test-project',
        visibleAnchors: [],
        currentRoute: 'projects',
        currentProject: 'test-project'
      };

      // Mock API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            frame: { systemRules: 'test' },
            index: { projectSummaries: [] },
            details: { contentChunks: [] },
            type: 'complete'
          },
          timestamp: Date.now()
        })
      } as Response);

      // First call - should fetch from server
      await manager.getOrFetchContext(uiState);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      mockFetch.mockClear();
      await manager.getOrFetchContext(uiState);
      expect(mockFetch).not.toHaveBeenCalled();

      // Clear cache for this project
      manager.clearCache('test-project');

      // Third call - should fetch from server again
      await manager.getOrFetchContext(uiState);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should clear entire cache', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home'
      };

      // Mock API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            frame: { systemRules: 'test' },
            index: { projectSummaries: [] },
            details: { contentChunks: [] },
            type: 'complete'
          },
          timestamp: Date.now()
        })
      } as Response);

      // First call - should fetch from server
      await manager.getOrFetchContext(uiState);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear entire cache
      manager.clearCache();

      // Second call - should fetch from server again
      mockFetch.mockClear();
      await manager.getOrFetchContext(uiState);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should provide cache statistics', () => {
      const stats = manager.getCacheStats();

      expect(stats).toMatchObject({
        size: expect.any(Number),
        maxSize: expect.any(Number),
        hitRate: expect.any(Number),
        oldestEntry: expect.any(Number),
        memoryUsage: expect.stringMatching(/~\d+KB/)
      });
    });
  });

  describe('Memory Management', () => {
    it('should enforce cache size limits', async () => {
      // Create a test manager with smaller cache size
      const testManager = new (class extends PassiveFIDManager {
        protected readonly MAX_CACHE_SIZE = 2;
      })();

      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            frame: { systemRules: 'test' },
            index: { projectSummaries: [] },
            details: { contentChunks: [] },
            type: 'complete'
          },
          timestamp: Date.now()
        })
      } as Response;

      mockFetch.mockResolvedValue(mockResponse);

      // Fill cache beyond limit with different cache keys
      for (let i = 0; i < 5; i++) {
        const uiState: UIState = {
          breadcrumbPath: `route-${i}`,
          visibleAnchors: [`anchor-${i}`], // Different anchors to ensure different cache keys
          currentRoute: `route-${i}`
        };
        await testManager.getOrFetchContext(uiState);
      }

      const stats = testManager.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);

      testManager.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home'
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const context = await manager.getOrFetchContext(uiState);

      // Should return minimal fallback context
      expect(context).toMatchObject({
        frame: {
          portfolioOwner: 'Portfolio Owner',
          currentCapabilities: ['navigation', 'basic-information']
        },
        index: {
          route: 'home',
          availableProjects: []
        },
        details: {
          intentBasedContent: []
        }
      });
    });

    it('should handle malformed server responses', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Invalid request'
        })
      } as Response);

      const context = await manager.getOrFetchContext(uiState);

      // Should return minimal fallback context
      expect(context.frame.portfolioOwner).toBe('Portfolio Owner');
      expect(context.index.availableProjects).toEqual([]);
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should cleanup resources on destroy', () => {
      const stats = manager.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);

      manager.destroy();

      const statsAfterDestroy = manager.getCacheStats();
      expect(statsAfterDestroy.size).toBe(0);
    });
  });
});