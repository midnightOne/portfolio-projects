/**
 * PassiveFIDManager Tests
 *
 * Client-side F-I-D context management. The manager builds context from the
 * unified tool chain (`/api/ai/tools/execute`: loadUserProfile,
 * searchProjects, loadProjectContext) and the semantic chunks API — the old
 * dedicated /api/ai/context/fid POST is no longer on this path, so the
 * harness routes a fetch mock by URL + toolName.
 */

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

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

function okJson(payload: unknown): Response {
  return { ok: true, json: async () => payload } as Response;
}

/** Route the manager's outbound calls; individual tests override pieces. */
function installRoutingFetch(overrides?: {
  searchProjects?: () => Response | Promise<Response>;
  profile?: () => Response | Promise<Response>;
}) {
  mockFetch.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (u.includes('/api/ai/tools/execute') && body.toolName === 'loadUserProfile') {
      return overrides?.profile
        ? overrides.profile()
        : okJson({ success: true, data: { name: 'Test Owner', bio: 'Builds things' } });
    }
    if (u.includes('/api/ai/tools/execute') && body.toolName === 'searchProjects') {
      return overrides?.searchProjects
        ? overrides.searchProjects()
        : okJson({
            success: true,
            data: {
              results: [
                {
                  id: '1',
                  slug: 'test-project',
                  title: 'Test Project',
                  description: 'A test project',
                  tags: ['test'],
                },
              ],
            },
          });
    }
    if (u.includes('/api/semantic/chunks/')) {
      return okJson({ success: true, data: { chunks: [] } });
    }
    // loadProjectContext and anything else
    return okJson({ success: true, data: {} });
  });
}

const totalCalls = () => mockFetch.mock.calls.length;

describe('PassiveFIDManager', () => {
  let manager: PassiveFIDManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (PassiveFIDManager as any).instance = null;
    manager = PassiveFIDManager.getInstance();
    mockFetch.mockReset();
    installRoutingFetch();
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

  describe('Caching', () => {
    it('should serve repeated identical states from cache (no new fetches)', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: ['section1', 'section2'],
        currentRoute: 'home',
      };

      await manager.getOrFetchContext(uiState);
      const callsAfterFirst = totalCalls();

      await manager.getOrFetchContext(uiState);
      expect(totalCalls()).toBe(callsAfterFirst);
    });

    it('should generate separate cache entries for different states', async () => {
      await manager.getOrFetchContext({
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home',
      });
      await manager.getOrFetchContext({
        breadcrumbPath: 'projects',
        visibleAnchors: [],
        currentRoute: 'projects',
      });

      expect(manager.getCacheStats().size).toBe(2);
    });
  });

  describe('Context assembly (server data)', () => {
    it('builds frame/index/details from the unified tool chain', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: ['hero'],
        currentRoute: 'home',
      };

      const context = await manager.getOrFetchContext(uiState);

      // Profile rides the loadUserProfile tool
      expect(context.frame.portfolioOwner).toContain('Test Owner');
      expect(context.frame.currentCapabilities).toEqual(
        expect.arrayContaining(['navigation', 'project-information'])
      );
      expect(context.frame.uiContext).toContain('home');

      // Homepage index rides the searchProjects tool
      expect(context.index.route).toBe('home');
      expect(context.index.visibleSections).toEqual(['hero']);
      expect(context.index.availableProjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'test-project', title: 'Test Project' }),
        ])
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/tools/execute'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('degrades to an empty project index when the tool chain errors', async () => {
      installRoutingFetch({
        searchProjects: () => ({ ok: false, status: 500, statusText: 'Internal Server Error' } as Response),
      });

      const context = await manager.getOrFetchContext({
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home',
      });

      expect(context.index.availableProjects).toEqual([]);
      expect(context.frame.portfolioOwner).toEqual(expect.any(String));
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific project', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'projects.test-project',
        visibleAnchors: [],
        currentRoute: 'projects',
        currentProject: 'test-project',
      };

      await manager.getOrFetchContext(uiState);
      const callsAfterFirst = totalCalls();

      // Second call - cache hit, no new fetches
      await manager.getOrFetchContext(uiState);
      expect(totalCalls()).toBe(callsAfterFirst);

      // Clearing the project's cache forces a re-fetch
      manager.clearCache('test-project');
      await manager.getOrFetchContext(uiState);
      expect(totalCalls()).toBeGreaterThan(callsAfterFirst);
    });

    it('should clear entire cache', async () => {
      const uiState: UIState = {
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home',
      };

      await manager.getOrFetchContext(uiState);
      expect(manager.getCacheStats().size).toBe(1);

      manager.clearCache();
      expect(manager.getCacheStats().size).toBe(0);
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
      // The constructor is private — take a fresh singleton and shrink its
      // cache bound at runtime.
      (PassiveFIDManager as any).instance = null;
      const testManager = PassiveFIDManager.getInstance();
      (testManager as any).MAX_CACHE_SIZE = 2;

      for (let i = 0; i < 5; i++) {
        await testManager.getOrFetchContext({
          breadcrumbPath: `route-${i}`,
          visibleAnchors: [`anchor-${i}`],
          currentRoute: `route-${i}`,
        });
      }

      expect(testManager.getCacheStats().size).toBeLessThanOrEqual(2);
      testManager.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should fall back to a minimal context when every fetch fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const context = await manager.getOrFetchContext({
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home',
      });

      // Profile fetch failed too → the hardcoded owner default
      expect(context.frame.portfolioOwner).toEqual(expect.any(String));
      expect(context.index.route).toBe('home');
      expect(context.index.availableProjects).toEqual([]);
      expect(context.details.intentBasedContent ?? []).toEqual([]);
    });

    it('should handle malformed server responses', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(okJson({ success: false, error: 'Invalid request' }));

      const context = await manager.getOrFetchContext({
        breadcrumbPath: 'home',
        visibleAnchors: [],
        currentRoute: 'home',
      });

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

// ---------------------------------------------------------------------------
// 7.1a — compact orientation text (the dieted publish form)
// ---------------------------------------------------------------------------

import { renderFidOrientation, FIDContext } from '../PassiveFIDManager';

describe('renderFidOrientation (7.1a diet)', () => {
  const fullContext: FIDContext = {
    frame: {
      portfolioOwner: 'Kirill Prymachov, Experienced game developer with realtime 3D expertise',
      currentCapabilities: ['navigation', 'project-information'],
      uiContext: 'viewing project modal',
    },
    index: {
      route: 'home',
      currentProject: 'verification-fixture-kiln',
      visibleSections: ['thermal-control-system', 'results'],
      availableProjects: [],
      projectSemanticItems: [
        { id: 'hash-abc123', oneLiner: 'Thermal Control System', chunkId: 'thermal-control-system', tier: 2 },
      ],
    },
    details: {
      briefSummary: 'A kiln controller project with PID loops.',
      detailedSummary: 'LONG-DETAILED-BODY '.repeat(50),
      projectSummary: 'A kiln controller project with PID loops.',
    },
  };

  it('keeps location + pull handles, drops identity/capabilities/content prose', () => {
    const text = renderFidOrientation(fullContext);
    // orientation stays
    expect(text).toContain('route "home"');
    expect(text).toContain('project OPEN: verification-fixture-kiln');
    expect(text).toContain('thermal-control-system');
    // pull handles keep DB ids + anchors (content_get / ui_intent need them)
    expect(text).toContain('hash-abc123');
    expect(text).toContain('#thermal-control-system');
    // the 7.1a drop list: bio, capabilities, summaries, raw JSON shape
    expect(text).not.toContain('Kirill Prymachov'); // identity is mint-carried (7.2c)
    expect(text).not.toContain('project-information');
    expect(text).not.toContain('LONG-DETAILED-BODY');
    expect(text).not.toContain('PID loops'); // brief summary is a pull now
    expect(text).not.toContain('"frame"');
    // and it points the model at the pull tools
    expect(text).toContain('ui_details');
    expect(text).toContain('content_search');
  });

  it('homepage renders titles+slugs only (one-liners live in the mint start frame)', () => {
    const homepage: FIDContext = {
      ...fullContext,
      index: {
        route: 'home',
        currentProject: undefined,
        visibleSections: [],
        availableProjects: [
          {
            id: '1', slug: 'kiln', title: 'Chrono Kiln', description: 'desc',
            tags: ['iot'], technologies: ['c++'], tier1Summary: 'ONE-LINER-PROSE', importance: 0.9,
          },
        ],
        projectSemanticItems: undefined,
      },
      details: {},
    };
    const text = renderFidOrientation(homepage);
    expect(text).toContain('Chrono Kiln (kiln)');
    expect(text).toContain('no project open');
    expect(text).not.toContain('ONE-LINER-PROSE');
    expect(text).not.toContain('importance');
    expect(text).not.toContain('c++'); // technologies twin array dropped
  });
});
