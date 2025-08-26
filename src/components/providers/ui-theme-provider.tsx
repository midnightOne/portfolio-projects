/**
 * UI Theme Provider - Enhanced Theme Provider
 * 
 * Enhanced theme provider that wraps the UI system theme management
 * with the existing session provider structure. Provides backward
 * compatibility while adding AI coordination and animation support.
 */

'use client';

import { ThemeProvider } from '@/lib/ui/theme';
import type { ThemeProviderProps } from '@/lib/ui/types';

export function UIThemeProvider({ 
  children, 
  defaultTheme = 'light',
  storageKey = 'portfolio-theme',
  enableSystem = true 
}: ThemeProviderProps) {
  return (
    <ThemeProvider
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      enableSystem={enableSystem}
    >
      {children}
    </ThemeProvider>
  );
}