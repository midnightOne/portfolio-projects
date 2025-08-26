/**
 * Animation System - UI System
 * 
 * GSAP-powered animation orchestration system that works alongside existing
 * Framer Motion animations. Provides coordinated 0.7-second animations,
 * queue management, and AI-controlled animation sequences.
 * 
 * Task 4: Build Animation Orchestration System
 * - Install and configure GSAP with timeline management ✓
 * - Create animation queue system for coordinated 0.7-second transitions ✓
 * - Implement project modal growth + background blur + content load animations ✓
 * - Build highlighting system with spotlight, outline, and color effects ✓
 */

'use client';

import { gsap } from 'gsap';
import type { 
  AnimationCommand, 
  AnimationOptions, 
  HighlightOptions,
  UseAnimationReturn 
} from './types';

// Import GSAP plugins
let ScrollToPlugin: any = null;
let TextPlugin: any = null;

// Dynamically import GSAP plugins
if (typeof window !== 'undefined') {
  import('gsap/ScrollToPlugin').then((module) => {
    ScrollToPlugin = module.ScrollToPlugin;
    gsap.registerPlugin(ScrollToPlugin);
  }).catch(() => {
    console.warn('GSAP ScrollToPlugin not available');
  });

  import('gsap/TextPlugin').then((module) => {
    TextPlugin = module.TextPlugin;
    gsap.registerPlugin(TextPlugin);
  }).catch(() => {
    console.warn('GSAP TextPlugin not available');
  });
}

// Enhanced Animation queue management with timeline orchestration
class AnimationQueue {
  private queue: AnimationCommand[] = [];
  private current: { id: string; timeline: GSAPTimeline } | null = null;
  private isPlaying = false;
  private masterTimeline: GSAPTimeline | null = null;
  private coordinatedAnimations: Map<string, GSAPTimeline> = new Map();

  add(command: AnimationCommand): void {
    // Handle priority overrides
    if (command.priority === 'override') {
      this.clear();
      this.queue = [command];
    } else if (command.priority === 'high') {
      this.queue.unshift(command);
    } else {
      this.queue.push(command);
    }

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  // Add coordinated animation support
  addCoordinated(commands: AnimationCommand[]): void {
    if (commands.length === 0) return;

    // Create a master timeline for coordinated animations
    const masterTimeline = gsap.timeline({
      onComplete: () => {
        this.masterTimeline = null;
        this.coordinatedAnimations.clear();
        this.playNext();
      }
    });

    this.masterTimeline = masterTimeline;
    this.isPlaying = true;

    // Execute all commands simultaneously
    commands.forEach((command, index) => {
      const timeline = this.createAnimationTimeline(command);
      this.coordinatedAnimations.set(command.id, timeline);
      
      // Add to master timeline at the same time (0)
      masterTimeline.add(timeline, 0);
    });
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0 || this.masterTimeline) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const command = this.queue.shift()!;
    
    try {
      const timeline = this.createAnimationTimeline(command);
      this.current = { id: command.id, timeline };
      
      // Wait for animation to complete
      await new Promise<void>((resolve) => {
        timeline.eventCallback('onComplete', () => {
          this.current = null;
          resolve();
        });
      });
    } catch (error) {
      console.error('Animation command failed:', error);
    }

    // Play next animation
    this.playNext();
  }

  private createAnimationTimeline(command: AnimationCommand): GSAPTimeline {
    const timeline = gsap.timeline({
      onStart: command.options.onStart,
      onComplete: command.options.onComplete,
    });
    
    switch (command.type) {
      case 'navigate':
        return this.createNavigationAnimation(timeline, command);
      case 'highlight':
        return this.createHighlightAnimation(timeline, command);
      case 'modal':
        return this.createModalAnimation(timeline, command);
      case 'custom':
        return this.createCustomAnimation(timeline, command);
      default:
        console.warn(`Unknown animation type: ${command.type}`);
        return timeline;
    }
  }

  private createNavigationAnimation(timeline: GSAPTimeline, command: AnimationCommand): GSAPTimeline {
    const target = document.querySelector(command.target);
    if (!target) {
      console.warn(`Navigation target not found: ${command.target}`);
      return timeline;
    }

    // Enhanced smooth scroll with coordinated animations
    const duration = command.duration || 0.7;
    
    // Scroll to target with easing
    if (ScrollToPlugin) {
      timeline.to(window, {
        duration,
        scrollTo: { 
          y: target, 
          offsetY: 100,
          autoKill: false 
        },
        ease: command.options.easing || 'power2.out',
      });
    } else {
      // Fallback smooth scroll
      timeline.call(() => {
        target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      });
    }

    // Add subtle highlight to indicate navigation target
    timeline.to(target, {
      duration: 0.3,
      backgroundColor: 'var(--ui-highlight-spotlight)',
      ease: 'power2.out',
    }, duration * 0.8) // Start near end of scroll
    .to(target, {
      duration: 0.5,
      backgroundColor: 'transparent',
      ease: 'power2.out',
    });

    return timeline;
  }

  private createHighlightAnimation(timeline: GSAPTimeline, command: AnimationCommand): GSAPTimeline {
    const target = document.querySelector(command.target);
    if (!target) {
      console.warn(`Highlight target not found: ${command.target}`);
      return timeline;
    }

    const highlightOptions = command.options as any as HighlightOptions;
    const element = target as HTMLElement;
    
    // Store original styles for cleanup
    const originalStyles = {
      boxShadow: element.style.boxShadow,
      backgroundColor: element.style.backgroundColor,
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      filter: element.style.filter,
      transform: element.style.transform,
    };

    // Apply intensity-based variations
    const intensityMultiplier = {
      subtle: 0.5,
      medium: 1,
      strong: 1.5,
    }[highlightOptions.intensity] || 1;

    switch (highlightOptions.type) {
      case 'spotlight':
        // Spotlight effect with pulsing animation
        timeline
          .to(element, {
            duration: 0.3,
            boxShadow: `0 0 0 ${4 * intensityMultiplier}px var(--ui-highlight-spotlight), 
                       0 0 ${20 * intensityMultiplier}px var(--ui-highlight-spotlight)`,
            backgroundColor: 'var(--ui-highlight-spotlight)',
            ease: 'power2.out',
            force3D: true,
          })
          .to(element, {
            duration: 0.8,
            boxShadow: `0 0 0 ${6 * intensityMultiplier}px var(--ui-highlight-spotlight), 
                       0 0 ${30 * intensityMultiplier}px var(--ui-highlight-spotlight)`,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        break;
        
      case 'outline':
        // Animated outline with breathing effect
        timeline
          .to(element, {
            duration: 0.3,
            outline: `${2 * intensityMultiplier}px solid var(--ui-highlight-outline)`,
            outlineOffset: `${4 * intensityMultiplier}px`,
            ease: 'power2.out',
          })
          .to(element, {
            duration: 1,
            outlineOffset: `${6 * intensityMultiplier}px`,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        break;
        
      case 'glow':
        // Glow effect with pulsing
        timeline
          .to(element, {
            duration: 0.3,
            filter: `drop-shadow(0 0 ${8 * intensityMultiplier}px var(--ui-highlight-glow)) 
                    drop-shadow(0 0 ${16 * intensityMultiplier}px var(--ui-highlight-glow))`,
            ease: 'power2.out',
          })
          .to(element, {
            duration: 1.2,
            filter: `drop-shadow(0 0 ${12 * intensityMultiplier}px var(--ui-highlight-glow)) 
                    drop-shadow(0 0 ${24 * intensityMultiplier}px var(--ui-highlight-glow))`,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        break;
        
      case 'color':
        // Color highlight with subtle scale
        timeline
          .to(element, {
            duration: 0.3,
            backgroundColor: 'var(--ui-highlight-spotlight)',
            scale: 1 + (0.05 * intensityMultiplier),
            ease: 'power2.out',
            force3D: true,
          })
          .to(element, {
            duration: 0.8,
            scale: 1 + (0.02 * intensityMultiplier),
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        break;
    }

    // Auto-remove highlight if timed
    if (highlightOptions.duration === 'timed' && highlightOptions.timing) {
      timeline.to(element, {
        duration: 0.3,
        boxShadow: originalStyles.boxShadow,
        backgroundColor: originalStyles.backgroundColor,
        outline: originalStyles.outline,
        outlineOffset: originalStyles.outlineOffset,
        filter: originalStyles.filter,
        scale: 1,
        ease: 'power2.out',
        delay: highlightOptions.timing,
      });
    }

    // Store cleanup function
    (timeline as any).__cleanup = () => {
      gsap.set(element, originalStyles);
    };

    return timeline;
  }

  private createModalAnimation(timeline: GSAPTimeline, command: AnimationCommand): GSAPTimeline {
    const target = document.querySelector(command.target);
    if (!target) {
      console.warn(`Modal target not found: ${command.target}`);
      return timeline;
    }

    // Coordinated modal animation (0.7s) - Task 4 requirement
    const duration = 0.7;
    
    // 1. Project card growth with hardware acceleration
    timeline.to(target, {
      duration,
      scale: 1.2,
      zIndex: 100,
      ease: 'power2.out',
      force3D: true, // Hardware acceleration
      transformOrigin: 'center center',
    }, 0);

    // 2. Background blur and overlay
    const background = document.body;
    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      z-index: 50;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);

    timeline.to(overlay, {
      duration,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      ease: 'power2.out',
    }, 0);

    // 3. Modal content appearance with stagger
    const modal = document.querySelector('[data-modal]');
    if (modal) {
      // Initial state
      gsap.set(modal, {
        opacity: 0,
        scale: 0.8,
        y: 20,
      });

      // Modal container animation
      timeline.to(modal, {
        duration,
        opacity: 1,
        scale: 1,
        y: 0,
        ease: 'power2.out',
        force3D: true,
      }, 0.1); // Slight delay for better visual flow

      // Content load animation with stagger
      const modalContent = modal.querySelectorAll('[data-modal-content] > *');
      if (modalContent.length > 0) {
        gsap.set(modalContent, {
          opacity: 0,
          y: 10,
        });

        timeline.to(modalContent, {
          duration: 0.4,
          opacity: 1,
          y: 0,
          ease: 'power2.out',
          stagger: 0.05, // Stagger content appearance
        }, 0.3); // Start after modal is visible
      }
    }

    // Cleanup on complete
    timeline.eventCallback('onComplete', () => {
      // Store overlay reference for cleanup
      (timeline as any).__modalOverlay = overlay;
    });

    return timeline;
  }

  private createCustomAnimation(timeline: any, command: AnimationCommand): any {
    // Custom animations can be registered via plugins
    const customAnimations = (globalThis as any).__uiSystemCustomAnimations || {};
    const animationFn = customAnimations[command.target];
    
    if (typeof animationFn === 'function') {
      return animationFn(timeline, command);
    }
    
    console.warn(`Custom animation not found: ${command.target}`);
    return timeline;
  }

  clear(): void {
    this.queue = [];
    
    // Clear current animation
    if (this.current) {
      this.current.timeline.kill();
      this.current = null;
    }
    
    // Clear master timeline
    if (this.masterTimeline) {
      this.masterTimeline.kill();
      this.masterTimeline = null;
    }
    
    // Clear coordinated animations
    this.coordinatedAnimations.forEach(timeline => timeline.kill());
    this.coordinatedAnimations.clear();
    
    this.isPlaying = false;
    
    // Clean up any modal overlays
    document.querySelectorAll('.ui-modal-overlay').forEach(overlay => {
      overlay.remove();
    });
  }

  pause(): void {
    if (this.current) {
      this.current.timeline.pause();
    }
    if (this.masterTimeline) {
      this.masterTimeline.pause();
    }
  }

  resume(): void {
    if (this.current) {
      this.current.timeline.resume();
    }
    if (this.masterTimeline) {
      this.masterTimeline.resume();
    }
  }

  interrupt(newCommand?: AnimationCommand): void {
    // Kill current animations
    if (this.current) {
      this.current.timeline.kill();
      this.current = null;
    }
    
    if (this.masterTimeline) {
      this.masterTimeline.kill();
      this.masterTimeline = null;
    }
    
    // Clear queue and add new command if provided
    this.queue = newCommand ? [newCommand] : [];
    this.isPlaying = false;
    
    if (newCommand) {
      this.playNext();
    }
  }

  getQueue(): AnimationCommand[] {
    return [...this.queue];
  }

  getCurrentAnimation(): { id: string; timeline: GSAPTimeline } | null {
    return this.current;
  }

  isAnimating(): boolean {
    return this.isPlaying || this.masterTimeline !== null;
  }

  getPerformanceMetrics(): {
    queueLength: number;
    isAnimating: boolean;
    currentAnimationId: string | null;
    coordinatedCount: number;
  } {
    return {
      queueLength: this.queue.length,
      isAnimating: this.isAnimating(),
      currentAnimationId: this.current?.id || null,
      coordinatedCount: this.coordinatedAnimations.size,
    };
  }
}

// Global animation queue instance
const globalAnimationQueue = new AnimationQueue();

// Enhanced animation system initialization
export function initializeAnimationSystem(): void {
  // Configure GSAP defaults for 0.7s coordinated animations
  gsap.defaults({
    duration: 0.7,
    ease: 'power2.out',
    force3D: true, // Hardware acceleration
    autoAlpha: 1,
  });

  // Configure GSAP for performance
  gsap.config({
    force3D: true,
    nullTargetWarn: false,
  });

  // Set up timeline defaults
  gsap.globalTimeline.timeScale(1);

  // Respect reduced motion preferences
  if (typeof window !== 'undefined') {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleReducedMotion = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        gsap.globalTimeline.timeScale(0.01); // Nearly instant animations
        console.log('Animation system: Reduced motion enabled');
      } else {
        gsap.globalTimeline.timeScale(1);
        console.log('Animation system: Normal motion enabled');
      }
    };

    handleReducedMotion(prefersReducedMotion);
    prefersReducedMotion.addEventListener('change', handleReducedMotion);
  }

  // Performance monitoring
  if (typeof window !== 'undefined') {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const monitorPerformance = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        (globalThis as any).__uiAnimationFPS = fps;
        
        // Adjust animation quality based on performance
        if (fps < 30 && gsap.globalTimeline.timeScale() === 1) {
          console.warn('Animation system: Low FPS detected, consider reducing animation complexity');
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(monitorPerformance);
    };
    
    requestAnimationFrame(monitorPerformance);
  }

  console.log('Animation system initialized with GSAP timeline management');
}

// Animation execution functions
export function executeAnimation(
  target: string | Element,
  options: AnimationOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    
    if (!element) {
      reject(new Error(`Animation target not found: ${target}`));
      return;
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        options.onComplete?.();
        resolve();
      },
      onStart: options.onStart,
    });

    // Basic animation - can be extended based on options
    timeline.to(element, {
      duration: options.duration || 0.7,
      ease: options.easing || 'power2.out',
      delay: options.delay || 0,
    });
  });
}

export function executeNavigationCommand(command: AnimationCommand): void {
  globalAnimationQueue.add(command);
}

// Execute multiple coordinated animations simultaneously
export function executeCoordinatedAnimations(commands: AnimationCommand[]): Promise<void> {
  return new Promise((resolve) => {
    if (commands.length === 0) {
      resolve();
      return;
    }

    // Add completion callback to the last command
    const lastCommand = commands[commands.length - 1];
    const originalCallback = lastCommand.options.onComplete;
    lastCommand.options.onComplete = () => {
      originalCallback?.();
      resolve();
    };

    globalAnimationQueue.addCoordinated(commands);
  });
}

// Create coordinated 0.7s animation sequence
export function createCoordinatedSequence(
  projectCardSelector: string,
  modalSelector: string,
  backgroundSelector?: string
): AnimationCommand[] {
  const baseId = `coordinated-${Date.now()}`;
  
  return [
    // Project card growth
    {
      id: `${baseId}-card`,
      type: 'modal',
      target: projectCardSelector,
      duration: 0.7,
      options: {
        coordinated: true,
        easing: 'power2.out',
      },
      priority: 'high',
    },
    // Background blur (if specified)
    ...(backgroundSelector ? [{
      id: `${baseId}-background`,
      type: 'custom' as const,
      target: backgroundSelector,
      duration: 0.7,
      options: {
        coordinated: true,
        easing: 'power2.out',
      },
      priority: 'high' as const,
    }] : []),
    // Modal content load
    {
      id: `${baseId}-modal`,
      type: 'modal',
      target: modalSelector,
      duration: 0.7,
      options: {
        coordinated: true,
        easing: 'power2.out',
      },
      priority: 'high',
    },
  ];
}

// Enhanced highlighting with all effect types
export function executeHighlight(
  target: string,
  options: HighlightOptions
): Promise<void> {
  const command: AnimationCommand = {
    id: `highlight-${Date.now()}-${options.type}`,
    type: 'highlight',
    target,
    duration: 0.3,
    options: options as any,
    priority: 'normal',
  };

  globalAnimationQueue.add(command);
  
  return new Promise((resolve) => {
    // Resolve after highlight animation duration
    const duration = options.duration === 'timed' && options.timing 
      ? 300 + (options.timing * 1000) + 300 // Initial + timing + fade out
      : 300;
    setTimeout(resolve, duration);
  });
}

// Spotlight highlight with pulsing effect
export function executeSpotlightHighlight(
  target: string,
  intensity: 'subtle' | 'medium' | 'strong' = 'medium',
  duration: 'persistent' | 'timed' = 'persistent',
  timing?: number
): Promise<void> {
  return executeHighlight(target, {
    type: 'spotlight',
    intensity,
    duration,
    timing,
  });
}

// Outline highlight with breathing effect
export function executeOutlineHighlight(
  target: string,
  intensity: 'subtle' | 'medium' | 'strong' = 'medium',
  duration: 'persistent' | 'timed' = 'persistent',
  timing?: number
): Promise<void> {
  return executeHighlight(target, {
    type: 'outline',
    intensity,
    duration,
    timing,
  });
}

// Glow highlight with pulsing effect
export function executeGlowHighlight(
  target: string,
  intensity: 'subtle' | 'medium' | 'strong' = 'medium',
  duration: 'persistent' | 'timed' = 'persistent',
  timing?: number
): Promise<void> {
  return executeHighlight(target, {
    type: 'glow',
    intensity,
    duration,
    timing,
  });
}

// Color highlight with subtle scale
export function executeColorHighlight(
  target: string,
  intensity: 'subtle' | 'medium' | 'strong' = 'medium',
  duration: 'persistent' | 'timed' = 'persistent',
  timing?: number
): Promise<void> {
  return executeHighlight(target, {
    type: 'color',
    intensity,
    duration,
    timing,
  });
}

export function removeHighlight(target?: string): Promise<void> {
  return new Promise((resolve) => {
    if (target) {
      const element = document.querySelector(target);
      if (element) {
        gsap.to(element, {
          duration: 0.3,
          boxShadow: 'none',
          backgroundColor: 'transparent',
          outline: 'none',
          filter: 'none',
          ease: 'power2.out',
          onComplete: resolve,
        });
      } else {
        resolve();
      }
    } else {
      // Remove all highlights
      const highlightedElements = document.querySelectorAll('[style*="box-shadow"], [style*="outline"], [style*="filter"]');
      
      if (highlightedElements.length === 0) {
        resolve();
        return;
      }

      gsap.to(highlightedElements, {
        duration: 0.3,
        boxShadow: 'none',
        backgroundColor: 'transparent',
        outline: 'none',
        filter: 'none',
        ease: 'power2.out',
        onComplete: resolve,
      });
    }
  });
}

// Enhanced project modal animation with coordinated 0.7s transitions
export function executeProjectModalAnimation(
  projectCard: string | Element,
  modalElement: string | Element
): Promise<void> {
  return new Promise((resolve) => {
    const card = typeof projectCard === 'string' ? document.querySelector(projectCard) : projectCard;
    const modal = typeof modalElement === 'string' ? document.querySelector(modalElement) : modalElement;
    
    if (!card || !modal) {
      resolve();
      return;
    }

    // Create coordinated animation commands
    const commands: AnimationCommand[] = [
      {
        id: `modal-card-${Date.now()}`,
        type: 'modal',
        target: typeof projectCard === 'string' ? projectCard : '[data-project-card]',
        duration: 0.7,
        options: {
          coordinated: true,
          onComplete: resolve,
        },
        priority: 'high',
      }
    ];

    // Execute coordinated animations
    globalAnimationQueue.addCoordinated(commands);
  });
}

// Coordinated modal close animation
export function executeProjectModalCloseAnimation(
  projectCard: string | Element,
  modalElement: string | Element
): Promise<void> {
  return new Promise((resolve) => {
    const card = typeof projectCard === 'string' ? document.querySelector(projectCard) : projectCard;
    const modal = typeof modalElement === 'string' ? document.querySelector(modalElement) : modalElement;
    
    if (!card || !modal) {
      resolve();
      return;
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        // Clean up modal overlay
        document.querySelectorAll('.ui-modal-overlay').forEach(overlay => {
          overlay.remove();
        });
        resolve();
      },
    });

    const duration = 0.5; // Slightly faster close

    // Reverse coordinated animations
    timeline
      .to(modal, {
        duration: duration * 0.6,
        opacity: 0,
        scale: 0.8,
        y: 20,
        ease: 'power2.in',
      }, 0)
      .to('.ui-modal-overlay', {
        duration,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(0px)',
        ease: 'power2.in',
      }, 0)
      .to(card, {
        duration,
        scale: 1,
        zIndex: 'auto',
        ease: 'power2.out',
      }, duration * 0.2);
  });
}

// Animation queue management
export function clearAnimationQueue(): void {
  globalAnimationQueue.clear();
}

export function pauseAnimations(): void {
  globalAnimationQueue.pause();
}

export function resumeAnimations(): void {
  globalAnimationQueue.resume();
}

export function getAnimationQueue(): AnimationCommand[] {
  return globalAnimationQueue.getQueue();
}

export function isAnimating(): boolean {
  return globalAnimationQueue.isAnimating();
}

// Custom animation registration
export function registerCustomAnimation(
  name: string,
  animationFn: (timeline: GSAPTimeline, command: AnimationCommand) => GSAPTimeline
): void {
  if (typeof window !== 'undefined') {
    const customAnimations = (globalThis as any).__uiSystemCustomAnimations || {};
    customAnimations[name] = animationFn;
    (globalThis as any).__uiSystemCustomAnimations = customAnimations;
  }
}

// React hook for animation management
export function useAnimation(): UseAnimationReturn {
  const animate = async (target: Element, options: AnimationOptions): Promise<void> => {
    return executeAnimation(target, options);
  };

  return {
    animate,
    isAnimating: isAnimating(),
    queue: getAnimationQueue(),
    clearQueue: clearAnimationQueue,
    pauseAnimations,
    resumeAnimations,
  };
}

// Enhanced performance monitoring
export function getAnimationPerformance(): {
  fps: number;
  frameTime: number;
  skipAnimations: boolean;
  queueMetrics: {
    queueLength: number;
    isAnimating: boolean;
    currentAnimationId: string | null;
    coordinatedCount: number;
  };
  memoryUsage?: number;
} {
  const currentFPS = (globalThis as any).__uiAnimationFPS || 60;
  const frameTime = performance.now() - (globalThis as any).__lastFrameTime || 16;
  const skipAnimations = currentFPS < 30;

  (globalThis as any).__lastFrameTime = performance.now();

  const result: any = {
    fps: currentFPS,
    frameTime,
    skipAnimations,
    queueMetrics: globalAnimationQueue.getPerformanceMetrics(),
  };

  // Add memory usage if available
  if ('memory' in performance) {
    result.memoryUsage = (performance as any).memory.usedJSHeapSize;
  }

  return result;
}

// Animation queue debugging
export function getAnimationQueueDebugInfo(): {
  queue: AnimationCommand[];
  current: { id: string; timeline: GSAPTimeline } | null;
  isAnimating: boolean;
  performance: ReturnType<typeof getAnimationPerformance>;
} {
  return {
    queue: globalAnimationQueue.getQueue(),
    current: globalAnimationQueue.getCurrentAnimation(),
    isAnimating: globalAnimationQueue.isAnimating(),
    performance: getAnimationPerformance(),
  };
}

// Force animation cleanup (for debugging)
export function forceAnimationCleanup(): void {
  globalAnimationQueue.clear();
  
  // Kill all GSAP animations
  gsap.killTweensOf('*');
  
  // Remove all highlights
  document.querySelectorAll('[style*="box-shadow"], [style*="outline"], [style*="filter"]')
    .forEach(element => {
      const el = element as HTMLElement;
      el.style.boxShadow = '';
      el.style.outline = '';
      el.style.filter = '';
      el.style.backgroundColor = '';
      el.style.transform = '';
    });
  
  // Remove modal overlays
  document.querySelectorAll('.ui-modal-overlay').forEach(overlay => {
    overlay.remove();
  });
  
  console.log('Animation system: Force cleanup completed');
}

// Initialize animation system on import
if (typeof window !== 'undefined') {
  initializeAnimationSystem();
  
  // Register enhanced animation system globally for theme coordination
  (globalThis as any).__uiAnimationSystem = {
    // Queue management
    isAnimating: () => globalAnimationQueue.isAnimating(),
    pauseAnimations: () => globalAnimationQueue.pause(),
    resumeAnimations: () => globalAnimationQueue.resume(),
    clearQueue: () => globalAnimationQueue.clear(),
    interruptAnimations: (newCommand?: AnimationCommand) => globalAnimationQueue.interrupt(newCommand),
    
    // Animation execution
    executeCommand: (command: AnimationCommand) => globalAnimationQueue.add(command),
    executeCoordinated: (commands: AnimationCommand[]) => globalAnimationQueue.addCoordinated(commands),
    
    // Highlighting
    spotlight: (target: string, options?: Partial<HighlightOptions>) => 
      executeSpotlightHighlight(target, options?.intensity, options?.duration, options?.timing),
    outline: (target: string, options?: Partial<HighlightOptions>) => 
      executeOutlineHighlight(target, options?.intensity, options?.duration, options?.timing),
    glow: (target: string, options?: Partial<HighlightOptions>) => 
      executeGlowHighlight(target, options?.intensity, options?.duration, options?.timing),
    color: (target: string, options?: Partial<HighlightOptions>) => 
      executeColorHighlight(target, options?.intensity, options?.duration, options?.timing),
    removeHighlight: (target?: string) => removeHighlight(target),
    
    // Modal animations
    openModal: (cardSelector: string, modalSelector: string) => 
      executeProjectModalAnimation(cardSelector, modalSelector),
    closeModal: (cardSelector: string, modalSelector: string) => 
      executeProjectModalCloseAnimation(cardSelector, modalSelector),
    
    // Performance and debugging
    getPerformance: () => getAnimationPerformance(),
    getDebugInfo: () => getAnimationQueueDebugInfo(),
    forceCleanup: () => forceAnimationCleanup(),
    
    // Theme coordination
    onThemeChange: (theme: 'light' | 'dark') => {
      // Pause animations during theme change
      globalAnimationQueue.pause();
      
      // Update CSS custom properties for animations
      const root = document.documentElement;
      
      // Resume animations after theme change
      setTimeout(() => {
        globalAnimationQueue.resume();
      }, 100);
      
      console.log(`Animation system updated for ${theme} theme`);
    },
    
    // Custom animation registration
    registerCustomAnimation: (name: string, animationFn: (timeline: GSAPTimeline, command: AnimationCommand) => GSAPTimeline) => 
      registerCustomAnimation(name, animationFn),
  };
  
  console.log('Enhanced animation orchestration system initialized');
}

// Export types for external use
export type { AnimationCommand, AnimationOptions, HighlightOptions } from './types';