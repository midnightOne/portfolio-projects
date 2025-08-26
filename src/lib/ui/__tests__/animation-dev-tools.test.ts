/**
 * Animation Development Tools Tests
 * 
 * Tests for animation preview, debugging, performance monitoring,
 * and conflict management systems.
 */

import { JSDOM } from 'jsdom';
import {
  AnimationDevTools,
  type AnimationPreviewOptions,
  type AnimationPerformanceMetrics,
  type AnimationTestResult,
} from '../animation-dev-tools';

// Mock GSAP
const createMockTimeline = () => ({
  to: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  fromTo: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  add: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  eventCallback: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnValue(0.7),
  progress: jest.fn().mockReturnValue(0),
  isActive: jest.fn().mockReturnValue(false),
  getChildren: jest.fn().mockReturnValue([]),
  kill: jest.fn().mockReturnThis(),
  play: jest.fn().mockReturnThis(),
  pause: jest.fn().mockReturnThis(),
  resume: jest.fn().mockReturnThis(),
  restart: jest.fn().mockReturnThis(),
  timeScale: jest.fn().mockReturnThis(),
  repeat: jest.fn().mockReturnThis(),
});

jest.mock('gsap', () => ({
  gsap: {
    timeline: jest.fn(() => createMockTimeline()),
    to: jest.fn(() => createMockTimeline()),
    from: jest.fn(() => createMockTimeline()),
    fromTo: jest.fn(() => createMockTimeline()),
    set: jest.fn(() => createMockTimeline()),
    registerPlugin: jest.fn(),
    config: jest.fn(),
    defaults: jest.fn(),
    globalTimeline: { 
      timeScale: jest.fn(),
      getChildren: jest.fn().mockReturnValue([]),
    },
    killTweensOf: jest.fn(),
  },
}));

// Mock custom animations
jest.mock('../custom-animations', () => ({
  executeCustomAnimation: jest.fn(() => createMockTimeline()),
  composeCustomAnimations: jest.fn(() => createMockTimeline()),
  getAvailableAnimations: jest.fn(() => ['ipad-grid-select', 'particle-burst', 'slide-transition']),
  getAvailablePlugins: jest.fn(() => ['ipad-grid', 'composition-effects', 'transition-effects']),
  getAnimationDebugInfo: jest.fn(() => ({
    plugins: ['ipad-grid', 'composition-effects'],
    animations: ['ipad-grid-select', 'particle-burst'],
    activeVariants: {},
    performance: {
      registeredCount: 2,
      executionCount: 0,
      errorCount: 0,
    },
  })),
}));

describe('Animation Development Tools', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  let testElement: HTMLElement;

  beforeEach(() => {
    // Use fake timers
    jest.useFakeTimers();
    
    // Set up DOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-element" style="width: 100px; height: 100px; background: red;">Test Element</div>
          <div class="grid-container">
            <div class="project-card">Item 1</div>
            <div class="project-card">Item 2</div>
            <div class="project-card">Item 3</div>
            <div class="project-card">Item 4</div>
          </div>
        </body>
      </html>
    `);
    
    document = dom.window.document;
    window = dom.window as unknown as Window;
    
    // Set up global objects
    global.document = document;
    global.window = window;
    (global as any).globalThis = global;

    // Mock performance API
    global.performance = {
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1024 * 1024, // 1MB
      },
    } as any;

    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));

    // Mock URL and Blob for export functionality
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn(),
    } as any;

    global.Blob = jest.fn() as any;

    testElement = document.getElementById('test-element') as HTMLElement;

    // Mock process.env for development mode
    process.env.NODE_ENV = 'development';
    
    // Initialize global dev tools
    (global as any).__uiAnimationDevTools = AnimationDevTools;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    dom.window.close();
    
    // Clean up any preview containers
    AnimationDevTools.closePreview();
    AnimationDevTools.clearPerformanceMetrics();
    AnimationDevTools.clearTestResults();
    AnimationDevTools.clearDebugSessions();
  });

  describe('Animation Preview System', () => {
    it('should handle preview animation calls', async () => {
      const previewOptions: AnimationPreviewOptions = {
        target: testElement,
        animationName: 'particle-burst',
        options: {
          intensity: 'medium',
        },
        loop: false,
        speed: 1,
        showBounds: true,
        showTimeline: true,
      };

      // The preview function should not throw
      await expect(AnimationDevTools.previewAnimation(previewOptions)).resolves.not.toThrow();
    });

    it('should handle preview with different options', async () => {
      const previewOptions: AnimationPreviewOptions = {
        target: testElement,
        animationName: 'ipad-grid-select',
        options: {
          selectedIndex: 1,
          variant: 'dramatic',
        },
        loop: true,
        speed: 2,
        showBounds: false,
        showTimeline: false,
      };

      await expect(AnimationDevTools.previewAnimation(previewOptions)).resolves.not.toThrow();
    });

    it('should close preview properly', async () => {
      await AnimationDevTools.previewAnimation({
        target: testElement,
        animationName: 'particle-burst',
      });

      // Close should not throw
      expect(() => AnimationDevTools.closePreview()).not.toThrow();
    });

    it('should handle preview errors gracefully', async () => {
      // Mock executeCustomAnimation to throw an error
      const { executeCustomAnimation } = require('../custom-animations');
      executeCustomAnimation.mockImplementationOnce(() => {
        throw new Error('Animation failed');
      });

      // Should handle errors gracefully
      await expect(AnimationDevTools.previewAnimation({
        target: testElement,
        animationName: 'invalid-animation',
      })).resolves.not.toThrow();
    });
  });

  describe('Performance Monitoring System', () => {
    it('should start and stop performance monitoring', () => {
      AnimationDevTools.startPerformanceMonitoring();
      
      // Simulate some time passing
      jest.advanceTimersByTime(1000);
      
      const metrics = AnimationDevTools.stopPerformanceMonitoring();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.fps).toBe('number');
      expect(typeof metrics.frameTime).toBe('number');
      expect(typeof metrics.animationCount).toBe('number');
      expect(Array.isArray(metrics.recommendations)).toBe(true);
    });

    it('should generate performance recommendations', () => {
      AnimationDevTools.startPerformanceMonitoring();
      
      // Simulate poor performance
      jest.advanceTimersByTime(2000);
      
      const metrics = AnimationDevTools.stopPerformanceMonitoring();
      
      expect(metrics.recommendations.length).toBeGreaterThan(0);
      expect(typeof metrics.recommendations[0]).toBe('string');
    });

    it('should track memory usage when available', () => {
      // Ensure memory API is available
      global.performance = {
        ...global.performance,
        memory: {
          usedJSHeapSize: 1024 * 1024, // 1MB
        },
      } as any;
      
      AnimationDevTools.startPerformanceMonitoring();
      
      // Simulate memory increase
      (global.performance as any).memory.usedJSHeapSize = 2 * 1024 * 1024; // 2MB
      
      const metrics = AnimationDevTools.stopPerformanceMonitoring();
      
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.peakMemoryUsage).toBeDefined();
    });

    it('should maintain performance history', () => {
      // Run multiple monitoring sessions
      for (let i = 0; i < 3; i++) {
        AnimationDevTools.startPerformanceMonitoring();
        jest.advanceTimersByTime(500);
        AnimationDevTools.stopPerformanceMonitoring();
      }

      const history = AnimationDevTools.getPerformanceHistory();
      expect(history.length).toBe(3);
      
      AnimationDevTools.clearPerformanceMetrics();
      
      const clearedHistory = AnimationDevTools.getPerformanceHistory();
      expect(clearedHistory.length).toBe(0);
    });
  });

  describe('Animation Testing System', () => {
    it('should test individual animations', async () => {
      const result = await AnimationDevTools.testAnimation(
        'particle-burst',
        testElement,
        { intensity: 'medium' }
      );

      expect(result).toBeDefined();
      expect(result.animationName).toBe('particle-burst');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.performance).toBeDefined();
      expect(result.coverage).toBeDefined();
    });

    it('should run full test suite', async () => {
      const results = await AnimationDevTools.runFullTestSuite();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result.animationName).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should handle test failures gracefully', async () => {
      // Mock executeCustomAnimation to fail
      const { executeCustomAnimation } = require('../custom-animations');
      executeCustomAnimation.mockImplementationOnce(() => {
        throw new Error('Test animation failed');
      });

      const result = await AnimationDevTools.testAnimation(
        'failing-animation',
        testElement
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Test animation failed');
    });

    it('should generate test reports', async () => {
      // Run a few tests
      await AnimationDevTools.testAnimation('particle-burst', testElement);
      await AnimationDevTools.testAnimation('slide-transition', testElement);

      const report = AnimationDevTools.generateTestReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('Animation Test Report');
      expect(report).toContain('Total Tests:');
      expect(report).toContain('Success Rate:');
    });

    it('should clear test results', async () => {
      await AnimationDevTools.testAnimation('particle-burst', testElement);
      
      let results = AnimationDevTools.getTestResults();
      expect(results.length).toBeGreaterThan(0);

      AnimationDevTools.clearTestResults();
      
      results = AnimationDevTools.getTestResults();
      expect(results.length).toBe(0);
    });
  });

  describe('Debug Session Management', () => {
    it('should create and manage debug sessions', () => {
      const sessionId = AnimationDevTools.startDebugSession('test-session');
      
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toContain('test-session');

      const session = AnimationDevTools.getDebugSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.isActive).toBe(true);

      const endedSession = AnimationDevTools.endDebugSession(sessionId);
      expect(endedSession?.isActive).toBe(false);
    });

    it('should track multiple debug sessions', () => {
      const session1 = AnimationDevTools.startDebugSession('session-1');
      const session2 = AnimationDevTools.startDebugSession('session-2');

      const allSessions = AnimationDevTools.getAllDebugSessions();
      expect(allSessions.length).toBe(2);
      
      const sessionIds = allSessions.map(s => s.id);
      expect(sessionIds).toContain(session1);
      expect(sessionIds).toContain(session2);
    });

    it('should export debug sessions', () => {
      const sessionId = AnimationDevTools.startDebugSession('export-test');
      
      const exportData = AnimationDevTools.exportDebugSession(sessionId);
      
      expect(typeof exportData).toBe('string');
      
      const parsedData = JSON.parse(exportData);
      expect(parsedData.id).toBe(sessionId);
      expect(parsedData.animations).toBeDefined();
      expect(parsedData.performance).toBeDefined();
      expect(parsedData.conflicts).toBeDefined();
    });

    it('should handle export of non-existent session', () => {
      expect(() => {
        AnimationDevTools.exportDebugSession('non-existent-session');
      }).toThrow('Session non-existent-session not found');
    });

    it('should clear all debug sessions', () => {
      AnimationDevTools.startDebugSession('session-1');
      AnimationDevTools.startDebugSession('session-2');

      let sessions = AnimationDevTools.getAllDebugSessions();
      expect(sessions.length).toBe(2);

      AnimationDevTools.clearDebugSessions();

      sessions = AnimationDevTools.getAllDebugSessions();
      expect(sessions.length).toBe(0);
    });
  });

  describe('Conflict Management System', () => {
    it('should track conflict history', () => {
      const conflicts = AnimationDevTools.getConflictHistory();
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should track active animations', () => {
      const activeAnimations = AnimationDevTools.getActiveAnimations();
      expect(activeAnimations instanceof Map).toBe(true);
    });

    it('should clear conflict history', () => {
      AnimationDevTools.clearConflictHistory();
      
      const conflicts = AnimationDevTools.getConflictHistory();
      expect(conflicts.length).toBe(0);
      
      const activeAnimations = AnimationDevTools.getActiveAnimations();
      expect(activeAnimations.size).toBe(0);
    });
  });

  describe('System Information', () => {
    it('should provide comprehensive system information', () => {
      const systemInfo = AnimationDevTools.getSystemInfo();

      expect(systemInfo).toBeDefined();
      expect(systemInfo.plugins).toBeDefined();
      expect(systemInfo.animations).toBeDefined();
      expect(systemInfo.performance).toBeDefined();
      expect(systemInfo.availableAnimations).toBeDefined();
      expect(systemInfo.availablePlugins).toBeDefined();
      expect(systemInfo.browserSupport).toBeDefined();

      // Check browser support detection
      expect(typeof systemInfo.browserSupport.gsap).toBe('boolean');
      expect(typeof systemInfo.browserSupport.performance).toBe('boolean');
      expect(typeof systemInfo.browserSupport.memory).toBe('boolean');
      expect(typeof systemInfo.browserSupport.requestAnimationFrame).toBe('boolean');
    });
  });

  describe('Integration with Custom Animation System', () => {
    it('should integrate with existing animation system', () => {
      const { getAvailableAnimations, getAvailablePlugins } = require('../custom-animations');
      
      const systemInfo = AnimationDevTools.getSystemInfo();
      
      expect(systemInfo.availableAnimations).toEqual(getAvailableAnimations());
      expect(systemInfo.availablePlugins).toEqual(getAvailablePlugins());
    });

    it('should handle animation execution through dev tools', async () => {
      const { executeCustomAnimation } = require('../custom-animations');
      
      await AnimationDevTools.previewAnimation({
        target: testElement,
        animationName: 'particle-burst',
        options: { intensity: 'medium' },
      });

      expect(executeCustomAnimation).toHaveBeenCalledWith(
        'particle-burst',
        expect.any(HTMLElement),
        expect.objectContaining({ intensity: 'medium' })
      );
    });
  });

  describe('Development Mode Integration', () => {
    it('should initialize global dev tools in development mode', () => {
      // The dev tools should be available globally in development
      expect((globalThis as any).__uiAnimationDevTools).toBeDefined();
      expect((globalThis as any).__uiAnimationDevTools).toBe(AnimationDevTools);
    });

    it('should provide all expected API methods', () => {
      const devTools = AnimationDevTools;

      // Preview System
      expect(typeof devTools.previewAnimation).toBe('function');
      expect(typeof devTools.closePreview).toBe('function');

      // Performance Monitoring
      expect(typeof devTools.startPerformanceMonitoring).toBe('function');
      expect(typeof devTools.stopPerformanceMonitoring).toBe('function');
      expect(typeof devTools.getPerformanceHistory).toBe('function');
      expect(typeof devTools.clearPerformanceMetrics).toBe('function');

      // Testing System
      expect(typeof devTools.testAnimation).toBe('function');
      expect(typeof devTools.runFullTestSuite).toBe('function');
      expect(typeof devTools.getTestResults).toBe('function');
      expect(typeof devTools.generateTestReport).toBe('function');
      expect(typeof devTools.clearTestResults).toBe('function');

      // Debug Sessions
      expect(typeof devTools.startDebugSession).toBe('function');
      expect(typeof devTools.endDebugSession).toBe('function');
      expect(typeof devTools.getDebugSession).toBe('function');
      expect(typeof devTools.getAllDebugSessions).toBe('function');
      expect(typeof devTools.exportDebugSession).toBe('function');
      expect(typeof devTools.clearDebugSessions).toBe('function');

      // Conflict Management
      expect(typeof devTools.getConflictHistory).toBe('function');
      expect(typeof devTools.getActiveAnimations).toBe('function');
      expect(typeof devTools.clearConflictHistory).toBe('function');

      // Utility Functions
      expect(typeof devTools.getSystemInfo).toBe('function');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing DOM elements gracefully', async () => {
      const nonExistentElement = document.createElement('div');
      nonExistentElement.textContent = 'Non-existent element';
      
      await expect(AnimationDevTools.previewAnimation({
        target: nonExistentElement,
        animationName: 'particle-burst',
      })).resolves.not.toThrow();
    });

    it('should handle performance monitoring without memory API', () => {
      // Create performance object without memory API
      const originalPerformance = global.performance;
      global.performance = {
        now: jest.fn(() => Date.now()),
      } as any;

      AnimationDevTools.startPerformanceMonitoring();
      const metrics = AnimationDevTools.stopPerformanceMonitoring();

      expect(metrics.memoryUsage).toBeUndefined();
      expect(metrics.peakMemoryUsage).toBeUndefined();
      
      // Restore original performance
      global.performance = originalPerformance;
    });

    it('should handle test failures without crashing', async () => {
      const { executeCustomAnimation } = require('../custom-animations');
      executeCustomAnimation.mockImplementation(() => null);

      const result = await AnimationDevTools.testAnimation(
        'null-animation',
        testElement
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});