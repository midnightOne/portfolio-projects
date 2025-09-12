/**
 * UINavigationTools System
 * 
 * Client-side JavaScript functions for UI manipulation by voice agents.
 * Provides immediate tool execution without server round-trips and reports
 * results back to AI providers for conversation continuity.
 */

import { ToolDefinition, ToolResult } from '@/types/voice-agent';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';
import { v4 as uuidv4 } from 'uuid';

// Navigation result types
interface NavigationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// UI element selectors and utilities
class UIElementManager {
  static findElement(selector: string): Element | null {
    try {
      return document.querySelector(selector);
    } catch (error) {
      console.error(`Invalid selector: ${selector}`, error);
      return null;
    }
  }

  static findElements(selector: string): NodeListOf<Element> | null {
    try {
      return document.querySelectorAll(selector);
    } catch (error) {
      console.error(`Invalid selector: ${selector}`, error);
      return null;
    }
  }

  static isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      rect.top >= 0 && rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth;
  }

  static scrollIntoView(element: Element, behavior: ScrollBehavior = 'smooth'): void {
    element.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
  }

  static highlightElement(element: Element, className: string = 'voice-highlight'): void {
    element.classList.add(className);

    // Auto-remove highlight after 5 seconds
    setTimeout(() => {
      element.classList.remove(className);
    }, 5000);
  }

  static removeHighlight(element: Element, className: string = 'voice-highlight'): void {
    element.classList.remove(className);
  }

  static removeAllHighlights(className: string = 'voice-highlight'): void {
    const highlighted = document.querySelectorAll(`.${className}`);
    highlighted.forEach(el => el.classList.remove(className));
  }
}

// Navigation tools implementation
export class UINavigationTools {
  private static instance: UINavigationTools | null = null;
  private toolResultCallbacks: Map<string, (result: ToolResult) => void> = new Map();
  private navigationHistory: Array<{ action: string; params: any; timestamp: Date }> = [];

  private constructor() {
    this.setupHighlightStyles();
  }

  static getInstance(): UINavigationTools {
    if (!UINavigationTools.instance) {
      UINavigationTools.instance = new UINavigationTools();
    }
    return UINavigationTools.instance;
  }

  // Set up CSS styles for highlighting
  private setupHighlightStyles(): void {
    if (document.getElementById('voice-highlight-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'voice-highlight-styles';
    style.textContent = `
      .voice-highlight {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
        background-color: rgba(59, 130, 246, 0.1) !important;
        border-radius: 4px !important;
        transition: all 0.3s ease !important;
        animation: voice-pulse 2s infinite !important;
      }
      
      .voice-highlight-text {
        background-color: rgba(59, 130, 246, 0.3) !important;
        padding: 2px 4px !important;
        border-radius: 3px !important;
        transition: all 0.3s ease !important;
      }
      
      @keyframes voice-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
        50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
      }
    `;
    document.head.appendChild(style);
  }

  // Register callback for tool results
  registerToolResultCallback(toolName: string, callback: (result: ToolResult) => void): void {
    this.toolResultCallbacks.set(toolName, callback);
  }

  // Execute tool and report result with enhanced debugging
  private async executeAndReport(toolName: string, args: any, handler: () => Promise<NavigationResult>, sessionId?: string): Promise<NavigationResult> {
    const startTime = Date.now();
    const toolCallId = uuidv4();
    const correlationId = `ui_nav_${toolCallId}`;

    // Emit tool call start event
    debugEventEmitter.emitToolCallStart(
      toolName,
      args,
      sessionId || 'ui-navigation',
      toolCallId,
      'client',
      'ui-navigation-tools',
      correlationId
    );

    try {
      const result = await handler();
      const executionTime = Date.now() - startTime;

      // Add to navigation history
      this.navigationHistory.push({
        action: toolName,
        params: args,
        timestamp: new Date()
      });

      // Emit tool call complete event
      debugEventEmitter.emitToolCallComplete(
        toolName,
        result.data || result.message,
        executionTime,
        result.success,
        sessionId || 'ui-navigation',
        toolCallId,
        'client',
        'ui-navigation-tools',
        result.error,
        correlationId
      );

      // Report result to callback if registered
      const callback = this.toolResultCallbacks.get(toolName);
      if (callback) {
        callback({
          id: toolCallId,
          result: result.data || result.message,
          error: result.error,
          timestamp: new Date(),
          executionTime
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResult: NavigationResult = {
        success: false,
        message: `Tool execution failed: ${errorMessage}`,
        error: errorMessage
      };

      // Emit tool call complete event with error
      debugEventEmitter.emitToolCallComplete(
        toolName,
        null,
        executionTime,
        false,
        sessionId || 'ui-navigation',
        toolCallId,
        'client',
        'ui-navigation-tools',
        errorMessage,
        correlationId
      );

      // Report error to callback if registered
      const callback = this.toolResultCallbacks.get(toolName);
      if (callback) {
        callback({
          id: toolCallId,
          result: null,
          error: errorMessage,
          timestamp: new Date(),
          executionTime
        });
      }

      return errorResult;
    }
  }

  // Navigation tools

  async navigateTo(args: { path: string; newTab?: boolean }, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('navigateTo', args, async () => {
      const { path, newTab = false } = args;

      if (!path || typeof path !== 'string') {
        return {
          success: false,
          message: 'Invalid path provided',
          error: 'Path must be a non-empty string'
        };
      }

      try {
        // Check if this is a project-related navigation that should use the modal system
        const isProjectNavigation = path.includes('/projects') && path.includes('project=');
        const isCurrentlyOnProjectsPage = window.location.pathname === '/projects';

        if (isProjectNavigation && isCurrentlyOnProjectsPage) {
          // We're on projects page and trying to open a project - use modal system
          const url = new URL(path, window.location.origin);
          const projectSlug = url.searchParams.get('project');

          if (projectSlug) {
            // Update URL without full navigation to maintain voice session
            window.history.pushState({}, '', path);

            // Trigger the project modal by dispatching a popstate event
            window.dispatchEvent(new PopStateEvent('popstate'));

            return {
              success: true,
              message: `Opened project ${projectSlug} in modal`,
              data: { path, newTab: false, method: 'modal' }
            };
          }
        }

        // For voice sessions, prefer new tab to avoid disconnecting
        const shouldUseNewTab = newTab || sessionId !== undefined;

        if (shouldUseNewTab) {
          window.open(path, '_blank');
          return {
            success: true,
            message: `Opened ${path} in new tab (preserving voice session)`,
            data: { path, newTab: true, reason: 'voice_session_preservation' }
          };
        } else {
          window.location.href = path;
          return {
            success: true,
            message: `Navigated to ${path}`,
            data: { path, newTab: false }
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to navigate to ${path}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }, sessionId);
  }

  async showProjectDetails(args: { projectId: string; highlightSections?: string[] }, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('showProjectDetails', args, async () => {
      const { projectId, highlightSections = [] } = args;

      if (!projectId || typeof projectId !== 'string') {
        return {
          success: false,
          message: 'Invalid project ID provided',
          error: 'Project ID must be a non-empty string'
        };
      }

      try {
        // First, try to find and map the project ID to the correct slug
        const mappedProjectSlug = await this.mapProjectIdToSlug(projectId);

        // Check if we're already on the projects page
        const isOnProjectsPage = window.location.pathname === '/projects';

        if (isOnProjectsPage) {
          // We're on the projects page, use the modal system
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('project', mappedProjectSlug);

          // Update URL without full navigation to maintain voice session
          window.history.pushState({}, '', currentUrl.toString());

          // Trigger the project modal by dispatching a popstate event
          window.dispatchEvent(new PopStateEvent('popstate'));

          // Wait for modal to open and highlight sections if specified
          if (highlightSections.length > 0) {
            setTimeout(() => {
              highlightSections.forEach(sectionId => {
                const section = UIElementManager.findElement(`#${sectionId}`) ||
                  UIElementManager.findElement(`[data-section="${sectionId}"]`);
                if (section) {
                  UIElementManager.highlightElement(section);
                  UIElementManager.scrollIntoView(section);
                }
              });
            }, 1000); // Increased timeout to allow modal to load
          }

          return {
            success: true,
            message: `Opened project details for ${mappedProjectSlug} in modal`,
            data: { projectId: mappedProjectSlug, highlightSections, method: 'modal' }
          };
        } else {
          // Navigate to projects page with project parameter (in new tab to preserve voice session)
          const projectUrl = `/projects?project=${mappedProjectSlug}`;
          window.open(projectUrl, '_blank');

          return {
            success: true,
            message: `Opened project details for ${mappedProjectSlug} in new tab`,
            data: { projectId: mappedProjectSlug, path: projectUrl, method: 'new_tab' }
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to show project details for ${projectId}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  // Helper method to map user input to actual project slugs
  private async mapProjectIdToSlug(projectId: string): Promise<string> {
    // Normalize the input
    const normalizedInput = projectId.toLowerCase().trim();

    // Common mappings for user-friendly names to actual slugs
    const projectMappings: Record<string, string> = {
      'e-commerce': 'e-commerce-platform',
      'ecommerce': 'e-commerce-platform',
      'e-commerce website': 'e-commerce-platform',
      'e-commerce platform': 'e-commerce-platform',
      'ecommerce platform': 'e-commerce-platform',
      'ecommerce website': 'e-commerce-platform',
      'shop': 'e-commerce-platform',
      'store': 'e-commerce-platform',
      'shopping': 'e-commerce-platform',

      'task management': 'task-management-app',
      'task manager': 'task-management-app',
      'tasks': 'task-management-app',
      'todo': 'task-management-app',
      'todo app': 'task-management-app',

      'portfolio': 'portfolio-website',
      'portfolio site': 'portfolio-website',
      'personal website': 'portfolio-website',
      'website': 'portfolio-website'
    };

    // Check direct mapping first
    if (projectMappings[normalizedInput]) {
      return projectMappings[normalizedInput];
    }

    // Try to fetch projects and find a match
    try {
      const response = await fetch('/api/projects?limit=50');
      if (response.ok) {
        const data = await response.json();
        const projects = data.data?.items || [];

        // Look for exact slug match
        const exactMatch = projects.find((p: any) => p.slug === normalizedInput);
        if (exactMatch) {
          return exactMatch.slug;
        }

        // Look for partial title match
        const titleMatch = projects.find((p: any) =>
          p.title.toLowerCase().includes(normalizedInput) ||
          normalizedInput.includes(p.title.toLowerCase())
        );
        if (titleMatch) {
          return titleMatch.slug;
        }

        // Look for partial slug match
        const slugMatch = projects.find((p: any) =>
          p.slug.includes(normalizedInput) ||
          normalizedInput.includes(p.slug)
        );
        if (slugMatch) {
          return slugMatch.slug;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch projects for mapping:', error);
    }

    // If no mapping found, return the input as-is (might be a valid slug)
    return normalizedInput;
  }

  async scrollIntoView(args: { selector: string; behavior?: ScrollBehavior }, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('scrollIntoView', args, async () => {
      const { selector, behavior = 'smooth' } = args;

      if (!selector || typeof selector !== 'string') {
        return {
          success: false,
          message: 'Invalid selector provided',
          error: 'Selector must be a non-empty string'
        };
      }

      const element = UIElementManager.findElement(selector);
      if (!element) {
        return {
          success: false,
          message: `Element not found: ${selector}`,
          error: 'Element does not exist in the DOM'
        };
      }

      try {
        UIElementManager.scrollIntoView(element, behavior);

        return {
          success: true,
          message: `Scrolled to element: ${selector}`,
          data: { selector, behavior }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to scroll to element: ${selector}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }, sessionId);
  }

  async highlightText(args: { selector: string; text?: string; className?: string }, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('highlightText', args, async () => {
      const { selector, text, className = 'voice-highlight' } = args;

      if (!selector || typeof selector !== 'string') {
        return {
          success: false,
          message: 'Invalid selector provided',
          error: 'Selector must be a non-empty string'
        };
      }

      try {
        if (text) {
          // Highlight specific text within elements
          const elements = UIElementManager.findElements(selector);
          if (!elements || elements.length === 0) {
            return {
              success: false,
              message: `No elements found: ${selector}`,
              error: 'Elements do not exist in the DOM'
            };
          }

          let highlightCount = 0;
          elements.forEach(element => {
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
              null
            );

            const textNodes: Text[] = [];
            let node;
            while (node = walker.nextNode()) {
              textNodes.push(node as Text);
            }

            textNodes.forEach(textNode => {
              if (textNode.textContent && textNode.textContent.toLowerCase().includes(text.toLowerCase())) {
                const parent = textNode.parentElement;
                if (parent) {
                  const regex = new RegExp(`(${text})`, 'gi');
                  const highlightedHTML = textNode.textContent.replace(regex,
                    `<span class="${className}-text">$1</span>`
                  );

                  const wrapper = document.createElement('span');
                  wrapper.innerHTML = highlightedHTML;
                  parent.replaceChild(wrapper, textNode);
                  highlightCount++;
                }
              }
            });
          });

          return {
            success: true,
            message: `Highlighted text "${text}" in ${highlightCount} locations`,
            data: { selector, text, className, count: highlightCount }
          };
        } else {
          // Highlight entire elements
          const elements = UIElementManager.findElements(selector);
          if (!elements || elements.length === 0) {
            return {
              success: false,
              message: `No elements found: ${selector}`,
              error: 'Elements do not exist in the DOM'
            };
          }

          elements.forEach(element => {
            UIElementManager.highlightElement(element, className);
          });

          return {
            success: true,
            message: `Highlighted ${elements.length} elements`,
            data: { selector, className, count: elements.length }
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to highlight: ${selector}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  async clearHighlights(args: { className?: string } = {}, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('clearHighlights', args, async () => {
      const { className = 'voice-highlight' } = args;

      try {
        UIElementManager.removeAllHighlights(className);
        UIElementManager.removeAllHighlights(`${className}-text`);

        return {
          success: true,
          message: 'Cleared all highlights',
          data: { className }
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to clear highlights',
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  async focusElement(args: { selector: string }, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('focusElement', args, async () => {
      const { selector } = args;

      if (!selector || typeof selector !== 'string') {
        return {
          success: false,
          message: 'Invalid selector provided',
          error: 'Selector must be a non-empty string'
        };
      }

      const element = UIElementManager.findElement(selector);
      if (!element) {
        return {
          success: false,
          message: `Element not found: ${selector}`,
          error: 'Element does not exist in the DOM'
        };
      }

      try {
        if (element instanceof HTMLElement) {
          element.focus();
          UIElementManager.scrollIntoView(element);
          UIElementManager.highlightElement(element);
        }

        return {
          success: true,
          message: `Focused element: ${selector}`,
          data: { selector }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to focus element: ${selector}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }, sessionId);
  }

  // Utility methods

  getNavigationHistory(): Array<{ action: string; params: any; timestamp: Date }> {
    return [...this.navigationHistory];
  }

  clearNavigationHistory(): void {
    this.navigationHistory = [];
  }

  getCurrentPageInfo(): { url: string; title: string; pathname: string } {
    return {
      url: window.location.href,
      title: document.title,
      pathname: window.location.pathname
    };
  }

  getVisibleElements(selector: string): Element[] {
    const elements = UIElementManager.findElements(selector);
    if (!elements) return [];

    return Array.from(elements).filter(el => UIElementManager.isElementVisible(el));
  }
}

// Note: Tool definitions are now managed by UnifiedToolRegistry
// This function has been removed as part of the unified tool system migration

// Export singleton instance
export const uiNavigationTools = UINavigationTools.getInstance();