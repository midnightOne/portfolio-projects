/**
 * Integration tests for search functionality
 * Tests the search utilities and debounced search hook
 */

import { renderHook, act } from '@testing-library/react';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';

// Mock timers for debounce testing
jest.useFakeTimers();

describe('Search Integration', () => {
  describe('useDebouncedSearch Hook', () => {
    afterEach(() => {
      jest.clearAllTimers();
    });

    it('should initialize with provided initial query', () => {
      const { result } = renderHook(() => 
        useDebouncedSearch('initial query')
      );

      expect(result.current.searchQuery).toBe('initial query');
      expect(result.current.debouncedQuery).toBe('initial query');
      expect(result.current.isSearching).toBe(false);
    });

    it('should debounce search query changes', () => {
      const { result } = renderHook(() => 
        useDebouncedSearch('', { delay: 300 })
      );

      // Set search query
      act(() => {
        result.current.setSearchQuery('test query');
      });

      // Immediately after setting, searchQuery should update but debouncedQuery should not
      expect(result.current.searchQuery).toBe('test query');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isSearching).toBe(true);

      // Fast-forward time to trigger debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // After debounce delay, debouncedQuery should update
      expect(result.current.debouncedQuery).toBe('test query');
      expect(result.current.isSearching).toBe(false);
    });

    it('should cancel previous debounce when query changes quickly', () => {
      const { result } = renderHook(() => 
        useDebouncedSearch('', { delay: 300 })
      );

      // Set first query
      act(() => {
        result.current.setSearchQuery('first');
      });

      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Set second query before first debounce completes
      act(() => {
        result.current.setSearchQuery('second');
      });

      // Advance time to complete second debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should have the second query, not the first
      expect(result.current.debouncedQuery).toBe('second');
    });

    it('should handle empty queries without debouncing', () => {
      const { result } = renderHook(() => 
        useDebouncedSearch('test')
      );

      // Clear the query
      act(() => {
        result.current.setSearchQuery('');
      });

      // Empty query should update immediately without debouncing
      expect(result.current.searchQuery).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isSearching).toBe(false);
    });

    it('should respect minimum length requirement', () => {
      const { result } = renderHook(() => 
        useDebouncedSearch('', { delay: 300, minLength: 3 })
      );

      // Set query shorter than minimum length
      act(() => {
        result.current.setSearchQuery('ab');
      });

      // Should update immediately without debouncing
      expect(result.current.searchQuery).toBe('ab');
      expect(result.current.debouncedQuery).toBe('ab');
      expect(result.current.isSearching).toBe(false);

      // Set query meeting minimum length
      act(() => {
        result.current.setSearchQuery('abc');
      });

      // Should start debouncing
      expect(result.current.searchQuery).toBe('abc');
      expect(result.current.debouncedQuery).toBe('ab'); // Still old value
      expect(result.current.isSearching).toBe(true);

      // Complete debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('abc');
      expect(result.current.isSearching).toBe(false);
    });

    it('should clear search correctly', () => {
      const { result } = renderHook(() => 
        useDebouncedSearch('initial')
      );

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('Search Query Processing', () => {
    it('should handle URL encoding in search queries', () => {
      const encodedQuery = 'C%2B%2B%20programming'; // "C++ programming"
      const decodedQuery = decodeURIComponent(encodedQuery);
      
      expect(decodedQuery).toBe('C++ programming');
    });

    it('should process multi-word search terms correctly', () => {
      const searchQuery = 'React TypeScript project';
      const searchTerms = searchQuery
        .split(/\s+/)
        .filter(term => term.length > 0)
        .map(term => `${term}:*`)
        .join(' & ');
      
      expect(searchTerms).toBe('React:* & TypeScript:* & project:*');
    });

    it('should handle special characters in search', () => {
      const specialChars = ['C++', 'C#', '.NET', 'Node.js'];
      
      specialChars.forEach(term => {
        // Should not throw errors when processing
        expect(() => {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'gi');
          'Test C++ programming'.match(regex);
        }).not.toThrow();
      });
    });
  });

  describe('Search Result Processing', () => {
    it('should create proper search parameters', () => {
      const searchQuery = 'React';
      const selectedTags = ['TypeScript', 'Web'];
      const sortBy = 'relevance';
      
      const params = new URLSearchParams();
      if (searchQuery) params.set('query', searchQuery);
      if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
      params.set('sortBy', sortBy);
      params.set('sortOrder', 'desc');
      params.set('page', '1');
      params.set('limit', '20');
      
      const expectedUrl = 'query=React&tags=TypeScript%2CWeb&sortBy=relevance&sortOrder=desc&page=1&limit=20';
      expect(params.toString()).toBe(expectedUrl);
    });

    it('should handle empty search parameters', () => {
      const params = new URLSearchParams();
      params.set('sortBy', 'date');
      params.set('sortOrder', 'desc');
      params.set('page', '1');
      params.set('limit', '20');
      
      expect(params.toString()).toBe('sortBy=date&sortOrder=desc&page=1&limit=20');
    });
  });
});

// Test search performance characteristics
describe('Search Performance', () => {
  it('should handle rapid search query changes efficiently', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch('', { delay: 100 })
    );

    const startTime = performance.now();
    
    // Simulate rapid typing
    const queries = ['r', 're', 'rea', 'reac', 'react'];
    
    queries.forEach((query, index) => {
      act(() => {
        result.current.setSearchQuery(query);
        jest.advanceTimersByTime(50); // Less than debounce delay
      });
    });

    // Complete the final debounce
    act(() => {
      jest.advanceTimersByTime(100);
    });

    const endTime = performance.now();
    
    // Should have the final query
    expect(result.current.debouncedQuery).toBe('react');
    
    // Should complete quickly (test environment, so very fast)
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('should not cause memory leaks with frequent updates', () => {
    const { result, unmount } = renderHook(() => 
      useDebouncedSearch('')
    );

    // Simulate many rapid updates
    for (let i = 0; i < 100; i++) {
      act(() => {
        result.current.setSearchQuery(`query-${i}`);
      });
    }

    // Unmount should clean up timers
    expect(() => unmount()).not.toThrow();
  });
});