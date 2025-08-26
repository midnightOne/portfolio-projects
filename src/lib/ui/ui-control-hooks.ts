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

// Navigation functions with enhanced GSAP integration
async function navigateToSection(target: string, options?: ScrollOptions): Promise<void> {
  const element = document.querySelector(target);
  if (!element) {
    throw new Error(`Navigation target not found: ${target}`);
  }

  // Update navigation state
  globalUIState.navigation.history.push(globalUIState.navigation.currentSection);
  globalUIState.navigation.currentSection = target;
  globalUIState.navigation.canGoBack = globalUIState.navigation.history.length > 0;
  globalUIState.layout.aiNavigation.isAnimating = true;
  
  // Execute GSAP-powered smooth scroll with animation coordination
  const { executeNavigationCommand } = await import('./animation');
  const command = {
    id: `navigate-${Date.now()}`,
    type: 'navigate' as const,
    target,
    duration: 0.7,
    options: {
      easing: 'power2.out',
      coordinated: true,
      onComplete: () => {
        globalUIState.layout.aiNavigation.isAnimating = false;
        notifyStateChange();
      }
    },
    priority: 'normal' as const,
  };
  
  executeNavigationCommand(command);
  
  // Add to navigation history for AI system
  globalUIState.layout.aiNavigation.navigationHistory.push({
    action: 'navigate',
    target,
    options: { scroll: options },
    metadata: {
      source: 'user',
      timestamp: Date.now(),
      sessionId: 'ui-control-hooks'
    }
  });

  notifyStateChange();
}

async function navigateToPage(page: string): Promise<void> {
  if (typeof window !== 'undefined') {
    // Update navigation state before page transition
    globalUIState.navigation.history.push(window.location.pathname);
    globalUIState.navigation.canGoBack = true;
    
    // Add to AI navigation history
    globalUIState.layout.aiNavigation.navigationHistory.push({
      action: 'navigate',
      target: page,
      metadata: {
        source: 'user',
        timestamp: Date.now(),
        sessionId: 'ui-control-hooks'
      }
    });
    
    notifyStateChange();
    
    // Use Next.js router for smooth transitions
    try {
      // Try to use Next.js router for better transitions
      const { useRouter } = await import('next/navigation');
      // Since we can't use hooks outside components, use window.location
      // but with a smooth transition effect
      document.body.style.opacity = '0.8';
      setTimeout(() => {
        window.location.href = page;
      }, 150);
    } catch {
      // Fallback to direct navigation
      window.location.href = page;
    }
  }
}

async function openModal(modalId: string, data?: any, options?: ModalOptions): Promise<void> {
  globalUIState.layout.modal = {
    open: true,
    component: modalId,
    data: data || null,
  };
  globalUIState.layout.aiNavigation.isAnimating = true;

  // Add modal element to DOM if it doesn't exist
  let modalElement = document.querySelector(`[data-modal="${modalId}"]`) as HTMLElement;
  if (!modalElement) {
    modalElement = document.createElement('div');
    modalElement.setAttribute('data-modal', modalId);
    modalElement.setAttribute('data-modal-content', 'true');
    modalElement.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      opacity: 0;
      pointer-events: none;
    `;
    
    // Add modal content container
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-background border rounded-lg p-6 max-w-md w-full mx-4';
    modalContent.innerHTML = `
      <h3 class="text-lg font-semibold mb-2">${modalId}</h3>
      <p class="text-muted-foreground mb-4">${data?.title || 'Modal content'}</p>
      <button onclick="this.closest('[data-modal]').remove()" class="px-4 py-2 bg-primary text-primary-foreground rounded">Close</button>
    `;
    modalElement.appendChild(modalContent);
    document.body.appendChild(modalElement);
  }

  // Execute GSAP-powered modal animation
  const { executeProjectModalAnimation } = await import('./animation');
  try {
    await executeProjectModalAnimation(modalElement, modalElement);
    globalUIState.layout.aiNavigation.isAnimating = false;
  } catch (error) {
    console.warn('Modal animation failed, using fallback:', error);
    // Fallback animation
    modalElement.style.pointerEvents = 'auto';
    modalElement.style.opacity = '1';
    modalElement.style.background = 'rgba(0, 0, 0, 0.5)';
    modalElement.style.backdropFilter = 'blur(8px)';
    globalUIState.layout.aiNavigation.isAnimating = false;
  }

  // Add to navigation history
  globalUIState.layout.aiNavigation.navigationHistory.push({
    action: 'modal',
    target: modalId,
    options: { modal: options },
    metadata: {
      source: 'user',
      timestamp: Date.now(),
      sessionId: 'ui-control-hooks'
    }
  });

  notifyStateChange();
}

async function closeModal(modalId?: string): Promise<void> {
  const currentModal = globalUIState.layout.modal.component;
  const targetModal = modalId || currentModal;
  globalUIState.layout.aiNavigation.isAnimating = true;

  if (targetModal) {
    const modalElement = document.querySelector(`[data-modal="${targetModal}"]`) as HTMLElement;
    if (modalElement) {
      // Execute GSAP-powered close animation
      const { executeProjectModalCloseAnimation } = await import('./animation');
      try {
        await executeProjectModalCloseAnimation(modalElement, modalElement);
      } catch (error) {
        console.warn('Modal close animation failed, using fallback:', error);
        // Fallback animation
        modalElement.style.opacity = '0';
        modalElement.style.background = 'rgba(0, 0, 0, 0)';
        modalElement.style.backdropFilter = 'blur(0px)';
        modalElement.style.pointerEvents = 'none';
        
        // Remove from DOM after animation
        setTimeout(() => {
          modalElement.remove();
        }, 300);
      }
    }
  }

  globalUIState.layout.modal = {
    open: false,
    component: null,
    data: null,
  };
  globalUIState.layout.aiNavigation.isAnimating = false;

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

// Enhanced focus management functions with accessibility
async function setFocus(target: string): Promise<void> {
  const element = document.querySelector(target) as HTMLElement;
  if (!element) {
    throw new Error(`Focus target not found: ${target}`);
  }

  // Store previous focus for accessibility
  const previousFocus = document.activeElement as HTMLElement;
  
  // Ensure element is focusable
  if (!element.hasAttribute('tabindex') && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(element.tagName)) {
    element.setAttribute('tabindex', '-1');
  }

  // Set focus with proper timing
  element.focus({ preventScroll: true });
  
  // Ensure element is visible with GSAP smooth scroll
  const { executeNavigationCommand } = await import('./animation');
  const command = {
    id: `focus-${Date.now()}`,
    type: 'navigate' as const,
    target,
    duration: 0.5,
    options: {
      easing: 'power2.out',
      onComplete: () => {
        // Announce focus change to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
        announcement.textContent = `Focused on ${element.getAttribute('aria-label') || element.textContent?.slice(0, 50) || 'element'}`;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
          document.body.removeChild(announcement);
        }, 1000);
      }
    },
    priority: 'high' as const,
  };
  
  executeNavigationCommand(command);
  
  // Store focus change in navigation history
  globalUIState.layout.aiNavigation.navigationHistory.push({
    action: 'focus',
    target,
    metadata: {
      source: 'user',
      timestamp: Date.now(),
      sessionId: 'ui-control-hooks'
    }
  });
  
  notifyStateChange();
}

async function selectText(target: string, range?: { start: number; end: number }): Promise<void> {
  const element = document.querySelector(target) as HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  if (!element) {
    throw new Error(`Text selection target not found: ${target}`);
  }

  // Focus element first
  await setFocus(target);
  
  // Handle different element types
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Input/textarea elements
    if (range && 'setSelectionRange' in element) {
      element.setSelectionRange(range.start, range.end);
    } else if ('select' in element) {
      element.select();
    }
  } else {
    // Regular elements - use Selection API
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      
      try {
        const textContent = element.textContent || '';
        if (range && textContent.length > 0) {
          const textNode = element.firstChild || element;
          const rangeObj = document.createRange();
          
          const startOffset = Math.min(range.start, textContent.length);
          const endOffset = Math.min(range.end, textContent.length);
          
          rangeObj.setStart(textNode, startOffset);
          rangeObj.setEnd(textNode, endOffset);
          selection.addRange(rangeObj);
        } else {
          // Select all text in element
          const rangeObj = document.createRange();
          rangeObj.selectNodeContents(element);
          selection.addRange(rangeObj);
        }
        
        // Highlight selected text with subtle animation
        const { executeHighlight } = await import('./animation');
        await executeHighlight(target, {
          type: 'color',
          intensity: 'subtle',
          duration: 'timed',
          timing: 2
        });
        
      } catch (error) {
        console.warn('Text selection failed:', error);
      }
    }
  }
  
  // Add to navigation history
  globalUIState.layout.aiNavigation.navigationHistory.push({
    action: 'focus',
    target,
    options: { scroll: { behavior: 'smooth' } },
    metadata: {
      source: 'user',
      timestamp: Date.now(),
      sessionId: 'ui-control-hooks'
    }
  });
  
  notifyStateChange();
}

async function scrollIntoView(target: string, options?: ScrollIntoViewOptions): Promise<void> {
  const element = document.querySelector(target);
  if (!element) {
    throw new Error(`Scroll target not found: ${target}`);
  }

  globalUIState.layout.aiNavigation.isAnimating = true;
  
  // Use GSAP-powered smooth scroll for better performance and control
  const { executeNavigationCommand } = await import('./animation');
  const command = {
    id: `scroll-${Date.now()}`,
    type: 'navigate' as const,
    target,
    duration: 0.7,
    options: {
      easing: 'power2.out',
      coordinated: true,
      onComplete: () => {
        globalUIState.layout.aiNavigation.isAnimating = false;
        notifyStateChange();
      }
    },
    priority: 'normal' as const,
  };
  
  executeNavigationCommand(command);
  
  // Add subtle highlight to indicate scroll target
  setTimeout(async () => {
    try {
      const { executeHighlight } = await import('./animation');
      await executeHighlight(target, {
        type: 'outline',
        intensity: 'subtle',
        duration: 'timed',
        timing: 1.5
      });
    } catch (error) {
      console.warn('Scroll highlight failed:', error);
    }
  }, 500);
  
  // Add to navigation history
  globalUIState.layout.aiNavigation.navigationHistory.push({
    action: 'scroll',
    target,
    options: { 
      scroll: {
        behavior: options?.behavior === 'auto' ? 'smooth' : options?.behavior || 'smooth',
        block: options?.block || 'start',
        inline: options?.inline || 'nearest'
      }
    },
    metadata: {
      source: 'user',
      timestamp: Date.now(),
      sessionId: 'ui-control-hooks'
    }
  });
  
  notifyStateChange();
}

// Enhanced command processing with error handling and accessibility
async function processNavigationCommand(command: NavigationCommand): Promise<void> {
  // Validate command
  if (!command || !command.action || !command.target) {
    throw new Error('Invalid navigation command provided');
  }
  
  globalUIState.ai.lastCommand = command;
  globalUIState.ai.isProcessing = true;
  
  // Add command to navigation history
  globalUIState.layout.aiNavigation.navigationHistory.push(command);
  
  // Limit history size for performance
  if (globalUIState.layout.aiNavigation.navigationHistory.length > 50) {
    globalUIState.layout.aiNavigation.navigationHistory = 
      globalUIState.layout.aiNavigation.navigationHistory.slice(-25);
  }
  
  notifyStateChange();

  try {
    // Check if animations should be skipped for performance
    const shouldSkipAnimations = globalUIState.performance.skipAnimations || 
      (globalUIState.performance.animationFPS < 30);
    
    if (shouldSkipAnimations) {
      console.log('Skipping animations due to performance constraints');
    }

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
        } else {
          // Default highlight if none specified
          await highlightElement(command.target, {
            type: 'outline',
            intensity: 'medium',
            duration: 'timed',
            timing: 3
          });
        }
        break;

      case 'modal':
        await openModal(command.target, command.metadata, command.options?.modal);
        break;

      case 'scroll':
        await scrollIntoView(command.target, command.options?.scroll);
        break;

      case 'focus':
        await setFocus(command.target);
        break;

      default:
        console.warn(`Unknown navigation command: ${command.action}`);
        throw new Error(`Unsupported navigation command: ${command.action}`);
    }
    
    // Announce successful command completion to screen readers
    if (command.metadata?.source === 'ai') {
      announceToScreenReader(`Navigation command completed: ${command.action} to ${command.target}`);
    }
    
  } catch (error) {
    console.error('Navigation command failed:', error);
    
    // Announce error to screen readers
    announceToScreenReader(`Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Store error in state for debugging
    globalUIState.ai.lastCommand = {
      ...command,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as any;
    
    throw error;
  } finally {
    globalUIState.ai.isProcessing = false;
    notifyStateChange();
  }
}

// Screen reader announcement helper
function announceToScreenReader(message: string): void {
  if (typeof window === 'undefined') return;
  
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.cssText = `
    position: absolute; 
    left: -10000px; 
    width: 1px; 
    height: 1px; 
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  `;
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    if (document.body.contains(announcement)) {
      document.body.removeChild(announcement);
    }
  }, 1000);
}

// Enhanced state management with performance optimization
function getUIState(): UIState {
  // Return a deep copy to prevent external mutations
  return JSON.parse(JSON.stringify(globalUIState));
}

async function setUIState(updates: Partial<UIState>): Promise<void> {
  // Validate state updates
  if (!updates || typeof updates !== 'object') {
    throw new Error('Invalid state updates provided');
  }
  
  // Deep merge state updates
  const mergeDeep = (target: any, source: any): any => {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  };
  
  const previousState = { ...globalUIState };
  globalUIState = mergeDeep(globalUIState, updates);
  
  // Coordinate animations if theme changed
  if (updates.theme && updates.theme !== previousState.theme) {
    try {
      const animationSystem = (globalThis as any).__uiAnimationSystem;
      if (animationSystem && !animationSystem.isAnimating()) {
        // Pause animations during theme transition
        animationSystem.pauseAnimations();
        setTimeout(() => {
          animationSystem.resumeAnimations();
        }, 300);
      }
    } catch (error) {
      console.warn('Theme transition animation coordination failed:', error);
    }
  }
  
  // Update performance metrics
  globalUIState.performance.lastFrameTime = performance.now();
  
  // Throttle state change notifications for performance
  if (typeof window !== 'undefined') {
    if (!(globalThis as any).__stateChangeThrottle) {
      (globalThis as any).__stateChangeThrottle = true;
      requestAnimationFrame(() => {
        notifyStateChange();
        (globalThis as any).__stateChangeThrottle = false;
      });
    }
  } else {
    notifyStateChange();
  }
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

// Enhanced keyboard navigation support
export function useKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }
      
      // Handle keyboard shortcuts
      switch (event.key) {
        case 'Escape':
          // Close any open modals
          if (globalUIState.layout.modal.open) {
            closeModal();
            event.preventDefault();
          }
          // Clear all highlights
          clearAllHighlights();
          break;
          
        case 'Tab':
          // Enhanced tab navigation with visual feedback
          if (!event.shiftKey) {
            // Forward tab - highlight next focusable element
            const focusableElements = document.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
            const nextElement = focusableElements[currentIndex + 1];
            
            if (nextElement) {
              setTimeout(() => {
                highlightElement(`#${nextElement.id}` || nextElement.tagName.toLowerCase(), {
                  type: 'outline',
                  intensity: 'subtle',
                  duration: 'timed',
                  timing: 1
                });
              }, 100);
            }
          }
          break;
          
        case 'ArrowUp':
        case 'ArrowDown':
          // Vertical navigation between sections
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const sections = document.querySelectorAll('section, [data-section]');
            const currentSection = Array.from(sections).find(section => {
              const rect = section.getBoundingClientRect();
              return rect.top <= 100 && rect.bottom > 100;
            });
            
            if (currentSection) {
              const currentIndex = Array.from(sections).indexOf(currentSection);
              const targetIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
              const targetSection = sections[targetIndex];
              
              if (targetSection) {
                scrollIntoView(`#${targetSection.id}` || targetSection.tagName.toLowerCase());
              }
            }
          }
          break;
          
        case 'h':
          // Show/hide help overlay
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Toggle help modal
            if (globalUIState.layout.modal.component === 'keyboard-help') {
              closeModal('keyboard-help');
            } else {
              openModal('keyboard-help', { 
                title: 'Keyboard Navigation Help',
                content: `
                  <div class="space-y-4">
                    <div><kbd>Esc</kbd> - Close modals and clear highlights</div>
                    <div><kbd>Tab</kbd> - Navigate between focusable elements</div>
                    <div><kbd>Ctrl/Cmd + ↑/↓</kbd> - Navigate between sections</div>
                    <div><kbd>Ctrl/Cmd + H</kbd> - Show/hide this help</div>
                    <div><kbd>/</kbd> - Focus search (if available)</div>
                  </div>
                `
              });
            }
          }
          break;
          
        case '/':
          // Focus search input if available
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement;
          if (searchInput) {
            event.preventDefault();
            setFocus(`#${searchInput.id}` || 'input[type="search"]');
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  return {
    // Expose keyboard navigation functions
    focusNext: () => {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
      const nextElement = focusableElements[currentIndex + 1] || focusableElements[0];
      if (nextElement) {
        (nextElement as HTMLElement).focus();
      }
    },
    focusPrevious: () => {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
      const prevElement = focusableElements[currentIndex - 1] || focusableElements[focusableElements.length - 1];
      if (prevElement) {
        (prevElement as HTMLElement).focus();
      }
    },
    closeModals: () => closeModal(),
    clearHighlights: () => clearAllHighlights(),
  };
}

// Performance monitoring and optimization
function initializePerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;
  
  let frameCount = 0;
  let lastTime = performance.now();
  
  const monitorPerformance = () => {
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      
      // Update performance state
      globalUIState.performance.animationFPS = fps;
      globalUIState.performance.lastFrameTime = currentTime;
      globalUIState.performance.skipAnimations = fps < 30;
      
      // Log performance warnings
      if (fps < 30) {
        console.warn(`UI Control Hooks: Low FPS detected (${fps}fps), enabling performance mode`);
      }
      
      frameCount = 0;
      lastTime = currentTime;
    }
    
    requestAnimationFrame(monitorPerformance);
  };
  
  requestAnimationFrame(monitorPerformance);
}

// Navigation history management
export function getNavigationHistory(): NavigationCommand[] {
  return [...globalUIState.layout.aiNavigation.navigationHistory];
}

export function clearNavigationHistory(): void {
  globalUIState.layout.aiNavigation.navigationHistory = [];
  notifyStateChange();
}

export function canGoBack(): boolean {
  return globalUIState.navigation.canGoBack;
}

export function canGoForward(): boolean {
  return globalUIState.navigation.canGoForward;
}

export function goBack(): Promise<void> {
  if (!globalUIState.navigation.canGoBack || globalUIState.navigation.history.length === 0) {
    return Promise.reject(new Error('Cannot go back: no history available'));
  }
  
  const previousSection = globalUIState.navigation.history.pop()!;
  globalUIState.navigation.canGoBack = globalUIState.navigation.history.length > 0;
  
  return navigateToSection(previousSection);
}

// Accessibility helpers
export function enableHighContrast(): void {
  document.documentElement.classList.add('high-contrast');
  globalUIState.theme = 'dark'; // High contrast typically uses dark theme
  notifyStateChange();
}

export function disableHighContrast(): void {
  document.documentElement.classList.remove('high-contrast');
  notifyStateChange();
}

export function enableReducedMotion(): void {
  globalUIState.performance.skipAnimations = true;
  document.documentElement.classList.add('reduce-motion');
  notifyStateChange();
}

export function disableReducedMotion(): void {
  globalUIState.performance.skipAnimations = false;
  document.documentElement.classList.remove('reduce-motion');
  notifyStateChange();
}

// Debug utilities
export function getDebugInfo(): {
  state: UIState;
  performance: {
    fps: number;
    frameTime: number;
    skipAnimations: boolean;
  };
  navigationHistory: NavigationCommand[];
  activeHighlights: Record<string, HighlightOptions>;
  listeners: number;
} {
  return {
    state: getUIState(),
    performance: {
      fps: globalUIState.performance.animationFPS,
      frameTime: globalUIState.performance.lastFrameTime,
      skipAnimations: globalUIState.performance.skipAnimations,
    },
    navigationHistory: getNavigationHistory(),
    activeHighlights: { ...globalUIState.highlighting.active },
    listeners: stateChangeListeners.length,
  };
}

// Initialize performance monitoring on module load
if (typeof window !== 'undefined') {
  initializePerformanceMonitoring();
  
  // Respect user's motion preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) {
    enableReducedMotion();
  }
  
  prefersReducedMotion.addEventListener('change', (e) => {
    if (e.matches) {
      enableReducedMotion();
    } else {
      disableReducedMotion();
    }
  });
  
  // Respect user's contrast preferences
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
  if (prefersHighContrast.matches) {
    enableHighContrast();
  }
  
  prefersHighContrast.addEventListener('change', (e) => {
    if (e.matches) {
      enableHighContrast();
    } else {
      disableHighContrast();
    }
  });
}

// Utility functions for external use
export {
  processNavigationCommand as executeNavigationCommand,
  getUIState,
  setUIState,
  subscribeToStateChanges,
  announceToScreenReader,
  clearAllHighlights,
};