/**
 * Theme System - UI System
 * 
 * Enhanced theme management system that builds on the existing shadcn/ui
 * foundation while adding AI coordination, animation support, and design tokens.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ThemeConfig, ThemeProviderProps, UseThemeReturn } from './types';
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

// Theme application with animation coordination
function applyTheme(theme: 'light' | 'dark', animate: boolean = true): Promise<void> {
  return new Promise((resolve) => {
    const root = document.documentElement;
    
    if (animate) {
      // Add transition class for smooth theme switching
      root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }
    
    // Apply theme class
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    // Apply design tokens
    applyThemeTokens(theme);
    
    if (animate) {
      // Remove transition after animation completes
      setTimeout(() => {
        root.style.transition = '';
        resolve();
      }, 300);
    } else {
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
    setThemeState(initialTheme);
    
    // Apply theme without animation on initial load
    applyTheme(initialTheme, false);
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

  // Theme setter with animation
  const setTheme = useCallback(async (newTheme: 'light' | 'dark') => {
    if (newTheme === theme || isAnimating) return;

    setIsAnimating(true);
    setThemeState(newTheme);
    setStoredTheme(storageKey, newTheme);
    
    try {
      await applyTheme(newTheme, true);
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

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
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

// AI coordination helpers
export function switchThemeWithAICoordination(
  theme: 'light' | 'dark',
  onAnimationStart?: () => void,
  onAnimationComplete?: () => void
): Promise<void> {
  return new Promise(async (resolve) => {
    onAnimationStart?.();
    
    try {
      await applyTheme(theme, true);
      onAnimationComplete?.();
      resolve();
    } catch (error) {
      console.error('Theme switch failed:', error);
      onAnimationComplete?.();
      resolve();
    }
  });
}

// Export theme configurations for external use
export const themeConfigs = {
  light: defaultLightTheme,
  dark: defaultDarkTheme,
} as const;