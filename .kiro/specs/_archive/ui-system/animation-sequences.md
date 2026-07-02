# UI System - Animation Sequences and Timing Specifications

## Overview

This document defines the specific animation sequences, timing, and coordination patterns for the AI-guided navigation system. All animations are designed around the core 0.7-second timing for consistency and professional polish.

## Core Animation Principles

### 1. Timing Standards

#### Primary Duration: 0.7 seconds
- **Coordinated Animations**: All major UI transitions use 0.7s for consistency
- **Micro Interactions**: 0.2s for hover states and small feedback
- **Loading States**: 1.5s for skeleton animations and spinners
- **Theme Transitions**: 0.3s for color and style changes

#### Easing Functions
```css
:root {
  /* Primary easing for coordinated animations */
  --ease-coordinated: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* smooth */
  
  /* Micro interaction easing */
  --ease-micro: cubic-bezier(0.4, 0, 0.2, 1); /* material design */
  
  /* Bounce effects */
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  
  /* Elastic effects */
  --ease-elastic: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  /* Sharp entrance */
  --ease-sharp: cubic-bezier(0.4, 0, 1, 1);
  
  /* Gentle exit */
  --ease-gentle: cubic-bezier(0, 0, 0.2, 1);
}
```

### 2. Animation Hierarchy

#### Level 1: Coordinated Animations (0.7s)
- Project modal transitions
- AI interface position changes
- Page navigation transitions
- Major layout changes

#### Level 2: Component Animations (0.3s)
- Button hover states
- Card hover effects
- Form field focus
- Dropdown animations

#### Level 3: Micro Animations (0.2s)
- Icon transitions
- Text color changes
- Border highlights
- Small scale changes

## Detailed Animation Sequences

### 1. Project Modal Transition (0.7s Coordinated)

#### Timeline Breakdown
```
Total Duration: 700ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)

0ms (0%):
├─ Project Card: scale(1.0), z-index(auto)
├─ Background: blur(0px), opacity(1.0)
└─ Modal: opacity(0), scale(0.8), y(20px)

100ms (14%):
├─ Project Card: scale(1.05), z-index(100)
├─ Background: blur(2px), opacity(0.95)
└─ Modal: opacity(0.1), scale(0.85), y(15px)

200ms (29%):
├─ Project Card: scale(1.10), z-index(100)
├─ Background: blur(4px), opacity(0.8)
└─ Modal: opacity(0.3), scale(0.9), y(10px)

350ms (50%):
├─ Project Card: scale(1.15), z-index(100)
├─ Background: blur(6px), opacity(0.65)
└─ Modal: opacity(0.6), scale(0.95), y(5px)

500ms (71%):
├─ Project Card: scale(1.18), z-index(100)
├─ Background: blur(7px), opacity(0.55)
└─ Modal: opacity(0.8), scale(0.98), y(2px)

700ms (100%):
├─ Project Card: scale(1.2), z-index(100)
├─ Background: blur(8px), opacity(0.5)
└─ Modal: opacity(1.0), scale(1.0), y(0px)
```

#### GSAP Implementation
```typescript
const projectModalAnimation = (
  projectCard: Element,
  background: Element,
  modal: Element
) => {
  const timeline = gsap.timeline({
    duration: 0.7,
    ease: "power2.out"
  });

  // Simultaneous animations
  timeline
    .to(projectCard, {
      scale: 1.2,
      zIndex: 100,
      duration: 0.7,
      ease: "power2.out"
    }, 0)
    .to(background, {
      backdropFilter: "blur(8px)",
      backgroundColor: "rgba(0,0,0,0.5)",
      duration: 0.7,
      ease: "power2.out"
    }, 0)
    .fromTo(modal, {
      opacity: 0,
      scale: 0.8,
      y: 20
    }, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.7,
      ease: "power2.out"
    }, 0);

  return timeline;
};
```

### 2. AI Interface Position Transition (0.7s)

#### Hero to Pinned Animation
```
Total Duration: 700ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)

0ms (0%):
├─ Position: bottom(30vh)
├─ Scale: 1.0
└─ Glow: opacity(0)

150ms (21%):
├─ Position: bottom(25vh)
├─ Scale: 1.02
└─ Glow: opacity(0.1)

350ms (50%):
├─ Position: bottom(15vh)
├─ Scale: 1.0
└─ Glow: opacity(0.2)

550ms (79%):
├─ Position: bottom(5vh)
├─ Scale: 1.0
└─ Glow: opacity(0.25)

700ms (100%):
├─ Position: bottom(24px)
├─ Scale: 1.0
└─ Glow: opacity(0.3)
```

#### GSAP Implementation
```typescript
const aiInterfacePositionAnimation = (interface: Element, direction: 'hero' | 'pinned') => {
  const positions = {
    hero: { bottom: '30vh', scale: 1, glow: 0 },
    pinned: { bottom: '24px', scale: 1, glow: 0.3 }
  };

  const target = positions[direction];

  return gsap.to(interface, {
    bottom: target.bottom,
    scale: target.scale,
    boxShadow: `0 0 20px rgba(var(--primary), ${target.glow})`,
    duration: 0.7,
    ease: "power2.out"
  });
};
```

### 3. Highlighting System Animations

#### Spotlight Effect (0.3s)
```
Total Duration: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)

0ms (0%):
├─ Box Shadow: none
├─ Background: transparent
└─ Transform: scale(1.0)

100ms (33%):
├─ Box Shadow: 0 0 0 2px rgba(primary, 0.2)
├─ Background: rgba(primary, 0.05)
└─ Transform: scale(1.01)

200ms (67%):
├─ Box Shadow: 0 0 0 3px rgba(primary, 0.25)
├─ Background: rgba(primary, 0.08)
└─ Transform: scale(1.02)

300ms (100%):
├─ Box Shadow: 0 0 0 4px rgba(primary, 0.3)
├─ Background: rgba(primary, 0.1)
└─ Transform: scale(1.02)
```

#### Outline Effect (0.3s)
```
Total Duration: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)

0ms (0%):
├─ Outline: 2px solid transparent
└─ Outline Offset: 2px

150ms (50%):
├─ Outline: 2px solid rgba(primary, 0.5)
└─ Outline Offset: 3px

300ms (100%):
├─ Outline: 2px solid var(--primary)
└─ Outline Offset: 4px
```

#### GSAP Implementation
```typescript
const highlightAnimations = {
  spotlight: (element: Element, options: HighlightOptions) => {
    const intensity = {
      subtle: { shadow: 0.2, bg: 0.05, scale: 1.01 },
      medium: { shadow: 0.3, bg: 0.1, scale: 1.02 },
      strong: { shadow: 0.4, bg: 0.15, scale: 1.03 }
    };

    const config = intensity[options.intensity];

    return gsap.timeline()
      .to(element, {
        boxShadow: `0 0 0 4px rgba(var(--primary), ${config.shadow})`,
        backgroundColor: `rgba(var(--primary), ${config.bg})`,
        scale: config.scale,
        duration: 0.3,
        ease: "power2.out"
      });
  },

  outline: (element: Element, options: HighlightOptions) => {
    return gsap.timeline()
      .to(element, {
        outline: "2px solid var(--primary)",
        outlineOffset: "4px",
        duration: 0.3,
        ease: "power2.out"
      });
  },

  glow: (element: Element, options: HighlightOptions) => {
    return gsap.timeline()
      .to(element, {
        filter: "drop-shadow(0 0 8px rgba(var(--primary), 0.5))",
        duration: 0.3,
        ease: "power2.out"
      });
  }
};
```

### 4. iPad-Style Grid Animation (0.7s)

#### Selected Item Animation
```
Total Duration: 700ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)

0ms (0%):
├─ Scale: 1.0
├─ Z-Index: auto
└─ Filter: none

200ms (29%):
├─ Scale: 1.1
├─ Z-Index: 100
└─ Filter: brightness(1.1)

450ms (64%):
├─ Scale: 1.15
├─ Z-Index: 100
└─ Filter: brightness(1.15)

700ms (100%):
├─ Scale: 1.2
├─ Z-Index: 100
└─ Filter: brightness(1.2)
```

#### Non-Selected Items Animation
```
Total Duration: 700ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)

0ms (0%):
├─ X: 0px
├─ Opacity: 1.0
└─ Scale: 1.0

150ms (21%):
├─ X: ±50px (direction based on position)
├─ Opacity: 0.8
└─ Scale: 0.95

400ms (57%):
├─ X: ±150px
├─ Opacity: 0.4
└─ Scale: 0.85

700ms (100%):
├─ X: ±200px
├─ Opacity: 0
└─ Scale: 0.8
```

#### GSAP Implementation
```typescript
const iPadGridAnimation = (
  container: Element,
  selectedIndex: number
) => {
  const timeline = gsap.timeline();
  const gridItems = container.querySelectorAll('.project-card');
  
  gridItems.forEach((item, index) => {
    if (index === selectedIndex) {
      // Selected item grows and brightens
      timeline.to(item, {
        scale: 1.2,
        zIndex: 100,
        filter: "brightness(1.2)",
        duration: 0.7,
        ease: "power2.out"
      }, 0);
    } else {
      // Other items animate away
      const direction = index < selectedIndex ? -1 : 1;
      timeline.to(item, {
        x: direction * 200,
        opacity: 0,
        scale: 0.8,
        duration: 0.7,
        ease: "power2.out"
      }, 0);
    }
  });
  
  return timeline;
};
```

### 5. Theme Transition Animation (0.3s)

#### Color Transition
```
Total Duration: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)

0ms (0%):
├─ All Colors: current theme values
└─ Transition: none

50ms (17%):
├─ All Colors: interpolated values (17%)
└─ Transition: active

150ms (50%):
├─ All Colors: interpolated values (50%)
└─ Transition: active

300ms (100%):
├─ All Colors: new theme values
└─ Transition: active
```

#### CSS Implementation
```css
/* Theme transition classes */
.theme-transitioning * {
  transition: 
    background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    fill 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    stroke 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Prevent transition flicker on initial load */
.theme-loading * {
  transition: none !important;
}
```

### 6. Hover and Micro Animations

#### Button Hover (0.2s)
```typescript
const buttonHoverAnimation = {
  enter: (button: Element) => {
    return gsap.to(button, {
      scale: 1.05,
      boxShadow: "0 4px 12px rgba(var(--primary), 0.3)",
      duration: 0.2,
      ease: "power2.out"
    });
  },
  
  leave: (button: Element) => {
    return gsap.to(button, {
      scale: 1,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      duration: 0.2,
      ease: "power2.out"
    });
  }
};
```

#### Card Hover (0.3s)
```typescript
const cardHoverAnimation = {
  enter: (card: Element) => {
    return gsap.to(card, {
      y: -4,
      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.15)",
      duration: 0.3,
      ease: "power2.out"
    });
  },
  
  leave: (card: Element) => {
    return gsap.to(card, {
      y: 0,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      duration: 0.3,
      ease: "power2.out"
    });
  }
};
```

## Animation Queue System

### 1. Queue Management
```typescript
interface AnimationQueue {
  current: GSAPTimeline | null;
  queue: AnimationCommand[];
  isPlaying: boolean;
  
  add: (command: AnimationCommand) => void;
  play: () => void;
  pause: () => void;
  clear: () => void;
  interrupt: (override?: boolean) => void;
}

interface AnimationCommand {
  id: string;
  type: 'navigate' | 'highlight' | 'modal' | 'custom';
  target: string | Element;
  duration: number;
  options: AnimationOptions;
  priority: 'normal' | 'high' | 'override';
  onComplete?: () => void;
  onStart?: () => void;
}
```

### 2. Queue Implementation
```typescript
class AnimationQueueManager {
  private queue: AnimationCommand[] = [];
  private current: GSAPTimeline | null = null;
  private isPlaying = false;

  add(command: AnimationCommand) {
    // Handle priority
    if (command.priority === 'override') {
      this.interrupt();
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

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const command = this.queue.shift()!;
    
    try {
      command.onStart?.();
      this.current = await this.executeCommand(command);
      await this.current.play();
      command.onComplete?.();
    } catch (error) {
      console.error('Animation error:', error);
    } finally {
      this.current = null;
      this.playNext();
    }
  }

  interrupt(clearQueue = false) {
    if (this.current) {
      this.current.kill();
      this.current = null;
    }
    
    if (clearQueue) {
      this.queue = [];
    }
    
    this.isPlaying = false;
  }

  private executeCommand(command: AnimationCommand): GSAPTimeline {
    const target = typeof command.target === 'string' 
      ? document.querySelector(command.target)
      : command.target;

    if (!target) {
      throw new Error(`Animation target not found: ${command.target}`);
    }

    switch (command.type) {
      case 'navigate':
        return this.createNavigationAnimation(target, command.options);
      case 'highlight':
        return this.createHighlightAnimation(target, command.options);
      case 'modal':
        return this.createModalAnimation(target, command.options);
      default:
        return this.createCustomAnimation(target, command.options);
    }
  }
}
```

## Performance Optimization

### 1. Hardware Acceleration
```css
/* Force hardware acceleration for animated elements */
.will-animate {
  will-change: transform, opacity, filter;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Remove will-change after animation */
.animation-complete {
  will-change: auto;
}
```

### 2. Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .coordinated-animation {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .gsap-animation {
    --duration-coordinated: 0.01s;
    --duration-normal: 0.01s;
    --duration-fast: 0.01s;
  }
}
```

### 3. Frame Rate Monitoring
```typescript
class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;

  startMonitoring() {
    const monitor = () => {
      this.frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - this.lastTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastTime = currentTime;
        
        // Adjust animation quality based on FPS
        if (this.fps < 30) {
          this.reduceAnimationComplexity();
        }
      }
      
      requestAnimationFrame(monitor);
    };
    
    requestAnimationFrame(monitor);
  }

  private reduceAnimationComplexity() {
    // Disable complex animations if performance drops
    document.documentElement.classList.add('reduced-animations');
  }
}
```

## Animation Development Tools

### 1. Animation Inspector
```typescript
class AnimationInspector {
  private animations: Map<string, GSAPTimeline> = new Map();

  register(id: string, timeline: GSAPTimeline) {
    this.animations.set(id, timeline);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Animation registered: ${id}`, timeline);
    }
  }

  inspect(id: string) {
    const timeline = this.animations.get(id);
    if (timeline) {
      return {
        duration: timeline.duration(),
        progress: timeline.progress(),
        isActive: timeline.isActive(),
        children: timeline.getChildren()
      };
    }
  }

  debugAll() {
    return Array.from(this.animations.entries()).map(([id, timeline]) => ({
      id,
      ...this.inspect(id)
    }));
  }
}
```

### 2. Animation Testing Utilities
```typescript
class AnimationTester {
  async testAnimationDuration(
    animationFn: () => GSAPTimeline,
    expectedDuration: number,
    tolerance = 50 // ms
  ): Promise<boolean> {
    const startTime = performance.now();
    const timeline = animationFn();
    
    return new Promise((resolve) => {
      timeline.eventCallback('onComplete', () => {
        const actualDuration = performance.now() - startTime;
        const withinTolerance = Math.abs(actualDuration - expectedDuration) <= tolerance;
        resolve(withinTolerance);
      });
    });
  }

  async measureFPS(
    animationFn: () => GSAPTimeline,
    duration: number
  ): Promise<number> {
    let frameCount = 0;
    const timeline = animationFn();
    
    const countFrames = () => {
      frameCount++;
      if (timeline.isActive()) {
        requestAnimationFrame(countFrames);
      }
    };
    
    requestAnimationFrame(countFrames);
    
    return new Promise((resolve) => {
      timeline.eventCallback('onComplete', () => {
        const fps = (frameCount / duration) * 1000;
        resolve(fps);
      });
    });
  }
}
```

This comprehensive animation specification provides the foundation for implementing smooth, coordinated animations that enhance the user experience while maintaining performance and accessibility standards.