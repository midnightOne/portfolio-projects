/**
 * AI System Integration - Simplified Version - UI System Task 14
 * 
 * Provides stable APIs for AI system to control UI elements with
 * simplified implementation focusing on core functionality.
 * 
 * Requirements: 8.6, 8.7, 8.8, 8.9, 8.10
 */

'use client';

import type { 
  NavigationCommand, 
  HighlightOptions, 
  UIState,
  UserActionEvent,
  AISystemEvent
} from './types';
import { 
  executeNavigationCommand,
  executeHighlight,
  removeHighlight,
  isAnimating
} from './animation';

// Simplified AI System API
export interface SimpleAISystemAPI {
  // Navigation Control
  navigateToSection: (target: string) => Promise<void>;
  navigateToProject: (projectSlug: string) => Promise<void>;
  openProjectModal: (projectId: string, data?: any) => Promise<void>;
  closeProjectModal: (modalId?: string) => Promise<void>;
  
  // Content Highlighting
  highlightElement: (target: string, options: HighlightOptions) => Promise<void>;
  highlightMultiple: (highlights: Array<{ target: string; options: HighlightOptions }>) => Promise<void>;
  removeHighlight: (target?: string) => Promise<void>;
  clearAllHighlights: () => Promise<void>;
  
  // Focus Management
  setFocus: (target: string) => Promise<void>;
  scrollToElement: (target: string) => Promise<void>;
  
  // Animation Control
  interruptAnimations: () => Promise<void>;
  
  // State Management
  getUIState: () => UIState;
  updateUIState: (updates: Partial<UIState>) => Promise<void>;
  
  // User Action Notifications
  onUserAction: (callback: (action: UserActionEvent) => void) => () => void;
  notifyAISystem: (event: AISystemEvent) => void;
}

// Global state for user action tracking
let userActionCallbacks: Array<(action: UserActionEvent) => void> = [];
let systemEventCallbacks: Array<(event: AISystemEvent) => void> = [];
let sessionId = `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// User action tracking
function trackUserAction(event: UserActionEvent): void {
  userActionCallbacks.forEach(callback => {
    try {
      callback(event);
    } catch (error) {
      console.error('Error in AI system user action callback:', error);
    }
  });
}

// System event notification
function notifySystemEvent(event: AISystemEvent): void {
  systemEventCallbacks.forEach(callback => {
    try {
      callback(event);
    } catch (error) {
      console.error('Error in AI system event callback:', error);
    }
  });
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
    }, 150);
  }, { passive: true });
}

// Helper function to generate CSS selector for an element
function getElementSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.dataset.testid) {
    return `[data-testid="${element.dataset.testid}"]`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  
  return element.tagName.toLowerCase();
}

// Simple AI System Integration Implementation
export class SimpleAISystemIntegration implements SimpleAISystemAPI {
  constructor() {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        initializeUserActionTracking();
      }, 100);
    }
  }
  
  // Navigation Control
  async navigateToSection(target: string): Promise<void> {
    try {
      const command: NavigationCommand = {
        action: 'navigate',
        target,
        metadata: {
          source: 'ai',
          timestamp: Date.now(),
          sessionId
        }
      };
      
      executeNavigationCommand(command);
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'navigateToSection', target },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Navigation failed:', error);
      throw error;
    }
  }
  
  async navigateToProject(projectSlug: string): Promise<void> {
    try {
      const projectUrl = `/projects/${projectSlug}`;
      
      if (typeof window !== 'undefined') {
        window.location.href = projectUrl;
      }
      
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
      
    } catch (error) {
      console.error('AI System: Project navigation failed:', error);
      throw error;
    }
  }
  
  async openProjectModal(projectId: string, data?: any): Promise<void> {
    try {
      // Simple modal implementation
      let modalElement = document.querySelector(`[data-modal="${projectId}"]`) as HTMLElement;
      if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.setAttribute('data-modal', projectId);
        modalElement.style.cssText = `
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
        `;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-background border rounded-lg p-6 max-w-md w-full mx-4';
        modalContent.innerHTML = `
          <h3 class="text-lg font-semibold mb-2">${projectId}</h3>
          <p class="text-muted-foreground mb-4">${data?.title || 'Modal content'}</p>
          <button onclick="this.closest('[data-modal]').remove()" class="px-4 py-2 bg-primary text-primary-foreground rounded">Close</button>
        `;
        modalElement.appendChild(modalContent);
        document.body.appendChild(modalElement);
      }
      
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
      
    } catch (error) {
      console.error('AI System: Modal opening failed:', error);
      throw error;
    }
  }
  
  async closeProjectModal(modalId?: string): Promise<void> {
    try {
      const modals = modalId 
        ? [document.querySelector(`[data-modal="${modalId}"]`)]
        : Array.from(document.querySelectorAll('[data-modal]'));
      
      modals.forEach(modal => {
        if (modal) {
          modal.remove();
        }
      });
      
      trackUserAction({
        type: 'modal',
        target: modalId || 'all',
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
      await executeHighlight(target, options);
      
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
  
  async highlightMultiple(highlights: Array<{ target: string; options: HighlightOptions }>): Promise<void> {
    try {
      // Execute all highlights in parallel
      await Promise.all(highlights.map(({ target, options }) => 
        executeHighlight(target, options)
      ));
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'highlightMultiple', highlights },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Multiple element highlighting failed:', error);
      throw error;
    }
  }
  
  async removeHighlight(target?: string): Promise<void> {
    try {
      await removeHighlight(target);
      
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
      await removeHighlight();
      
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
      const element = document.querySelector(target) as HTMLElement;
      if (!element) {
        throw new Error(`Focus target not found: ${target}`);
      }
      
      if (!element.hasAttribute('tabindex') && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(element.tagName)) {
        element.setAttribute('tabindex', '-1');
      }
      
      element.focus({ preventScroll: true });
      
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
  
  async scrollToElement(target: string): Promise<void> {
    try {
      const element = document.querySelector(target);
      if (!element) {
        throw new Error(`Scroll target not found: ${target}`);
      }
      
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'scrollToElement', target },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Scrolling failed:', error);
      throw error;
    }
  }
  
  // Animation Control
  async interruptAnimations(): Promise<void> {
    try {
      // Clear all running animations
      const animatedElements = document.querySelectorAll('[data-ai-animated]');
      animatedElements.forEach(element => {
        element.removeAttribute('data-ai-animated');
        // Remove any animation classes
        element.classList.remove('animate-pulse', 'animate-bounce', 'animate-spin');
      });
      
      this.notifyAISystem({
        type: 'command_executed',
        source: 'ai_system',
        data: { command: 'interruptAnimations' },
        timestamp: Date.now(),
        sessionId
      });
      
    } catch (error) {
      console.error('AI System: Animation interruption failed:', error);
      throw error;
    }
  }
  
  // State Management
  getUIState(): UIState {
    // Return a basic UI state
    return {
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
  }
  
  async updateUIState(updates: Partial<UIState>): Promise<void> {
    try {
      // Simple state update - in a real implementation this would update global state
      console.log('UI State update requested:', updates);
      
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
  
  // User Action Notifications
  onUserAction(callback: (action: UserActionEvent) => void): () => void {
    userActionCallbacks.push(callback);
    
    return () => {
      const index = userActionCallbacks.indexOf(callback);
      if (index > -1) {
        userActionCallbacks.splice(index, 1);
      }
    };
  }
  
  notifyAISystem(event: AISystemEvent): void {
    notifySystemEvent(event);
  }
}

// Global simple AI system integration instance
let globalSimpleAISystemIntegration: SimpleAISystemIntegration | null = null;

// Get or create simple AI system integration instance
export function getSimpleAISystemIntegration(): SimpleAISystemIntegration {
  if (!globalSimpleAISystemIntegration) {
    globalSimpleAISystemIntegration = new SimpleAISystemIntegration();
  }
  return globalSimpleAISystemIntegration;
}

// React Hook for Simple AI System Integration
export function useSimpleAISystemIntegration(): SimpleAISystemAPI {
  return getSimpleAISystemIntegration();
}

// Utility functions for debugging
export function getSimpleAISystemDebugInfo(): {
  sessionId: string;
  callbackCounts: {
    userAction: number;
    systemEvent: number;
  };
} {
  return {
    sessionId,
    callbackCounts: {
      userAction: userActionCallbacks.length,
      systemEvent: systemEventCallbacks.length,
    }
  };
}

// Clear debug data
export function clearSimpleAISystemDebugData(): void {
  // Simple implementation - just reset callbacks
  userActionCallbacks = [];
  systemEventCallbacks = [];
}

// Export types for external use
export type {
  SimpleAISystemAPI,
  UserActionEvent,
  AISystemEvent
};