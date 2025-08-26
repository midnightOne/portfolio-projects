/**
 * Responsive Design Hook - UI System
 * 
 * Desktop-first responsive design utilities that provide breakpoint
 * detection and responsive behavior management for the UI system.
 */

'use client';

import { useState, useEffect } from 'react';
import type { UseResponsiveReturn } from './types';
import { UI_LAYOUT } from './layout-constants';

// Breakpoint values
const breakpoints = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
} as const;

// Get current breakpoint based on window width
function getCurrentBreakpoint(width: number): 'desktop' | 'tablet' | 'mobile' {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
}

// Check if window matches media query
function matchesMediaQuery(query: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
}

export function useResponsive(): UseResponsiveReturn {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const [mounted, setMounted] = useState(false);

  // Update dimensions on window resize
  useEffect(() => {
    setMounted(true);

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    
    // Set initial dimensions
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return {
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1024,
      height: 768,
    };
  }

  const breakpoint = getCurrentBreakpoint(dimensions.width);
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop';

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    width: dimensions.width,
    height: dimensions.height,
  };
}

// Utility hooks for specific breakpoint checks
export function useIsMobile(): boolean {
  const { isMobile } = useResponsive();
  return isMobile;
}

export function useIsTablet(): boolean {
  const { isTablet } = useResponsive();
  return isTablet;
}

export function useIsDesktop(): boolean {
  const { isDesktop } = useResponsive();
  return isDesktop;
}

// Media query hooks
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  // Prevent hydration mismatch
  if (!mounted) return false;

  return matches;
}

// Specific media query hooks for common breakpoints
export function useDesktopMediaQuery(): boolean {
  return useMediaQuery(`(min-width: ${breakpoints.desktop}px)`);
}

export function useTabletMediaQuery(): boolean {
  return useMediaQuery(`(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px)`);
}

export function useMobileMediaQuery(): boolean {
  return useMediaQuery(`(max-width: ${breakpoints.tablet - 1}px)`);
}

// Reduced motion detection
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// Dark mode preference detection
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

// Utility functions for responsive behavior
export function getResponsiveValue<T>(
  values: {
    mobile?: T;
    tablet?: T;
    desktop: T;
  },
  currentBreakpoint: 'desktop' | 'tablet' | 'mobile'
): T {
  switch (currentBreakpoint) {
    case 'mobile':
      return values.mobile ?? values.tablet ?? values.desktop;
    case 'tablet':
      return values.tablet ?? values.desktop;
    case 'desktop':
      return values.desktop;
  }
}

// Hook for responsive values
export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop: T;
}): T {
  const { breakpoint } = useResponsive();
  return getResponsiveValue(values, breakpoint);
}

// Breakpoint constants for external use
export const RESPONSIVE_BREAKPOINTS = breakpoints;

// CSS media query strings
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${breakpoints.tablet - 1}px)`,
  tablet: `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px)`,
  desktop: `(min-width: ${breakpoints.desktop}px)`,
  tabletAndUp: `(min-width: ${breakpoints.tablet}px)`,
  desktopAndUp: `(min-width: ${breakpoints.desktop}px)`,
} as const;