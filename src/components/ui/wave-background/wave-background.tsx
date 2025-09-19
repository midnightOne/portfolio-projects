"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    isReady: false
  });

  // Determine current theme
  const currentTheme = (theme === 'system' ? systemTheme : theme) as 'light' | 'dark';

  // ============================================================================
  // CONFIGURATION LOADING
  // ============================================================================

  const loadWaveConfiguration = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/admin/homepage/wave-config');
      
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

      setState(prev => ({
        ...prev,
        config: data.data.config,
        isLoading: false,
        isReady: true // Mark as ready when config is loaded
      }));

    } catch (error) {
      console.warn('Error loading wave configuration, using default:', error);
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
      shouldUseFallback
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

  const handlePerformanceChange = useCallback((fps: number) => {
    onPerformanceChange?.(fps);
    
    // Auto-fallback if performance is too low, but only when page is visible
    // Don't trigger fallback during alt+tab or when page is hidden
    if (fps < 30 && !state.shouldUseFallback && !document.hidden) {
      console.warn('Wave animation performance too low, switching to fallback');
      setState(prev => ({ ...prev, shouldUseFallback: true }));
    }
  }, [onPerformanceChange, state.shouldUseFallback]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const handleWaveError = useCallback((error: Error) => {
    console.error('Wave engine error:', error);
    setState(prev => ({ ...prev, shouldUseFallback: true, error: error.message }));
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
      // Reset performance monitoring when page becomes visible again
      // This prevents false positives from alt+tab scenarios
      if (!document.hidden && state.shouldUseFallback) {
        console.log('Page visible again, checking if we can restore wave animation...');
        // Don't automatically restore - let user refresh if needed
        // This prevents flickering between states
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty dependency array - only run once on mount

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
        theme={currentTheme || 'light'}
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