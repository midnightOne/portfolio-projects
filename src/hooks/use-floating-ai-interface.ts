/**
 * Floating AI Interface Hook - UI System Task 6
 * 
 * React hook for managing floating AI interface state, position transitions,
 * and integration with the UI control system.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUIControl } from '@/lib/ui/ui-control-hooks';
import type { QuickAction } from '@/components/ai/floating-ai-interface';

export interface UseFloatingAIInterfaceOptions {
  initialPosition?: 'hero' | 'pinned';
  initialMode?: 'pill' | 'expanded';
  autoPin?: boolean;
  expandOnFocus?: boolean;
  persistState?: boolean;
  storageKey?: string;
}

export interface UseFloatingAIInterfaceReturn {
  // State
  position: 'hero' | 'pinned';
  mode: 'pill' | 'expanded';
  currentNarration: string | null;
  isListening: boolean;
  isProcessing: boolean;
  isTyping: boolean;
  inputValue: string;
  hasInteracted: boolean;
  
  // Actions
  setPosition: (position: 'hero' | 'pinned') => void;
  setMode: (mode: 'pill' | 'expanded') => void;
  setNarration: (narration: string | null) => void;
  setInputValue: (value: string) => void;
  
  // Handlers
  handleTextSubmit: (text: string) => Promise<void>;
  handleVoiceStart: () => void;
  handleVoiceEnd: (transcript: string) => void;
  handleQuickAction: (action: QuickAction) => void;
  handleSettings: () => void;
  handleClear: () => void;
  
  // Utilities
  reset: () => void;
  toggleMode: () => void;
  togglePosition: () => void;
}

const DEFAULT_OPTIONS: Required<UseFloatingAIInterfaceOptions> = {
  initialPosition: 'hero',
  initialMode: 'pill',
  autoPin: true,
  expandOnFocus: true,
  persistState: false,
  storageKey: 'floating-ai-interface-state'
};

export function useFloatingAIInterface(
  options: UseFloatingAIInterfaceOptions = {}
): UseFloatingAIInterfaceReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { getUIState, setUIState } = useUIControl();

  // Load initial state from storage if persistence is enabled
  const loadInitialState = () => {
    if (opts.persistState && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(opts.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            position: parsed.position || opts.initialPosition,
            mode: parsed.mode || opts.initialMode,
            hasInteracted: parsed.hasInteracted || false
          };
        }
      } catch (error) {
        console.warn('Failed to load AI interface state from storage:', error);
      }
    }
    
    return {
      position: opts.initialPosition,
      mode: opts.initialMode,
      hasInteracted: false
    };
  };

  const initialState = loadInitialState();

  // Core state
  const [position, setPositionState] = useState<'hero' | 'pinned'>(initialState.position);
  const [mode, setModeState] = useState<'pill' | 'expanded'>(initialState.mode);
  const [currentNarration, setCurrentNarration] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasInteracted, setHasInteracted] = useState(initialState.hasInteracted);

  // Persist state when it changes
  useEffect(() => {
    if (opts.persistState && typeof window !== 'undefined') {
      try {
        const stateToStore = {
          position,
          mode,
          hasInteracted
        };
        localStorage.setItem(opts.storageKey, JSON.stringify(stateToStore));
      } catch (error) {
        console.warn('Failed to persist AI interface state:', error);
      }
    }
  }, [position, mode, hasInteracted, opts.persistState, opts.storageKey]);

  // Auto-pin after first interaction
  useEffect(() => {
    if (opts.autoPin && hasInteracted && position === 'hero') {
      setPositionState('pinned');
    }
  }, [opts.autoPin, hasInteracted, position]);

  // Sync with global UI state
  useEffect(() => {
    const uiState = getUIState();
    if (uiState.ai.interface.position !== position || uiState.ai.interface.mode !== mode) {
      setUIState({
        ai: {
          ...uiState.ai,
          interface: {
            ...uiState.ai.interface,
            position,
            mode,
            currentNarration,
            isListening,
            isProcessing,
            hasUserInteracted: hasInteracted
          }
        }
      });
    }
  }, [position, mode, currentNarration, isListening, isProcessing, hasInteracted, getUIState, setUIState]);

  // Position setter with animation coordination
  const setPosition = useCallback((newPosition: 'hero' | 'pinned') => {
    setPositionState(newPosition);
    setCurrentNarration(
      newPosition === 'pinned' 
        ? 'Now pinned at the bottom for easy access while you browse.'
        : 'Moved to hero position for better visibility.'
    );
    
    // Clear narration after a delay
    setTimeout(() => setCurrentNarration(null), 3000);
  }, []);

  // Mode setter with focus handling
  const setMode = useCallback((newMode: 'pill' | 'expanded') => {
    setModeState(newMode);
    if (newMode === 'expanded' && !hasInteracted) {
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  // Narration setter with auto-clear
  const setNarration = useCallback((narration: string | null) => {
    setCurrentNarration(narration);
    
    // Auto-clear narration after 5 seconds if it's not null
    if (narration) {
      setTimeout(() => {
        setCurrentNarration(current => current === narration ? null : current);
      }, 5000);
    }
  }, []);

  // Text submission handler
  const handleTextSubmit = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;
    
    setHasInteracted(true);
    setIsProcessing(true);
    setCurrentNarration('Processing your request...');
    
    try {
      // Simulate AI processing (replace with actual AI integration)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsProcessing(false);
      setIsTyping(true);
      setCurrentNarration('Generating response...');
      
      // Simulate typing (replace with actual streaming response)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIsTyping(false);
      setCurrentNarration(`You asked: "${text}". Here's my response to your question.`);
      
      // Clear input
      setInputValue('');
      
      // Auto-collapse to pill mode after response
      if (mode === 'expanded') {
        setTimeout(() => setModeState('pill'), 3000);
      }
      
    } catch (error) {
      console.error('AI processing error:', error);
      setIsProcessing(false);
      setIsTyping(false);
      setCurrentNarration('Sorry, I encountered an error processing your request.');
    }
  }, [isProcessing, mode]);

  // Voice input handlers
  const handleVoiceStart = useCallback(() => {
    setIsListening(true);
    setHasInteracted(true);
    setCurrentNarration('Listening... speak now.');
  }, []);

  const handleVoiceEnd = useCallback((transcript: string) => {
    setIsListening(false);
    setCurrentNarration(`I heard: "${transcript}"`);
    
    // Process the transcript as text input
    if (transcript.trim()) {
      setInputValue(transcript);
      setTimeout(() => handleTextSubmit(transcript), 1000);
    }
  }, [handleTextSubmit]);

  // Quick action handler
  const handleQuickAction = useCallback((action: QuickAction) => {
    setHasInteracted(true);
    setCurrentNarration(`Executing: ${action.label}`);
    
    if (action.command) {
      setInputValue(action.command);
      setTimeout(() => handleTextSubmit(action.command!), 1000);
    }
  }, [handleTextSubmit]);

  // Settings handler
  const handleSettings = useCallback(() => {
    setHasInteracted(true);
    setCurrentNarration('Opening AI assistant settings...');
    
    // TODO: Implement settings modal or panel
    console.log('AI settings requested');
    
    // Clear narration after showing settings
    setTimeout(() => setCurrentNarration(null), 2000);
  }, []);

  // Clear handler
  const handleClear = useCallback(() => {
    setInputValue('');
    setCurrentNarration('Input cleared.');
    setTimeout(() => setCurrentNarration(null), 1500);
  }, []);

  // Utility functions
  const reset = useCallback(() => {
    setPositionState(opts.initialPosition);
    setModeState(opts.initialMode);
    setCurrentNarration(null);
    setIsListening(false);
    setIsProcessing(false);
    setIsTyping(false);
    setInputValue('');
    setHasInteracted(false);
    
    // Clear persisted state
    if (opts.persistState && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(opts.storageKey);
      } catch (error) {
        console.warn('Failed to clear persisted AI interface state:', error);
      }
    }
  }, [opts.initialPosition, opts.initialMode, opts.persistState, opts.storageKey]);

  const toggleMode = useCallback(() => {
    setMode(mode === 'pill' ? 'expanded' : 'pill');
  }, [mode, setMode]);

  const togglePosition = useCallback(() => {
    setPosition(position === 'hero' ? 'pinned' : 'hero');
  }, [position, setPosition]);

  return {
    // State
    position,
    mode,
    currentNarration,
    isListening,
    isProcessing,
    isTyping,
    inputValue,
    hasInteracted,
    
    // Actions
    setPosition,
    setMode,
    setNarration,
    setInputValue,
    
    // Handlers
    handleTextSubmit,
    handleVoiceStart,
    handleVoiceEnd,
    handleQuickAction,
    handleSettings,
    handleClear,
    
    // Utilities
    reset,
    toggleMode,
    togglePosition
  };
}