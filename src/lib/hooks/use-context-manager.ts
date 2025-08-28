/**
 * React hook for using the Context Manager
 * Provides client-side interface to the AI context building system
 */

import React, { useState, useCallback, useRef } from 'react';
import { ContextSource, ContextBuildOptions } from '@/lib/services/ai/context-manager';

export interface ContextResult {
  context: string;
  fromCache: boolean;
  sessionId: string;
  query: string;
  processingTime: number;
  tokenCount: number;
  cacheStats: {
    size: number;
    sessions: string[];
    totalTokens: number;
  };
}

export interface UseContextManagerOptions {
  sessionId?: string;
  defaultSources?: ContextSource[];
  defaultOptions?: ContextBuildOptions;
  enableCache?: boolean;
}

export interface UseContextManagerReturn {
  // State
  isLoading: boolean;
  error: string | null;
  lastResult: ContextResult | null;
  
  // Actions
  buildContext: (query: string, sources?: ContextSource[], options?: ContextBuildOptions) => Promise<ContextResult>;
  clearCache: (sessionId?: string) => Promise<void>;
  getCacheStats: () => Promise<any>;
  
  // Utilities
  reset: () => void;
}

export function useContextManager(options: UseContextManagerOptions = {}): UseContextManagerReturn {
  const {
    sessionId: providedSessionId,
    defaultSources = [],
    defaultOptions = {},
    enableCache = true
  } = options;

  // Generate session ID if not provided
  const sessionIdRef = useRef(providedSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const sessionId = sessionIdRef.current;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ContextResult | null>(null);

  /**
   * Build context for AI conversations
   */
  const buildContext = useCallback(async (
    query: string,
    sources: ContextSource[] = defaultSources,
    options: ContextBuildOptions = defaultOptions
  ): Promise<ContextResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          query,
          sources,
          options,
          useCache: enableCache
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to build context');
      }

      const data = await response.json();
      const result = data.data as ContextResult;
      
      setLastResult(result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, defaultSources, defaultOptions, enableCache]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(async (targetSessionId?: string): Promise<void> => {
    try {
      const url = targetSessionId 
        ? `/api/ai/context/cache?sessionId=${encodeURIComponent(targetSessionId)}`
        : '/api/ai/context/cache';

      const response = await fetch(url, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to clear cache');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/context/cache');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get cache stats');
      }

      const data = await response.json();
      return data.data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastResult(null);
  }, []);

  return {
    // State
    isLoading,
    error,
    lastResult,
    
    // Actions
    buildContext,
    clearCache,
    getCacheStats,
    
    // Utilities
    reset
  };
}

/**
 * Hook for building context with automatic session management
 */
export function useAutoContextManager(
  query: string,
  sources?: ContextSource[],
  options?: ContextBuildOptions & { enabled?: boolean }
) {
  const { enabled = true, ...contextOptions } = options || {};
  const contextManager = useContextManager();
  
  const [result, setResult] = useState<ContextResult | null>(null);

  // Auto-build context when query changes
  React.useEffect(() => {
    if (!enabled || !query || query.trim().length < 2) {
      return;
    }

    let cancelled = false;

    const buildContext = async () => {
      try {
        const result = await contextManager.buildContext(query, sources, contextOptions);
        if (!cancelled) {
          setResult(result);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Auto context building failed:', error);
        }
      }
    };

    buildContext();

    return () => {
      cancelled = true;
    };
  }, [query, enabled, sources, contextOptions, contextManager]);

  return {
    ...contextManager,
    result
  };
}