import { renderHook, act } from '@testing-library/react';
import { useProgressiveLoading } from '../use-progressive-loading';

describe('useProgressiveLoading', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    expect(result.current.loadingState).toEqual({
      projects: 'idle',
      tags: 'idle',
      search: 'idle',
      media: 'idle',
    });

    expect(result.current.progressiveState).toEqual({
      initialLoad: true,
      hasProjects: false,
      hasTags: false,
      canFilter: false,
      canSearch: false,
      showSkeletons: true,
    });
  });

  it('should update loading status correctly', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.setLoadingStatus('projects', 'loading');
    });

    expect(result.current.loadingState.projects).toBe('loading');
  });

  it('should enable search when projects are successfully loaded', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.setLoadingStatus('projects', 'success');
    });

    expect(result.current.progressiveState.hasProjects).toBe(true);
    expect(result.current.progressiveState.canSearch).toBe(true);
    expect(result.current.progressiveState.showSkeletons).toBe(false);
  });

  it('should enable filtering when tags are successfully loaded', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.setLoadingStatus('tags', 'success');
    });

    expect(result.current.progressiveState.hasTags).toBe(true);
    expect(result.current.progressiveState.canFilter).toBe(true);
  });

  it('should mark initial load as complete when both projects and tags are loaded', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.setLoadingStatus('projects', 'success');
    });

    expect(result.current.progressiveState.initialLoad).toBe(true);

    act(() => {
      result.current.setLoadingStatus('tags', 'success');
    });

    expect(result.current.progressiveState.initialLoad).toBe(false);
  });

  it('should mark initial load as complete when projects succeed and tags error', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.setLoadingStatus('projects', 'success');
      result.current.setLoadingStatus('tags', 'error');
    });

    expect(result.current.progressiveState.initialLoad).toBe(false);
  });

  it('should correctly report feature readiness', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    // Initially nothing is ready
    expect(result.current.isReady('projects')).toBe(false);
    expect(result.current.isReady('search')).toBe(false);
    expect(result.current.isReady('filter')).toBe(false);

    act(() => {
      result.current.setLoadingStatus('projects', 'success');
    });

    expect(result.current.isReady('projects')).toBe(true);
    expect(result.current.isReady('search')).toBe(true);
    expect(result.current.isReady('filter')).toBe(false);

    act(() => {
      result.current.setLoadingStatus('tags', 'success');
    });

    expect(result.current.isReady('filter')).toBe(true);
  });

  it('should provide correct loading messages', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    expect(result.current.getLoadingMessage('projects')).toBe('Loading projects...');
    expect(result.current.getLoadingMessage('tags')).toBe('Loading filters...');
    expect(result.current.getLoadingMessage('search')).toBe('Searching...');
    expect(result.current.getLoadingMessage('media')).toBe('Loading media...');
  });

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    // Change some state
    act(() => {
      result.current.setLoadingStatus('projects', 'success');
      result.current.setLoadingStatus('tags', 'success');
    });

    expect(result.current.progressiveState.hasProjects).toBe(true);
    expect(result.current.progressiveState.canFilter).toBe(true);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.loadingState).toEqual({
      projects: 'idle',
      tags: 'idle',
      search: 'idle',
      media: 'idle',
    });

    expect(result.current.progressiveState).toEqual({
      initialLoad: true,
      hasProjects: false,
      hasTags: false,
      canFilter: false,
      canSearch: false,
      showSkeletons: true,
    });
  });

  it('should update progressive state manually', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.setProgressiveState({ showSkeletons: false });
    });

    expect(result.current.progressiveState.showSkeletons).toBe(false);
    expect(result.current.progressiveState.initialLoad).toBe(true); // Other values unchanged
  });
});