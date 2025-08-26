/**
 * Custom Animation System Tests
 * 
 * Tests for the plugin architecture, iPad-style grid animations,
 * animation composition, and runtime variant selection.
 */

import { JSDOM } from 'jsdom';
import {
  registerCustomAnimationPlugin,
  unregisterCustomAnimationPlugin,
  executeCustomAnimation,
  composeCustomAnimations,
  setAnimationVariant,
  getAvailableAnimations,
  getAvailablePlugins,
  executeIPadGridAnimation,
  resetIPadGrid,
  createComposedEffect,
  getAnimationDebugInfo,
  type AnimationPlugin,
  type CustomAnimationOptions,
} from '../custom-animations';

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
    globalTimeline: { timeScale: jest.fn() },
    killTweensOf: jest.fn(),
  },
}));

describe('Custom Animation System', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  let mockTimeline: ReturnType<typeof createMockTimeline>;

  beforeEach(() => {
    // Create fresh mock timeline for each test
    mockTimeline = createMockTimeline();
    
    // Set up DOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="grid-container">
            <div class="project-card">Project 1</div>
            <div class="project-card">Project 2</div>
            <div class="project-card">Project 3</div>
            <div class="project-card">Project 4</div>
          </div>
          <div class="composition-target">Composition Target</div>
          <div class="slide-target">Slide Target 1</div>
          <div class="slide-target">Slide Target 2</div>
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
    } as any;

    // Mock matchMedia
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })) as any;

    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
  });

  afterEach(() => {
    jest.clearAllMocks();
    dom.window.close();
  });

  describe('Plugin Architecture', () => {
    it('should register and unregister custom animation plugins', () => {
      const testPlugin: AnimationPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        animations: {
          'test-animation': {
            name: 'Test Animation',
            duration: 0.5,
            create: jest.fn(() => mockTimeline),
          },
        },
        register: jest.fn(),
        unregister: jest.fn(),
      };

      // Register plugin
      registerCustomAnimationPlugin(testPlugin);
      
      expect(testPlugin.register).toHaveBeenCalled();
      expect(getAvailablePlugins()).toContain('test-plugin');
      expect(getAvailableAnimations()).toContain('test-animation');

      // Unregister plugin
      unregisterCustomAnimationPlugin('test-plugin');
      
      expect(testPlugin.unregister).toHaveBeenCalled();
      expect(getAvailablePlugins()).not.toContain('test-plugin');
      expect(getAvailableAnimations()).not.toContain('test-animation');
    });

    it('should handle plugin dependencies', () => {
      const dependentPlugin: AnimationPlugin = {
        name: 'dependent-plugin',
        version: '1.0.0',
        dependencies: ['non-existent-plugin'],
        animations: {},
        register: jest.fn(),
        unregister: jest.fn(),
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      registerCustomAnimationPlugin(dependentPlugin);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin dependency not found: non-existent-plugin')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('iPad-Style Grid Animation', () => {
    it('should execute iPad grid selection animation', () => {
      const container = document.querySelector('.grid-container') as Element;
      
      const timeline = executeIPadGridAnimation(container, 1, {
        intensity: 'medium',
        variant: 'dramatic',
      });

      expect(timeline).toBeTruthy();
      expect(mockTimeline.to).toHaveBeenCalled();
    });

    it('should reset iPad grid to original positions', () => {
      const container = document.querySelector('.grid-container') as Element;
      
      const timeline = resetIPadGrid(container);

      expect(timeline).toBeTruthy();
      expect(mockTimeline.to).toHaveBeenCalled();
    });

    it('should handle different animation variants', () => {
      const container = document.querySelector('.grid-container') as Element;
      
      // Test subtle variant
      executeIPadGridAnimation(container, 0, { variant: 'subtle' });
      expect(mockTimeline.to).toHaveBeenCalled();

      // Test dramatic variant
      executeIPadGridAnimation(container, 0, { variant: 'dramatic' });
      expect(mockTimeline.to).toHaveBeenCalled();

      // Test directional variant
      executeIPadGridAnimation(container, 0, { variant: 'directional' });
      expect(mockTimeline.to).toHaveBeenCalled();
    });

    it('should handle different intensity levels', () => {
      const container = document.querySelector('.grid-container') as Element;
      
      ['subtle', 'medium', 'strong'].forEach(intensity => {
        executeIPadGridAnimation(container, 0, { 
          intensity: intensity as 'subtle' | 'medium' | 'strong' 
        });
        expect(mockTimeline.to).toHaveBeenCalled();
      });
    });
  });

  describe('Animation Composition', () => {
    it('should compose multiple animations together', () => {
      const target = document.querySelector('.composition-target') as Element;
      
      const timeline = composeCustomAnimations(
        ['particle-burst', 'ripple-effect'],
        target,
        {
          composition: {
            combine: ['particle-burst', 'ripple-effect'],
            sequence: 'parallel',
            blend: 'add',
          },
        }
      );

      expect(timeline).toBeTruthy();
    });

    it('should create composed effects with convenience function', () => {
      const target = document.querySelector('.composition-target') as Element;
      
      const timeline = createComposedEffect(
        target,
        ['particle-burst', 'glow-pulse'],
        { intensity: 'medium' }
      );

      expect(timeline).toBeTruthy();
    });

    it('should handle different composition sequences', () => {
      const target = document.querySelector('.composition-target') as Element;
      
      // Test parallel composition
      composeCustomAnimations(['particle-burst', 'ripple-effect'], target, {
        composition: { combine: ['particle-burst', 'ripple-effect'], sequence: 'parallel' },
      });

      // Test sequential composition
      composeCustomAnimations(['particle-burst', 'ripple-effect'], target, {
        composition: { combine: ['particle-burst', 'ripple-effect'], sequence: 'sequential' },
      });

      // Test staggered composition
      composeCustomAnimations(['particle-burst', 'ripple-effect'], target, {
        composition: { combine: ['particle-burst', 'ripple-effect'], sequence: 'staggered' },
      });

      expect(mockTimeline.add).toHaveBeenCalled();
    });
  });

  describe('Runtime Variant Selection', () => {
    it('should set and use animation variants', () => {
      // Set variant
      setAnimationVariant('ipad-grid-select', 'dramatic');
      
      const container = document.querySelector('.grid-container') as Element;
      executeCustomAnimation('ipad-grid-select', container, { selectedIndex: 0 });

      expect(mockTimeline.to).toHaveBeenCalled();
    });

    it('should override variants at execution time', () => {
      // Set default variant
      setAnimationVariant('ipad-grid-select', 'subtle');
      
      const container = document.querySelector('.grid-container') as Element;
      
      // Override with different variant
      executeCustomAnimation('ipad-grid-select', container, {
        selectedIndex: 0,
        variant: 'dramatic', // Override
      });

      expect(mockTimeline.to).toHaveBeenCalled();
    });
  });

  describe('Configuration System', () => {
    it('should handle different animation directions', () => {
      const container = document.querySelector('.grid-container') as Element;
      
      ['up', 'down', 'left', 'right', 'center', 'random'].forEach(direction => {
        executeIPadGridAnimation(container, 0, {
          direction: direction as any,
        });
        expect(mockTimeline.to).toHaveBeenCalled();
      });
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      window.matchMedia = jest.fn(() => ({
        matches: true, // Prefers reduced motion
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })) as any;

      const target = document.querySelector('.composition-target') as Element;
      
      const timeline = executeCustomAnimation('particle-burst', target, {
        respectReducedMotion: true,
      });

      expect(timeline).toBeTruthy();
      expect(mockTimeline.set).toHaveBeenCalled(); // Should use instant state change
    });

    it('should handle stagger configuration', () => {
      const elements = document.querySelectorAll('.slide-target');
      
      executeCustomAnimation('slide-transition', Array.from(elements), {
        stagger: 0.2,
      });

      expect(mockTimeline.to).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle missing animation gracefully', () => {
      const target = document.querySelector('.composition-target') as Element;
      
      const timeline = executeCustomAnimation('non-existent-animation', target);
      
      expect(timeline).toBeNull();
    });

    it('should use fallback animations on error', () => {
      const errorPlugin: AnimationPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        animations: {
          'error-animation': {
            name: 'Error Animation',
            duration: 0.5,
            create: jest.fn(() => {
              throw new Error('Animation failed');
            }),
            fallback: jest.fn(() => mockTimeline),
          },
        },
        register: jest.fn(),
        unregister: jest.fn(),
      };

      registerCustomAnimationPlugin(errorPlugin);
      
      const target = document.querySelector('.composition-target') as Element;
      const timeline = executeCustomAnimation('error-animation', target, {
        fallbackOnError: true,
      });

      expect(timeline).toBeTruthy();
      expect(errorPlugin.animations['error-animation'].fallback).toHaveBeenCalled();
    });
  });

  describe('Performance and Debug Features', () => {
    it('should provide debug information', () => {
      const debugInfo = getAnimationDebugInfo();
      
      expect(debugInfo).toHaveProperty('plugins');
      expect(debugInfo).toHaveProperty('animations');
      expect(debugInfo).toHaveProperty('activeVariants');
      expect(debugInfo).toHaveProperty('performance');
      
      expect(Array.isArray(debugInfo.plugins)).toBe(true);
      expect(Array.isArray(debugInfo.animations)).toBe(true);
      expect(typeof debugInfo.performance.registeredCount).toBe('number');
    });

    it('should track animation execution count', () => {
      const initialDebugInfo = getAnimationDebugInfo();
      const initialCount = initialDebugInfo.performance.executionCount;
      
      const target = document.querySelector('.composition-target') as Element;
      executeCustomAnimation('particle-burst', target);
      
      const updatedDebugInfo = getAnimationDebugInfo();
      expect(updatedDebugInfo.performance.executionCount).toBe(initialCount + 1);
    });

    it('should list available animations and plugins', () => {
      const animations = getAvailableAnimations();
      const plugins = getAvailablePlugins();
      
      expect(Array.isArray(animations)).toBe(true);
      expect(Array.isArray(plugins)).toBe(true);
      
      // Should include built-in animations
      expect(animations).toContain('ipad-grid-select');
      expect(animations).toContain('particle-burst');
      expect(animations).toContain('slide-transition');
      
      // Should include built-in plugins
      expect(plugins).toContain('ipad-grid');
      expect(plugins).toContain('composition-effects');
      expect(plugins).toContain('transition-effects');
    });
  });

  describe('Built-in Plugins', () => {
    it('should have iPad Grid plugin with correct animations', () => {
      const animations = getAvailableAnimations();
      
      expect(animations).toContain('ipad-grid-select');
      expect(animations).toContain('ipad-grid-reset');
    });

    it('should have Composition Effects plugin with correct animations', () => {
      const animations = getAvailableAnimations();
      
      expect(animations).toContain('particle-burst');
      expect(animations).toContain('ripple-effect');
      expect(animations).toContain('glow-pulse');
    });

    it('should have Transition Effects plugin with correct animations', () => {
      const animations = getAvailableAnimations();
      
      expect(animations).toContain('slide-transition');
      expect(animations).toContain('fade-scale');
    });
  });
});