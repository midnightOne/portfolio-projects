/**
 * Project Indexing Hook
 * Automatically triggers project indexing when projects are updated
 * Integrates with the Client-Side AI Assistant's context management system
 */

import { useCallback, useEffect } from 'react';
import { projectIndexer } from '@/lib/services/project-indexer';

export interface ProjectIndexingOptions {
  autoIndex?: boolean;
  debounceMs?: number;
  onIndexComplete?: (projectId: string, success: boolean) => void;
  onIndexError?: (projectId: string, error: Error) => void;
}

export function useProjectIndexing(options: ProjectIndexingOptions = {}) {
  const {
    autoIndex = true,
    debounceMs = 2000,
    onIndexComplete,
    onIndexError
  } = options;

  // Debounced indexing function
  const indexProject = useCallback(
    debounce(async (projectId: string) => {
      if (!autoIndex) return;

      try {
        await projectIndexer.indexProject(projectId);
        onIndexComplete?.(projectId, true);
      } catch (error) {
        console.error(`Failed to index project ${projectId}:`, error);
        onIndexError?.(projectId, error as Error);
        onIndexComplete?.(projectId, false);
      }
    }, debounceMs),
    [autoIndex, debounceMs, onIndexComplete, onIndexError]
  );

  // Manual indexing function
  const manualIndexProject = useCallback(async (projectId: string) => {
    try {
      // Clear cache to force fresh indexing
      projectIndexer.clearProjectCache(projectId);
      await projectIndexer.indexProject(projectId);
      onIndexComplete?.(projectId, true);
      return true;
    } catch (error) {
      console.error(`Failed to manually index project ${projectId}:`, error);
      onIndexError?.(projectId, error as Error);
      onIndexComplete?.(projectId, false);
      return false;
    }
  }, [onIndexComplete, onIndexError]);

  // Batch indexing function
  const indexMultipleProjects = useCallback(async (projectIds: string[]) => {
    const results: Array<{ projectId: string; success: boolean; error?: Error }> = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < projectIds.length; i += batchSize) {
      const batch = projectIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (projectId) => {
        try {
          await projectIndexer.indexProject(projectId);
          onIndexComplete?.(projectId, true);
          return { projectId, success: true };
        } catch (error) {
          console.error(`Failed to index project ${projectId}:`, error);
          onIndexError?.(projectId, error as Error);
          onIndexComplete?.(projectId, false);
          return { projectId, success: false, error: error as Error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }, [onIndexComplete, onIndexError]);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    return projectIndexer.getCacheStats();
  }, []);

  // Clear cache
  const clearCache = useCallback((projectId?: string) => {
    if (projectId) {
      projectIndexer.clearProjectCache(projectId);
    } else {
      projectIndexer.clearAllCache();
    }
  }, []);

  return {
    indexProject,
    manualIndexProject,
    indexMultipleProjects,
    getCacheStats,
    clearCache
  };
}

/**
 * Hook for monitoring project changes and triggering indexing
 */
export function useProjectChangeMonitor(projectId: string, options: ProjectIndexingOptions = {}) {
  const { indexProject } = useProjectIndexing(options);

  // Monitor project changes
  useEffect(() => {
    if (!projectId) return;

    // Trigger indexing when component mounts (project loaded)
    indexProject(projectId);

    // Set up event listener for project updates
    const handleProjectUpdate = (event: CustomEvent) => {
      if (event.detail.projectId === projectId) {
        indexProject(projectId);
      }
    };

    // Listen for custom project update events
    window.addEventListener('projectUpdated', handleProjectUpdate as EventListener);

    return () => {
      window.removeEventListener('projectUpdated', handleProjectUpdate as EventListener);
    };
  }, [projectId, indexProject]);

  return { indexProject };
}

/**
 * Hook for triggering indexing on project save
 */
export function useProjectSaveIndexing(options: ProjectIndexingOptions = {}) {
  const { indexProject } = useProjectIndexing(options);

  const handleProjectSave = useCallback(async (projectId: string) => {
    // Trigger indexing after save
    await indexProject(projectId);
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('projectUpdated', {
      detail: { projectId }
    }));
  }, [indexProject]);

  return { handleProjectSave };
}

/**
 * Utility function for debouncing
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Hook for getting project summaries for AI context
 */
export function useProjectSummaries(projectIds: string[]) {
  const [summaries, setSummaries] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummaries = useCallback(async () => {
    if (projectIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const summaryPromises = projectIds.map(async (projectId) => {
        try {
          const summary = await projectIndexer.getProjectSummary(projectId);
          return { projectId, summary };
        } catch (err) {
          console.warn(`Failed to get summary for project ${projectId}:`, err);
          return { projectId, summary: null };
        }
      });

      const results = await Promise.all(summaryPromises);
      const summaryMap = new Map();
      
      results.forEach(({ projectId, summary }) => {
        if (summary) {
          summaryMap.set(projectId, summary);
        }
      });

      setSummaries(summaryMap);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectIds]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  return {
    summaries,
    loading,
    error,
    refetch: fetchSummaries
  };
}

// Import useState for the last hook
import { useState } from 'react';