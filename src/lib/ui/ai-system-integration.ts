/**
 * AI System Integration - UI System Task 14
 * 
 * Provides stable APIs for AI system to control UI elements, implements
 * bidirectional communication for user action notifications, and coordinates
 * AI interface animations with main portfolio navigation.
 * 
 * Requirements: 8.6, 8.7, 8.8, 8.9, 8.10
 */

'use client';

import type { 
  NavigationCommand, 
  HighlightOptions, 
  UIState,
  AnimationCommand 
} from './types';
import { 
  executeNavigationCommand,
  executeCoordinatedAnimations,
  executeHighlight,
  removeHighlight,
  clearAnimationQueue,
  isAnimating
} from './animation';
import { useUIControl } from './ui-control-hooks';

// AI System Integration Types
export interface AISystemAPI {
  // Navigation Control
  navigateToSection: (target: string, options?: NavigationOptions) => Promise<void>;
  navigateToProject: (projectSlug: string, options?: NavigationOptions) => Promise<void>;
  openProjectModal: (projectId: string, data?: any, options?: ModalOptions) => Promise<void>;
  closeProjectModal: (modalId?: string) => Promise<void>;
  
  // Content Highlighting
  highlightElement: (target: string, options: HighlightOptions) => Promise<void>;
  highlightMultiple: (targets: Array<{ target: string; options: HighlightOptions }>) => Promise<void>;
  removeHighlight: (target?: string) => Promise<void>;
  clearAllHighlights: () => Promise<void>;
  
  // Focus Management
  setFocus: (target: string) => Promise<void>;
  selectText: (target: string, range?: TextRange) => Promise<void>;
  scrollToElement: (target: string, options?: ScrollOptions) => Promise<void>;
  
  // Animation Coordination
  executeCoordinatedSequence: (commands: AnimationCommand[]) => Promise<void>;
  interruptAnimations: (newCommand?: AnimationCommand) => Promise<void>;
  waitForAnimations: () => Promise<void>;
  
  // State Management
  getUIState: () => UIState;
  updateUIState: (updates: Partial<UIState>) => Promise<void>;
  subscribeToStateChanges: (callback: (state: UIState) => void) => () => void;
  
  // User Action Notifications
  onUserAction: (callback: (action: UserActionEvent) => void) => () => void;
  notifyAISystem: (event: AISystemEvent) => void;
}

export interface NavigationOptions {
  animate?: boolean;
  duration?: number;
  easing?: string;
  highlight?: boolean;
  highlightOptions?: HighlightOptions;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface ModalOptions {
  animate?: boolean;
  duration?: number;
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'center' | 'top' | 'bottom';
}

export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
  offset?: number;
}

export interface TextRange {
  start: number;
  end: number;
}

// User Action Event Types
export interface UserActionEvent {
  type: 'click' | 'scroll' | 'navigation' | 'modal' | 'input' | 'focus' | 'selection';
  target: string;
  data?: any;
  timestamp: number;
  sessionId: string;
  metadata?: {
    elementType?: string;
    elementText?: string;
    scrollPosition?: number;
    inputValue?: string;
    selectionText?: string;
  };
}

// AI System Event Types
export interface AISystemEvent {
  type: 'command_executed' | 'animation_started' | 'animation_completed' | 'error' | 'state_changed';
  source: 'ai_system';
  data?: any;
  timestamp: number;
  sessionId: string;
}

// Global state for AI system integration
let aiSystemCallbacks: {
  userActionCallbacks: Array<(action: UserActionEvent) => void>;
  stateChangeCallbacks: Array<(state: UIState) => void>;
  aiSystemEventCallbacks: Array<(event: AISystemEvent) => void>;
} = {
  userActionCallbacks: [],
  stateChangeCallbacks: [],
  aiSystemEventCallbacks: []
};

let sessionId = `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// User action tracking
function trackUserAction(event: UserActionEvent): void {
  // Notify all registered AI system callbacks
  aiSystemCallbacks.userActionCallbacks.forEach(callback => {
    try {
      callback(event);
    } catch (error) {
      console.error('Error in AI system user action callback:', error);
    }
  });
  
  // Store in session for debugging
  if (typeof window !== 'undefined') {
    const actions = JSON.parse(sessionStorage.getItem('ai-user-actions') || '[]');
    actions.push(event);
    // Keep only last 50 actions for performance
    if (actions.length > 50) {
      actions.splice(0, actions.length - 50);
    }
    sessionStorage.setItem('ai-user-actions', JSON.stringify(actions));
  }
}

// Initialize user action tracking
function initializeUserActionTracking(): void {
  if (typeof window === 'undefined') return;
  
  // Track clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const targetSelector = getElementSelector(target);
    
    trackUserAction({
      type: 'click',
      target: targetSelector,
      timestamp: Date.now(),
      sessionId,
      metadata: {
        elementType: target.tagName.toLowerCase(),
        elementText: target.textContent?.slice(0, 100) || '',
      }
    });
  }, { passive: true });
  
  // Track scroll
  let scrollTimeout: NodeJS.Timeout;
  document.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      trackUserAction({
        type: 'scroll',
        target: 'window',
        timestamp: Date.now(),
        sessionId,
        metadata: {
          scrollPosition: window.scrollY,
        }
      });
    }, 150); // Throttle scroll events
  }, { passive: true });
  
  // Track input changes
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const targetSelector = getElementSelector(target);
      
      trackUserAction({
        type: 'input',
        target: targetSelector,
        timestamp: Date.now(),
        sessionId,
        metadata: {
          elementType: target.tagName.toLowerCase(),
          inputValue: target.value.slice(0, 100), // Limit for privacy
        }
      });
    }
  }, { passive: true });
  
  // Track focus changes
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    const targetSelector = getElementSelector(target);
    
    trackUserAction({
      type: 'focus',
      target: targetSelector,
      timestamp: Date.now(),
      sessionId,
      metadata: {
        elementType: target.tagName.toLowerCase(),
        elementText: target.textContent?.slice(0, 100) || '',
      }
    });
  }, { passive: true });
  
  // Track text selection
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container as HTMLElement;
      
      if (element) {
        const targetSelector = getElementSelector(element);
        
        trackUserAction({
          type: 'selection',
          target: targetSelector,
          timestamp: Date.now(),
          sessionId,
          metadata: {
            selectionText: selection.toString().slice(0, 200),
          }
        });
      }
    }
  });
}

// Helper function to generate CSS selector for an element
function getElementSelector(element: HTMLElement): string {
  // Try ID first
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Try data attributes
  if (element.dataset.testid) {
    return `[data-testid="${element.dataset.testid}"]`;
  }
  
  if (element.dataset.component) {
    return `[data-component="${element.dataset.component}"]`;
  }
  
  // Try class-based selector
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  
  // Fallback to tag name with nth-child
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
  }
  
  return element.tagName.toLowerCase();
}

// AI System API Implementation
export class AISystemIntegration implements AISystemAPI {
  private uiControl: ReturnType<typeof useUIControl> | null = null;
  
  constructor() {
    // Initialize user action tracking
    if (typeof window !== 'undefined') {
      // Delay initialization to avoid hydration issues
      setTimeout(() => {
        initializeUserActionTracking();
      }, 100);
    }
  }
  
  // Initialize with UI control hooks (called from React component)
  initialize(uiControl: ReturnType<typeof useUIControl>): void {
    this.uiControl = uiControl;
  }
  
  // Navigation Control
  async navigateToSection(target: string, options: NavigationOptions = {}): Promise<void> {
    try {
      const command: NavigationCommand = {
        action: 'navigate',
        target,
        options: {
          scroll: {
            behavior: options.animate !== false ? 'smooth' : 'auto',
            block: 'start',
          }
        },
        metadata: {
          source: 'ai',
          timestamp: Date.now(),
          sessionId
        }
      };
      
      if (this.uiControl) {
        await this.uiControl.navigate(command);
      } else {
        // Fallback to direct animation system
        executeNavigationCommand(command);
      }
      
      // Add highlight if requested
      if (options.highlight && options.highlightOptions) {
        await this.highlightElement(target, options.highlightOptions);
      }
      
      // Notify AI system of completion
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'navigateToSection', target },
        timestamp: Date.now(),
        sessionId
      });
      
      options.onComplete?.();
      
    } catch (error) {
      console.error('AI System: Navigation failed:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }
  
  async navigateToProject(projectSlug: string, options: NavigationOptions = {}): Promise<void> {
    try {
      const projectUrl = `/projects/${projectSlug}`;
      
      const command: NavigationCommand = {
        action: 'navigate',
        target: projectUrl,
        metadata: {
          source: 'ai',
          timestamp: Date.now(),
          sessionId
        }
      };
      
      if (this.uiControl) {
        await this.uiControl.navigate(command);
      } else {
        // Fallback to direct navigation
        if (typeof window !== 'undefined') {
          window.location.href = projectUrl;
        }
      }
      
      // Track navigation action
      trackUserAction({
        type: 'navigation',
        target: projectUrl,
        timestamp: Date.now(),
        sessionId,
        data: { projectSlug }
      });
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'navigateToProject', projectSlug },
        timestamp: Date.now(),
        sessionId
      });
      
      options.onComplete?.();
      
    } catch (error) {
      console.error('AI System: Project navigation failed:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }
  
  async openProjectModal(projectId: string, data?: any, options: ModalOptions = {}): Promise<void> {
    try {
      const command: NavigationCommand = {
        action: 'modal',
        target: projectId,
        options: {
          modal: {
            backdrop: options.backdrop !== false,
            size: options.size || 'lg',
            position: options.position || 'center'
          }
        },
        metadata: {
          source: 'ai',
          timestamp: Date.now(),
          sessionId,
          data
        }
      };
      
      if (this.uiControl) {
        await this.uiControl.navigate(command);
      } else {
        // Fallback to direct modal opening
        const { openModal } = await import('./ui-control-hooks');
        await openModal(projectId, data, options);
      }
      
      // Track modal action
      trackUserAction({
        type: 'modal',
        target: projectId,
        timestamp: Date.now(),
        sessionId,
        data: { action: 'open', projectId }
      });
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'openProjectModal', projectId },
        timestamp: Date.now(),
        sessionId
      });
      
      options.onComplete?.();
      
    } catch (error) {
      console.error('AI System: Modal opening failed:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }
  
  async closeProjectModal(modalId?: string): Promise<void> {
    try {
      if (this.uiControl) {
        const state = this.uiControl.getUIState();
        const currentModal = modalId || state.layout.modal.component;
        
        if (currentModal) {
          await this.uiControl.setUIState({
            layout: {
              ...state.layout,
              modal: {
                open: false,
                component: null,
                data: null
              }
            }
          });
        }
      } else {
        // Fallback to direct modal closing
        const { closeModal } = await import('./ui-control-hooks');
        await closeModal(modalId);
      }
      
      // Track modal action
      trackUserAction({
        type: 'modal',
        target: modalId || 'current',
        timestamp: Date.now(),
        sessionId,
        data: { action: 'close' }
      });
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'closeProjectModal', modalId },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Modal closing failed:', error);
      throw error;
    }
  }
  
  // Content Highlighting
  async highlightElement(target: string, options: HighlightOptions): Promise<void> {
    try {
      if (this.uiControl) {
        await this.uiControl.highlight(target, options);
      } else {
        // Fallback to direct highlighting
        await executeHighlight(target, options);
      }
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'highlightElement', target, options },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Element highlighting failed:', error);
      throw error;
    }
  }
  
  async highlightMultiple(targets: Array<{ target: string; options: HighlightOptions }>): Promise<void> {
    try {
      // Execute all highlights simultaneously for better performance
      const promises = targets.map(({ target, options }) => 
        this.highlightElement(target, options)
      );
      
      await Promise.all(promises);
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'highlightMultiple', count: targets.length },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Multiple highlighting failed:', error);
      throw error;
    }
  }
  
  async removeHighlight(target?: string): Promise<void> {
    try {
      if (this.uiControl) {
        await this.uiControl.removeHighlight(target);
      } else {
        // Fallback to direct highlight removal
        await removeHighlight(target);
      }
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'removeHighlight', target },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Highlight removal failed:', error);
      throw error;
    }
  }
  
  async clearAllHighlights(): Promise<void> {
    try {
      if (this.uiControl) {
        await this.uiControl.removeHighlight(); // No target = clear all
      } else {
        // Fallback to direct highlight clearing
        await removeHighlight();
      }
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'clearAllHighlights' },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Highlight clearing failed:', error);
      throw error;
    }
  }
  
  // Focus Management
  async setFocus(target: string): Promise<void> {
    try {
      const command: NavigationCommand = {
        action: 'focus',
        target,
        metadata: {
          source: 'ai',
          timestamp: Date.now(),
          sessionId
        }
      };
      
      if (this.uiControl) {
        await this.uiControl.navigate(command);
      } else {
        // Fallback to direct focus
        const { setFocus } = await import('./ui-control-hooks');
        await setFocus(target);
      }
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'setFocus', target },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Focus setting failed:', error);
      throw error;
    }
  }
  
  async selectText(target: string, range?: TextRange): Promise<void> {
    try {
      const { selectText } = await import('./ui-control-hooks');
      await selectText(target, range);
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'selectText', target, range },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Text selection failed:', error);
      throw error;
    }
  }
  
  async scrollToElement(target: string, options: ScrollOptions = {}): Promise<void> {
    try {
      const command: NavigationCommand = {
        action: 'scroll',
        target,
        options: {
          scroll: {
            behavior: options.behavior || 'smooth',
            block: options.block || 'start',
            inline: options.inline || 'nearest'
          }
        },
        metadata: {
          source: 'ai',
          timestamp: Date.now(),
          sessionId
        }
      };
      
      if (this.uiControl) {
        await this.uiControl.navigate(command);
      } else {
        // Fallback to direct scrolling
        const { scrollIntoView } = await import('./ui-control-hooks');
        await scrollIntoView(target, options);
      }
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'scrollToElement', target, options },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Scrolling failed:', error);
      throw error;
    }
  }
  
  // Animation Coordination
  async executeCoordinatedSequence(commands: AnimationCommand[]): Promise<void> {
    try {
      this.notifyAISystem({
        type: 'animation_started',
        source: 'ai_system',
        data: { commandCount: commands.length },
        timestamp: Date.now(),
        sessionId
      });
      
      await executeCoordinatedAnimations(commands);
      
      this.notifyAISystem({
        type: 'animation_completed',
        source: 'ai_system',
        data: { commandCount: commands.length },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Coordinated animation failed:', error);
      this.notifyAISystem({
        type: 'error',
        source: 'ai_system',
        data: { error: error.message, context: 'executeCoordinatedSequence' },
        timestamp: Date.now(),
        sessionId
      });
      throw error;
    }
  }
  
  async interruptAnimations(newCommand?: AnimationCommand): Promise<void> {
    try {
      clearAnimationQueue();
      
      if (newCommand) {
        executeNavigationCommand(newCommand);
      }
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'interruptAnimations', hasNewCommand: !!newCommand },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Animation interruption failed:', error);
      throw error;
    }
  }
  
  async waitForAnimations(): Promise<void> {
    return new Promise((resolve) => {
      const checkAnimations = () => {
        if (!isAnimating()) {
          resolve();
        } else {
          requestAnimationFrame(checkAnimations);
        }
      };
      checkAnimations();
    });
  }
  
  // State Management
  getUIState(): UIState {
    if (this.uiControl) {
      return this.uiControl.getUIState();
    } else {
      // Fallback to direct state access
      const { getUIState } = require('./ui-control-hooks');
      return getUIState();
    }
  }
  
  async updateUIState(updates: Partial<UIState>): Promise<void> {
    try {
      if (this.uiControl) {
        await this.uiControl.setUIState(updates);
      } else {
        // Fallback to direct state update
        const { setUIState } = await import('./ui-control-hooks');
        await setUIState(updates);
      }
      
      this.notifyAISystem({
        type: 'state_changed',
        source: 'ai_system',
        data: { updates },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: State update failed:', error);
      throw error;
    }
  }
  
  subscribeToStateChanges(callback: (state: UIState) => void): () => void {
    aiSystemCallbacks.stateChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = aiSystemCallbacks.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        aiSystemCallbacks.stateChangeCallbacks.splice(index, 1);
      }
    };
  }
  
  // User Action Notifications
  onUserAction(callback: (action: UserActionEvent) => void): () => void {
    aiSystemCallbacks.userActionCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = aiSystemCallbacks.userActionCallbacks.indexOf(callback);
      if (index > -1) {
        aiSystemCallbacks.userActionCallbacks.splice(index, 1);
      }
    };
  }
  
  notifyAISystem(event: AISystemEvent): void {
    // Notify all registered AI system event callbacks
    aiSystemCallbacks.aiSystemEventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in AI system event callback:', error);
      }
    });
    
    // Store in session for debugging
    if (typeof window !== 'undefined') {
      const events = JSON.parse(sessionStorage.getItem('ai-system-events') || '[]');
      events.push(event);
      // Keep only last 50 events for performance
      if (events.length > 50) {
        events.splice(0, events.length - 50);
      }
      sessionStorage.setItem('ai-system-events', JSON.stringify(events));
    }
  }
}

// Global AI System Integration instance
let globalAISystemIntegration: AISystemIntegration | null = null;

// Get or create AI System Integration instance
export function getAISystemIntegration(): AISystemIntegration {
  if (!globalAISystemIntegration) {
    globalAISystemIntegration = new AISystemIntegration();
  }
  return globalAISystemIntegration;
}

// React Hook for AI System Integration
export function useAISystemIntegration(): AISystemAPI {
  const uiControl = useUIControl();
  const aiIntegration = getAISystemIntegration();
  
  // Initialize with UI control hooks
  aiIntegration.initialize(uiControl);
  
  return aiIntegration;
}

// Utility functions for debugging and monitoring
export function getAISystemDebugInfo(): {
  sessionId: string;
  userActions: UserActionEvent[];
  systemEvents: AISystemEvent[];
  callbackCounts: {
    userAction: number;
    stateChange: number;
    aiSystemEvent: number;
  };
} {
  const userActions = typeof window !== 'undefined' 
    ? JSON.parse(sessionStorage.getItem('ai-user-actions') || '[]')
    : [];
    
  const systemEvents = typeof window !== 'undefined'
    ? JSON.parse(sessionStorage.getItem('ai-system-events') || '[]')
    : [];
  
  return {
    sessionId,
    userActions,
    systemEvents,
    callbackCounts: {
      userAction: aiSystemCallbacks.userActionCallbacks.length,
      stateChange: aiSystemCallbacks.stateChangeCallbacks.length,
      aiSystemEvent: aiSystemCallbacks.aiSystemEventCallbacks.length,
    }
  };
}

// Clear debug data
export function clearAISystemDebugData(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('ai-user-actions');
    sessionStorage.removeItem('ai-system-events');
  }
}

// Export types for external use
export type {
  AISystemAPI,
  NavigationOptions,
  ModalOptions,
  ScrollOptions,
  TextRange,
  UserActionEvent,
  AISystemEvent
};