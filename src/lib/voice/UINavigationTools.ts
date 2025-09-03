/**
 * UINavigationTools System
 * 
 * Client-side JavaScript functions for UI manipulation by voice agents.
 * Provides immediate tool execution without server round-trips and reports
 * results back to AI providers for conversation continuity.
 */

import { ToolDefinition, ToolResult } from '@/types/voice-agent';

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

  // Execute tool and report result
  private async executeAndReport(toolName: string, args: any, handler: () => Promise<NavigationResult>): Promise<NavigationResult> {
    const startTime = Date.now();
    
    try {
      const result = await handler();
      const executionTime = Date.now() - startTime;
      
      // Add to navigation history
      this.navigationHistory.push({
        action: toolName,
        params: args,
        timestamp: new Date()
      });

      // Report result to callback if registered
      const callback = this.toolResultCallbacks.get(toolName);
      if (callback) {
        callback({
          id: `${toolName}_${Date.now()}`,
          result: result.data || result.message,
          error: result.error,
          timestamp: new Date(),
          executionTime
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult: NavigationResult = {
        success: false,
        message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };

      // Report error to callback if registered
      const callback = this.toolResultCallbacks.get(toolName);
      if (callback) {
        callback({
          id: `${toolName}_${Date.now()}`,
          result: null,
          error: errorResult.error,
          timestamp: new Date(),
          executionTime
        });
      }

      return errorResult;
    }
  }

  // Navigation tools

  async navigateTo(args: { path: string; newTab?: boolean }): Promise<NavigationResult> {
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
        if (newTab) {
          window.open(path, '_blank');
        } else {
          window.location.href = path;
        }

        return {
          success: true,
          message: `Navigated to ${path}`,
          data: { path, newTab }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to navigate to ${path}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  async showProjectDetails(args: { projectId: string; highlightSections?: string[] }): Promise<NavigationResult> {
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
        // Look for existing project modal or create navigation
        const projectLink = UIElementManager.findElement(`[data-project-id="${projectId}"]`) ||
                           UIElementManager.findElement(`[href*="${projectId}"]`);

        if (projectLink && projectLink instanceof HTMLElement) {
          projectLink.click();
          
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
            }, 500);
          }

          return {
            success: true,
            message: `Opened project details for ${projectId}`,
            data: { projectId, highlightSections }
          };
        } else {
          // Navigate to project page if no modal available
          const projectPath = `/projects/${projectId}`;
          window.location.href = projectPath;
          
          return {
            success: true,
            message: `Navigated to project page for ${projectId}`,
            data: { projectId, path: projectPath }
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

  async scrollIntoView(args: { selector: string; behavior?: ScrollBehavior }): Promise<NavigationResult> {
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
    });
  }

  async highlightText(args: { selector: string; text?: string; className?: string }): Promise<NavigationResult> {
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

  async clearHighlights(args: { className?: string } = {}): Promise<NavigationResult> {
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

  async focusElement(args: { selector: string }): Promise<NavigationResult> {
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
    });
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

// Tool definitions for voice agents
export function createUINavigationToolDefinitions(): ToolDefinition[] {
  const tools = UINavigationTools.getInstance();

  return [
    {
      name: 'navigateTo',
      description: 'Navigate to a specific page or URL',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path or URL to navigate to'
          },
          newTab: {
            type: 'boolean',
            description: 'Whether to open in a new tab',
            default: false
          }
        },
        required: ['path']
      },
      handler: async (args) => tools.navigateTo(args)
    },
    {
      name: 'showProjectDetails',
      description: 'Show details for a specific project, optionally highlighting sections',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The ID or slug of the project to show'
          },
          highlightSections: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of section IDs to highlight',
            default: []
          }
        },
        required: ['projectId']
      },
      handler: async (args) => tools.showProjectDetails(args)
    },
    {
      name: 'scrollIntoView',
      description: 'Scroll to bring a specific element into view',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to scroll to'
          },
          behavior: {
            type: 'string',
            enum: ['auto', 'smooth'],
            description: 'Scroll behavior',
            default: 'smooth'
          }
        },
        required: ['selector']
      },
      handler: async (args) => tools.scrollIntoView(args)
    },
    {
      name: 'highlightText',
      description: 'Highlight specific text or elements on the page',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for elements to search within'
          },
          text: {
            type: 'string',
            description: 'Specific text to highlight (optional - if not provided, highlights entire elements)'
          },
          className: {
            type: 'string',
            description: 'CSS class name for highlighting',
            default: 'voice-highlight'
          }
        },
        required: ['selector']
      },
      handler: async (args) => tools.highlightText(args)
    },
    {
      name: 'clearHighlights',
      description: 'Clear all highlights from the page',
      parameters: {
        type: 'object',
        properties: {
          className: {
            type: 'string',
            description: 'CSS class name to remove',
            default: 'voice-highlight'
          }
        }
      },
      handler: async (args) => tools.clearHighlights(args)
    },
    {
      name: 'focusElement',
      description: 'Focus on a specific element and bring it into view',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to focus'
          }
        },
        required: ['selector']
      },
      handler: async (args) => tools.focusElement(args)
    }
  ];
}

// Export singleton instance
export const uiNavigationTools = UINavigationTools.getInstance();