# UI System - Design System Guidelines

## Overview

This document establishes comprehensive design system guidelines for custom themes, visual identity, and consistent design patterns across the AI-enhanced portfolio system. It builds upon the existing shadcn/ui foundation while adding custom theming capabilities and AI-specific design elements.

## Design Token System

### 1. Color System Enhancement

#### Base Color Palette Structure
```css
:root {
  /* Hue variables for theme customization */
  --primary-hue: 220;
  --secondary-hue: 200;
  --accent-hue: 280;
  --success-hue: 120;
  --warning-hue: 45;
  --error-hue: 0;
  
  /* Lightness and chroma scales */
  --lightness-50: 0.98;
  --lightness-100: 0.95;
  --lightness-200: 0.90;
  --lightness-300: 0.82;
  --lightness-400: 0.70;
  --lightness-500: 0.55; /* Base */
  --lightness-600: 0.45;
  --lightness-700: 0.35;
  --lightness-800: 0.25;
  --lightness-900: 0.15;
  
  --chroma-subtle: 0.02;
  --chroma-muted: 0.05;
  --chroma-normal: 0.10;
  --chroma-vibrant: 0.15;
  --chroma-intense: 0.20;
}
```

#### Enhanced Color Tokens
```css
:root {
  /* Primary color scale */
  --primary-50: oklch(var(--lightness-50) var(--chroma-subtle) var(--primary-hue));
  --primary-100: oklch(var(--lightness-100) var(--chroma-muted) var(--primary-hue));
  --primary-200: oklch(var(--lightness-200) var(--chroma-normal) var(--primary-hue));
  --primary-300: oklch(var(--lightness-300) var(--chroma-normal) var(--primary-hue));
  --primary-400: oklch(var(--lightness-400) var(--chroma-vibrant) var(--primary-hue));
  --primary-500: oklch(var(--lightness-500) var(--chroma-vibrant) var(--primary-hue));
  --primary-600: oklch(var(--lightness-600) var(--chroma-intense) var(--primary-hue));
  --primary-700: oklch(var(--lightness-700) var(--chroma-intense) var(--primary-hue));
  --primary-800: oklch(var(--lightness-800) var(--chroma-vibrant) var(--primary-hue));
  --primary-900: oklch(var(--lightness-900) var(--chroma-normal) var(--primary-hue));

  /* Secondary color scale */
  --secondary-50: oklch(var(--lightness-50) var(--chroma-subtle) var(--secondary-hue));
  --secondary-100: oklch(var(--lightness-100) var(--chroma-muted) var(--secondary-hue));
  --secondary-200: oklch(var(--lightness-200) var(--chroma-normal) var(--secondary-hue));
  --secondary-300: oklch(var(--lightness-300) var(--chroma-normal) var(--secondary-hue));
  --secondary-400: oklch(var(--lightness-400) var(--chroma-vibrant) var(--secondary-hue));
  --secondary-500: oklch(var(--lightness-500) var(--chroma-vibrant) var(--secondary-hue));
  --secondary-600: oklch(var(--lightness-600) var(--chroma-intense) var(--secondary-hue));
  --secondary-700: oklch(var(--lightness-700) var(--chroma-intense) var(--secondary-hue));
  --secondary-800: oklch(var(--lightness-800) var(--chroma-vibrant) var(--secondary-hue));
  --secondary-900: oklch(var(--lightness-900) var(--chroma-normal) var(--secondary-hue));

  /* Accent color scale */
  --accent-50: oklch(var(--lightness-50) var(--chroma-subtle) var(--accent-hue));
  --accent-100: oklch(var(--lightness-100) var(--chroma-muted) var(--accent-hue));
  --accent-200: oklch(var(--lightness-200) var(--chroma-normal) var(--accent-hue));
  --accent-300: oklch(var(--lightness-300) var(--chroma-normal) var(--accent-hue));
  --accent-400: oklch(var(--lightness-400) var(--chroma-vibrant) var(--accent-hue));
  --accent-500: oklch(var(--lightness-500) var(--chroma-vibrant) var(--accent-hue));
  --accent-600: oklch(var(--lightness-600) var(--chroma-intense) var(--accent-hue));
  --accent-700: oklch(var(--lightness-700) var(--chroma-intense) var(--accent-hue));
  --accent-800: oklch(var(--lightness-800) var(--chroma-vibrant) var(--accent-hue));
  --accent-900: oklch(var(--lightness-900) var(--chroma-normal) var(--accent-hue));

  /* Semantic color scales */
  --success-50: oklch(var(--lightness-50) var(--chroma-subtle) var(--success-hue));
  --success-500: oklch(var(--lightness-500) var(--chroma-vibrant) var(--success-hue));
  --success-700: oklch(var(--lightness-700) var(--chroma-intense) var(--success-hue));
  
  --warning-50: oklch(var(--lightness-50) var(--chroma-subtle) var(--warning-hue));
  --warning-500: oklch(var(--lightness-500) var(--chroma-vibrant) var(--warning-hue));
  --warning-700: oklch(var(--lightness-700) var(--chroma-intense) var(--warning-hue));
  
  --error-50: oklch(var(--lightness-50) var(--chroma-subtle) var(--error-hue));
  --error-500: oklch(var(--lightness-500) var(--chroma-vibrant) var(--error-hue));
  --error-700: oklch(var(--lightness-700) var(--chroma-intense) var(--error-hue));
}
```

#### Neutral Color System
```css
:root {
  /* Neutral grays with subtle warm undertone */
  --neutral-50: oklch(0.98 0.005 var(--primary-hue));
  --neutral-100: oklch(0.95 0.008 var(--primary-hue));
  --neutral-200: oklch(0.90 0.012 var(--primary-hue));
  --neutral-300: oklch(0.82 0.015 var(--primary-hue));
  --neutral-400: oklch(0.70 0.018 var(--primary-hue));
  --neutral-500: oklch(0.55 0.020 var(--primary-hue));
  --neutral-600: oklch(0.45 0.018 var(--primary-hue));
  --neutral-700: oklch(0.35 0.015 var(--primary-hue));
  --neutral-800: oklch(0.25 0.012 var(--primary-hue));
  --neutral-900: oklch(0.15 0.008 var(--primary-hue));
  --neutral-950: oklch(0.08 0.005 var(--primary-hue));
}
```

### 2. Typography System

#### Font Stack Definition
```css
:root {
  /* Primary font families */
  --font-sans: 'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', monospace;
  --font-display: 'Cal Sans', 'Inter Variable', 'Inter', system-ui, sans-serif;
  
  /* Font weight scale */
  --font-weight-thin: 100;
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  --font-weight-black: 900;
}
```

#### Typography Scale
```css
:root {
  /* Font size scale using fluid typography */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.3rem + 1vw, 1.875rem);
  --text-3xl: clamp(1.875rem, 1.6rem + 1.375vw, 2.25rem);
  --text-4xl: clamp(2.25rem, 1.9rem + 1.75vw, 3rem);
  --text-5xl: clamp(3rem, 2.5rem + 2.5vw, 4rem);
  --text-6xl: clamp(4rem, 3rem + 5vw, 6rem);
  
  /* Line height scale */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
}
```

#### Typography Semantic Tokens
```css
:root {
  /* Semantic typography tokens */
  --typography-display-large: var(--text-6xl) / var(--leading-none) var(--font-display);
  --typography-display-medium: var(--text-5xl) / var(--leading-tight) var(--font-display);
  --typography-display-small: var(--text-4xl) / var(--leading-tight) var(--font-display);
  
  --typography-headline-large: var(--text-3xl) / var(--leading-tight) var(--font-sans);
  --typography-headline-medium: var(--text-2xl) / var(--leading-snug) var(--font-sans);
  --typography-headline-small: var(--text-xl) / var(--leading-snug) var(--font-sans);
  
  --typography-body-large: var(--text-lg) / var(--leading-relaxed) var(--font-sans);
  --typography-body-medium: var(--text-base) / var(--leading-normal) var(--font-sans);
  --typography-body-small: var(--text-sm) / var(--leading-normal) var(--font-sans);
  
  --typography-label-large: var(--text-base) / var(--leading-snug) var(--font-sans);
  --typography-label-medium: var(--text-sm) / var(--leading-snug) var(--font-sans);
  --typography-label-small: var(--text-xs) / var(--leading-tight) var(--font-sans);
  
  --typography-code: var(--text-sm) / var(--leading-normal) var(--font-mono);
}
```

### 3. Spacing and Layout System

#### Spacing Scale
```css
:root {
  /* Base spacing unit */
  --space-unit: 0.25rem; /* 4px */
  
  /* Spacing scale */
  --space-0: 0;
  --space-px: 1px;
  --space-0-5: calc(var(--space-unit) * 0.5); /* 2px */
  --space-1: var(--space-unit); /* 4px */
  --space-1-5: calc(var(--space-unit) * 1.5); /* 6px */
  --space-2: calc(var(--space-unit) * 2); /* 8px */
  --space-2-5: calc(var(--space-unit) * 2.5); /* 10px */
  --space-3: calc(var(--space-unit) * 3); /* 12px */
  --space-3-5: calc(var(--space-unit) * 3.5); /* 14px */
  --space-4: calc(var(--space-unit) * 4); /* 16px */
  --space-5: calc(var(--space-unit) * 5); /* 20px */
  --space-6: calc(var(--space-unit) * 6); /* 24px */
  --space-7: calc(var(--space-unit) * 7); /* 28px */
  --space-8: calc(var(--space-unit) * 8); /* 32px */
  --space-9: calc(var(--space-unit) * 9); /* 36px */
  --space-10: calc(var(--space-unit) * 10); /* 40px */
  --space-11: calc(var(--space-unit) * 11); /* 44px */
  --space-12: calc(var(--space-unit) * 12); /* 48px */
  --space-14: calc(var(--space-unit) * 14); /* 56px */
  --space-16: calc(var(--space-unit) * 16); /* 64px */
  --space-20: calc(var(--space-unit) * 20); /* 80px */
  --space-24: calc(var(--space-unit) * 24); /* 96px */
  --space-28: calc(var(--space-unit) * 28); /* 112px */
  --space-32: calc(var(--space-unit) * 32); /* 128px */
  --space-36: calc(var(--space-unit) * 36); /* 144px */
  --space-40: calc(var(--space-unit) * 40); /* 160px */
  --space-44: calc(var(--space-unit) * 44); /* 176px */
  --space-48: calc(var(--space-unit) * 48); /* 192px */
  --space-52: calc(var(--space-unit) * 52); /* 208px */
  --space-56: calc(var(--space-unit) * 56); /* 224px */
  --space-60: calc(var(--space-unit) * 60); /* 240px */
  --space-64: calc(var(--space-unit) * 64); /* 256px */
  --space-72: calc(var(--space-unit) * 72); /* 288px */
  --space-80: calc(var(--space-unit) * 80); /* 320px */
  --space-96: calc(var(--space-unit) * 96); /* 384px */
}
```

#### Layout Constants
```css
:root {
  /* Container max-widths */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1536px;
  --container-content: 1200px; /* Main content width */
  
  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
  
  /* Layout spacing */
  --layout-padding-mobile: var(--space-4);
  --layout-padding-tablet: var(--space-6);
  --layout-padding-desktop: var(--space-8);
  
  --layout-gap-small: var(--space-4);
  --layout-gap-medium: var(--space-6);
  --layout-gap-large: var(--space-8);
  --layout-gap-xlarge: var(--space-12);
  
  /* Component spacing */
  --component-padding-sm: var(--space-2) var(--space-3);
  --component-padding-md: var(--space-3) var(--space-4);
  --component-padding-lg: var(--space-4) var(--space-6);
  --component-padding-xl: var(--space-6) var(--space-8);
}
```

### 4. Border Radius and Shadows

#### Border Radius Scale
```css
:root {
  --radius-none: 0;
  --radius-sm: 0.125rem; /* 2px */
  --radius-base: 0.25rem; /* 4px */
  --radius-md: 0.375rem; /* 6px */
  --radius-lg: 0.5rem; /* 8px */
  --radius-xl: 0.75rem; /* 12px */
  --radius-2xl: 1rem; /* 16px */
  --radius-3xl: 1.5rem; /* 24px */
  --radius-full: 9999px;
  
  /* Semantic radius tokens */
  --radius-button: var(--radius-md);
  --radius-card: var(--radius-lg);
  --radius-modal: var(--radius-xl);
  --radius-input: var(--radius-base);
}
```

#### Shadow System
```css
:root {
  /* Shadow color with opacity */
  --shadow-color: var(--neutral-900);
  --shadow-opacity-light: 0.05;
  --shadow-opacity-medium: 0.1;
  --shadow-opacity-heavy: 0.15;
  
  /* Shadow scale */
  --shadow-xs: 0 1px 2px 0 oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  --shadow-sm: 0 1px 3px 0 oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light)),
              0 1px 2px -1px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  --shadow-base: 0 1px 3px 0 oklch(from var(--shadow-color) l c h / var(--shadow-opacity-medium)),
                 0 1px 2px -1px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  --shadow-md: 0 4px 6px -1px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-medium)),
               0 2px 4px -2px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  --shadow-lg: 0 10px 15px -3px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-medium)),
               0 4px 6px -4px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  --shadow-xl: 0 20px 25px -5px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-medium)),
               0 8px 10px -6px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  --shadow-2xl: 0 25px 50px -12px oklch(from var(--shadow-color) l c h / var(--shadow-opacity-heavy));
  --shadow-inner: inset 0 2px 4px 0 oklch(from var(--shadow-color) l c h / var(--shadow-opacity-light));
  
  /* Semantic shadows */
  --shadow-button: var(--shadow-sm);
  --shadow-card: var(--shadow-base);
  --shadow-modal: var(--shadow-2xl);
  --shadow-dropdown: var(--shadow-lg);
}
```

## Animation and Motion System

### 1. Animation Timing and Easing

#### Timing Tokens
```css
:root {
  /* Duration scale */
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-slower: 700ms;
  --duration-slowest: 1000ms;
  
  /* AI navigation specific timing */
  --duration-ai-transition: 700ms; /* Core AI navigation timing */
  --duration-ai-highlight: 300ms;
  --duration-ai-focus: 150ms;
  
  /* Easing functions */
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --ease-elastic: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  /* Semantic easing */
  --ease-ui: var(--ease-out); /* Default UI transitions */
  --ease-ai: var(--ease-in-out); /* AI-controlled animations */
  --ease-user: var(--ease-bounce); /* User-triggered interactions */
}
```

#### GSAP Animation Presets
```javascript
// Animation preset configurations for GSAP
const animationPresets = {
  // Core AI navigation animations
  aiTransition: {
    duration: 0.7,
    ease: "power2.inOut",
    stagger: 0.1
  },
  
  // UI element animations
  fadeIn: {
    duration: 0.3,
    ease: "power2.out",
    opacity: 1,
    y: 0
  },
  
  slideUp: {
    duration: 0.5,
    ease: "power3.out",
    y: 0,
    opacity: 1
  },
  
  scaleIn: {
    duration: 0.4,
    ease: "back.out(1.7)",
    scale: 1,
    opacity: 1
  },
  
  // Modal animations
  modalEnter: {
    duration: 0.7,
    ease: "power2.out",
    scale: 1,
    opacity: 1,
    backdropFilter: "blur(8px)"
  },
  
  // Highlighting animations
  highlight: {
    duration: 0.3,
    ease: "power2.out",
    boxShadow: "0 0 0 2px var(--primary-500)",
    scale: 1.02
  }
};
```

### 2. Component Animation States

#### Interactive States
```css
:root {
  /* Hover state timing */
  --hover-duration: var(--duration-fast);
  --hover-ease: var(--ease-out);
  
  /* Focus state timing */
  --focus-duration: var(--duration-fast);
  --focus-ease: var(--ease-out);
  
  /* Active state timing */
  --active-duration: var(--duration-instant);
  --active-ease: var(--ease-linear);
  
  /* Loading state timing */
  --loading-duration: var(--duration-normal);
  --loading-ease: var(--ease-in-out);
}
```

## Theme System Architecture

### 1. Theme Structure

#### Base Theme Definition
```typescript
interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    accent: ColorScale;
    neutral: ColorScale;
    semantic: SemanticColors;
  };
  typography: TypographyConfig;
  spacing: SpacingConfig;
  animation: AnimationConfig;
  customProperties?: Record<string, string>;
}

interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string; // Base color
  600: string;
  700: string;
  800: string;
  900: string;
}

interface SemanticColors {
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
  info: ColorScale;
}
```

#### Theme Variants
```typescript
// Built-in theme variants
const themeVariants = {
  default: {
    id: 'default',
    name: 'Default',
    colors: {
      primary: { hue: 220, chroma: 0.15 },
      secondary: { hue: 200, chroma: 0.12 },
      accent: { hue: 280, chroma: 0.18 }
    }
  },
  
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: { hue: 200, chroma: 0.20 },
      secondary: { hue: 180, chroma: 0.15 },
      accent: { hue: 160, chroma: 0.22 }
    }
  },
  
  sunset: {
    id: 'sunset',
    name: 'Sunset Orange',
    colors: {
      primary: { hue: 25, chroma: 0.25 },
      secondary: { hue: 45, chroma: 0.20 },
      accent: { hue: 320, chroma: 0.18 }
    }
  },
  
  forest: {
    id: 'forest',
    name: 'Forest Green',
    colors: {
      primary: { hue: 140, chroma: 0.18 },
      secondary: { hue: 120, chroma: 0.15 },
      accent: { hue: 60, chroma: 0.20 }
    }
  }
};
```

### 2. Theme Customization System

#### Custom Theme Builder
```typescript
interface CustomThemeBuilder {
  // Color customization
  setPrimaryHue(hue: number): CustomThemeBuilder;
  setSecondaryHue(hue: number): CustomThemeBuilder;
  setAccentHue(hue: number): CustomThemeBuilder;
  setChromaIntensity(intensity: number): CustomThemeBuilder;
  
  // Typography customization
  setFontFamily(family: 'sans' | 'serif' | 'mono', fontStack: string): CustomThemeBuilder;
  setFontScale(scale: number): CustomThemeBuilder;
  
  // Spacing customization
  setSpacingScale(scale: number): CustomThemeBuilder;
  setBorderRadius(style: 'sharp' | 'rounded' | 'pill'): CustomThemeBuilder;
  
  // Animation customization
  setAnimationSpeed(speed: 'fast' | 'normal' | 'slow'): CustomThemeBuilder;
  setAnimationStyle(style: 'subtle' | 'bouncy' | 'elastic'): CustomThemeBuilder;
  
  // Build and validate
  build(): ThemeDefinition;
  validate(): ThemeValidationResult;
}
```

#### Theme Validation Rules
```typescript
interface ThemeValidationResult {
  isValid: boolean;
  errors: ThemeValidationError[];
  warnings: ThemeValidationWarning[];
  accessibility: AccessibilityReport;
}

interface AccessibilityReport {
  contrastRatios: ContrastCheck[];
  colorBlindnessCompatibility: ColorBlindnessCheck;
  focusVisibility: FocusVisibilityCheck;
}
```

## Component Design Patterns

### 1. Component Composition Patterns

#### Base Component Structure
```typescript
interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  variant?: ComponentVariant;
  size?: ComponentSize;
  disabled?: boolean;
  loading?: boolean;
  
  // AI control props
  aiControlled?: boolean;
  aiHighlight?: boolean;
  aiId?: string;
  
  // Animation props
  animate?: boolean;
  animationDelay?: number;
  animationDuration?: number;
}

type ComponentVariant = 'default' | 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline';
type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
```

#### Enhanced Component Pattern
```typescript
// Example: Enhanced Button component
interface ButtonProps extends BaseComponentProps {
  onClick?: (event: MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  href?: string; // For link-style buttons
  
  // AI navigation props
  aiAction?: AIAction;
  aiTarget?: string;
  aiDescription?: string;
}

interface AIAction {
  type: 'navigate' | 'highlight' | 'focus' | 'modal' | 'scroll';
  target: string;
  options?: Record<string, any>;
}
```

### 2. Layout Component Patterns

#### Container Components
```typescript
interface ContainerProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'content' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  center?: boolean;
  
  // AI layout control
  aiScrollTarget?: boolean;
  aiSection?: string;
}

interface GridProps {
  columns?: number | 'auto' | ResponsiveValue<number>;
  gap?: SpacingToken;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  
  // AI grid animations
  aiStagger?: boolean;
  aiStaggerDelay?: number;
}
```

#### Modal and Overlay Patterns
```typescript
interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  
  // AI modal control
  aiTriggered?: boolean;
  aiCloseAction?: AIAction;
  aiBackdropBlur?: boolean;
  
  // Animation configuration
  enterAnimation?: 'fade' | 'scale' | 'slide' | 'custom';
  exitAnimation?: 'fade' | 'scale' | 'slide' | 'custom';
  animationDuration?: number;
}
```

## Responsive Design Strategy

### 1. Desktop-First Approach

#### Breakpoint Strategy
```css
/* Desktop-first media queries */
@media (max-width: 1279px) {
  /* Large tablet and small desktop adjustments */
}

@media (max-width: 1023px) {
  /* Tablet adjustments */
}

@media (max-width: 767px) {
  /* Mobile adjustments */
}

@media (max-width: 639px) {
  /* Small mobile adjustments */
}
```

#### Responsive Utilities
```typescript
interface ResponsiveValue<T> {
  default: T;
  xl?: T;
  lg?: T;
  md?: T;
  sm?: T;
}

// Usage examples
const responsiveSpacing: ResponsiveValue<string> = {
  default: 'var(--space-8)',
  lg: 'var(--space-6)',
  md: 'var(--space-4)',
  sm: 'var(--space-3)'
};

const responsiveColumns: ResponsiveValue<number> = {
  default: 4,
  lg: 3,
  md: 2,
  sm: 1
};
```

### 2. Component Responsive Behavior

#### Responsive Component Props
```typescript
interface ResponsiveComponentProps {
  // Responsive sizing
  size?: ResponsiveValue<ComponentSize>;
  
  // Responsive spacing
  padding?: ResponsiveValue<SpacingToken>;
  margin?: ResponsiveValue<SpacingToken>;
  gap?: ResponsiveValue<SpacingToken>;
  
  // Responsive layout
  direction?: ResponsiveValue<'row' | 'column'>;
  align?: ResponsiveValue<AlignValue>;
  justify?: ResponsiveValue<JustifyValue>;
  
  // Responsive visibility
  hidden?: ResponsiveValue<boolean>;
  display?: ResponsiveValue<'block' | 'flex' | 'grid' | 'none'>;
}
```

## Accessibility Guidelines

### 1. Color and Contrast

#### Contrast Requirements
```css
:root {
  /* Ensure WCAG AA compliance (4.5:1 for normal text, 3:1 for large text) */
  --contrast-aa-normal: 4.5;
  --contrast-aa-large: 3;
  --contrast-aaa-normal: 7;
  --contrast-aaa-large: 4.5;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --primary-500: oklch(0.45 0.25 var(--primary-hue));
    --neutral-700: oklch(0.25 0.02 var(--primary-hue));
    --neutral-300: oklch(0.85 0.02 var(--primary-hue));
  }
}
```

#### Color Blindness Considerations
```css
/* Ensure color is not the only means of conveying information */
.status-success {
  color: var(--success-700);
  position: relative;
}

.status-success::before {
  content: "✓";
  margin-right: var(--space-1);
}

.status-error {
  color: var(--error-700);
  position: relative;
}

.status-error::before {
  content: "✗";
  margin-right: var(--space-1);
}
```

### 2. Motion and Animation Accessibility

#### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-ai-transition: 0ms;
  }
  
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### Alternative Feedback Mechanisms
```typescript
interface AccessibleAnimationProps {
  // Provide alternative feedback for reduced motion
  reducedMotionFallback?: 'highlight' | 'outline' | 'shadow' | 'none';
  
  // Ensure animations don't interfere with screen readers
  ariaLive?: 'polite' | 'assertive' | 'off';
  
  // Provide text alternatives for visual animations
  animationDescription?: string;
}
```

### 3. Focus Management

#### Focus Styles
```css
:root {
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --focus-ring-color: var(--primary-500);
  --focus-ring-style: solid;
}

/* Consistent focus styles */
.focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

/* High contrast focus styles */
@media (prefers-contrast: high) {
  .focus-visible {
    --focus-ring-width: 3px;
    --focus-ring-color: var(--neutral-900);
  }
}
```

#### Focus Management for AI Navigation
```typescript
interface AIFocusManagement {
  // Preserve focus context during AI navigation
  preserveFocus?: boolean;
  
  // Announce AI actions to screen readers
  announceActions?: boolean;
  
  // Provide keyboard alternatives to AI actions
  keyboardFallback?: boolean;
  
  // Focus restoration after AI navigation
  restoreFocus?: boolean;
}
```

## Performance Optimization

### 1. CSS Performance

#### Critical CSS Strategy
```css
/* Critical above-the-fold styles */
.critical {
  /* Essential layout and typography */
  font-family: var(--font-sans);
  color: var(--neutral-900);
  background-color: var(--neutral-50);
}

/* Non-critical styles loaded asynchronously */
.non-critical {
  /* Enhanced animations and decorative styles */
  transition: all var(--duration-normal) var(--ease-ui);
  box-shadow: var(--shadow-card);
}
```

#### CSS Custom Properties Optimization
```css
/* Minimize custom property recalculation */
:root {
  /* Pre-calculate commonly used combinations */
  --primary-with-opacity-10: oklch(from var(--primary-500) l c h / 0.1);
  --primary-with-opacity-20: oklch(from var(--primary-500) l c h / 0.2);
  --primary-with-opacity-50: oklch(from var(--primary-500) l c h / 0.5);
}
```

### 2. Animation Performance

#### Hardware Acceleration
```css
/* Promote elements to their own layer for smooth animations */
.will-animate {
  will-change: transform, opacity;
  transform: translateZ(0); /* Force hardware acceleration */
}

/* Clean up after animations */
.animation-complete {
  will-change: auto;
}
```

#### GSAP Performance Configuration
```javascript
// Optimize GSAP for performance
gsap.config({
  force3D: true,
  nullTargetWarn: false,
  trialWarn: false
});

// Use GSAP's performance-optimized properties
const performantAnimation = {
  // Prefer transform over changing layout properties
  x: 100, // Instead of left: 100px
  y: 50,  // Instead of top: 50px
  scale: 1.1, // Instead of width/height changes
  rotation: 45, // Hardware accelerated
  
  // Batch DOM reads and writes
  onStart: () => gsap.set(target, { willChange: "transform" }),
  onComplete: () => gsap.set(target, { willChange: "auto" })
};
```

## Implementation Guidelines

### 1. File Organization

#### Design System Structure
```
src/design-system/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   ├── animation.css
│   └── index.css
├── components/
│   ├── base/
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── index.ts
│   ├── layout/
│   │   ├── Container/
│   │   ├── Grid/
│   │   ├── Stack/
│   │   └── index.ts
│   └── index.ts
├── themes/
│   ├── default.ts
│   ├── variants.ts
│   ├── custom-builder.ts
│   └── index.ts
├── animations/
│   ├── presets.ts
│   ├── gsap-config.ts
│   ├── ai-animations.ts
│   └── index.ts
├── utils/
│   ├── responsive.ts
│   ├── accessibility.ts
│   ├── performance.ts
│   └── index.ts
└── index.ts
```

### 2. Integration Strategy

#### Gradual Migration Approach
1. **Phase 1**: Extract existing design tokens and create CSS custom properties
2. **Phase 2**: Enhance existing components with AI control props
3. **Phase 3**: Implement new animation system alongside existing Framer Motion
4. **Phase 4**: Add custom theme system and builder
5. **Phase 5**: Optimize performance and add advanced features

#### Backward Compatibility
```typescript
// Maintain compatibility with existing Tailwind classes
interface ComponentProps {
  // New design system props
  variant?: ComponentVariant;
  size?: ComponentSize;
  
  // Backward compatibility
  className?: string; // Still accepts Tailwind classes
  
  // Migration helpers
  /** @deprecated Use variant="primary" instead */
  primary?: boolean;
  /** @deprecated Use size="lg" instead */
  large?: boolean;
}
```

### 3. Testing Strategy

#### Visual Regression Testing
```typescript
// Test theme variations
describe('Theme System', () => {
  test('renders correctly with default theme', () => {
    // Visual regression test
  });
  
  test('renders correctly with custom theme', () => {
    // Test custom theme application
  });
  
  test('maintains accessibility with theme changes', () => {
    // Test contrast ratios and focus visibility
  });
});
```

#### Animation Testing
```typescript
// Test animation performance and behavior
describe('Animation System', () => {
  test('respects reduced motion preferences', () => {
    // Test reduced motion fallbacks
  });
  
  test('maintains 60fps during animations', () => {
    // Performance testing
  });
  
  test('AI animations complete within expected timeframes', () => {
    // Test 0.7-second AI transition timing
  });
});
```

This comprehensive design system provides the foundation for a cohesive, accessible, and performant UI system that supports both traditional user interactions and AI-guided navigation while maintaining flexibility for customization and future enhancements.