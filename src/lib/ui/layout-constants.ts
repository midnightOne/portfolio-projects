/**
 * Layout Constants - UI System
 * 
 * Enhanced layout constants extracted from portfolio-projects with additional
 * UI system features for AI navigation, animations, and responsive design.
 * This replaces the original layout constants with an enhanced version.
 */

// Import existing layout constants for re-export and enhancement
import {
  MAX_WIDTHS,
  CONTAINERS,
  SPACING,
  GRID,
  FLEX,
  MODAL,
  COMPONENTS,
  BREAKPOINTS,
  LAYOUT_PRESETS,
  type MaxWidth,
  type Container,
  type SpacingSize,
  type GridType,
  type FlexType,
  type ModalSize,
  type LayoutPreset,
  getMaxWidth,
  getContainer,
  getSpacing,
  getGrid,
  getFlex,
  getLayoutPreset,
  isValidMaxWidth,
  isValidSpacingSize,
} from '../constants/layout';

// Re-export all existing layout constants for backward compatibility
export {
  MAX_WIDTHS,
  CONTAINERS,
  SPACING,
  GRID,
  FLEX,
  MODAL,
  COMPONENTS,
  BREAKPOINTS,
  LAYOUT_PRESETS,
  type MaxWidth,
  type Container,
  type SpacingSize,
  type GridType,
  type FlexType,
  type ModalSize,
  type LayoutPreset,
  getMaxWidth,
  getContainer,
  getSpacing,
  getGrid,
  getFlex,
  getLayoutPreset,
  isValidMaxWidth,
  isValidSpacingSize,
};

// UI System specific layout constants
export const UI_LAYOUT = {
  // AI Interface positioning
  aiInterface: {
    hero: {
      bottom: '30vh',
      transform: 'translateX(-50%)',
      left: '50%',
    },
    pinned: {
      bottom: '24px',
      transform: 'translateX(-50%)',
      left: '50%',
    },
    width: {
      pill: '320px',
      expanded: '480px',
    },
    height: {
      pill: '48px',
      expanded: '120px',
    },
  },
  
  // Animation-specific layouts
  animation: {
    // Project modal growth animation
    projectModal: {
      initialScale: '1',
      growthScale: '1.2',
      finalScale: '1',
      zIndex: {
        normal: '1',
        animating: '100',
        modal: '1000',
      },
    },
    
    // Highlighting layouts
    highlight: {
      spotlight: {
        padding: '4px',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--ui-shadow-highlight)',
      },
      outline: {
        outlineWidth: '2px',
        outlineOffset: '4px',
        outlineStyle: 'solid',
      },
      glow: {
        filter: 'drop-shadow(0 0 8px var(--ui-highlight-glow))',
      },
    },
  },
  
  // Responsive breakpoints for desktop-first design
  breakpoints: {
    desktop: '1024px',
    tablet: '768px',
    mobile: '640px',
    // Specific breakpoints for UI components
    aiInterface: '480px', // When to switch to mobile AI interface
    navigation: '768px',  // When to switch to mobile navigation
    modal: '640px',       // When to adjust modal sizing
  },
  
  // Z-index management for layered UI
  zIndex: {
    base: 1,
    dropdown: 10,
    sticky: 20,
    modal: 1000,
    aiInterface: 1100,
    highlight: 1200,
    tooltip: 1300,
    toast: 1400,
  },
} as const;

// Enhanced container classes with AI interface support
export const UI_CONTAINERS = {
  ...CONTAINERS,
  
  // AI-aware containers that account for floating interface
  aiAware: {
    default: 'container mx-auto px-4 sm:px-6 lg:px-8 pb-20', // Extra bottom padding for AI interface
    compact: 'container mx-auto px-4 pb-20',
    wide: 'w-full mx-auto px-4 sm:px-6 lg:px-8 pb-20',
  },
  
  // Animation-safe containers
  animationSafe: {
    default: 'container mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden',
    modal: 'relative overflow-hidden',
    highlight: 'relative z-0', // Ensures proper stacking for highlights
  },
} as const;

// Enhanced spacing with animation considerations
export const UI_SPACING = {
  ...SPACING,
  
  // Animation-specific spacing
  animation: {
    // Spacing for coordinated animations
    coordinated: {
      stagger: '0.1s',  // Delay between staggered animations
      overlap: '0.2s',  // Overlap time for coordinated animations
    },
    
    // Spacing for UI elements during animations
    safe: {
      margin: '8px',    // Safe margin around animating elements
      padding: '16px',  // Safe padding inside animating containers
    },
  },
  
  // AI interface specific spacing
  aiInterface: {
    margin: '16px',           // Margin around AI interface
    narrationGap: '12px',     // Gap between narration and interface
    buttonGap: '8px',         // Gap between interface buttons
    expandedPadding: '16px',  // Padding in expanded mode
  },
} as const;

// Layout utilities for AI navigation and animations
export const UI_UTILITIES = {
  // Classes for animation-safe layouts
  animationSafe: {
    container: 'relative overflow-hidden',
    element: 'transform-gpu will-change-transform',
    text: 'will-change-contents',
  },
  
  // Classes for AI interface integration
  aiIntegration: {
    container: 'relative',
    overlay: 'absolute inset-0 pointer-events-none z-[1200]',
    highlightable: 'relative z-0 transition-all duration-300',
  },
  
  // Responsive utilities for desktop-first approach
  responsive: {
    hideOnMobile: 'hidden md:block',
    showOnMobile: 'block md:hidden',
    desktopFirst: 'block lg:flex',
    mobileStack: 'flex flex-col lg:flex-row',
  },
  
  // Performance optimization classes
  performance: {
    gpu: 'transform-gpu',
    willChange: 'will-change-transform',
    backfaceHidden: 'backface-visibility-hidden',
    optimizeSpeed: 'image-rendering-optimize-speed',
  },
} as const;

// Layout presets for common UI system patterns
export const UI_LAYOUT_PRESETS = {
  ...LAYOUT_PRESETS,
  
  // AI interface layouts
  aiInterface: {
    hero: {
      position: 'fixed',
      ...UI_LAYOUT.aiInterface.hero,
      zIndex: UI_LAYOUT.zIndex.aiInterface,
    },
    pinned: {
      position: 'fixed',
      ...UI_LAYOUT.aiInterface.pinned,
      zIndex: UI_LAYOUT.zIndex.aiInterface,
    },
  },
  
  // Animation-optimized layouts
  animationOptimized: {
    container: {
      position: 'relative',
      overflow: 'hidden',
      willChange: 'transform',
    },
    modal: {
      position: 'fixed',
      inset: '0',
      zIndex: UI_LAYOUT.zIndex.modal,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
  
  // Responsive layouts for desktop-first design
  desktopFirst: {
    navigation: {
      display: 'flex',
      flexDirection: 'row',
      '@media (max-width: 768px)': {
        flexDirection: 'column',
      },
    },
    content: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      '@media (min-width: 1024px)': {
        gridTemplateColumns: '1fr 300px',
      },
    },
  },
} as const;

// Type definitions for UI layout constants
export type UILayoutKey = keyof typeof UI_LAYOUT;
export type UIContainerKey = keyof typeof UI_CONTAINERS;
export type UISpacingKey = keyof typeof UI_SPACING;
export type UIUtilityKey = keyof typeof UI_UTILITIES;
export type UILayoutPresetKey = keyof typeof UI_LAYOUT_PRESETS;

// Helper functions for UI layout
export const getUILayout = (key: UILayoutKey) => UI_LAYOUT[key];
export const getUIContainer = (key: UIContainerKey) => UI_CONTAINERS[key];
export const getUISpacing = (key: UISpacingKey) => UI_SPACING[key];
export const getUIUtility = (key: UIUtilityKey) => UI_UTILITIES[key];
export const getUILayoutPreset = (key: UILayoutPresetKey) => UI_LAYOUT_PRESETS[key];

// Validation helpers
export const isValidUILayoutKey = (value: string): value is UILayoutKey =>
  value in UI_LAYOUT;

export const isValidUIContainerKey = (value: string): value is UIContainerKey =>
  Object.prototype.hasOwnProperty.call(UI_CONTAINERS, value);

// CSS-in-JS helper for dynamic styles
export function generateLayoutCSS(preset: UILayoutPresetKey): React.CSSProperties {
  const presetConfig = UI_LAYOUT_PRESETS[preset];
  
  if (typeof presetConfig === 'object') {
    return presetConfig as React.CSSProperties;
  }
  
  return {};
}

// Responsive breakpoint utilities
export function getBreakpointValue(breakpoint: keyof typeof UI_LAYOUT.breakpoints): string {
  return UI_LAYOUT.breakpoints[breakpoint];
}

export function isBreakpointActive(breakpoint: keyof typeof UI_LAYOUT.breakpoints): boolean {
  if (typeof window === 'undefined') return false;
  
  const breakpointValue = parseInt(getBreakpointValue(breakpoint));
  return window.innerWidth >= breakpointValue;
}