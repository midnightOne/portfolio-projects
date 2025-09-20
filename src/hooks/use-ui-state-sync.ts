/**
 * React Hook for UI State Synchronization with UIManager
 * 
 * This hook provides a simple interface for components to:
 * 1. Register as state providers (provide state to UIManager)
 * 2. Subscribe to state changes (receive updates from UIManager)
 * 3. Update UIManager state directly
 * 
 * Usage Examples:
 * 
 * // Component that provides scroll state
 * const { updateState } = useUIStateSync('scroll-tracker', {
 *   provider: () => ({ scrollPosition: getCurrentScrollState() })
 * });
 * 
 * // Component that listens to project changes
 * const { state } = useUIStateSync('project-listener', {
 *   subscriber: (state) => setLocalProject(state.currentProject)
 * });
 * 
 * // Component that updates media state
 * const { updateState } = useUIStateSync('media-player');
 * updateState({ mediaState: { activeVideos: [...] } });
 */

import { useEffect, useCallback, useState } from 'react';
import { UIManager, type UIState } from '@/lib/navigation/UIManager';

export interface UseUIStateSyncOptions {
  // Provide state to UIManager
  provider?: () => Partial<UIState>;
  
  // Subscribe to state changes from UIManager
  subscriber?: (state: UIState) => void;
  
  // Auto-sync interval for provider (default: none, manual only)
  syncInterval?: number;
  
  // Enable debug logging
  debug?: boolean;
}

export interface UseUIStateSyncReturn {
  // Current UI state (if subscribed)
  state: UIState | null;
  
  // Update UIManager state
  updateState: (update: Partial<UIState>) => void;
  
  // Force sync from provider
  syncState: () => void;
  
  // Get current state without subscribing
  getCurrentState: () => UIState;
}

export function useUIStateSync(
  componentId: string, 
  options: UseUIStateSyncOptions = {}
): UseUIStateSyncReturn {
  const { provider, subscriber, syncInterval, debug } = options;
  const [state, setState] = useState<UIState | null>(null);
  const uiManager = UIManager.getInstance();

  // Register provider on mount
  useEffect(() => {
    if (provider) {
      uiManager.registerStateProvider(componentId, provider);
      
      if (debug) {
        console.log(`[UIStateSync] Registered provider: ${componentId}`);
      }
      
      return () => {
        uiManager.unregisterStateProvider(componentId);
        if (debug) {
          console.log(`[UIStateSync] Unregistered provider: ${componentId}`);
        }
      };
    }
  }, [componentId, provider, debug]);

  // Subscribe to state changes
  useEffect(() => {
    if (subscriber) {
      const handleStateChange = (newState: UIState) => {
        setState(newState);
        subscriber(newState);
        
        if (debug) {
          console.log(`[UIStateSync] State update for ${componentId}:`, newState);
        }
      };
      
      uiManager.subscribeToState(componentId, handleStateChange);
      
      // Get initial state
      const initialState = uiManager.getCurrentUIState();
      handleStateChange(initialState);
      
      return () => {
        uiManager.unsubscribeFromState(componentId);
        if (debug) {
          console.log(`[UIStateSync] Unsubscribed: ${componentId}`);
        }
      };
    }
  }, [componentId, subscriber, debug]);

  // Auto-sync interval
  useEffect(() => {
    if (provider && syncInterval && syncInterval > 0) {
      const interval = setInterval(() => {
        try {
          const update = provider();
          if (update && Object.keys(update).length > 0) {
            uiManager.updateUIState(componentId, update);
            
            if (debug) {
              console.log(`[UIStateSync] Auto-sync from ${componentId}:`, update);
            }
          }
        } catch (error) {
          console.error(`[UIStateSync] Auto-sync failed for ${componentId}:`, error);
        }
      }, syncInterval);
      
      return () => clearInterval(interval);
    }
  }, [componentId, provider, syncInterval, debug]);

  // Update state callback
  const updateState = useCallback((update: Partial<UIState>) => {
    uiManager.updateUIState(componentId, update);
    
    if (debug) {
      console.log(`[UIStateSync] Manual update from ${componentId}:`, update);
    }
  }, [componentId, debug]);

  // Force sync callback
  const syncState = useCallback(() => {
    if (provider) {
      try {
        const update = provider();
        if (update && Object.keys(update).length > 0) {
          uiManager.updateUIState(componentId, update);
          
          if (debug) {
            console.log(`[UIStateSync] Force sync from ${componentId}:`, update);
          }
        }
      } catch (error) {
        console.error(`[UIStateSync] Force sync failed for ${componentId}:`, error);
      }
    }
  }, [componentId, provider, debug]);

  // Get current state callback
  const getCurrentState = useCallback(() => {
    return uiManager.getCurrentUIState();
  }, []);

  return {
    state,
    updateState,
    syncState,
    getCurrentState
  };
}

// Specialized hooks for common use cases

/**
 * Hook for components that track scroll state
 */
export function useScrollStateSync(componentId: string, getScrollState: () => Partial<UIState['scrollPosition']>) {
  return useUIStateSync(componentId, {
    provider: () => ({
      scrollPosition: getScrollState()
    })
  });
}

/**
 * Hook for components that manage media state
 */
export function useMediaStateSync(componentId: string, getMediaState: () => Partial<UIState['mediaState']>) {
  return useUIStateSync(componentId, {
    provider: () => ({
      mediaState: getMediaState()
    })
  });
}

/**
 * Hook for components that track project state
 */
export function useProjectStateSync(componentId: string, getProjectState: () => Partial<UIState['currentProject']>) {
  return useUIStateSync(componentId, {
    provider: () => ({
      currentProject: getProjectState()
    })
  });
}

/**
 * Hook for components that need to track user interactions
 */
export function useInteractionStateSync(componentId: string, getInteractionState: () => Partial<UIState['interactionState']>) {
  return useUIStateSync(componentId, {
    provider: () => ({
      interactionState: getInteractionState()
    })
  });
}
