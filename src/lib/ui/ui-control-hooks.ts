/**
 * UI Control Hooks - UI System
 * 
 * Programmatic UI control hooks for AI system integration.
 * Provides navigation, highlighting, focus management, and state synchronization.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { 
  NavigationCommand, 
  HighlightOptions, 
  UIState, 
  UseUIControlReturn,
  ScrollOptions,
  ModalOptions 
} from './types';
import { 
  executeNavigationCommand, 
  executeHighlight, 
  removeHighlight,
  isAnimating 
} from './animation';

// UI State management
let globalUIState: UIState = {
  theme: 'light',
  layout: {
    header: { visible: true, height: 64, transparent: false },
    modal: { open: false, component: null, data: null },
    aiInterface: { position: 'hero', mode: 'pill', visible: false, currentNarration: null },
    aiNavigation: { activeHighlights: {}, navigationHistory: [], isAnimating: false },
  },
  navigation: {
    currentSection: '',
    history: [],
    canGoBack: false,
    canGoForward: false,
  },
  highlighting: {
    active: {},
    history: [],
  },
  ai: {
    interface: {
      position: 'hero',
      mode: 'pill',
      isListening: false,
      isProcessing: false,
      currentNarration: null,
      hasUserInteracted: false,
    },
    lastCommand: null,
    isProcessing: false,
  },
  performance: {
    animationFPS: 60,
    lastFrameTime: 0,
    skipAnimations: false,
  },
};

// State change listeners
const stateChangeListeners: Array<(state: UIState) => void> = [];

function notifyStateChange(): void {
  stateChangeListeners.forEach(listener => listener(globalUIState));
}

// Navigation functions
async function navigateToSection(target: string, options?: ScrollOptions): Promise<void> {
  const element = document.querySelector(target);
  if (!element) {
    throw new Error(`Navigation target not found: ${target}`);
  }

  // Update navigation state
  globalUIState.navigation.history.push(globalUIState.navigation.currentSection);
  globalUIState.navigation.currentSection = target;
  globalUIState.navigation.canGoBack = globalUIState.navigation.history.length > 0;
  
  // Execute scroll animation
  element.scrollIntoView({
    behavior: options?.behavior || 'smooth',
    block: options?.block || 'start',
    inline: options?.inline || 'nearest',
  });

  notifyStateChange();
}

async function navigateToPage(page: string): Promise<void> {
  if (typeof window !== 'undefined') {
    // Use Next.js router if available
    const { useRouter } = await import('next/navigation');
    // This would need to be called from within a component context
    // For now, use window.location
    window.location.href = page;
  }
}

async function openModal(modalId: string, data?: any, options?: ModalOptions): Promise<void> {
  globalUIState.layout.modal = {
    open: true,
    component: modalId,
    data: data || null,
  };

  // Add modal element to DOM if it doesn't exist
  let modalElement = document.querySelector(`[data-modal="${modalId}"]`) as HTMLElement;
  if (!modalElement) {
    modalElement = document.createElement('div');
    modalElement.setAttribute('data-modal', modalId);
    modalElement.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(modalElement);
  }

  // Show modal with animation
  if (modalElement) {
    modalElement.style.pointerEvents = 'auto';
    modalElement.style.opacity = '1';
  }

  notifyStateChange();
}

async function closeModal(modalId?: string): Promise<void> {
  const currentModal = globalUIState.layout.modal.component;
  const targetModal = modalId || currentModal;

  if (targetModal) {
    const modalElement = document.querySelector(`[data-modal="${targetModal}"]`) as HTMLElement;
    if (modalElement) {
      modalElement.style.opacity = '0';
      modalElement.style.pointerEvents = 'none';
      
      // Remove from DOM after animation
      setTimeout(() => {
        modalElement.remove();
      }, 300);
    }
  }

  globalUIState.layout.modal = {
    open: false,
    component: null,
    data: null,
  };

  notifyStateChange();
}

// Highlighting functions
async function highlightElement(target: string, options: HighlightOptions): Promise<void> {
  // Store highlight in state
  globalUIState.highlighting.active[target] = options;
  globalUIState.highlighting.history.push({
    target,
    options,
    timestamp: Date.now(),
  });

  // Execute highlight animation
  await executeHighlight(target, options);

  notifyStateChange();
}

async function removeElementHighlight(target?: string): Promise<void> {
  if (target) {
    delete globalUIState.highlighting.active[target];
  } else {
    globalUIState.highlighting.active = {};
  }

  await removeHighlight(target);
  notifyStateChange();
}

async function clearAllHighlights(): Promise<void> {
  globalUIState.highlighting.active = {};
  await removeHighlight();
  notifyStateChange();
}

// Focus management functions
async function setFocus(target: string): Promise<void> {
  const element = document.querySelector(target) as HTMLElement;
  if (!element) {
    throw new Error(`Focus target not found: ${target}`);
  }

  element.focus();
  
  // Ensure element is visible
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
}

async function selectText(target: string, range?: { start: number; end: number }): Promise<void> {
  const element = document.querySelector(target) as HTMLInputElement | HTMLTextAreaElement;
  if (!element) {
    throw new Error(`Text selection target not found: ${target}`);
  }

  element.focus();
  
  if (range && 'setSelectionRange' in element) {
    element.setSelectionRange(range.start, range.end);
  } else if ('select' in element) {
    element.select();
  }
}

async function scrollIntoView(target: string, options?: ScrollIntoViewOptions): Promise<void> {
  const element = document.querySelector(target);
  if (!element) {
    throw new Error(`Scroll target not found: ${target}`);
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
    ...options,
  });
}

// Command processing
async function processNavigationCommand(command: NavigationCommand): Promise<void> {
  globalUIState.ai.lastCommand = command;
  globalUIState.ai.isProcessing = true;
  notifyStateChange();

  try {
    switch (command.action) {
      case 'navigate':
        if (command.target.startsWith('/')) {
          await navigateToPage(command.target);
        } else {
          await navigateToSection(command.target, command.options?.scroll);
        }
        break;

      case 'highlight':
        if (command.options?.highlight) {
          await highlightElement(command.target, command.options.highlight);
        }
        break;

      case 'modal':
        await openModal(command.target, null, command.options?.modal);
        break;

      case 'scroll':
        await scrollIntoView(command.target, command.options?.scroll);
        break;

      case 'focus':
        await setFocus(command.target);
        break;

      default:
        console.warn(`Unknown navigation command: ${command.action}`);
    }
  } finally {
    globalUIState.ai.isProcessing = false;
    notifyStateChange();
  }
}

// State management
function getUIState(): UIState {
  return { ...globalUIState };
}

async function setUIState(updates: Partial<UIState>): Promise<void> {
  globalUIState = { ...globalUIState, ...updates };
  notifyStateChange();
}

function subscribeToStateChanges(callback: (state: UIState) => void): () => void {
  stateChangeListeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = stateChangeListeners.indexOf(callback);
    if (index > -1) {
      stateChangeListeners.splice(index, 1);
    }
  };
}

// Main UI Control Hook
export function useUIControl(): UseUIControlReturn {
  const [, forceUpdate] = useState({});

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = subscribeToStateChanges(() => {
      forceUpdate({});
    });

    return unsubscribe;
  }, []);

  const navigate = useCallback(async (command: NavigationCommand): Promise<void> => {
    await processNavigationCommand(command);
  }, []);

  const highlight = useCallback(async (target: string, options: HighlightOptions): Promise<void> => {
    await highlightElement(target, options);
  }, []);

  const removeHighlightFn = useCallback(async (target?: string): Promise<void> => {
    await removeElementHighlight(target);
  }, []);

  const getUIStateFn = useCallback((): UIState => {
    return getUIState();
  }, []);

  const setUIStateFn = useCallback(async (state: Partial<UIState>): Promise<void> => {
    await setUIState(state);
  }, []);

  return {
    navigate,
    highlight,
    removeHighlight: removeHighlightFn,
    getUIState: getUIStateFn,
    setUIState: setUIStateFn,
    isAnimating: isAnimating(),
  };
}

// Individual hook exports for specific functionality
export function useNavigation() {
  return {
    navigateToSection,
    navigateToPage,
    openModal,
    closeModal,
  };
}

export function useHighlighting() {
  return {
    highlight: highlightElement,
    removeHighlight: removeElementHighlight,
    clearAllHighlights,
  };
}

export function useFocusManagement() {
  return {
    setFocus,
    selectText,
    scrollIntoView,
  };
}

export function useUIState() {
  const [state, setState] = useState(globalUIState);

  useEffect(() => {
    const unsubscribe = subscribeToStateChanges(setState);
    return unsubscribe;
  }, []);

  return {
    state,
    updateState: setUIState,
    subscribe: subscribeToStateChanges,
  };
}

// Utility functions for external use
export {
  processNavigationCommand as executeNavigationCommand,
  getUIState,
  setUIState,
  subscribeToStateChanges,
};