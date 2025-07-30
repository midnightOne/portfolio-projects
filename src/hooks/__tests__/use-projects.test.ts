import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjects } from '../use-projects';

// Mock the progressive loading hook
const mockSetLoadingStatus = jest.fn();
const mockSetProgressiveState = jest.fn();
const mockIsReady = jest.fn(() => true);
const mockGetLoadingMessage = jest.fn(() => 'Loading...');
const mockReset = jest.fn();

jest.mock('../use-progressive-loading', () => ({
  useProgressiveLoading: () => ({
    loadingState: {
      projects: 'idle',
      tags: 'idle',
      search: 'idle',
      media: 'idle',
    },
    progressiveState: {
      initialLoad: true,
      hasProjects: false,
      hasTags: false,
      canFilter: false,
      canSearch: false,
      showSkeletons: true,
    },
    setLoadingStatus: mockSetLoadingStatus,
    setProgressiveState: mockSetProgressiveState,
    isReady: mockIsReady,
    getLoadingMessage: mockGetLoadingMessage,
    reset: mockReset,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('useProjects', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockSetLoadingStatus.mockClear();
    mockSetProgressiveState.mockClear();
    mockIsReady.mockClear();
    mockGetLoadingMessage.mockClear();
    mockReset.mockClear();
    
    // Default mock implementation
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { items: [], totalCount: 0, hasMore: false }
          }),
        } as Response);
      }
      if (typeof url === 'string' && url.includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response);
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useProjects());

    expect(result.current.projects).toEqual([]);
    expect(result.current.tags).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedTags).toEqual([]);
    expect(result.current.sortBy).toBe('relevance');
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasMore).toBe(false);
  });

  it('should initialize with provided options', () => {
    const options = {
      initialSearchQuery: 'test',
      initialTags: ['react', 'typescript'],
      initialSortBy: 'date' as const,
    };

    const { result } = renderHook(() => useProjects(options));

    expect(result.current.searchQuery).toBe('test');
    expect(result.current.selectedTags).toEqual(['react', 'typescript']);
    expect(result.current.sortBy).toBe('date');
  });

  it('should fetch projects on mount', async () => {
    const mockProjectsResponse = {
      success: true,
      data: {
        items: [
          { id: '1', title: 'Project 1', slug: 'project-1' },
          { id: '2', title: 'Project 2', slug: 'project-2' },
        ],
        totalCount: 2,
        hasMore: false,
      },
    };

    const mockTagsResponse = {
      success: true,
      data: [
        { id: '1', name: 'React' },
        { id: '2', name: 'TypeScript' },
      ],
    };

    mockFetch
      .mockImplementationOnce((url) => {
        if (typeof url === 'string' && url.includes('/api/projects')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockProjectsResponse,
          } as Response);
        }
        return Promise.reject(new Error('Unexpected URL'));
      })
      .mockImplementationOnce((url) => {
        if (typeof url === 'string' && url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTagsResponse,
          } as Response);
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toEqual(mockProjectsResponse.data.items);
    expect(result.current.tags).toEqual(mockTagsResponse.data);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('should handle projects API error gracefully', async () => {
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/projects')) {
        return Promise.reject(new Error('API Error'));
      }
      if (typeof url === 'string' && url.includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response);
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('API Error');
    expect(result.current.projects).toEqual([]);
  });

  it('should handle tags API error gracefully', async () => {
    const mockProjectsResponse = {
      success: true,
      data: {
        items: [],
        totalCount: 0,
        hasMore: false,
      },
    };

    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjectsResponse,
        } as Response);
      }
      if (typeof url === 'string' && url.includes('/api/tags')) {
        return Promise.reject(new Error('Tags API Error'));
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Projects should still load even if tags fail
    expect(result.current.projects).toEqual([]);
    expect(result.current.error).toBe(null); // Tags error shouldn't set main error
    expect(result.current.tags).toEqual([]);
  });

  it('should update search query and trigger refetch', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [{ id: '1', title: 'Filtered Project', slug: 'filtered' }],
        totalCount: 1,
        hasMore: false,
      },
    };

    mockFetch.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response);
    });

    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.setSearchQuery('test');
    });

    expect(result.current.searchQuery).toBe('test');

    // Wait for debounced search
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('query=test')
      );
    }, { timeout: 1000 });
  });

  it('should update selected tags and trigger refetch', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [],
        totalCount: 0,
        hasMore: false,
      },
    };

    mockFetch.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response);
    });

    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.setSelectedTags(['react', 'typescript']);
    });

    expect(result.current.selectedTags).toEqual(['react', 'typescript']);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tags=react%2Ctypescript')
      );
    });
  });

  it('should clear filters correctly', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [
          { id: '1', title: 'All Projects', slug: 'all' },
        ],
        totalCount: 1,
        hasMore: false,
      },
    };

    mockFetch.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response);
    });

    const { result } = renderHook(() => useProjects());

    // Set some filters first
    act(() => {
      result.current.setSearchQuery('test');
      result.current.setSelectedTags(['react']);
    });

    expect(result.current.searchQuery).toBe('test');
    expect(result.current.selectedTags).toEqual(['react']);

    // Clear filters
    act(() => {
      result.current.setSearchQuery('');
      result.current.setSelectedTags([]);
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedTags).toEqual([]);

    // Should trigger refetch with empty filters
    await waitFor(() => {
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const url = lastCall?.[0] as string;
      expect(url).not.toContain('query=');
      expect(url).not.toContain('tags=');
    });
  });

  it('should update sort option and trigger refetch', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [],
        totalCount: 0,
        hasMore: false,
      },
    };

    mockFetch.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response);
    });

    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.setSortBy('date');
    });

    expect(result.current.sortBy).toBe('date');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=date')
      );
    });
  });

  it('should refetch projects when refetch is called', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [],
        totalCount: 0,
        hasMore: false,
      },
    };

    mockFetch.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response);
    });

    const { result } = renderHook(() => useProjects());

    const initialCallCount = mockFetch.mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});