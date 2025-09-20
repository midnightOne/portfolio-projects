/**
 * NavigationOrchestrator Tests
 * 
 * Tests for declarative navigation system functionality
 */

import { NavigationOrchestrator, UIIntentParams } from '../NavigationOrchestrator';

// Mock the UIStateManager
jest.mock('../UIStateManager', () => ({
  uiStateManager: {
    getCurrentUIState: jest.fn(() => ({
      breadcrumbPath: 'home',
      visibleAnchors: [],
      activeFilters: undefined,
      lastUserAction: undefined
    }))
  }
}));

// Mock the debug event emitter
jest.mock('@/lib/debug/debugEventEmitter', () => ({
  debugEventEmitter: {
    emit: jest.fn()
  }
}));

describe('NavigationOrchestrator', () => {
  let orchestrator: NavigationOrchestrator;

  // Mock window and document for browser environment
  const mockWindow = {
    location: {
      href: 'http://localhost:3000/',
      pathname: '/',
      search: '',
      hash: ''
    },
    history: {
      pushState: jest.fn(),
      replaceState: jest.fn()
    },
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };

  const mockDocument = {
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    getElementById: jest.fn(),
    body: {
      addEventListener: jest.fn()
    }
  };

  beforeEach(() => {
    // Setup window and document mocks
    (global as any).window = mockWindow;
    (global as any).document = mockDocument;
    
    orchestrator = NavigationOrchestrator.getInstance();
    orchestrator.initialize();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset window location
    mockWindow.location.pathname = '/';
    mockWindow.location.search = '';
    mockWindow.location.hash = '';
  });

  afterEach(() => {
    orchestrator.destroy();
  });

  describe('executeIntent', () => {
    it('should handle section navigation intent', async () => {
      // Mock element found
      const mockElement = {
        scrollIntoView: jest.fn()
      };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'about' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      });
    });

    it('should handle project navigation intent', async () => {
      // Set current location to projects page
      mockWindow.location.pathname = '/projects';

      const intent: UIIntentParams = {
        target: { type: 'project', id: 'test-project' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(mockWindow.history.pushState).toHaveBeenCalled();
      expect(mockWindow.dispatchEvent).toHaveBeenCalled();
    });

    it('should handle element navigation intent', async () => {
      // Mock element found
      const mockElement = {
        scrollIntoView: jest.fn(),
        focus: jest.fn()
      };
      mockDocument.getElementById.mockReturnValue(mockElement);

      const intent: UIIntentParams = {
        target: { type: 'element', id: 'test-element' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(mockElement.scrollIntoView).toHaveBeenCalled();
      expect(mockElement.focus).toHaveBeenCalled();
    });

    it('should support idempotency', async () => {
      const intent: UIIntentParams = {
        target: { type: 'section', id: 'about' },
        idempotencyKey: 'test-key-123'
      };

      // Mock element found
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      // First execution
      const result1 = await orchestrator.executeIntent(intent);
      expect(result1.success).toBe(true);

      // Second execution with same key should return cached result
      const result2 = await orchestrator.executeIntent(intent);
      expect(result2.success).toBe(true);
      expect(result2).toEqual(result1);

      // scrollIntoView should only be called once due to idempotency
      expect(mockElement.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('should handle navigation errors gracefully', async () => {
      // Mock element not found
      mockDocument.querySelector.mockReturnValue(null);

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'nonexistent' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });

    it('should respect custom behavior options', async () => {
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'about' },
        behavior: {
          scrollBehavior: 'instant',
          waitForReadyMs: 500
        }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'center'
      });
    });
  });

  describe('describeUI', () => {
    it('should describe current UI state', async () => {
      // Mock some sections
      const mockSections = [
        { id: 'hero', querySelector: () => ({ textContent: 'Hero Section' }) },
        { id: 'about', querySelector: () => ({ textContent: 'About Section' }) }
      ];
      mockDocument.querySelectorAll.mockReturnValue(mockSections);

      const description = await orchestrator.describeUI();

      expect(description.route).toBe('home');
      expect(description.viewStack).toContain('home');
      expect(description.transitions).toBeDefined();
      expect(typeof description.epoch).toBe('number');
    });

    it('should detect project modal state', async () => {
      // Set location to projects page with project parameter
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=test-project';

      const description = await orchestrator.describeUI();

      expect(description.route).toBe('projects');
      expect(description.viewStack).toContain('projectModal:test-project');
    });

    it('should increment epoch on state changes', async () => {
      const description1 = await orchestrator.describeUI();
      const description2 = await orchestrator.describeUI();

      expect(description2.epoch).toBeGreaterThan(description1.epoch);
    });
  });

  describe('navigation planning', () => {
    it('should skip navigation when already at target route', async () => {
      // Already on home page
      mockWindow.location.pathname = '/';

      const intent: UIIntentParams = {
        target: { type: 'route', id: 'home' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(result.executedSteps).not.toContain('navigate_to_home');
    });

    it('should create navigation plan for project intent', async () => {
      // Not on projects page
      mockWindow.location.pathname = '/';

      const intent: UIIntentParams = {
        target: { type: 'project', id: 'test-project' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(result.executedSteps.length).toBeGreaterThan(0);
    });
  });
});