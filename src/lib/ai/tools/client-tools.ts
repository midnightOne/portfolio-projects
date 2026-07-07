/**
 * Client-Side Tool Definitions
 * 
 * This file defines all client-side tools that execute directly in the browser
 * for UI navigation, manipulation, and immediate user interface interactions.
 */

import { UnifiedToolDefinition } from './types';

// Navigation Tools - Direct browser execution
// navigateTo tool removed - superseded by ui_intent

// showProjectDetails tool removed - superseded by ui_intent



export const scrollIntoViewToolDefinition: UnifiedToolDefinition = {
  name: 'scrollIntoView',
  description: 'INTERNAL/RECOVERY TOOL: Low-level element scrolling. Use ui_intent with section target instead for better reliability and context awareness.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector or section name. For homepage sections: "hero", "about", "bio", "projects", "contact". For specific elements: "#my-id", ".my-class", "[data-section-id=hero-main]"'
      },
      behavior: {
        type: 'string',
        enum: ['auto', 'smooth'],
        description: 'Scroll behavior animation',
        default: 'smooth'
      },
      block: {
        type: 'string',
        enum: ['start', 'center', 'end', 'nearest'],
        description: 'Vertical alignment of the element',
        default: 'start'
      }
    },
    required: ['selector']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      selector: { type: 'string' },
      elementFound: { type: 'boolean' }
    }
  }
};

export const highlightTextToolDefinition: UnifiedToolDefinition = {
  name: 'highlightText',
  description: 'INTERNAL/RECOVERY TOOL: Low-level text highlighting. Use ui_intent for navigation with automatic highlighting, or use this only for specific emphasis needs.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector or section name. For homepage sections: "hero", "about", "bio", "projects", "contact". For specific elements: "#my-id", ".my-class", "[data-section-id=hero-main]", "h1", "p"'
      },
      text: {
        type: 'string',
        description: 'Specific text to highlight (optional - if not provided, highlights entire elements)'
      },
      className: {
        type: 'string',
        description: 'CSS class name for highlighting style',
        default: 'voice-highlight'
      },
      type: {
        type: 'string',
        enum: ['spotlight', 'outline', 'color', 'glow'],
        description: 'Type of highlighting effect',
        default: 'color'
      }
    },
    required: ['selector']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      elementsHighlighted: { type: 'number' },
      highlightClass: { type: 'string' }
    }
  }
};

export const clearHighlightsToolDefinition: UnifiedToolDefinition = {
  name: 'clearHighlights',
  description: 'Clear all highlights from the page to reset visual emphasis.',
  parameters: {
    type: 'object',
    properties: {
      className: {
        type: 'string',
        description: 'CSS class name to remove (optional - removes all highlights if not specified)',
        default: 'voice-highlight'
      },
      selector: {
        type: 'string',
        description: 'Specific selector to clear highlights from (optional - clears all if not specified)'
      }
    }
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      elementsCleared: { type: 'number' }
    }
  }
};

export const focusElementToolDefinition: UnifiedToolDefinition = {
  name: 'focusElement',
  description: 'Focus on a specific element and bring it into view for user attention.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element to focus'
      },
      scrollIntoView: {
        type: 'boolean',
        description: 'Whether to scroll the element into view',
        default: true
      }
    },
    required: ['selector']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      selector: { type: 'string' },
      elementFocused: { type: 'boolean' }
    }
  }
};

// reportUIState tool removed - redundant with ui_describe and UIManager background updates

// Removed ui_navigate - consolidated into ui_intent

export const uiDescribeToolDefinition: UnifiedToolDefinition = {
  name: 'ui_describe',
  description: 'Get current UI state and available navigation affordances. Use this to understand what navigation options are available.',
  parameters: {
    type: 'object',
    properties: {}
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      epoch: { type: 'number' },
      route: { type: 'string' },
      viewStack: { type: 'array', items: { type: 'string' } },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            containerId: { type: 'string' }
          }
        }
      },
      transitions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['open', 'close', 'route', 'tab'] },
            target: { type: 'string' },
            requires: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }
};

// UIManager Navigation Tools - Declarative navigation system
export const uiIntentToolDefinition: UnifiedToolDefinition = {
  name: 'ui_intent',
  description: 'PRIMARY NAVIGATION TOOL: Execute declarative navigation intents using the UIManager system. Use this for ALL navigation goals including projects, sections, routes, and modal operations.',
  parameters: {
    type: 'object',
    properties: {
      epoch: {
        type: 'number',
        description: 'Client UI state version for consistency checking (optional)'
      },
      target: {
        type: 'object',
        description: 'Navigation target specification',
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['project'] },
              id: { type: 'string', description: 'Project slug (e.g., "e-commerce-platform")' },
              sectionId: { type: 'string', description: 'Optional section within project' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['section'] },
              id: { type: 'string', description: 'Section identifier (e.g., "hero", "about", "contact")' },
              projectId: { type: 'string', description: 'Optional project context' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['route'] },
              id: { type: 'string', description: 'Route name (e.g., "home", "projects")' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['modal'] },
              id: { type: 'string', description: 'Modal identifier or "close" to close modals' },
              parentContext: { type: 'string', description: 'Optional parent context' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['element'] },
              id: { type: 'string', description: 'Element identifier for tabs, accordions, etc.' }
            },
            required: ['type', 'id']
          }
        ]
      },
      behavior: {
        type: 'object',
        description: 'Navigation behavior options',
        properties: {
          openIfNeeded: { type: 'boolean', description: 'Open modal or navigate if required' },
          closeBlocking: { type: 'boolean', description: 'Close blocking modals if needed' },
          waitForReadyMs: { type: 'number', description: 'Wait time for transitions' },
          scrollBehavior: { type: 'string', enum: ['smooth', 'instant'], description: 'Scroll animation type' },
          allowInterruption: { type: 'boolean', description: 'Allow navigation to be interrupted' }
        }
      },
      scope: {
        type: 'object',
        description: 'Navigation scope constraints',
        properties: {
          route: { type: 'string', description: 'Limit to specific route' },
          modalId: { type: 'string', description: 'Limit to specific modal' },
          projectId: { type: 'string', description: 'Limit to specific project' }
        }
      },
      idempotencyKey: {
        type: 'string',
        description: 'Unique key to prevent duplicate navigation operations'
      }
    },
    required: ['target']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: { type: 'object' },
      error: { type: 'string' },
      executedSteps: { type: 'array', items: { type: 'string' } },
      totalTime: { type: 'number' }
    }
  }
};

// Export all client-side tool definitions
export const clientToolDefinitions: UnifiedToolDefinition[] = [
  // Removed: navigateToToolDefinition, showProjectDetailsToolDefinition, reportUIStateToolDefinition
  scrollIntoViewToolDefinition,
  highlightTextToolDefinition,
  clearHighlightsToolDefinition,
  focusElementToolDefinition,
  uiDescribeToolDefinition,
  uiIntentToolDefinition
];

// Individual tools are already exported above with their definitions

// ---------------------------------------------------------------------------
// Client-side tool EXECUTION (merged from src/lib/voice/UINavigationTools.ts,
// Phase 3 task 3.2 - one client-tool module: definitions above, executors below).
// ---------------------------------------------------------------------------

import { ToolResult } from '@/types/voice-agent';
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

  // Set up CSS styles for highlighting (no-op on the server: this module is
  // imported by server code for the tool DEFINITIONS; executors run in-browser)
  private setupHighlightStyles(): void {
    if (typeof document === 'undefined') {
      return;
    }
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

  // INTERNAL/RECOVERY NAVIGATION TOOLS - Use ui_intent instead for better reliability

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

      // Map common section names to selectors
      const sectionMap: Record<string, string[]> = {
        'hero': ['#hero', '[data-section-type="hero"]', '[data-section-id*="hero"]'],
        'about': ['#about', '[data-section-type="about"]', '[data-section-id*="about"]'],
        'bio': ['#about', '[data-section-type="about"]', '[data-section-id*="about"]'], // bio is commonly about
        'projects': ['#projects', '[data-section-type="projects"]', '[data-section-id*="projects"]'],
        'work': ['#projects', '[data-section-type="projects"]', '[data-section-id*="projects"]'], // work is commonly projects
        'contact': ['#contact', '[data-section-type="contact"]', '[data-section-id*="contact"]']
      };

      let element: Element | null = null;
      let actualSelector = selector;

      // Try to find element using section mapping first
      const normalizedSelector = selector.toLowerCase().trim();
      if (sectionMap[normalizedSelector]) {
        for (const mappedSelector of sectionMap[normalizedSelector]) {
          element = UIElementManager.findElement(mappedSelector);
          if (element) {
            actualSelector = mappedSelector;
            break;
          }
        }
      }

      // If not found via mapping, try direct selector
      if (!element) {
        element = UIElementManager.findElement(selector);
        actualSelector = selector;
      }

      if (!element) {
        return {
          success: false,
          message: `Element not found: ${selector}${sectionMap[normalizedSelector] ? ` (also tried: ${sectionMap[normalizedSelector].join(', ')})` : ''}`,
          error: 'Element does not exist in the DOM'
        };
      }

      try {
        UIElementManager.scrollIntoView(element, behavior);

        return {
          success: true,
          message: `Scrolled to element: ${actualSelector}`,
          data: { selector: actualSelector, originalSelector: selector, behavior }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to scroll to element: ${actualSelector}`,
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

      // Map common section names to selectors
      const sectionMap: Record<string, string[]> = {
        'hero': ['#hero', '[data-section-type="hero"]', '[data-section-id*="hero"]'],
        'about': ['#about', '[data-section-type="about"]', '[data-section-id*="about"]'],
        'bio': ['#about', '[data-section-type="about"]', '[data-section-id*="about"]'], // bio is commonly about
        'projects': ['#projects', '[data-section-type="projects"]', '[data-section-id*="projects"]'],
        'work': ['#projects', '[data-section-type="projects"]', '[data-section-id*="projects"]'], // work is commonly projects
        'contact': ['#contact', '[data-section-type="contact"]', '[data-section-id*="contact"]']
      };

      let elements: NodeListOf<Element> | null = null;
      let actualSelector = selector;

      // Try to find elements using section mapping first
      const normalizedSelector = selector.toLowerCase().trim();
      if (sectionMap[normalizedSelector]) {
        for (const mappedSelector of sectionMap[normalizedSelector]) {
          elements = UIElementManager.findElements(mappedSelector);
          if (elements && elements.length > 0) {
            actualSelector = mappedSelector;
            break;
          }
        }
      }

      // If not found via mapping, try direct selector
      if (!elements || elements.length === 0) {
        elements = UIElementManager.findElements(selector);
        actualSelector = selector;
      }

      if (!elements || elements.length === 0) {
        return {
          success: false,
          message: `No elements found: ${selector}${sectionMap[normalizedSelector] ? ` (also tried: ${sectionMap[normalizedSelector].join(', ')})` : ''}`,
          error: 'Elements do not exist in the DOM'
        };
      }

      try {
        if (text) {
          // Highlight specific text within elements
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
            message: `Highlighted text "${text}" in ${highlightCount} locations within ${actualSelector}`,
            data: { selector: actualSelector, originalSelector: selector, text, className, count: highlightCount }
          };
        } else {
          // Highlight entire elements
          elements.forEach(element => {
            UIElementManager.highlightElement(element, className);
          });

          return {
            success: true,
            message: `Highlighted ${elements.length} elements using ${actualSelector}`,
            data: { selector: actualSelector, originalSelector: selector, className, count: elements.length }
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to highlight: ${actualSelector}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }, sessionId);
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

  // PRIMARY NAVIGATION INTERFACE - Use ui_intent for all navigation

  async ['ui_intent'](args: any, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('ui_intent', args, async () => {
      try {
        console.log('🎯 ui_intent called with args:', JSON.stringify(args, null, 2));
        
        // Parse args if they come as a string (from voice interface)
        let params = args;
        if (typeof args === 'string') {
          try {
            params = JSON.parse(args);
          } catch (parseError) {
            console.error('❌ Failed to parse ui_intent args:', parseError);
            throw new Error('Invalid JSON parameters for ui_intent');
          }
        }
        
        // Ensure params has the correct structure for UIIntentParams
        if (!params.target) {
          console.error('❌ ui_intent missing target:', params);
          throw new Error('ui_intent requires a target parameter');
        }
        
        // Import UIManager dynamically to avoid circular dependencies
        const { UIManager } = await import('@/lib/navigation/UIManager');
        const uiManager = UIManager.getInstance();
        
        console.log('🎯 UIManager imported, calling executeIntent with params:', JSON.stringify(params, null, 2));
        const result = await uiManager.executeIntent(params, sessionId);
        
        console.log('🎯 UIManager executeIntent result:', JSON.stringify(result, null, 2));
        
        return {
          success: result.success,
          message: result.message,
          data: result.executedSteps || result.data,
          error: result.error,
          executedSteps: result.executedSteps || [],
          totalTime: result.totalTime || 0
        };
        
      } catch (error) {
        console.error('❌ ui_intent error:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error in ui_intent',
          error: error instanceof Error ? error.message : 'Unknown error',
          data: null,
          executedSteps: [],
          totalTime: 0
        };
      }
    });
  }

  // Removed ui_navigate - consolidated into ui_intent

  async ['ui_describe'](args: any = {}, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('ui_describe', args, async () => {
      try {
        // Import UIManager dynamically to avoid circular dependencies
        const { UIManager } = await import('@/lib/navigation/UIManager');
        const uiManager = UIManager.getInstance();
        
        const description = await uiManager.describe();
        
        return {
          success: true,
          message: 'UI state described successfully',
          data: description
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to describe UI state`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }, sessionId);
  }

}

// Note: Tool definitions are now managed by UnifiedToolRegistry
// This function has been removed as part of the unified tool system migration

// Export singleton instance
export const uiNavigationTools = UINavigationTools.getInstance();

// Expose globally for integration tests and debugging
if (typeof window !== 'undefined') {
  (window as any).UINavigationTools = UINavigationTools;
}