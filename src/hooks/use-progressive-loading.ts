"use client";

import { useState, useCallback, useRef } from 'react';

export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingState {
  projects: LoadingStatus;
  tags: LoadingStatus;
  search: LoadingStatus;
  media: LoadingStatus;
}

export interface ProgressiveLoadingState {
  initialLoad: boolean;
  hasProjects: boolean;
  hasTags: boolean;
  canFilter: boolean;
  canSearch: boolean;
  showSkeletons: boolean;
}

export interface UseProgressiveLoadingReturn {
  loadingState: LoadingState;
  progressiveState: ProgressiveLoadingState;
  setLoadingStatus: (key: keyof LoadingState, status: LoadingStatus) => void;
  setProgressiveState: (updates: Partial<ProgressiveLoadingState>) => void;
  isReady: (feature: 'filter' | 'search' | 'projects') => boolean;
  getLoadingMessage: (feature: keyof LoadingState) => string;
  reset: () => void;
}

const initialLoadingState: LoadingState = {
  projects: 'idle',
  tags: 'idle',
  search: 'idle',
  media: 'idle',
};

const initialProgressiveState: ProgressiveLoadingState = {
  initialLoad: true,
  hasProjects: false,
  hasTags: false,
  canFilter: false,
  canSearch: false,
  showSkeletons: true,
};

export function useProgressiveLoading(): UseProgressiveLoadingReturn {
  const [loadingState, setLoadingState] = useState<LoadingState>(initialLoadingState);
  const [progressiveState, setProgressiveStateInternal] = useState<ProgressiveLoadingState>(initialProgressiveState);
  const initialLoadTriggered = useRef(false);

  const setLoadingStatus = useCallback((key: keyof LoadingState, status: LoadingStatus) => {
    setLoadingState(prev => {
      const newState = { ...prev, [key]: status };
      
      // Update progressive state based on loading status changes
      if (key === 'projects' && status === 'success') {
        setProgressiveStateInternal(prevProgressive => ({
          ...prevProgressive,
          hasProjects: true,
          canSearch: true, // Enable search once projects are loaded
          showSkeletons: false,
        }));
      }
      
      if (key === 'tags' && status === 'success') {
        setProgressiveStateInternal(prevProgressive => ({
          ...prevProgressive,
          hasTags: true,
          canFilter: true, // Enable filtering once tags are loaded
        }));
      }
      
      // Mark initial load as complete when both projects and tags are loaded or errored
      if ((key === 'projects' || key === 'tags') && (status === 'success' || status === 'error')) {
        setProgressiveStateInternal(prevProgressive => {
          const projectsComplete = key === 'projects' ? (status === 'success' || status === 'error') : 
            (prevProgressive.hasProjects || prev.projects === 'error');
          const tagsComplete = key === 'tags' ? (status === 'success' || status === 'error') : 
            (prevProgressive.hasTags || prev.tags === 'error');
          
          return {
            ...prevProgressive,
            initialLoad: !(projectsComplete && tagsComplete),
          };
        });
      }
      
      return newState;
    });
  }, []);

  const setProgressiveState = useCallback((updates: Partial<ProgressiveLoadingState>) => {
    setProgressiveStateInternal(prev => ({ ...prev, ...updates }));
  }, []);

  const isReady = useCallback((feature: 'filter' | 'search' | 'projects') => {
    switch (feature) {
      case 'filter':
        return progressiveState.canFilter && loadingState.tags === 'success';
      case 'search':
        return progressiveState.canSearch && loadingState.projects === 'success';
      case 'projects':
        return progressiveState.hasProjects && loadingState.projects === 'success';
      default:
        return false;
    }
  }, [progressiveState, loadingState]);

  const getLoadingMessage = useCallback((feature: keyof LoadingState) => {
    const messages = {
      projects: 'Loading projects...',
      tags: 'Loading filters...',
      search: 'Searching...',
      media: 'Loading media...',
    };
    return messages[feature];
  }, []);

  const reset = useCallback(() => {
    setLoadingState(initialLoadingState);
    setProgressiveStateInternal(initialProgressiveState);
  }, []);

  return {
    loadingState,
    progressiveState,
    setLoadingStatus,
    setProgressiveState,
    isReady,
    getLoadingMessage,
    reset,
  };
}