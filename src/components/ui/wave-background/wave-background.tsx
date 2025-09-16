"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { WaveEngine, type WaveConfiguration, defaultWaveConfig } from './wave-engine';
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
    isSupported: true
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
        if (response.status === 404) {
          // No configuration found, use default
          setState(prev => ({
            ...prev,
            config: defaultWaveConfig,
            isLoading: false
          }));
          return;
        }
        throw new Error(`Failed to load wave configuration: ${response.statusText}`);
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        config: data.data.config || defaultWaveConfig,
        isLoading: false
      }));

    } catch (error) {
      console.error('Error loading wave configuration:', error);
      setState(prev => ({
        ...prev,
        config: defaultWaveConfig, // Fallback to default
        error: error instanceof Error ? error.message : 'Failed to load configuration',
        isLoading: false
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
    
    // Auto-fallback if performance is too low
    if (fps < 30 && !state.shouldUseFallback) {
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
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [checkSupport, updateDimensions, loadWaveConfiguration]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show fallback if not supported, performance is low, or error occurred
  if (state.shouldUseFallback || !state.isSupported || state.error) {
    const gradient = fallbackGradient || getFallbackGradient(currentTheme || 'light');
    
    return (
      <div
        className={cn('absolute inset-0 -z-10', className)}
        style={{ background: gradient }}
      >
        {/* Optional pattern overlay for fallback */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:20px_20px]" />
        </div>
      </div>
    );
  }

  // Show loading state
  if (state.isLoading || !state.config || dimensions.width === 0) {
    const gradient = fallbackGradient || getFallbackGradient(currentTheme || 'light');
    
    return (
      <div
        className={cn('absolute inset-0 -z-10', className)}
        style={{ background: gradient }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/50 text-sm">Loading wave animation...</div>
        </div>
      </div>
    );
  }

  // Render wave engine
  return (
    <div className={cn('absolute inset-0 -z-10', className)}>
      <WaveEngine
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

export { type WaveConfiguration, defaultWaveConfig, wavePresets } from './wave-engine';