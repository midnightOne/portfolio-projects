/**
 * Animation System - UI System
 * 
 * GSAP-powered animation orchestration system that works alongside existing
 * Framer Motion animations. Provides coordinated 0.7-second animations,
 * queue management, and AI-controlled animation sequences.
 */

'use client';

import { gsap } from 'gsap';
import type { 
  AnimationCommand, 
  AnimationOptions, 
  HighlightOptions,
  UseAnimationReturn 
} from './types';

// Animation queue management
class AnimationQueue {
  private queue: AnimationCommand[] = [];
  private current: { id: string; timeline: any } | null = null;
  private isPlaying = false;

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

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const command = this.queue.shift()!;
    
    try {
      const timeline = await this.executeCommand(command);
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

  private async executeCommand(command: AnimationCommand): Promise<any> {
    const timeline = gsap.timeline();
    
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

  private createNavigationAnimation(timeline: any, command: AnimationCommand): any {
    const target = document.querySelector(command.target);
    if (!target) {
      console.warn(`Navigation target not found: ${command.target}`);
      return timeline;
    }

    // Smooth scroll to target
    timeline.to(window, {
      duration: command.duration,
      scrollTo: { y: target, offsetY: 100 },
      ease: command.options.easing || 'power2.out',
      onStart: command.options.onStart,
      onComplete: command.options.onComplete,
    });

    return timeline;
  }

  private createHighlightAnimation(timeline: any, command: AnimationCommand): any {
    const target = document.querySelector(command.target);
    if (!target) {
      console.warn(`Highlight target not found: ${command.target}`);
      return timeline;
    }

    const highlightOptions = command.options as any as HighlightOptions;
    
    switch (highlightOptions.type) {
      case 'spotlight':
        timeline.to(target, {
          duration: 0.3,
          boxShadow: '0 0 0 4px var(--ui-highlight-spotlight)',
          backgroundColor: 'var(--ui-highlight-spotlight)',
          ease: 'power2.out',
        });
        break;
        
      case 'outline':
        timeline.to(target, {
          duration: 0.3,
          outline: '2px solid var(--ui-highlight-outline)',
          outlineOffset: '4px',
          ease: 'power2.out',
        });
        break;
        
      case 'glow':
        timeline.to(target, {
          duration: 0.3,
          filter: 'drop-shadow(0 0 8px var(--ui-highlight-glow))',
          ease: 'power2.out',
        });
        break;
        
      case 'color':
        timeline.to(target, {
          duration: 0.3,
          backgroundColor: 'var(--ui-highlight-spotlight)',
          ease: 'power2.out',
        });
        break;
    }

    // Auto-remove highlight if timed
    if (highlightOptions.duration === 'timed' && highlightOptions.timing) {
      timeline.to(target, {
        duration: 0.3,
        boxShadow: 'none',
        backgroundColor: 'transparent',
        outline: 'none',
        filter: 'none',
        ease: 'power2.out',
        delay: highlightOptions.timing,
      });
    }

    return timeline;
  }

  private createModalAnimation(timeline: any, command: AnimationCommand): any {
    const target = document.querySelector(command.target);
    if (!target) {
      console.warn(`Modal target not found: ${command.target}`);
      return timeline;
    }

    // Coordinated modal animation (0.7s)
    const duration = 0.7;
    
    // Project card growth
    timeline.to(target, {
      duration,
      scale: 1.2,
      zIndex: 100,
      ease: 'power2.out',
    }, 0);

    // Background blur
    const background = document.body;
    timeline.to(background, {
      duration,
      backdropFilter: 'blur(8px)',
      ease: 'power2.out',
    }, 0);

    // Modal appearance
    const modal = document.querySelector('[data-modal]');
    if (modal) {
      timeline.fromTo(modal, {
        opacity: 0,
        scale: 0.8,
      }, {
        duration,
        opacity: 1,
        scale: 1,
        ease: 'power2.out',
      }, 0);
    }

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
    if (this.current) {
      this.current.timeline.kill();
      this.current = null;
    }
    this.isPlaying = false;
  }

  pause(): void {
    if (this.current) {
      this.current.timeline.pause();
    }
  }

  resume(): void {
    if (this.current) {
      this.current.timeline.resume();
    }
  }

  getQueue(): AnimationCommand[] {
    return [...this.queue];
  }

  isAnimating(): boolean {
    return this.isPlaying;
  }
}

// Global animation queue instance
const globalAnimationQueue = new AnimationQueue();

// Animation system initialization
export function initializeAnimationSystem(): void {
  // Configure GSAP defaults
  gsap.defaults({
    duration: 0.7,
    ease: 'power2.out',
  });

  // Register ScrollTo plugin if available
  if (typeof window !== 'undefined') {
    try {
      // Try to import and register ScrollToPlugin
      import('gsap/ScrollToPlugin').then(({ ScrollToPlugin }) => {
        gsap.registerPlugin(ScrollToPlugin);
      }).catch(() => {
        console.warn('GSAP ScrollToPlugin not available');
      });
    } catch (error) {
      console.warn('GSAP ScrollToPlugin import failed:', error);
    }
  }

  // Respect reduced motion preferences
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.globalTimeline.timeScale(0.01); // Nearly instant animations
  }
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

export function executeHighlight(
  target: string,
  options: HighlightOptions
): Promise<void> {
  const command: AnimationCommand = {
    id: `highlight-${Date.now()}`,
    type: 'highlight',
    target,
    duration: 0.3,
    options: options as any,
    priority: 'normal',
  };

  globalAnimationQueue.add(command);
  
  return new Promise((resolve) => {
    // Resolve after highlight animation duration
    setTimeout(resolve, 300);
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

// Project modal specific animation
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

    const timeline = gsap.timeline({
      onComplete: resolve,
    });

    const duration = 0.7;

    // Coordinated animations
    timeline
      .to(card, {
        duration,
        scale: 1.2,
        zIndex: 100,
        ease: 'power2.out',
      }, 0)
      .to(document.body, {
        duration,
        backdropFilter: 'blur(8px)',
        ease: 'power2.out',
      }, 0)
      .fromTo(modal, {
        opacity: 0,
        scale: 0.8,
      }, {
        duration,
        opacity: 1,
        scale: 1,
        ease: 'power2.out',
      }, 0);
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

// Performance monitoring
export function getAnimationPerformance(): {
  fps: number;
  frameTime: number;
  skipAnimations: boolean;
} {
  // Basic performance monitoring
  const fps = Math.round(1000 / (performance.now() - (globalThis as any).__lastFrameTime || 16));
  const frameTime = performance.now() - (globalThis as any).__lastFrameTime || 16;
  const skipAnimations = fps < 30; // Skip animations if FPS is too low

  (globalThis as any).__lastFrameTime = performance.now();

  return {
    fps,
    frameTime,
    skipAnimations,
  };
}

// Initialize animation system on import
if (typeof window !== 'undefined') {
  initializeAnimationSystem();
  
  // Register animation system globally for theme coordination
  (globalThis as any).__uiAnimationSystem = {
    isAnimating: () => globalAnimationQueue.isAnimating(),
    pauseAnimations: () => globalAnimationQueue.pause(),
    resumeAnimations: () => globalAnimationQueue.resume(),
    onThemeChange: (theme: 'light' | 'dark') => {
      // Update animation colors based on theme
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      // Update GSAP defaults with new theme colors
      gsap.defaults({
        duration: 0.7,
        ease: 'power2.out',
      });
      
      console.log(`Animation system updated for ${theme} theme`);
    },
  };
}