/**
 * Enhanced NavigationOrchestrator Tests
 * 
 * Tests for robust state management, interruption handling, and configurable timing
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
jest.mock('../../debug/debugEventEmitter', () => ({
  debugEventEmitter: {
    emit: jest.fn()
  }
}));

describe('NavigationOrchestrator Enhanced Features', () => {
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
    },
    addEventListener: jest.fn(),
    hidden: false
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

  describe('Configuration Management', () => {
    it('should allow timing configuration', () => {
      const customTiming = {
        modalOpenDuration: 500,
        modalCloseDuration: 400,
        scrollDuration: 1000
      };

      orchestrator.configureTiming(customTiming);
      const config = orchestrator.getTimingConfig();

      expect(config.modalOpenDuration).toBe(500);
      expect(config.modalCloseDuration).toBe(400);
      expect(config.scrollDuration).toBe(1000);
      // Should preserve other defaults
      expect(config.stepTimeoutMs).toBe(8000);
    });

    it('should provide navigation state information', () => {
      const state = orchestrator.getNavigationState();
      
      expect(state.isExecuting).toBe(false);
      expect(state.canBeInterrupted).toBe(true);
      expect(state.currentPlanId).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should track execution state correctly', async () => {
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'about' }
      };

      // Check initial state
      expect(orchestrator.canAcceptNewRequest()).toBe(true);
      expect(orchestrator.getNavigationState().isExecuting).toBe(false);

      // Start navigation (don't await to check intermediate state)
      const navigationPromise = orchestrator.executeIntent(intent);

      // Small delay to let execution start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check executing state
      const executingState = orchestrator.getNavigationState();
      expect(executingState.isExecuting).toBe(true);
      expect(executingState.currentPlanId).toBeTruthy();

      // Wait for completion
      const result = await navigationPromise;

      // Check final state
      expect(result.success).toBe(true);
      expect(orchestrator.getNavigationState().isExecuting).toBe(false);
    });

    it('should handle interruption requests', async () => {
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      // Start a long-running navigation
      const intent1: UIIntentParams = {
        target: { type: 'section', id: 'about' },
        behavior: { waitForReadyMs: 5000 } // Long wait
      };

      const navigationPromise = orchestrator.executeIntent(intent1);

      // Small delay to let execution start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Request interruption
      const intent2: UIIntentParams = {
        target: { type: 'section', id: 'contact' }
      };

      const canInterrupt = await orchestrator.requestInterruption(intent2, false);
      expect(canInterrupt).toBe(true);

      // Wait for original navigation to complete/be interrupted
      const result = await navigationPromise;
      
      // Should either complete or be interrupted
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle non-interruptible navigation', async () => {
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'about' },
        behavior: { allowInterruption: false }
      };

      const navigationPromise = orchestrator.executeIntent(intent);

      // Small delay to let execution start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to interrupt
      const intent2: UIIntentParams = {
        target: { type: 'section', id: 'contact' }
      };

      const canInterrupt = await orchestrator.requestInterruption(intent2, false);
      
      // Should not be able to interrupt
      expect(canInterrupt).toBe(false);

      await navigationPromise;
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle step failures gracefully', async () => {
      // Mock element not found
      mockDocument.querySelector.mockReturnValue(null);

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'nonexistent' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      
      // State should be reset after failure
      expect(orchestrator.getNavigationState().isExecuting).toBe(false);
      expect(orchestrator.canAcceptNewRequest()).toBe(true);
    });

    it('should retry failed steps with exponential backoff', async () => {
      let attemptCount = 0;
      const mockElement = {
        scrollIntoView: jest.fn(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary failure');
          }
        })
      };
      mockDocument.querySelector.mockReturnValue(mockElement);

      // Configure faster retries for testing
      orchestrator.configureTiming({
        retryDelayBase: 10, // Very fast for testing
        maxRetries: 3
      });

      const intent: UIIntentParams = {
        target: { type: 'section', id: 'about' }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3); // Should have retried
      expect(mockElement.scrollIntoView).toHaveBeenCalledTimes(3);
    });
  });

  describe('Complex Navigation Scenarios', () => {
    it('should handle project modal switching with proper timing', async () => {
      // Currently viewing Project A modal
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=project-a';

      // Mock URL constructor
      const mockURL = {
        searchParams: {
          get: jest.fn(() => 'project-a'),
          set: jest.fn(),
          delete: jest.fn()
        },
        toString: jest.fn(() => 'http://localhost:3000/projects?project=project-b')
      };
      (global as any).URL = jest.fn(() => mockURL);

      const intent: UIIntentParams = {
        target: { type: 'project', id: 'project-b' },
        behavior: { closeBlocking: true }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(result.executedSteps.length).toBeGreaterThan(0);
      
      // Should have used proper timing for modal transitions
      expect(mockWindow.history.pushState).toHaveBeenCalled();
    });

    it('should handle section navigation within different project', async () => {
      // Currently viewing Project A modal
      mockWindow.location.pathname = '/projects';
      mockWindow.location.search = '?project=project-a';

      // Mock element found for section scrolling
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const intent: UIIntentParams = {
        target: { 
          type: 'section', 
          id: 'technical-details', 
          projectId: 'project-b' 
        },
        behavior: { closeBlocking: true }
      };

      const result = await orchestrator.executeIntent(intent);

      expect(result.success).toBe(true);
      expect(result.executedSteps.length).toBeGreaterThan(2); // Should have multiple steps
      expect(mockElement.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid successive navigation requests', async () => {
      const mockElement = { scrollIntoView: jest.fn() };
      mockDocument.querySelector.mockReturnValue(mockElement);

      // Fire multiple navigation requests rapidly
      const intents = [
        { target: { type: 'section', id: 'about' } },
        { target: { type: 'section', id: 'contact' } },
        { target: { type: 'section', id: 'projects' } }
      ] as UIIntentParams[];

      const results = await Promise.allSettled(
        intents.map(intent => orchestrator.executeIntent(intent))
      );

      // At least one should succeed
      const successfulResults = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      );
      expect(successfulResults.length).toBeGreaterThan(0);

      // Final state should be stable
      expect(orchestrator.getNavigationState().isExecuting).toBe(false);
      expect(orchestrator.canAcceptNewRequest()).toBe(true);
    });

    it('should cleanup resources properly on destroy', () => {
      const initialState = orchestrator.getNavigationState();
      expect(initialState.isExecuting).toBe(false);

      orchestrator.destroy();

      const finalState = orchestrator.getNavigationState();
      expect(finalState.isExecuting).toBe(false);
      expect(finalState.currentPlanId).toBeNull();
    });
  });
});