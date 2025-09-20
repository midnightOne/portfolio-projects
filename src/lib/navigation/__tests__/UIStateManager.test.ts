/**
 * UIManager State Management Tests
 * 
 * Tests for the consolidated UI state tracking system with background updates.
 * Tests the state management functionality that was consolidated from UIStateManager.
 */

import { UIManager } from '../UIManager';

// Mock DOM environment
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  href: 'http://localhost:3000/'
};

const mockWindow = {
  location: mockLocation,
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

describe('UIManager State Management', () => {
  let uiManager: UIManager;
  let mockBackgroundCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset window mock for each test
    (global as any).window = mockWindow;
    
    // Reset UIManager singleton for testing
    (UIManager as any).instance = null;
    
    uiManager = UIManager.getInstance();
    
    // Set test location for UIManager
    uiManager.setTestLocation(mockLocation);
    
    mockBackgroundCallback = jest.fn();
    
    // Override debounce timing for tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (uiManager && typeof uiManager.destroy === 'function') {
      uiManager.destroy();
    }
    jest.useRealTimers();
  });

  describe('Breadcrumb Path Generation', () => {
    it('should generate correct breadcrumb path for home page', () => {
      mockWindow.location.pathname = '/';
      mockWindow.location.search = '';
      mockWindow.location.hash = '';

      const state = uiManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('home');
    });

    it('should generate correct breadcrumb path for projects page with project modal', () => {
      // Update the mock location object directly
      mockLocation.pathname = '/projects';
      mockLocation.search = '?project=test-project';
      mockLocation.hash = '';

      const state = uiManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('projects.project:test-project');
    });

    it('should generate correct breadcrumb path with section hash', () => {
      mockLocation.pathname = '/projects';
      mockLocation.search = '?project=test-project';
      mockLocation.hash = '#technical-details';

      const state = uiManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('projects.project:test-project.section:technical-details');
    });

    it('should generate correct breadcrumb path with tab parameter', () => {
      mockLocation.pathname = '/projects';
      mockLocation.search = '?project=test-project&tab=overview';
      mockLocation.hash = '';

      const state = uiManager.getCurrentUIState();
      expect(state.breadcrumbPath).toBe('projects.project:test-project.tab:overview');
    });
  });

  describe('Background Updates', () => {
    it('should initialize with background update callback', () => {
      uiManager.initialize(mockBackgroundCallback);
      
      expect(mockIntersectionObserver).toHaveBeenCalled();
      expect(mockMutationObserver).toHaveBeenCalled();
    });

    it('should call background update callback on navigation state change', () => {
      uiManager.initialize(mockBackgroundCallback);
      
      // Simulate navigation change
      uiManager.updateNavigationState('home.projects.new-project');
      
      expect(mockBackgroundCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui_state_update',
          breadcrumbPath: 'home.projects.new-project',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should call background update callback on filter state change', () => {
      uiManager.initialize(mockBackgroundCallback);
      
      // Update filter state (this is debounced)
      uiManager.updateFilterState({
        searchTerm: 'react',
        tags: ['frontend', 'javascript']
      });
      
      // Fast-forward time to trigger debounce (5 seconds)
      jest.advanceTimersByTime(5000);
      
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
    });
  });

  describe('State Serialization', () => {
    it('should serialize state for server context', () => {
      mockLocation.pathname = '/projects';
      mockLocation.search = '?project=test-project';
      mockLocation.hash = '#implementation';

      const serialized = uiManager.serializeForServerContext();
      
      expect(serialized).toEqual({
        breadcrumbPath: 'projects.project:test-project.section:implementation',
        visibleAnchors: [],
        activeFilters: undefined,
        lastUserAction: undefined
      });
    });

    it('should include filter state in serialization', () => {
      uiManager.updateFilterState({
        searchTerm: 'typescript',
        techStack: ['react', 'nextjs']
      });

      // Fast-forward time to trigger debounce (5 seconds)
      jest.advanceTimersByTime(5000);

      const serialized = uiManager.serializeForServerContext();
      
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
      
      uiManager.initialize(mockBackgroundCallback);
      
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
      
      uiManager.initialize(mockBackgroundCallback);
      uiManager.destroy();
      
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('should clear background update callback on destroy', () => {
      uiManager.initialize(mockBackgroundCallback);
      uiManager.destroy();
      
      // Verify callback is cleared by checking internal state
      expect(uiManager['_backgroundUpdateCallback']).toBeNull();
    });
  });

  describe('Debouncing', () => {
    it('should debounce scroll updates', () => {
      uiManager.initialize(mockBackgroundCallback);
      
      // Simulate multiple rapid scroll updates
      const mockAnchors = ['section-1', 'section-2'];
      
      // Call the debounced function multiple times rapidly
      for (let i = 0; i < 5; i++) {
        uiManager['_debouncedScrollUpdate'](mockAnchors);
      }
      
      // Fast-forward time to trigger debounce (10 seconds)
      jest.advanceTimersByTime(10000);
      
      // Should only call callback once after debounce period
      expect(mockBackgroundCallback).toHaveBeenCalledTimes(1);
    });

    it('should debounce filter updates', () => {
      uiManager.initialize(mockBackgroundCallback);
      
      // Simulate multiple rapid filter updates
      const filters = { searchTerm: 'test' };
      
      for (let i = 0; i < 3; i++) {
        uiManager.updateFilterState(filters);
      }
      
      // Fast-forward time to trigger debounce (5 seconds)
      jest.advanceTimersByTime(5000);
      
      // Should only call callback once after debounce period
      expect(mockBackgroundCallback).toHaveBeenCalledTimes(1);
    });
  });
});