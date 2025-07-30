"use client";

import { useState, useEffect, useCallback } from 'react';

interface UseDebouncedSearchOptions {
  delay?: number;
  minLength?: number;
}

interface UseDebouncedSearchReturn {
  searchQuery: string;
  debouncedQuery: string;
  isSearching: boolean;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
}

/**
 * Hook for debounced search functionality
 * Provides real-time search with configurable debounce delay
 */
export function useDebouncedSearch(
  initialQuery: string = '',
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const { delay = 300, minLength = 0 } = options;
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Don't debounce if query is empty or below minimum length
    if (searchQuery.length === 0 || searchQuery.length < minLength) {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
      return;
    }

    // Set searching state immediately when user types
    setIsSearching(true);

    // Debounce the search query
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery, delay, minLength]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setIsSearching(false);
  }, []);

  return {
    searchQuery,
    debouncedQuery,
    isSearching,
    setSearchQuery,
    clearSearch,
  };
}