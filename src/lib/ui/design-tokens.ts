/**
 * Design Tokens System
 * 
 * Centralized design tokens using CSS custom properties for consistent
 * theming across all components. These tokens work with the existing
 * shadcn/ui foundation while adding UI system enhancements.
 */

import type { ThemeTokens } from './types';

// Base design tokens that extend the existing CSS custom properties
export const designTokens = {
  // Colors (extending existing shadcn/ui tokens)
  colors: {
    // Base colors (use existing CSS custom properties)
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    primary: 'var(--primary)',
    primaryForeground: 'var(--primary-foreground)',
    secondary: 'var(--secondary)',
    secondaryForeground: 'var(--secondary-foreground)',
    accent: 'var(--accent)',
    accentForeground: 'var(--accent-foreground)',
    muted: 'var(--muted)',
    mutedForeground: 'var(--muted-foreground)',
    card: 'var(--card)',
    cardForeground: 'var(--card-foreground)',
    border: 'var(--border)',
    input: 'var(--input)',
    ring: 'var(--ring)',
    
    // UI System specific colors (new CSS custom properties)
    aiBackground: 'var(--ui-ai-background)',
    aiBorder: 'var(--ui-ai-border)',
    aiAccent: 'var(--ui-ai-accent)',
    highlightSpotlight: 'var(--ui-highlight-spotlight)',
    highlightOutline: 'var(--ui-highlight-outline)',
    highlightGlow: 'var(--ui-highlight-glow)',
  },
  
  // Gradients for enhanced visual effects
  gradients: {
    primary: 'var(--ui-gradient-primary)',
    accent: 'var(--ui-gradient-accent)',
    background: 'var(--ui-gradient-background)',
    ai: 'var(--ui-gradient-ai)',
  },
  
  // Animation tokens
  animations: {
    duration: {
      fast: 'var(--ui-duration-fast)',      // 0.2s
      normal: 'var(--ui-duration-normal)',  // 0.7s (primary)
      slow: 'var(--ui-duration-slow)',      // 1.2s
    },
    easing: {
      smooth: 'var(--ui-easing-smooth)',    // cubic-bezier(0.25, 0.46, 0.45, 0.94)
      bounce: 'var(--ui-easing-bounce)',    // cubic-bezier(0.68, -0.55, 0.265, 1.55)
      elastic: 'var(--ui-easing-elastic)',  // cubic-bezier(0.175, 0.885, 0.32, 1.275)
    },
  },
  
  // Spacing tokens (extending existing system)
  spacing: {
    xs: 'var(--ui-spacing-xs)',    // 0.5rem
    sm: 'var(--ui-spacing-sm)',    // 0.75rem
    md: 'var(--ui-spacing-md)',    // 1rem
    lg: 'var(--ui-spacing-lg)',    // 1.5rem
    xl: 'var(--ui-spacing-xl)',    // 2rem
    xxl: 'var(--ui-spacing-xxl)',  // 3rem
  },
  
  // Border radius tokens (extending existing --radius)
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    full: '9999px',
  },
  
  // Shadow tokens for depth and elevation
  shadows: {
    sm: 'var(--ui-shadow-sm)',
    md: 'var(--ui-shadow-md)',
    lg: 'var(--ui-shadow-lg)',
    xl: 'var(--ui-shadow-xl)',
    ai: 'var(--ui-shadow-ai)',
    highlight: 'var(--ui-shadow-highlight)',
  },
  
  // Typography tokens (extending existing font system)
  typography: {
    fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
    fontSize: {
      xs: 'var(--ui-text-xs)',
      sm: 'var(--ui-text-sm)',
      base: 'var(--ui-text-base)',
      lg: 'var(--ui-text-lg)',
      xl: 'var(--ui-text-xl)',
      xxl: 'var(--ui-text-xxl)',
    },
    lineHeight: {
      tight: 'var(--ui-leading-tight)',
      normal: 'var(--ui-leading-normal)',
      relaxed: 'var(--ui-leading-relaxed)',
    },
  },
} as const;

// Light theme tokens
export const lightThemeTokens: ThemeTokens = {
  colors: {
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    accent: 'oklch(0.97 0 0)',
    accentHover: 'oklch(0.94 0 0)',
    muted: 'oklch(0.97 0 0)',
    card: {
      background: 'oklch(1 0 0)',
      border: 'oklch(0.922 0 0)',
    },
    ai: {
      background: 'oklch(0.99 0 0)',
      border: 'oklch(0.88 0 0)',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, oklch(0.97 0 0) 0%, oklch(0.94 0 0) 100%)',
    accent: 'linear-gradient(135deg, oklch(0.205 0 0) 0%, oklch(0.145 0 0) 100%)',
    background: 'linear-gradient(180deg, oklch(1 0 0) 0%, oklch(0.99 0 0) 100%)',
  },
  animations: {
    duration: {
      fast: '0.2s',
      normal: '0.7s',
      slow: '1.2s',
    },
    easing: {
      smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
  },
};

// Dark theme tokens
export const darkThemeTokens: ThemeTokens = {
  colors: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    accent: 'oklch(0.269 0 0)',
    accentHover: 'oklch(0.32 0 0)',
    muted: 'oklch(0.269 0 0)',
    card: {
      background: 'oklch(0.205 0 0)',
      border: 'oklch(1 0 0 / 10%)',
    },
    ai: {
      background: 'oklch(0.18 0 0)',
      border: 'oklch(1 0 0 / 15%)',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, oklch(0.269 0 0) 0%, oklch(0.32 0 0) 100%)',
    accent: 'linear-gradient(135deg, oklch(0.922 0 0) 0%, oklch(0.985 0 0) 100%)',
    background: 'linear-gradient(180deg, oklch(0.145 0 0) 0%, oklch(0.18 0 0) 100%)',
  },
  animations: {
    duration: {
      fast: '0.2s',
      normal: '0.7s',
      slow: '1.2s',
    },
    easing: {
      smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
  },
};

// CSS custom properties generator
export function generateCSSCustomProperties(tokens: ThemeTokens): Record<string, string> {
  return {
    // UI System specific properties
    '--ui-ai-background': tokens.colors.ai.background,
    '--ui-ai-border': tokens.colors.ai.border,
    '--ui-ai-accent': tokens.colors.accent,
    
    // Highlight colors
    '--ui-highlight-spotlight': `${tokens.colors.accent} / 0.3`,
    '--ui-highlight-outline': tokens.colors.accent,
    '--ui-highlight-glow': `${tokens.colors.accent} / 0.5`,
    
    // Gradients
    '--ui-gradient-primary': tokens.gradients.primary,
    '--ui-gradient-accent': tokens.gradients.accent,
    '--ui-gradient-background': tokens.gradients.background,
    '--ui-gradient-ai': `linear-gradient(135deg, ${tokens.colors.ai.background} 0%, ${tokens.colors.card.background} 100%)`,
    
    // Animation durations
    '--ui-duration-fast': tokens.animations.duration.fast,
    '--ui-duration-normal': tokens.animations.duration.normal,
    '--ui-duration-slow': tokens.animations.duration.slow,
    
    // Animation easings
    '--ui-easing-smooth': tokens.animations.easing.smooth,
    '--ui-easing-bounce': tokens.animations.easing.bounce,
    '--ui-easing-elastic': tokens.animations.easing.elastic,
    
    // Spacing
    '--ui-spacing-xs': '0.5rem',
    '--ui-spacing-sm': '0.75rem',
    '--ui-spacing-md': '1rem',
    '--ui-spacing-lg': '1.5rem',
    '--ui-spacing-xl': '2rem',
    '--ui-spacing-xxl': '3rem',
    
    // Shadows
    '--ui-shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--ui-shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--ui-shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    '--ui-shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '--ui-shadow-ai': `0 8px 32px ${tokens.colors.ai.border}`,
    '--ui-shadow-highlight': `0 0 0 4px ${tokens.colors.accent} / 0.3`,
    
    // Typography
    '--ui-text-xs': '0.75rem',
    '--ui-text-sm': '0.875rem',
    '--ui-text-base': '1rem',
    '--ui-text-lg': '1.125rem',
    '--ui-text-xl': '1.25rem',
    '--ui-text-xxl': '1.5rem',
    '--ui-leading-tight': '1.25',
    '--ui-leading-normal': '1.5',
    '--ui-leading-relaxed': '1.75',
  };
}

// Utility function to apply theme tokens to document
export function applyThemeTokens(theme: 'light' | 'dark'): void {
  const tokens = theme === 'light' ? lightThemeTokens : darkThemeTokens;
  const customProperties = generateCSSCustomProperties(tokens);
  
  const root = document.documentElement;
  Object.entries(customProperties).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

// Get design token value by path
export function getDesignToken(path: string): string {
  const pathParts = path.split('.');
  let current: any = designTokens;
  
  for (const part of pathParts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`Design token not found: ${path}`);
      return '';
    }
  }
  
  return typeof current === 'string' ? current : '';
}

// Validate design token path
export function isValidDesignTokenPath(path: string): boolean {
  try {
    const value = getDesignToken(path);
    return value !== '';
  } catch {
    return false;
  }
}