"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';
import type { SortOption } from '@/components/layout/navigation-bar';
import { useProgressiveLoading, type UseProgressiveLoadingReturn } from './use-progressive-loading';
import { useDebouncedSearch } from './use-debounced-search';

interface UseProjectsOptions {
  initialSearchQuery?: string;
  initialTags?: string[];
  initialSortBy?: SortOption;
}

interface UseProjectsReturn {
  projects: ProjectWithRelations[];
  tags: Tag[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];
  sortBy: SortOption;
  totalCount: number;
  hasMore: boolean;
  
  // Progressive loading state
  progressiveLoading: UseProgressiveLoadingReturn;
  
  // Search state
  isSearching: boolean;
  debouncedQuery: string;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setSortBy: (sort: SortOption) => void;
  refetch: () => void;
  clearSearch: () => void;
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(options.initialTags || []);
  const [sortBy, setSortBy] = useState<SortOption>(options.initialSortBy || 'relevance');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Progressive loading state management
  const progressiveLoading = useProgressiveLoading();
  
  // Debounced search functionality
  const {
    searchQuery,
    debouncedQuery,
    isSearching,
    setSearchQuery,
    clearSearch
  } = useDebouncedSearch(options.initialSearchQuery || '', { delay: 300, minLength: 0 });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Set progressive loading state
      progressiveLoading.setLoadingStatus('projects', 'loading');

      // Build query parameters using debounced query
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('query', debouncedQuery);
      if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
      params.set('sortBy', sortBy);
      params.set('sortOrder', 'desc');
      params.set('page', '1');
      params.set('limit', '20');

      const response = await fetch(`/api/projects?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch projects');
      }

      // Update projects immediately - progressive loading principle
      setProjects(data.data.items);
      setTotalCount(data.data.totalCount);
      setHasMore(data.data.hasMore);
      
      // Mark projects as successfully loaded
      progressiveLoading.setLoadingStatus('projects', 'success');

    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setProjects([]);
      setTotalCount(0);
      setHasMore(false);
      
      // Mark projects as failed
      progressiveLoading.setLoadingStatus('projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedTags, sortBy]);

  const fetchTags = useCallback(async () => {
    try {
      // Set progressive loading state for tags
      progressiveLoading.setLoadingStatus('tags', 'loading');
      
      // Use dedicated tags endpoint - much faster!
      const response = await fetch('/api/tags');
      
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setTags(data.data);
        // Mark tags as successfully loaded - this enables filtering
        progressiveLoading.setLoadingStatus('tags', 'success');
      } else {
        throw new Error('Invalid tags response');
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
      // Mark tags as failed but don't break the app
      progressiveLoading.setLoadingStatus('tags', 'error');
      // Don't set main error for tags failure, just log it
    }
  }, []);

  // Initial load: Load projects and tags
  useEffect(() => {
    if (isInitialLoad) {
      // Load projects immediately
      fetchProjects();
      
      // Load tags immediately as well - they're needed for filtering
      fetchTags();
      
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // Handle search/filter changes (excluding initial values)
  useEffect(() => {
    // Skip initial load
    if (isInitialLoad) {
      return;
    }
    
    // Trigger search when debounced query changes
    progressiveLoading.setLoadingStatus('search', 'loading');
    fetchProjects().finally(() => {
      progressiveLoading.setLoadingStatus('search', 'success');
    });
  }, [debouncedQuery, selectedTags, sortBy, isInitialLoad]); // Remove fetchProjects from dependencies

  return {
    projects,
    tags,
    loading,
    error,
    searchQuery,
    selectedTags,
    sortBy,
    totalCount,
    hasMore,
    
    // Progressive loading state
    progressiveLoading,
    
    // Search state
    isSearching,
    debouncedQuery,
    
    setSearchQuery,
    setSelectedTags,
    setSortBy,
    refetch: fetchProjects,
    clearSearch,
  };
}