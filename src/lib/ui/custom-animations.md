# Custom Animation System Documentation

## Overview

The Custom Animation System provides a plugin architecture for registering and executing custom animation sequences. It supports iPad-style grid animations, animation composition, runtime variant selection, and performance optimization.

## Key Features

### 1. Plugin Architecture (Requirement 12.1)
- Register custom animation plugins with multiple animations
- Dependency management between plugins
- Hot-swappable plugin system
- Version management and compatibility checking

### 2. iPad-Style Grid Animation (Requirement 12.2)
- Selected item grows and brightens
- Non-selected items animate away in configurable directions
- Multiple animation variants (subtle, dramatic, directional)
- Configurable intensity levels
- Automatic reset functionality

### 3. Animation Composition (Requirement 12.3)
- Combine multiple animation effects
- Parallel, sequential, and staggered execution
- Blend modes for effect combination
- Timeline synchronization

### 4. Runtime Variant Selection (Requirement 12.4)
- Switch animation variants at runtime
- Per-animation variant configuration
- Dynamic option modification
- Preview and fallback support

### 5. Configuration System (Requirement 12.5)
- Intensity levels (subtle, medium, strong)
- Direction control (up, down, left, right, center, random)
- Stagger timing configuration
- Reduced motion support
- Performance fallbacks

## API Reference

### Core Functions

#### `registerCustomAnimationPlugin(plugin: AnimationPlugin)`
Register a new animation plugin with the system.

```typescript
const myPlugin: AnimationPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Custom animations for my app',
  animations: {
    'my-animation': {
      name: 'My Animation',
      duration: 0.5,
      create: (target, options) => {
        return gsap.timeline().to(target, {
          scale: 1.2,
          duration: 0.5,
          ease: 'power2.out'
        });
      }
    }
  },
  register: () => console.log('Plugin registered'),
  unregister: () => console.log('Plugin unregistered'),
};

registerCustomAnimationPlugin(myPlugin);
```

#### `executeCustomAnimation(name: string, target: Element | Element[], options?: CustomAnimationOptions)`
Execute a registered custom animation.

```typescript
const timeline = executeCustomAnimation('ipad-grid-select', container, {
  selectedIndex: 2,
  intensity: 'medium',
  variant: 'dramatic'
});
```

#### `composeCustomAnimations(names: string[], target: Element | Element[], options?: CustomAnimationOptions)`
Compose multiple animations together.

```typescript
const timeline = composeCustomAnimations(
  ['particle-burst', 'ripple-effect', 'glow-pulse'],
  element,
  {
    composition: {
      combine: ['particle-burst', 'ripple-effect', 'glow-pulse'],
      sequence: 'parallel',
      blend: 'add'
    },
    intensity: 'strong'
  }
);
```

#### `setAnimationVariant(animationName: string, variantName: string)`
Set the active variant for an animation.

```typescript
setAnimationVariant('ipad-grid-select', 'dramatic');
```

### Convenience Functions

#### `executeIPadGridAnimation(container: Element, selectedIndex: number, options?)`
Execute the iPad-style grid animation.

```typescript
executeIPadGridAnimation(gridContainer, 3, {
  intensity: 'strong',
  direction: 'center'
});
```

#### `resetIPadGrid(container: Element, options?)`
Reset grid items to their original positions.

```typescript
resetIPadGrid(gridContainer);
```

#### `createComposedEffect(target: Element | Element[], effects: string[], options?)`
Create a composed effect with multiple animations.

```typescript
createComposedEffect(element, ['particle-burst', 'glow-pulse'], {
  intensity: 'medium'
});
```

## Built-in Plugins

### 1. iPad Grid Plugin
**Plugin Name:** `ipad-grid`

**Animations:**
- `ipad-grid-select`: Main grid selection animation
- `ipad-grid-reset`: Reset grid to original state

**Variants:**
- `subtle`: Gentle animation with minimal movement
- `dramatic`: Strong animation with pronounced movement  
- `directional`: Items animate in specific directions

**Options:**
- `selectedIndex`: Index of the selected grid item
- `intensity`: Animation strength ('subtle' | 'medium' | 'strong')
- `direction`: Movement direction ('up' | 'down' | 'left' | 'right' | 'center' | 'random')

### 2. Composition Effects Plugin
**Plugin Name:** `composition-effects`

**Animations:**
- `particle-burst`: Creates particle burst effect around target
- `ripple-effect`: Expanding ripple effect from target
- `glow-pulse`: Pulsing glow effect on target

**Features:**
- Automatic cleanup of generated elements
- Configurable intensity levels
- Hardware acceleration optimized

### 3. Transition Effects Plugin
**Plugin Name:** `transition-effects`

**Animations:**
- `slide-transition`: Slide elements from specified direction
- `fade-scale`: Fade in with scale animation

**Variants:**
- `slide-left`: Slide from left
- `slide-right`: Slide from right
- `slide-up`: Slide from bottom
- `slide-down`: Slide from top

## Animation Definition Structure

```typescript
interface AnimationDefinition {
  name: string;                    // Display name
  description?: string;            // Description for documentation
  duration: number;               // Default duration in seconds
  variants?: Record<string, AnimationVariant>; // Available variants
  create: (target, options) => GSAPTimeline;   // Main animation function
  preview?: (target, options) => GSAPTimeline; // Preview version
  fallback?: (target, options) => GSAPTimeline; // Fallback for errors
  compose?: boolean;              // Can be composed with others
  priority?: number;              // Priority for conflict resolution
}
```

## Animation Options

```typescript
interface CustomAnimationOptions {
  variant?: string;               // Active variant name
  intensity?: 'subtle' | 'medium' | 'strong'; // Animation strength
  direction?: 'up' | 'down' | 'left' | 'right' | 'center' | 'random';
  stagger?: number | { amount: number; from: string | number };
  selectedIndex?: number;         // For grid animations
  gridColumns?: number;           // Grid layout info
  gridRows?: number;             // Grid layout info
  composition?: CompositionOptions; // For composed animations
  fallbackOnError?: boolean;      // Use fallback on error
  respectReducedMotion?: boolean; // Honor reduced motion preference
  duration?: number;              // Override default duration
  easing?: string;               // GSAP easing function
  delay?: number;                // Animation delay
  onComplete?: () => void;       // Completion callback
  onStart?: () => void;          // Start callback
}
```

## Performance Features

### 1. Hardware Acceleration
- Automatic `force3D: true` for transform animations
- `will-change` property management
- GPU-optimized animation properties

### 2. Reduced Motion Support
- Automatic detection of `prefers-reduced-motion`
- Instant state changes instead of animations
- Configurable per animation

### 3. Error Handling
- Automatic fallback to simpler animations
- Graceful degradation on errors
- Performance monitoring and adjustment

### 4. Memory Management
- Automatic cleanup of generated elements
- Timeline disposal after completion
- Event listener cleanup

## Usage Examples

### Basic iPad Grid Animation

```typescript
// HTML structure
<div className="grid-container">
  <div className="project-card">Project 1</div>
  <div className="project-card">Project 2</div>
  <div className="project-card">Project 3</div>
  <div className="project-card">Project 4</div>
</div>

// JavaScript
const container = document.querySelector('.grid-container');
executeIPadGridAnimation(container, 1, {
  intensity: 'medium',
  variant: 'dramatic'
});
```

### Custom Plugin Creation

```typescript
const customPlugin: AnimationPlugin = {
  name: 'custom-effects',
  version: '1.0.0',
  animations: {
    'custom-bounce': {
      name: 'Custom Bounce',
      duration: 0.6,
      variants: {
        'high': {
          name: 'High Bounce',
          options: { intensity: 'strong' }
        },
        'low': {
          name: 'Low Bounce', 
          options: { intensity: 'subtle' }
        }
      },
      create: (target, options) => {
        const bounceHeight = options.intensity === 'strong' ? -50 : -20;
        return gsap.timeline()
          .to(target, {
            y: bounceHeight,
            duration: 0.3,
            ease: 'power2.out'
          })
          .to(target, {
            y: 0,
            duration: 0.3,
            ease: 'bounce.out'
          });
      }
    }
  },
  register: () => console.log('Custom plugin registered'),
  unregister: () => console.log('Custom plugin unregistered')
};

registerCustomAnimationPlugin(customPlugin);
```

### Animation Composition

```typescript
// Compose multiple effects
const timeline = composeCustomAnimations(
  ['particle-burst', 'ripple-effect', 'custom-bounce'],
  targetElement,
  {
    composition: {
      combine: ['particle-burst', 'ripple-effect', 'custom-bounce'],
      sequence: 'staggered',
      blend: 'add'
    },
    stagger: 0.2,
    intensity: 'medium'
  }
);
```

### Runtime Variant Switching

```typescript
// Set variant for future executions
setAnimationVariant('ipad-grid-select', 'dramatic');

// Execute with the new variant
executeCustomAnimation('ipad-grid-select', container, {
  selectedIndex: 2
});

// Or override variant for single execution
executeCustomAnimation('ipad-grid-select', container, {
  selectedIndex: 2,
  variant: 'subtle' // Override the set variant
});
```

## Integration with Main Animation System

The custom animation system integrates seamlessly with the main UI animation system:

```typescript
import { useAnimation } from '@/lib/ui/animation';

function MyComponent() {
  const {
    executeCustom,
    composeAnimations,
    setVariant,
    executeIPadGrid,
    resetIPadGrid
  } = useAnimation();

  const handleGridClick = (index: number) => {
    executeIPadGrid(gridRef.current, index, {
      intensity: 'medium'
    });
  };

  return (
    <div ref={gridRef} className="grid">
      {/* Grid items */}
    </div>
  );
}
```

## Testing and Debugging

### Debug Information
```typescript
import { getAnimationDebugInfo } from '@/lib/ui/custom-animations';

const debugInfo = getAnimationDebugInfo();
console.log('Plugins:', debugInfo.plugins);
console.log('Animations:', debugInfo.animations);
console.log('Performance:', debugInfo.performance);
```

### Available Animations
```typescript
import { getAvailableAnimations, getAvailablePlugins } from '@/lib/ui/custom-animations';

console.log('Available animations:', getAvailableAnimations());
console.log('Available plugins:', getAvailablePlugins());
```

## Best Practices

### 1. Plugin Development
- Use descriptive names and versions
- Provide fallback animations for error cases
- Clean up generated DOM elements
- Use hardware-accelerated properties
- Respect reduced motion preferences

### 2. Performance
- Limit the number of simultaneous animations
- Use `force3D: true` for transform animations
- Avoid animating layout-triggering properties
- Implement proper cleanup in animation callbacks

### 3. Accessibility
- Always provide reduced motion alternatives
- Use appropriate ARIA labels for animated content
- Ensure animations don't interfere with screen readers
- Provide keyboard navigation alternatives

### 4. Error Handling
- Always provide fallback animations
- Handle missing DOM elements gracefully
- Log errors for debugging but don't break the UI
- Test animations across different devices and browsers

## Usage Examples

### Basic iPad Grid Animation

```typescript
// HTML structure
<div className="grid-container">
  <div className="project-card">Project 1</div>
  <div className="project-card">Project 2</div>
  <div className="project-card">Project 3</div>
  <div className="project-card">Project 4</div>
</div>

// JavaScript
const container = document.querySelector('.grid-container');
executeIPadGridAnimation(container, 1, {
  intensity: 'medium',
  variant: 'dramatic'
});
```

### Slide Transitions

```typescript
// Slide elements from different directions
const elements = document.querySelectorAll('.slide-target');

// Slide from left to center
executeCustomAnimation('slide-transition', elements, {
  direction: 'left',
  stagger: 0.1
});

// Slide from right to center  
executeCustomAnimation('slide-transition', elements, {
  direction: 'right',
  stagger: 0.1
});

// Slide from bottom to center (upward)
executeCustomAnimation('slide-transition', elements, {
  direction: 'up',
  stagger: 0.1
});

// Slide from top to center (downward)
executeCustomAnimation('slide-transition', elements, {
  direction: 'down',
  stagger: 0.1
});
```

This custom animation system provides a robust, extensible foundation for creating sophisticated animations while maintaining performance and accessibility standards.