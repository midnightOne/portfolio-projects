"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';
import type { SortOption } from '@/components/layout/navigation-bar';

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
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setSortBy: (sort: SortOption) => void;
  refetch: () => void;
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(options.initialSearchQuery || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(options.initialTags || []);
  const [sortBy, setSortBy] = useState<SortOption>(options.initialSortBy || 'relevance');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.set('query', searchQuery);
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

      setProjects(data.data.items);
      setTotalCount(data.data.totalCount);
      setHasMore(data.data.hasMore);

    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setProjects([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTags, sortBy]);

  const fetchTags = useCallback(async () => {
    try {
      // Use dedicated tags endpoint - much faster!
      const response = await fetch('/api/tags');
      
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setTags(data.data);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
      // Don't set error for tags failure, just log it
    }
  }, []);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch tags once on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Debounce search query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== (options.initialSearchQuery || '')) {
        fetchProjects();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, fetchProjects, options.initialSearchQuery]);

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
    
    setSearchQuery,
    setSelectedTags,
    setSortBy,
    refetch: fetchProjects,
  };
}