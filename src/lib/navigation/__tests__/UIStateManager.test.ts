/**
 * UIStateManager Tests
 * 
 * Tests for the lightweight UI state tracking system with background updates.
 */

import { UIStateManager, UIState } from '../UIStateManager';

// Mock DOM environment
const mockWindow = {
  location: {
    pathname: '/projects',
    search: '?project=test-project&tab=technical',
    hash: '#implementation',
    href: 'http://localhost:3000/projects?project=test-project&tab=technical#implementation'
  },
  addEventListener: jest.fn(),
  history: {
    pushState: jest.fn(),
    replaceState: jest.fn()
  }
};

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
});

// Mock MutationObserver
const mockMutationObserver = jest.fn();
mockMutationObserver.mockReturnValue({
  observe: jest.fn(),
  disconnect: jest.fn()
});

// Mock document
const mockDocument = {
  querySelectorAll: jest.fn().mockReturnValue([]),
  body: {}
};

// Setup global mocks
(global as any).window = mockWindow;
(global as any).IntersectionObserver = mockIntersectionObserver;
(global as any).MutationObserver = mockMutationObserver;
(global as any).document = mockDocument;

describe('UIStateManager', () => {
  let uiStateManager: UIStateManager;
  let mockBackgroundCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    uiStateManager = UIStateManager.getInstance();
    mockBackgroundCallback = jest.fn();
  });

  afterEach(() => {
    uiStateManager.destroy();
  });

  describe('Breadcrumb Path Generation', () => {
    it('should generate correct breadcrumb path for home page', () => {
      mockWindow.location.pathname = '/';
      mockWindow.location.search = '';
      mockWindow.location.hash = '';

      const state = uiStateManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('home');
    });

    it('should generate correct breadcrumb path for projects page with project modal', () => {
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=test-project';
      mockWindow.location.hash = '';

      const state = uiStateManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('projects.project:test-project');
    });

    it('should generate correct breadcrumb path with section hash', () => {
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=test-project';
      mockWindow.location.hash = '#technical-details';

      const state = uiStateManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('projects.project:test-project.section:technical-details');
    });

    it('should generate correct breadcrumb path with tab parameter', () => {
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=test-project&tab=overview';
      mockWindow.location.hash = '';

      const state = uiStateManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('projects.project:test-project.tab:overview');
    });
  });

  describe('Background Updates', () => {
    it('should initialize with background update callback', () => {
      uiStateManager.initialize(mockBackgroundCallback);
      
      expect(mockIntersectionObserver).toHaveBeenCalled();
      expect(mockMutationObserver).toHaveBeenCalled();
    });

    it('should call background update callback on navigation state change', () => {
      uiStateManager.initialize(mockBackgroundCallback);
      
      // Simulate navigation change
      uiStateManager.updateNavigationState('home.projects.new-project');
      
      expect(mockBackgroundCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui_state_update',
          breadcrumbPath: 'home.projects.new-project',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should call background update callback on filter state change', (done) => {
      uiStateManager.initialize(mockBackgroundCallback);
      
      // Update filter state (this is debounced)
      uiStateManager.updateFilterState({
        searchTerm: 'react',
        tags: ['frontend', 'javascript']
      });
      
      // Wait for debounce (5 seconds + buffer)
      setTimeout(() => {
        expect(mockBackgroundCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ui_state_update',
            activeFilters: {
              searchTerm: 'react',
              tags: ['frontend', 'javascript']
            },
            timestamp: expect.any(Number)
          })
        );
        done();
      }, 100); // Use shorter timeout for testing
    });
  });

  describe('State Serialization', () => {
    it('should serialize state for server context', () => {
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=test-project';
      mockWindow.location.hash = '#implementation';

      const serialized = uiStateManager.serializeForServerContext();
      
      expect(serialized).toEqual({
        breadcrumbPath: 'projects.project:test-project.section:implementation',
        visibleAnchors: [],
        activeFilters: undefined,
        lastUserAction: undefined
      });
    });

    it('should include filter state in serialization', () => {
      uiStateManager.updateFilterState({
        searchTerm: 'typescript',
        techStack: ['react', 'nextjs']
      });

      const serialized = uiStateManager.serializeForServerContext();
      
      expect(serialized.activeFilters).toEqual({
        searchTerm: 'typescript',
        techStack: ['react', 'nextjs']
      });
    });
  });

  describe('Visible Anchors Detection', () => {
    it('should setup intersection observer for anchor elements', () => {
      const mockElements = [
        { id: 'section-1', getBoundingClientRect: () => ({ top: 100, height: 200 }) },
        { id: 'section-2', getBoundingClientRect: () => ({ top: 400, height: 200 }) }
      ];

      mockDocument.querySelectorAll.mockReturnValue(mockElements);
      
      uiStateManager.initialize(mockBackgroundCallback);
      
      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          root: null,
          rootMargin: '-10% 0px -10% 0px',
          threshold: [0.1, 0.5, 0.9]
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const mockObserver = {
        disconnect: jest.fn(),
        observe: jest.fn(),
        unobserve: jest.fn()
      };

      mockIntersectionObserver.mockReturnValue(mockObserver);
      
      uiStateManager.initialize(mockBackgroundCallback);
      uiStateManager.destroy();
      
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('should clear background update callback on destroy', () => {
      uiStateManager.initialize(mockBackgroundCallback);
      uiStateManager.destroy();
      
      // Verify callback is cleared by checking internal state
      expect(uiStateManager['_backgroundUpdateCallback']).toBeNull();
    });
  });

  describe('Debouncing', () => {
    it('should debounce scroll updates', (done) => {
      uiStateManager.initialize(mockBackgroundCallback);
      
      // Simulate multiple rapid scroll updates
      const mockAnchors = ['section-1', 'section-2'];
      
      // Call the debounced function multiple times rapidly
      for (let i = 0; i < 5; i++) {
        uiStateManager['_debouncedScrollUpdate'](mockAnchors);
      }
      
      // Should only call callback once after debounce period
      setTimeout(() => {
        expect(mockBackgroundCallback).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });

    it('should debounce filter updates', (done) => {
      uiStateManager.initialize(mockBackgroundCallback);
      
      // Simulate multiple rapid filter updates
      const filters = { searchTerm: 'test' };
      
      for (let i = 0; i < 3; i++) {
        uiStateManager.updateFilterState(filters);
      }
      
      // Should only call callback once after debounce period
      setTimeout(() => {
        expect(mockBackgroundCallback).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });
  });
});