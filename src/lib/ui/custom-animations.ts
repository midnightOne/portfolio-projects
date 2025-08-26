/**
 * Custom Animation System - UI System
 * 
 * Plugin architecture for registering custom animation sequences.
 * Supports iPad-style grid animations, animation composition,
 * and runtime variant selection.
 * 
 * Task 7: Implement Custom Animation System
 * - Create plugin architecture for registering custom animation sequences ✓
 * - Build iPad-style grid animation where non-selected previews animate away ✓
 * - Implement animation composition for combining multiple effects ✓
 * - Add runtime animation variant selection and configuration ✓
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

'use client';

import { gsap } from 'gsap';
import type { AnimationCommand, AnimationOptions } from './types';

// Custom Animation Plugin Types
export interface AnimationPlugin {
  name: string;
  version: string;
  description?: string;
  animations: Record<string, AnimationDefinition>;
  register: () => void;
  unregister: () => void;
  dependencies?: string[];
}

export interface AnimationDefinition {
  name: string;
  description?: string;
  duration: number;
  variants?: Record<string, AnimationVariant>;
  create: (target: Element | Element[], options: CustomAnimationOptions) => GSAPTimeline;
  preview?: (target: Element | Element[], options: CustomAnimationOptions) => GSAPTimeline;
  fallback?: (target: Element | Element[], options: CustomAnimationOptions) => GSAPTimeline;
  compose?: boolean; // Can be composed with other animations
  priority?: number; // Higher priority animations override lower ones
}

export interface AnimationVariant {
  name: string;
  description?: string;
  options: Partial<CustomAnimationOptions>;
  modifyTimeline?: (timeline: GSAPTimeline, options: CustomAnimationOptions) => GSAPTimeline;
}

export interface CustomAnimationOptions extends AnimationOptions {
  variant?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
  direction?: 'up' | 'down' | 'left' | 'right' | 'center' | 'random';
  stagger?: number | { amount: number; from: number | "start" | "center" | "end" | "random" | "edges" | [number, number] };
  selectedIndex?: number; // For grid animations
  gridColumns?: number;
  gridRows?: number;
  composition?: CompositionOptions;
  fallbackOnError?: boolean;
  respectReducedMotion?: boolean;
}

export interface CompositionOptions {
  combine: string[]; // Animation names to combine
  sequence?: 'parallel' | 'sequential' | 'staggered';
  timing?: number[]; // Custom timing for sequential animations
  blend?: 'multiply' | 'add' | 'override';
}

// Animation Registry
class CustomAnimationRegistry {
  private plugins: Map<string, AnimationPlugin> = new Map();
  private animations: Map<string, AnimationDefinition> = new Map();
  private activeVariants: Map<string, string> = new Map();

  registerPlugin(plugin: AnimationPlugin): void {
    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          console.warn(`Plugin dependency not found: ${dep} for ${plugin.name}`);
        }
      }
    }

    this.plugins.set(plugin.name, plugin);

    // Register all animations from the plugin
    Object.entries(plugin.animations).forEach(([name, definition]) => {
      this.animations.set(name, definition);
    });

    plugin.register();
    console.log(`Custom animation plugin registered: ${plugin.name} v${plugin.version}`);
  }

  unregisterPlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      // Unregister animations
      Object.keys(plugin.animations).forEach(name => {
        this.animations.delete(name);
        this.activeVariants.delete(name);
      });

      plugin.unregister();
      this.plugins.delete(pluginName);
      console.log(`Custom animation plugin unregistered: ${pluginName}`);
    }
  }

  getAnimation(name: string): AnimationDefinition | undefined {
    return this.animations.get(name);
  }

  getPlugin(name: string): AnimationPlugin | undefined {
    return this.plugins.get(name);
  }

  listAnimations(): string[] {
    return Array.from(this.animations.keys());
  }

  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  setVariant(animationName: string, variantName: string): void {
    const animation = this.animations.get(animationName);
    if (animation && animation.variants && animation.variants[variantName]) {
      this.activeVariants.set(animationName, variantName);
    } else {
      console.warn(`Variant ${variantName} not found for animation ${animationName}`);
    }
  }

  getActiveVariant(animationName: string): string | undefined {
    return this.activeVariants.get(animationName);
  }

  executeAnimation(
    name: string,
    target: Element | Element[],
    options: CustomAnimationOptions = {}
  ): GSAPTimeline | null {
    const animation = this.animations.get(name);
    if (!animation) {
      console.warn(`Custom animation not found: ${name}`);
      return null;
    }

    try {
      // Apply active variant options
      const activeVariant = this.activeVariants.get(name);
      if (activeVariant && animation.variants) {
        const variant = animation.variants[activeVariant];
        options = { ...variant.options, ...options, variant: activeVariant };
      }

      // Check for reduced motion
      if (options.respectReducedMotion !== false && this.shouldReduceMotion()) {
        return this.createReducedMotionTimeline(target, options);
      }

      // Create the animation timeline
      let timeline = animation.create(target, options);

      // Apply variant modifications
      if (activeVariant && animation.variants) {
        const variant = animation.variants[activeVariant];
        if (variant.modifyTimeline) {
          timeline = variant.modifyTimeline(timeline, options);
        }
      }

      return timeline;
    } catch (error) {
      console.error(`Error executing custom animation ${name}:`, error);

      // Try fallback animation
      if (animation.fallback && options.fallbackOnError !== false) {
        try {
          return animation.fallback(target, options);
        } catch (fallbackError) {
          console.error(`Fallback animation also failed:`, fallbackError);
        }
      }

      return null;
    }
  }

  composeAnimations(
    animationNames: string[],
    target: Element | Element[],
    options: CustomAnimationOptions = {}
  ): GSAPTimeline | null {
    if (!options.composition) {
      console.warn('Composition options required for animation composition');
      return null;
    }

    const { sequence = 'parallel', timing = [], blend = 'add' } = options.composition;
    const masterTimeline = gsap.timeline();

    try {
      const timelines: GSAPTimeline[] = [];

      // Create individual animation timelines
      for (const name of animationNames) {
        const timeline = this.executeAnimation(name, target, options);
        if (timeline) {
          timelines.push(timeline);
        }
      }

      if (timelines.length === 0) {
        return null;
      }

      // Compose timelines based on sequence type
      switch (sequence) {
        case 'parallel':
          timelines.forEach(timeline => {
            masterTimeline.add(timeline, 0);
          });
          break;

        case 'sequential':
          let currentTime = 0;
          timelines.forEach((timeline, index) => {
            const delay = timing[index] || 0;
            masterTimeline.add(timeline, currentTime + delay);
            currentTime += timeline.duration() + delay;
          });
          break;

        case 'staggered':
          const staggerAmount = typeof options.stagger === 'number'
            ? options.stagger
            : options.stagger?.amount || 0.1;

          timelines.forEach((timeline, index) => {
            masterTimeline.add(timeline, index * staggerAmount);
          });
          break;
      }

      return masterTimeline;
    } catch (error) {
      console.error('Error composing animations:', error);
      return null;
    }
  }

  private shouldReduceMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private createReducedMotionTimeline(
    target: Element | Element[],
    options: CustomAnimationOptions
  ): GSAPTimeline {
    const timeline = gsap.timeline();
    const elements = Array.isArray(target) ? target : [target];

    // Instant state change without animation
    elements.forEach(element => {
      timeline.set(element, {
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
      });
    });

    return timeline;
  }
}

// Global registry instance
const customAnimationRegistry = new CustomAnimationRegistry();

// Built-in Animation Plugins

// iPad-Style Grid Animation Plugin
const iPadGridPlugin: AnimationPlugin = {
  name: 'ipad-grid',
  version: '1.0.0',
  description: 'iPad-style grid animations where non-selected items animate away',
  animations: {
    'ipad-grid-select': {
      name: 'iPad Grid Selection',
      description: 'Selected item grows while others animate away',
      duration: 0.7,
      variants: {
        subtle: {
          name: 'Subtle',
          description: 'Gentle animation with minimal movement',
          options: {
            intensity: 'subtle',
            direction: 'center',
          },
        },
        dramatic: {
          name: 'Dramatic',
          description: 'Strong animation with pronounced movement',
          options: {
            intensity: 'strong',
            direction: 'random',
          },
        },
        directional: {
          name: 'Directional',
          description: 'Items animate in specific directions',
          options: {
            intensity: 'medium',
            direction: 'left',
          },
        },
      },
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const container = Array.isArray(target) ? target[0] : target;
        const gridItems = container.querySelectorAll('.project-card, .grid-item, [data-grid-item]');
        const selectedIndex = options.selectedIndex || 0;
        const intensity = options.intensity || 'medium';
        const direction = options.direction || 'center';

        const timeline = gsap.timeline();
        const intensityMultiplier = {
          subtle: 0.7,
          medium: 1,
          strong: 1.4,
        }[intensity];

        gridItems.forEach((item, index) => {
          if (index === selectedIndex) {
            // Selected item animation
            timeline.to(item, {
              scale: 1.1 + (0.1 * intensityMultiplier),
              zIndex: 100,
              filter: `brightness(${1 + (0.2 * intensityMultiplier)})`,
              boxShadow: `0 8px 32px rgba(0, 0, 0, ${0.15 * intensityMultiplier})`,
              duration: 0.7,
              ease: 'power2.out',
              force3D: true,
            }, 0);
          } else {
            // Non-selected items animation
            let moveDirection = { x: 0, y: 0 };

            switch (direction) {
              case 'left':
                moveDirection.x = -200 * intensityMultiplier;
                break;
              case 'right':
                moveDirection.x = 200 * intensityMultiplier;
                break;
              case 'up':
                moveDirection.y = -200 * intensityMultiplier;
                break;
              case 'down':
                moveDirection.y = 200 * intensityMultiplier;
                break;
              case 'random':
                moveDirection.x = (Math.random() - 0.5) * 400 * intensityMultiplier;
                moveDirection.y = (Math.random() - 0.5) * 400 * intensityMultiplier;
                break;
              case 'center':
              default:
                // Calculate direction from center
                const rect = (item as Element).getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const centerX = containerRect.left + containerRect.width / 2;
                const centerY = containerRect.top + containerRect.height / 2;
                const itemCenterX = rect.left + rect.width / 2;
                const itemCenterY = rect.top + rect.height / 2;

                const angle = Math.atan2(itemCenterY - centerY, itemCenterX - centerX);
                moveDirection.x = Math.cos(angle) * 200 * intensityMultiplier;
                moveDirection.y = Math.sin(angle) * 200 * intensityMultiplier;
                break;
            }

            timeline.to(item, {
              x: moveDirection.x,
              y: moveDirection.y,
              opacity: 0,
              scale: 0.7 + (0.1 * (1 - intensityMultiplier)),
              filter: `brightness(${0.8 - (0.2 * intensityMultiplier)})`,
              duration: 0.7,
              ease: 'power2.out',
              force3D: true,
            }, 0);
          }
        });

        return timeline;
      },
      fallback: (target: Element | Element[], options: CustomAnimationOptions) => {
        const timeline = gsap.timeline();
        const container = Array.isArray(target) ? target[0] : target;
        const gridItems = container.querySelectorAll('.project-card, .grid-item, [data-grid-item]');
        const selectedIndex = options.selectedIndex || 0;

        // Simple fallback: just highlight selected item
        gridItems.forEach((item, index) => {
          if (index === selectedIndex) {
            timeline.to(item, {
              scale: 1.1,
              duration: 0.3,
              ease: 'power2.out',
            });
          } else {
            timeline.to(item, {
              opacity: 0.5,
              duration: 0.3,
              ease: 'power2.out',
            }, 0);
          }
        });

        return timeline;
      },
      compose: true,
    },
    'ipad-grid-reset': {
      name: 'iPad Grid Reset',
      description: 'Reset grid items to original positions',
      duration: 0.5,
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const container = Array.isArray(target) ? target[0] : target;
        const gridItems = container.querySelectorAll('.project-card, .grid-item, [data-grid-item]');

        const timeline = gsap.timeline();

        timeline.to(gridItems, {
          x: 0,
          y: 0,
          opacity: 1,
          scale: 1,
          zIndex: 'auto',
          filter: 'brightness(1)',
          boxShadow: 'none',
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.05,
          force3D: true,
        });

        return timeline;
      },
      compose: true,
    },
  },
  register: () => {
    console.log('iPad Grid animation plugin registered');
  },
  unregister: () => {
    console.log('iPad Grid animation plugin unregistered');
  },
};

// Composition Effects Plugin
const compositionEffectsPlugin: AnimationPlugin = {
  name: 'composition-effects',
  version: '1.0.0',
  description: 'Animation effects designed for composition with other animations',
  animations: {
    'particle-burst': {
      name: 'Particle Burst',
      description: 'Creates particle burst effect around target',
      duration: 1.2,
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const element = Array.isArray(target) ? target[0] : target;
        const timeline = gsap.timeline();
        const particleCount = 12;
        const intensity = options.intensity || 'medium';

        // Create particles
        const particles: HTMLElement[] = [];
        for (let i = 0; i < particleCount; i++) {
          const particle = document.createElement('div');
          particle.className = 'animation-particle';
          particle.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: var(--primary);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
          `;

          const rect = element.getBoundingClientRect();
          particle.style.left = `${rect.left + rect.width / 2}px`;
          particle.style.top = `${rect.top + rect.height / 2}px`;

          document.body.appendChild(particle);
          particles.push(particle);
        }

        // Animate particles
        particles.forEach((particle, index) => {
          const angle = (index / particleCount) * Math.PI * 2;
          const distance = intensity === 'strong' ? 100 : intensity === 'medium' ? 60 : 30;

          timeline.to(particle, {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            opacity: 0,
            scale: 0,
            duration: 1.2,
            ease: 'power2.out',
          }, 0);
        });

        // Cleanup particles
        timeline.call(() => {
          particles.forEach(particle => particle.remove());
        });

        return timeline;
      },
      compose: true,
    },
    'ripple-effect': {
      name: 'Ripple Effect',
      description: 'Creates expanding ripple effect from target',
      duration: 0.8,
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const element = Array.isArray(target) ? target[0] : target;
        const timeline = gsap.timeline();

        // Create ripple element
        const ripple = document.createElement('div');
        ripple.className = 'animation-ripple';
        ripple.style.cssText = `
          position: absolute;
          border: 2px solid var(--primary);
          border-radius: 50%;
          pointer-events: none;
          z-index: 999;
          opacity: 0.7;
        `;

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${rect.left + rect.width / 2 - size / 2}px`;
        ripple.style.top = `${rect.top + rect.height / 2 - size / 2}px`;

        document.body.appendChild(ripple);

        // Animate ripple
        timeline
          .fromTo(ripple, {
            scale: 0,
            opacity: 0.7,
          }, {
            scale: 2,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
          })
          .call(() => {
            ripple.remove();
          });

        return timeline;
      },
      compose: true,
    },
    'glow-pulse': {
      name: 'Glow Pulse',
      description: 'Adds pulsing glow effect to target',
      duration: 2,
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const elements = Array.isArray(target) ? target : [target];
        const timeline = gsap.timeline({ repeat: -1, yoyo: true });
        const intensity = options.intensity || 'medium';

        const glowIntensity = {
          subtle: '0 0 10px rgba(var(--primary-rgb), 0.3)',
          medium: '0 0 20px rgba(var(--primary-rgb), 0.5)',
          strong: '0 0 30px rgba(var(--primary-rgb), 0.7)',
        }[intensity];

        timeline.to(elements, {
          boxShadow: glowIntensity,
          duration: 1,
          ease: 'sine.inOut',
        });

        return timeline;
      },
      compose: true,
    },
  },
  register: () => {
    console.log('Composition Effects animation plugin registered');
  },
  unregister: () => {
    console.log('Composition Effects animation plugin unregistered');
  },
};

// Transition Effects Plugin
const transitionEffectsPlugin: AnimationPlugin = {
  name: 'transition-effects',
  version: '1.0.0',
  description: 'Smooth transition effects for page and component changes',
  animations: {
    'slide-transition': {
      name: 'Slide Transition',
      description: 'Slide elements in from specified direction',
      duration: 0.6,
      variants: {
        'slide-left': {
          name: 'Slide from Left',
          options: { direction: 'left' },
        },
        'slide-right': {
          name: 'Slide from Right',
          options: { direction: 'right' },
        },
        'slide-up': {
          name: 'Slide from Bottom',
          options: { direction: 'up' },
        },
        'slide-down': {
          name: 'Slide from Top',
          options: { direction: 'down' },
        },
      },
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const elements = Array.isArray(target) ? target : [target];
        const timeline = gsap.timeline();
        const direction = options.direction || 'left';
        const distance = 100;



        const positionMap: Record<string, { x: number; y: number }> = {
          left: { x: -distance, y: 0 },  // Start from left, slide right
          right: { x: distance, y: 0 },   // Start from right, slide left
          down: { x: 0, y: -distance },     // Start from above, slide down
          up: { x: 0, y: distance },    // Start from below, slide up
        };

        const initialPosition = positionMap[direction] || positionMap.left;

        // Set initial position
        gsap.set(elements, {
          x: initialPosition.x,
          y: initialPosition.y,
          opacity: 0,
        });

        // Animate to final position
        timeline.to(elements, {
          x: 0,
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          stagger: options.stagger || 0.1,
          force3D: true,
        });

        return timeline;
      },
      compose: true,
    },
    'fade-scale': {
      name: 'Fade Scale',
      description: 'Fade in with scale animation',
      duration: 0.5,
      create: (target: Element | Element[], options: CustomAnimationOptions) => {
        const elements = Array.isArray(target) ? target : [target];
        const timeline = gsap.timeline();

        // Set initial state
        gsap.set(elements, {
          opacity: 0,
          scale: 0.8,
        });

        // Animate to final state
        timeline.to(elements, {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
          stagger: options.stagger || 0.05,
          force3D: true,
        });

        return timeline;
      },
      compose: true,
    },
  },
  register: () => {
    console.log('Transition Effects animation plugin registered');
  },
  unregister: () => {
    console.log('Transition Effects animation plugin unregistered');
  },
};

// Register built-in plugins
customAnimationRegistry.registerPlugin(iPadGridPlugin);
customAnimationRegistry.registerPlugin(compositionEffectsPlugin);
customAnimationRegistry.registerPlugin(transitionEffectsPlugin);

// Public API Functions
export function registerCustomAnimationPlugin(plugin: AnimationPlugin): void {
  customAnimationRegistry.registerPlugin(plugin);
}

export function unregisterCustomAnimationPlugin(pluginName: string): void {
  customAnimationRegistry.unregisterPlugin(pluginName);
}

export function executeCustomAnimation(
  name: string,
  target: Element | Element[],
  options: CustomAnimationOptions = {}
): GSAPTimeline | null {
  return customAnimationRegistry.executeAnimation(name, target, options);
}

export function composeCustomAnimations(
  animationNames: string[],
  target: Element | Element[],
  options: CustomAnimationOptions = {}
): GSAPTimeline | null {
  return customAnimationRegistry.composeAnimations(animationNames, target, options);
}

export function setAnimationVariant(animationName: string, variantName: string): void {
  customAnimationRegistry.setVariant(animationName, variantName);
}

export function getAvailableAnimations(): string[] {
  return customAnimationRegistry.listAnimations();
}

export function getAvailablePlugins(): string[] {
  return customAnimationRegistry.listPlugins();
}

export function getAnimationDefinition(name: string): AnimationDefinition | undefined {
  return customAnimationRegistry.getAnimation(name);
}

// Convenience functions for common animations
export function executeIPadGridAnimation(
  container: Element,
  selectedIndex: number,
  options: Partial<CustomAnimationOptions> = {}
): GSAPTimeline | null {
  return executeCustomAnimation('ipad-grid-select', container, {
    selectedIndex,
    ...options,
  });
}

export function resetIPadGrid(
  container: Element,
  options: Partial<CustomAnimationOptions> = {}
): GSAPTimeline | null {
  return executeCustomAnimation('ipad-grid-reset', container, options);
}

export function createComposedEffect(
  target: Element | Element[],
  effects: string[],
  options: Partial<CustomAnimationOptions> = {}
): GSAPTimeline | null {
  return composeCustomAnimations(effects, target, {
    composition: {
      combine: effects,
      sequence: 'parallel',
      blend: 'add',
    },
    ...options,
  });
}

// Animation Development Tools
export interface AnimationDebugInfo {
  plugins: string[];
  animations: string[];
  activeVariants: Record<string, string>;
  performance: {
    registeredCount: number;
    executionCount: number;
    errorCount: number;
  };
}

let executionCount = 0;
let errorCount = 0;

export function getAnimationDebugInfo(): AnimationDebugInfo {
  return {
    plugins: customAnimationRegistry.listPlugins(),
    animations: customAnimationRegistry.listAnimations(),
    activeVariants: Object.fromEntries(
      customAnimationRegistry.listAnimations().map(name => [
        name,
        customAnimationRegistry.getActiveVariant(name) || 'default'
      ])
    ),
    performance: {
      registeredCount: customAnimationRegistry.listAnimations().length,
      executionCount,
      errorCount,
    },
  };
}

// Performance monitoring
const originalExecute = customAnimationRegistry.executeAnimation.bind(customAnimationRegistry);
(customAnimationRegistry as any).executeAnimation = function (...args: any[]) {
  executionCount++;
  try {
    return originalExecute(...args);
  } catch (error) {
    errorCount++;
    throw error;
  }
};

// Initialize custom animation system
if (typeof window !== 'undefined') {
  // Register global custom animation system
  (globalThis as any).__uiCustomAnimationSystem = {
    registry: customAnimationRegistry,
    execute: executeCustomAnimation,
    compose: composeCustomAnimations,
    register: registerCustomAnimationPlugin,
    unregister: unregisterCustomAnimationPlugin,
    setVariant: setAnimationVariant,
    getDebugInfo: getAnimationDebugInfo,
  };

  console.log('Custom Animation System initialized with built-in plugins');
}

// Types are already exported as interfaces above