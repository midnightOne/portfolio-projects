/**
 * React hook for managing content sources
 * Provides client-side interface to the content source management system
 */

import { useState, useCallback, useEffect } from 'react';

export interface ContentSource {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  summary: string;
  lastUpdated: Date;
  priority: number;
  config: Record<string, any>;
  schema?: ContentSourceSchema;
  provider: {
    id: string;
    name: string;
    description: string;
    version: string;
  };
  metadata?: {
    lastUpdated: Date;
    itemCount: number;
    size: number;
    tags: string[];
    summary: string;
  };
  isAvailable?: boolean;
}

export interface ContentSourceSchema {
  configFields: ConfigField[];
  searchFilters: SearchFilter[];
  outputFormat: OutputFormat;
}

export interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: { value: any; label: string }[];
}

export interface SearchFilter {
  key: string;
  type: 'text' | 'date' | 'number' | 'select';
  label: string;
  description?: string;
}

export interface OutputFormat {
  fields: string[];
  supportedFormats: ('text' | 'json' | 'markdown')[];
}

export interface UseContentSourcesOptions {
  autoLoad?: boolean;
  refreshInterval?: number;
}

export interface UseContentSourcesReturn {
  // State
  sources: ContentSource[];
  loading: boolean;
  error: string | null;
  
  // Statistics
  totalCount: number;
  enabledCount: number;
  
  // Actions
  loadSources: () => Promise<void>;
  toggleSource: (sourceId: string, enabled: boolean) => Promise<void>;
  updatePriority: (sourceId: string, priority: number) => Promise<void>;
  updateConfig: (sourceId: string, config: Record<string, any>) => Promise<void>;
  refreshSources: () => Promise<void>;
  
  // Utilities
  getSource: (sourceId: string) => ContentSource | undefined;
  getEnabledSources: () => ContentSource[];
  getSortedSources: () => ContentSource[];
  reset: () => void;
}

export function useContentSources(options: UseContentSourcesOptions = {}): UseContentSourcesReturn {
  const { autoLoad = true, refreshInterval } = options;

  // State
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load content sources from API
   */
  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/ai/content-sources');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to load content sources');
      }

      const data = await response.json();
      setSources(data.data?.sources || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Toggle source enabled/disabled
   */
  const toggleSource = useCallback(async (sourceId: string, enabled: boolean) => {
    try {
      setError(null);

      const response = await fetch(`/api/admin/ai/content-sources/${sourceId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to toggle source');
      }

      // Update local state
      setSources(prev => prev.map(source => 
        source.id === sourceId ? { ...source, enabled } : source
      ));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Update source priority
   */
  const updatePriority = useCallback(async (sourceId: string, priority: number) => {
    try {
      setError(null);

      if (priority < 0 || priority > 100) {
        throw new Error('Priority must be between 0 and 100');
      }

      const response = await fetch(`/api/admin/ai/content-sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update priority');
      }

      // Update local state
      setSources(prev => prev.map(source => 
        source.id === sourceId ? { ...source, priority } : source
      ));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Update source configuration
   */
  const updateConfig = useCallback(async (sourceId: string, config: Record<string, any>) => {
    try {
      setError(null);

      const response = await fetch(`/api/admin/ai/content-sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update configuration');
      }

      // Update local state
      setSources(prev => prev.map(source => 
        source.id === sourceId ? { ...source, config: { ...source.config, ...config } } : source
      ));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Refresh sources (reload from server)
   */
  const refreshSources = useCallback(async () => {
    await loadSources();
  }, [loadSources]);

  /**
   * Get specific source by ID
   */
  const getSource = useCallback((sourceId: string): ContentSource | undefined => {
    return sources.find(source => source.id === sourceId);
  }, [sources]);

  /**
   * Get only enabled sources
   */
  const getEnabledSources = useCallback((): ContentSource[] => {
    return sources.filter(source => source.enabled);
  }, [sources]);

  /**
   * Get sources sorted by priority (highest first)
   */
  const getSortedSources = useCallback((): ContentSource[] => {
    return [...sources].sort((a, b) => b.priority - a.priority);
  }, [sources]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setSources([]);
    setLoading(false);
    setError(null);
  }, []);

  // Auto-load sources on mount
  useEffect(() => {
    if (autoLoad) {
      loadSources();
    }
  }, [autoLoad, loadSources]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        loadSources();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadSources]);

  // Calculate statistics
  const totalCount = sources.length;
  const enabledCount = sources.filter(s => s.enabled).length;

  return {
    // State
    sources,
    loading,
    error,
    
    // Statistics
    totalCount,
    enabledCount,
    
    // Actions
    loadSources,
    toggleSource,
    updatePriority,
    updateConfig,
    refreshSources,
    
    // Utilities
    getSource,
    getEnabledSources,
    getSortedSources,
    reset
  };
}

/**
 * Hook for getting a specific content source
 */
export function useContentSource(sourceId: string) {
  const { sources, loading, error, loadSources } = useContentSources();
  const source = sources.find(s => s.id === sourceId);

  return {
    source,
    loading,
    error,
    loadSources,
    exists: !!source
  };
}

/**
 * Hook for content source statistics
 */
export function useContentSourceStats() {
  const { sources, loading, error } = useContentSources();

  const stats = {
    total: sources.length,
    enabled: sources.filter(s => s.enabled).length,
    disabled: sources.filter(s => !s.enabled).length,
    available: sources.filter(s => s.isAvailable).length,
    unavailable: sources.filter(s => !s.isAvailable).length,
    totalItems: sources.reduce((sum, s) => sum + (s.metadata?.itemCount || 0), 0),
    totalSize: sources.reduce((sum, s) => sum + (s.metadata?.size || 0), 0),
    byType: sources.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return {
    stats,
    loading,
    error
  };
}