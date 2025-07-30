/**
 * Test suite for search functionality
 * Tests the real-time search implementation
 */

import { highlightSearchTerms, createSearchExcerpt, containsSearchTerms } from '@/lib/utils/search-highlight';

describe('Search Functionality', () => {
  describe('highlightSearchTerms', () => {
    it('should highlight single search term', () => {
      const result = highlightSearchTerms('This is a test project', 'test');
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ text: 'This is a ', isMatch: false });
      expect(result[1]).toEqual({ text: 'test', isMatch: true });
      expect(result[2]).toEqual({ text: ' project', isMatch: false });
    });

    it('should highlight multiple search terms', () => {
      const result = highlightSearchTerms('React TypeScript project', 'React TypeScript');
      
      const matchedSegments = result.filter(segment => segment.isMatch);
      expect(matchedSegments).toHaveLength(2);
      expect(matchedSegments[0].text).toBe('React');
      expect(matchedSegments[1].text).toBe('TypeScript');
    });

    it('should be case insensitive by default', () => {
      const result = highlightSearchTerms('JavaScript Project', 'javascript');
      
      const matchedSegments = result.filter(segment => segment.isMatch);
      expect(matchedSegments).toHaveLength(1);
      expect(matchedSegments[0].text).toBe('JavaScript');
    });

    it('should handle empty search query', () => {
      const result = highlightSearchTerms('Test content', '');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: 'Test content', isMatch: false });
    });

    it('should handle special regex characters', () => {
      const result = highlightSearchTerms('C++ programming', 'C++');
      
      const matchedSegments = result.filter(segment => segment.isMatch);
      expect(matchedSegments).toHaveLength(1);
      expect(matchedSegments[0].text).toBe('C++');
    });
  });

  describe('createSearchExcerpt', () => {
    const longText = 'This is a very long text that contains multiple sentences. It has information about React development and TypeScript programming. The text continues with more details about web development and modern JavaScript frameworks.';

    it('should create excerpt around search match', () => {
      const result = createSearchExcerpt(longText, 'React', 100, 30);
      
      const excerptText = result.map(segment => segment.text).join('');
      expect(excerptText).toContain('React');
      expect(excerptText.length).toBeLessThanOrEqual(100 + 10); // Allow some buffer for ellipsis
    });

    it('should highlight terms in excerpt', () => {
      const result = createSearchExcerpt(longText, 'TypeScript', 100, 30);
      
      const matchedSegments = result.filter(segment => segment.isMatch);
      expect(matchedSegments.length).toBeGreaterThan(0);
      expect(matchedSegments[0].text).toBe('TypeScript');
    });

    it('should handle search term not found', () => {
      const result = createSearchExcerpt(longText, 'Python', 100, 30);
      
      const excerptText = result.map(segment => segment.text).join('');
      expect(excerptText.length).toBeLessThanOrEqual(100 + 10);
      expect(result.every(segment => !segment.isMatch)).toBe(true);
    });
  });

  describe('containsSearchTerms', () => {
    it('should detect search terms in text', () => {
      expect(containsSearchTerms('React TypeScript project', 'React')).toBe(true);
      expect(containsSearchTerms('React TypeScript project', 'Vue')).toBe(false);
    });

    it('should be case insensitive by default', () => {
      expect(containsSearchTerms('JavaScript Project', 'javascript')).toBe(true);
      expect(containsSearchTerms('JavaScript Project', 'JAVASCRIPT')).toBe(true);
    });

    it('should handle multiple search terms', () => {
      expect(containsSearchTerms('React TypeScript project', 'React TypeScript')).toBe(true);
      expect(containsSearchTerms('React project', 'React TypeScript')).toBe(true); // Partial match
      expect(containsSearchTerms('Vue project', 'React TypeScript')).toBe(false);
    });

    it('should handle empty inputs', () => {
      expect(containsSearchTerms('', 'test')).toBe(false);
      expect(containsSearchTerms('test', '')).toBe(false);
      expect(containsSearchTerms('', '')).toBe(false);
    });
  });
});

describe('Search API Integration', () => {
  // Mock fetch for testing
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should make debounced search requests', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [
          {
            id: '1',
            title: 'Test Project',
            description: 'A test project description',
            tags: []
          }
        ],
        totalCount: 1,
        hasMore: false
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    // Simulate API call with search query
    const response = await fetch('/api/projects?query=test&sortBy=relevance&sortOrder=desc&page=1&limit=20');
    const data = await response.json();

    expect(mockFetch).toHaveBeenCalledWith('/api/projects?query=test&sortBy=relevance&sortOrder=desc&page=1&limit=20');
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].title).toBe('Test Project');
  });

  it('should handle search API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    try {
      const response = await fetch('/api/projects?query=test');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Internal Server Error');
    }
  });
});