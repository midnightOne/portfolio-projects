"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WaveEngine, type WaveConfiguration } from './wave-engine';
import { defaultWaveConfig } from '@/lib/constants/wave-config';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface WaveBackgroundProps {
  className?: string;
  fallbackGradient?: string;
  onError?: (error: Error) => void;
  onPerformanceChange?: (fps: number) => void;
  interactive?: boolean;
}

interface WaveBackgroundState {
  config: WaveConfiguration | null;
  isLoading: boolean;
  error: string | null;
  shouldUseFallback: boolean;
  isSupported: boolean;
  isReady: boolean; // New flag to control when to start rendering
  fallbackReason: 'performance' | 'support' | 'error' | null; // Track why we fell back
}

interface FPSTracker {
  samples: number[];
  maxSamples: number;
  lastSampleTime: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

function getDevicePerformanceLevel(): 'high' | 'medium' | 'low' {
  // Check for mobile devices first - classify as medium to enable wave with reduced quality
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check for slow network connection
  const isSlowConnection = (navigator as any).connection && 
    ((navigator as any).connection.effectiveType === 'slow-2g' || 
     (navigator as any).connection.effectiveType === '2g' ||
     (navigator as any).connection.saveData);
  
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Only disable for reduced motion preference (accessibility)
  if (prefersReducedMotion) {
    return 'low';
  }
  
  // Mobile devices get medium performance (wave enabled but optimized)
  if (isMobile || isSlowConnection) {
    console.log('Mobile/slow connection detected - using medium performance for optimized wave rendering');
    return 'medium';
  }

  // Simple heuristic based on device capabilities
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');

  if (!gl) return 'low';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    if (renderer.includes('Intel') || renderer.includes('AMD')) {
      return 'medium';
    }
    if (renderer.includes('NVIDIA') || renderer.includes('Apple')) {
      return 'high';
    }
  }

  // Fallback based on screen size and pixel ratio
  const screenArea = window.screen.width * window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;

  if (screenArea > 2073600 && pixelRatio > 1.5) return 'high'; // > 1920x1080 with high DPI
  if (screenArea > 921600) return 'medium'; // > 1280x720
  return 'low';
}

function getFallbackGradient(theme: 'light' | 'dark'): string {
  if (theme === 'dark') {
    return 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a8a 100%)';
  }
  return 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WaveBackground({
  className,
  fallbackGradient,
  onError,
  onPerformanceChange,
  interactive = false
}: WaveBackgroundProps) {
  const { theme, systemTheme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [state, setState] = useState<WaveBackgroundState>({
    config: null,
    isLoading: true,
    error: null,
    shouldUseFallback: false,
    isSupported: true,
    isReady: false,
    fallbackReason: null
  });

  // FPS tracking for performance monitoring
  const fpsTrackerRef = useRef<FPSTracker>({
    samples: [],
    maxSamples: 50, // Track last 50 FPS samples (roughly 5 seconds at 60fps)
    lastSampleTime: 0
  });

  // State to track DOM-based theme changes (for SimpleThemeToggle compatibility)
  const [domTheme, setDomTheme] = useState<'light' | 'dark'>('light');

  // Determine current theme (reactive to both next-themes and DOM changes)
  const currentTheme = React.useMemo(() => {
    const nextThemeResolved = (theme === 'system' ? systemTheme : theme) as 'light' | 'dark';
    // Use next-themes if available, otherwise use DOM-based theme
    return nextThemeResolved || domTheme;
  }, [theme, systemTheme, domTheme]);

  // ============================================================================
  // CONFIGURATION LOADING
  // ============================================================================

  const loadWaveConfiguration = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Try to load from localStorage first (offline fallback)
      const cachedConfig = localStorage.getItem('wave-config-cache');
      const cacheTimestamp = localStorage.getItem('wave-config-timestamp');
      const isCacheValid = cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < 300000; // 5 minutes

      if (cachedConfig && isCacheValid) {
        try {
          const parsedConfig = JSON.parse(cachedConfig);
          console.log('Using cached wave configuration');
          setState(prev => ({
            ...prev,
            config: parsedConfig,
            isLoading: false,
            isReady: true
          }));
          return;
        } catch (parseError) {
          console.warn('Invalid cached wave config, fetching fresh config');
        }
      }

      // Add timeout and better error handling for mobile devices
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/api/admin/homepage/wave-config', {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-cache', // Prevent caching issues on mobile
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Wave config API returned ${response.status}, using default config`);
        // Always use default config if API fails
        setState(prev => ({
          ...prev,
          config: defaultWaveConfig,
          isLoading: false,
          isReady: true // Mark as ready when using default config
        }));
        return;
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Wave config API returned non-JSON response, using default config');
        setState(prev => ({
          ...prev,
          config: defaultWaveConfig,
          isLoading: false,
          isReady: true
        }));
        return;
      }

      const data = await response.json();

      // Validate the response structure
      if (!data.success || !data.data || !data.data.config) {
        console.warn('Invalid wave config response structure, using default');
        setState(prev => ({
          ...prev,
          config: defaultWaveConfig,
          isLoading: false,
          isReady: true // Mark as ready when using default config
        }));
        return;
      }

      // Cache the successful response
      try {
        localStorage.setItem('wave-config-cache', JSON.stringify(data.data.config));
        localStorage.setItem('wave-config-timestamp', Date.now().toString());
      } catch (storageError) {
        console.warn('Failed to cache wave config:', storageError);
      }

      setState(prev => ({
        ...prev,
        config: data.data.config,
        isLoading: false,
        isReady: true // Mark as ready when config is loaded
      }));

    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('Wave config request timed out, using default config');
        } else if (error.message.includes('<!DOCTYPE')) {
          console.warn('Wave config API returned HTML instead of JSON, using default config');
        } else {
          console.warn('Error loading wave configuration, using default:', error.message);
        }
      } else {
        console.warn('Unknown error loading wave configuration, using default:', error);
      }
      
      // Always fallback to default config to prevent homepage from breaking
      setState(prev => ({
        ...prev,
        config: defaultWaveConfig,
        error: null, // Don't show error to user, just use fallback
        isLoading: false,
        isReady: true // Mark as ready when using default config
      }));
    }
  }, []);

  // ============================================================================
  // PERFORMANCE AND SUPPORT DETECTION
  // ============================================================================

  const checkSupport = useCallback(() => {
    const isSupported = checkWebGLSupport();
    const performanceLevel = getDevicePerformanceLevel();
    const shouldUseFallback = !isSupported || performanceLevel === 'low';

    setState(prev => ({
      ...prev,
      isSupported,
      shouldUseFallback,
      fallbackReason: !isSupported ? 'support' : shouldUseFallback ? 'performance' : null
    }));

    if (!isSupported) {
      onError?.(new Error('WebGL not supported on this device'));
    }
  }, [onError]);

  // ============================================================================
  // DIMENSION HANDLING
  // ============================================================================

  const updateDimensions = useCallback(() => {
    if (typeof window !== 'undefined') {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  }, []);

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  const addFPSSample = useCallback((fps: number) => {
    const tracker = fpsTrackerRef.current;
    const now = Date.now();

    // Only add samples when page is visible and not during the first few seconds after visibility change
    if (!document.hidden && now - tracker.lastSampleTime > 100) { // Minimum 100ms between samples
      tracker.samples.push(fps);

      // Keep only the last N samples
      if (tracker.samples.length > tracker.maxSamples) {
        tracker.samples.shift();
      }

      tracker.lastSampleTime = now;
    }
  }, []);

  const getAverageFPS = useCallback(() => {
    const samples = fpsTrackerRef.current.samples;
    if (samples.length === 0) return 60; // Default to good FPS if no samples

    const sum = samples.reduce((acc, fps) => acc + fps, 0);
    return sum / samples.length;
  }, []);

  const handlePerformanceChange = useCallback((fps: number) => {
    onPerformanceChange?.(fps);

    // Add FPS sample for averaging (only when page is visible)
    addFPSSample(fps);

    // Only check for fallback if we have enough samples and page is visible
    const tracker = fpsTrackerRef.current;
    if (tracker.samples.length >= 10 && !document.hidden && !state.shouldUseFallback) {
      const averageFPS = getAverageFPS();

      // Trigger fallback only if average FPS over time is consistently low
      if (averageFPS < 25) { // Slightly lower threshold for average
        console.warn(`Wave animation average performance too low (${averageFPS.toFixed(1)} FPS), switching to fallback`);
        setState(prev => ({
          ...prev,
          shouldUseFallback: true,
          fallbackReason: 'performance'
        }));
      }
    }
  }, [onPerformanceChange, state.shouldUseFallback, addFPSSample, getAverageFPS]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const handleWaveError = useCallback((error: Error) => {
    console.error('Wave engine error:', error);
    setState(prev => ({
      ...prev,
      shouldUseFallback: true,
      error: error.message,
      fallbackReason: 'error'
    }));
    onError?.(error);
  }, [onError]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    checkSupport();
    updateDimensions();
    loadWaveConfiguration();

    const handleResize = () => updateDimensions();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible - reset FPS tracking to avoid contamination
        console.log('Page visible again, resetting FPS tracking...');
        fpsTrackerRef.current.samples = [];
        fpsTrackerRef.current.lastSampleTime = Date.now();

        // Don't automatically restore fallback - let user refresh if needed
        // This prevents flickering between states
      }
    };

    // Watch for DOM class changes (for SimpleThemeToggle compatibility)
    const updateDomTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const newDomTheme = isDark ? 'dark' : 'light';
      setDomTheme(newDomTheme);
    };

    // Initial DOM theme detection
    updateDomTheme();

    // Watch for DOM class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateDomTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty dependency array - only run once on mount

  // Log theme changes for debugging
  useEffect(() => {
    console.log('Wave background theme changed to:', currentTheme, {
      nextTheme: theme,
      systemTheme,
      domTheme,
      domClasses: document.documentElement.className
    });
  }, [currentTheme, theme, systemTheme, domTheme]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show fallback if not supported, performance is low, or error occurred
  // Just return empty div to show clean homepage background
  if (state.shouldUseFallback || !state.isSupported || state.error) {
    return (
      <div className={cn('absolute inset-0 -z-10', className)} />
    );
  }

  // Show loading state - clean background until everything is ready
  if (state.isLoading || !state.config || !state.isReady || dimensions.width === 0) {
    return (
      <div className={cn('absolute inset-0 -z-10', className)} />
    );
  }

  // Only render wave engine when everything is ready
  return (
    <div className={cn('absolute inset-0 -z-10', className)}>
      <WaveEngine
        key="wave-engine" // Stable key to prevent re-mounting
        config={state.config}
        theme={currentTheme}
        width={dimensions.width}
        height={dimensions.height}
        interactive={interactive}
        onError={handleWaveError}
        onPerformanceChange={handlePerformanceChange}
        className="w-full h-full"
      />
    </div>
  );
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export { type WaveConfiguration, wavePresets } from './wave-engine';
export { defaultWaveConfig } from '@/lib/constants/wave-config';