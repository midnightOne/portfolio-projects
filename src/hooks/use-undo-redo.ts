import { useState, useCallback, useRef } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UndoRedoActions<T> {
  set: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newState: T) => void;
}

/**
 * Hook for managing undo/redo functionality during editing sessions
 */
export function useUndoRedo<T>(
  initialState: T,
  maxHistorySize: number = 50
): [T, UndoRedoActions<T>] {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  const lastSaveTime = useRef<number>(Date.now());
  const debounceTimeout = useRef<NodeJS.Timeout>();

  const set = useCallback((newState: T) => {
    // Debounce rapid changes to avoid cluttering history
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      const now = Date.now();
      // Only add to history if enough time has passed or content is significantly different
      const shouldAddToHistory = now - lastSaveTime.current > 1000; // 1 second debounce

      if (shouldAddToHistory) {
        setState(currentState => {
          const newPast = [...currentState.past, currentState.present];
          
          // Limit history size
          if (newPast.length > maxHistorySize) {
            newPast.shift();
          }

          return {
            past: newPast,
            present: newState,
            future: [] // Clear future when new state is set
          };
        });
        lastSaveTime.current = now;
      } else {
        // Just update present without adding to history
        setState(currentState => ({
          ...currentState,
          present: newState
        }));
      }
    }, 300); // 300ms debounce
  }, [maxHistorySize]);

  const undo = useCallback(() => {
    setState(currentState => {
      if (currentState.past.length === 0) return currentState;

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      if (currentState.future.length === 0) return currentState;

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const reset = useCallback((newState: T) => {
    setState({
      past: [],
      present: newState,
      future: []
    });
    lastSaveTime.current = Date.now();
  }, []);

  const actions: UndoRedoActions<T> = {
    set,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset
  };

  return [state.present, actions];
}