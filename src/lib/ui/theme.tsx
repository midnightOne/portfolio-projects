/**
 * Theme System - UI System
 * 
 * Enhanced theme management system that builds on the existing shadcn/ui
 * foundation while adding AI coordination, animation support, and design tokens.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// Conditional GSAP import with fallback
let gsap: any = null;
try {
  gsap = require('gsap').gsap;
} catch (error) {
  console.warn('GSAP not available, using fallback animations');
}
import type { ThemeConfig, ThemeProviderProps, UseThemeReturn, ThemeTokens } from './types';
import { lightThemeTokens, darkThemeTokens, applyThemeTokens } from './design-tokens';

// Theme context
interface ThemeContextType {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  systemTheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
  isAnimating: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Default theme configurations
export const defaultLightTheme: ThemeConfig = {
  id: 'light',
  name: 'Light',
  type: 'light',
  tokens: lightThemeTokens,
  customizations: {
    components: {},
    animations: {
      duration: 0.7,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      respectReducedMotion: true,
    },
  },
};

export const defaultDarkTheme: ThemeConfig = {
  id: 'dark',
  name: 'Dark',
  type: 'dark',
  tokens: darkThemeTokens,
  customizations: {
    components: {},
    animations: {
      duration: 0.7,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      respectReducedMotion: true,
    },
  },
};

// System theme detection
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Storage helpers
function getStoredTheme(storageKey: string): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function setStoredTheme(storageKey: string, theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Ignore storage errors
  }
}

// Theme application with GSAP animation coordination
function applyTheme(theme: 'light' | 'dark', animate: boolean = true): Promise<void> {
  return new Promise((resolve) => {
    const root = document.documentElement;
    
    if (animate && gsap) {
      // Use GSAP for smooth theme transitions
      const tl = gsap.timeline({
        onComplete: () => {
          resolve();
        }
      });

      // Animate theme transition with GSAP
      tl.to(root, {
        duration: 0.3,
        ease: 'power2.out',
        onStart: () => {
          // Apply theme class and tokens at start of animation
          root.classList.remove('light', 'dark');
          root.classList.add(theme);
          applyThemeTokens(theme);
        }
      });

      // Coordinate with any ongoing animations
      const animationSystem = (globalThis as any).__uiAnimationSystem;
      if (animationSystem?.isAnimating?.()) {
        // Delay theme change if animations are running
        tl.delay(0.1);
      }
    } else if (animate && !gsap) {
      // Fallback CSS transition animation
      root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      applyThemeTokens(theme);
      
      setTimeout(() => {
        root.style.transition = '';
        resolve();
      }, 300);
    } else {
      // Immediate theme application
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      applyThemeTokens(theme);
      resolve();
    }
  });
}

// Theme Provider Component
export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'ui-theme',
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<'light' | 'dark'>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme(storageKey);
    const currentSystemTheme = getSystemTheme();
    
    setSystemTheme(currentSystemTheme);
    
    const initialTheme = storedTheme || (enableSystem ? currentSystemTheme : defaultTheme);
    
    // Check if theme is already applied by the script in layout
    const hasThemeClass = document.documentElement.classList.contains('light') || 
                         document.documentElement.classList.contains('dark');
    
    if (!hasThemeClass) {
      applyTheme(initialTheme, false);
    }
    
    setThemeState(initialTheme);
    setMounted(true);
  }, [defaultTheme, storageKey, enableSystem]);

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem || !mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(newSystemTheme);
      
      // Only update theme if no manual theme is stored
      const storedTheme = getStoredTheme(storageKey);
      if (!storedTheme) {
        setThemeState(newSystemTheme);
        applyTheme(newSystemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [enableSystem, mounted, storageKey]);

  // Theme setter with GSAP animation coordination
  const setTheme = useCallback(async (newTheme: 'light' | 'dark') => {
    if (newTheme === theme || isAnimating) return;

    setIsAnimating(true);
    setThemeState(newTheme);
    setStoredTheme(storageKey, newTheme);
    
    try {
      // Coordinate with ongoing animations
      const animationSystem = (globalThis as any).__uiAnimationSystem;
      if (animationSystem?.isAnimating?.()) {
        // Wait for current animations to complete before theme change
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await applyTheme(newTheme, true);
      
      // Notify animation system of theme change
      if (animationSystem?.onThemeChange) {
        animationSystem.onThemeChange(newTheme);
      }
    } finally {
      setIsAnimating(false);
    }
  }, [theme, isAnimating, storageKey]);

  // Theme toggler
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  // Resolved theme (accounts for system preference)
  const resolvedTheme = theme;

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    systemTheme,
    resolvedTheme,
    isAnimating,
  };

  // Prevent hydration mismatch - use suppressHydrationWarning instead of hiding
  if (!mounted) {
    return <div suppressHydrationWarning>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Theme hook
export function useTheme(): UseThemeReturn {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

// Theme utilities
export function getCurrentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function getThemeConfig(theme: 'light' | 'dark'): ThemeConfig {
  return theme === 'light' ? defaultLightTheme : defaultDarkTheme;
}

export function isSystemDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Theme validation
export function isValidTheme(value: string): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

// Custom theme variants (built on shadcn/ui foundation)
export const customThemeVariants = {
  // Professional variant with enhanced contrast
  professional: {
    light: {
      ...defaultLightTheme,
      id: 'professional-light',
      name: 'Professional Light',
      tokens: {
        ...lightThemeTokens,
        colors: {
          ...lightThemeTokens.colors,
          accent: 'oklch(0.94 0 0)',
          accentHover: 'oklch(0.91 0 0)',
          ai: {
            background: 'oklch(0.98 0 0)',
            border: 'oklch(0.85 0 0)',
          },
        },
      },
    },
    dark: {
      ...defaultDarkTheme,
      id: 'professional-dark',
      name: 'Professional Dark',
      tokens: {
        ...darkThemeTokens,
        colors: {
          ...darkThemeTokens.colors,
          accent: 'oklch(0.32 0 0)',
          accentHover: 'oklch(0.35 0 0)',
          ai: {
            background: 'oklch(0.16 0 0)',
            border: 'oklch(1 0 0 / 20%)',
          },
        },
      },
    },
  },
  
  // Warm variant with subtle color tints
  warm: {
    light: {
      ...defaultLightTheme,
      id: 'warm-light',
      name: 'Warm Light',
      tokens: {
        ...lightThemeTokens,
        colors: {
          ...lightThemeTokens.colors,
          background: 'oklch(0.99 0.01 85)',
          accent: 'oklch(0.96 0.02 85)',
          accentHover: 'oklch(0.93 0.02 85)',
          ai: {
            background: 'oklch(0.98 0.01 85)',
            border: 'oklch(0.87 0.02 85)',
          },
        },
      },
    },
    dark: {
      ...defaultDarkTheme,
      id: 'warm-dark',
      name: 'Warm Dark',
      tokens: {
        ...darkThemeTokens,
        colors: {
          ...darkThemeTokens.colors,
          background: 'oklch(0.15 0.01 85)',
          accent: 'oklch(0.28 0.02 85)',
          accentHover: 'oklch(0.31 0.02 85)',
          ai: {
            background: 'oklch(0.19 0.01 85)',
            border: 'oklch(1 0 0 / 18%)',
          },
        },
      },
    },
  },
  
  // Cool variant with blue tints
  cool: {
    light: {
      ...defaultLightTheme,
      id: 'cool-light',
      name: 'Cool Light',
      tokens: {
        ...lightThemeTokens,
        colors: {
          ...lightThemeTokens.colors,
          background: 'oklch(0.99 0.01 240)',
          accent: 'oklch(0.96 0.02 240)',
          accentHover: 'oklch(0.93 0.02 240)',
          ai: {
            background: 'oklch(0.98 0.01 240)',
            border: 'oklch(0.87 0.02 240)',
          },
        },
      },
    },
    dark: {
      ...defaultDarkTheme,
      id: 'cool-dark',
      name: 'Cool Dark',
      tokens: {
        ...darkThemeTokens,
        colors: {
          ...darkThemeTokens.colors,
          background: 'oklch(0.15 0.01 240)',
          accent: 'oklch(0.28 0.02 240)',
          accentHover: 'oklch(0.31 0.02 240)',
          ai: {
            background: 'oklch(0.19 0.01 240)',
            border: 'oklch(1 0 0 / 18%)',
          },
        },
      },
    },
  },
} as const;

// AI coordination helpers with enhanced GSAP integration
export function switchThemeWithAICoordination(
  theme: 'light' | 'dark',
  onAnimationStart?: () => void,
  onAnimationComplete?: () => void
): Promise<void> {
  return new Promise(async (resolve) => {
    onAnimationStart?.();
    
    try {
      // Pause any ongoing animations during theme switch
      const animationSystem = (globalThis as any).__uiAnimationSystem;
      const wasAnimating = animationSystem?.isAnimating?.();
      
      if (wasAnimating) {
        animationSystem?.pauseAnimations?.();
      }
      
      // Apply theme with GSAP coordination
      await applyTheme(theme, true);
      
      // Resume animations after theme change
      if (wasAnimating) {
        animationSystem?.resumeAnimations?.();
      }
      
      onAnimationComplete?.();
      resolve();
    } catch (error) {
      console.error('Theme switch failed:', error);
      onAnimationComplete?.();
      resolve();
    }
  });
}

// Enhanced theme switching with custom variants
export function switchToCustomTheme(
  variant: keyof typeof customThemeVariants,
  mode: 'light' | 'dark',
  animate: boolean = true
): Promise<void> {
  const themeConfig = customThemeVariants[variant][mode];
  
  return new Promise(async (resolve) => {
    try {
      // Apply custom theme tokens
      const root = document.documentElement;
      
      if (animate) {
        const tl = gsap.timeline({
          onComplete: resolve,
        });

        tl.to(root, {
          duration: 0.4,
          ease: 'power2.out',
          onStart: () => {
            root.classList.remove('light', 'dark');
            root.classList.add(mode);
            applyThemeTokens(mode);
            
            // Apply custom variant tokens
            const customProperties = generateCustomThemeProperties(themeConfig.tokens);
            Object.entries(customProperties).forEach(([property, value]) => {
              root.style.setProperty(property, value);
            });
          }
        });
      } else {
        root.classList.remove('light', 'dark');
        root.classList.add(mode);
        applyThemeTokens(mode);
        
        const customProperties = generateCustomThemeProperties(themeConfig.tokens);
        Object.entries(customProperties).forEach(([property, value]) => {
          root.style.setProperty(property, value);
        });
        
        resolve();
      }
    } catch (error) {
      console.error('Custom theme switch failed:', error);
      resolve();
    }
  });
}

// Generate custom theme properties
function generateCustomThemeProperties(tokens: ThemeTokens): Record<string, string> {
  return {
    '--ui-ai-background': tokens.colors.ai.background,
    '--ui-ai-border': tokens.colors.ai.border,
    '--ui-ai-accent': tokens.colors.accent,
    '--ui-highlight-spotlight': `${tokens.colors.accent} / 0.3`,
    '--ui-highlight-outline': tokens.colors.accent,
    '--ui-highlight-glow': `${tokens.colors.accent} / 0.5`,
    '--ui-gradient-primary': tokens.gradients.primary,
    '--ui-gradient-accent': tokens.gradients.accent,
    '--ui-gradient-background': tokens.gradients.background,
  };
}

// Export theme configurations for external use
export const themeConfigs = {
  light: defaultLightTheme,
  dark: defaultDarkTheme,
  variants: customThemeVariants,
} as const;

// Theme variant utilities
export function getAvailableThemeVariants(): string[] {
  return Object.keys(customThemeVariants);
}

export function getThemeVariant(variant: keyof typeof customThemeVariants, mode: 'light' | 'dark'): ThemeConfig {
  return customThemeVariants[variant][mode];
}

export function isValidThemeVariant(variant: string): variant is keyof typeof customThemeVariants {
  return variant in customThemeVariants;
}