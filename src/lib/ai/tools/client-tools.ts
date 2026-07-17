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

/**
 * ui_details (task 7.1e): the instant pull behind the 7.1a orientation diet.
 * The fid controller retains the FULL current-view context client-side;
 * this tool returns it with zero server round-trip. Division of labor vs the
 * semantic tools is encoded in the description (and mirrored in mint
 * guidance): ui_details = current view in depth; content_search = the whole
 * portfolio; content_get = a specific known id.
 */
export const uiDetailsToolDefinition: UnifiedToolDefinition = {
  name: 'ui_details',
  description:
    'Instantly returns what the visitor is CURRENTLY looking at, in depth: the open project\'s brief + detailed summaries and its section handles. Deterministic, no query, read from the browser — use it FIRST for questions about the on-screen thing. Results are stable for a given NAV_CONTEXT state: if NAV_CONTEXT has not changed since your last ui_details call, you already have this — do not call again. For other topics or projects use content_search; for full detail on a specific known id use content_get.',
  parameters: {
    type: 'object',
    properties: {}
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      navKey: { type: 'string' },
      route: { type: 'string' },
      currentProject: { type: 'string' },
      briefSummary: { type: 'string' },
      detailedSummary: { type: 'string' },
      semanticItems: { type: 'array', items: { type: 'object' } },
      availableProjects: { type: 'array', items: { type: 'object' } }
    }
  }
};

// UIManager Navigation Tools - Declarative navigation system
// 7.2b: the per-target-type oneOf (5 near-identical branches, the highlight
// description repeated verbatim) collapsed into one flat target object — the
// dispatcher normalizes shapes anyway (_normalizeIntentTarget, 6.10), and
// Gemini always saw the flattened form. Keep the highlight pass-through rule;
// it is load-bearing (SHOW-DON'T-TELL).
export const uiIntentToolDefinition: UnifiedToolDefinition = {
  name: 'ui_intent',
  description: 'PRIMARY NAVIGATION TOOL: declaratively navigate to projects, sections, routes, and modals. Prefer passing a navTarget from content_search results through UNCHANGED.',
  parameters: {
    type: 'object',
    properties: {
      epoch: {
        type: 'number',
        description: 'Client UI state version (optional)'
      },
      target: {
        type: 'object',
        description: 'Navigation target. type=project: id is the slug, sectionId optional. type=section: id like "hero"/"about"/"projects"/"contact" or a section anchor, projectId optional. type=route: id like "home". type=modal: id is a modal id, or "close"/"close-all". type=element: tabs/accordions.',
        properties: {
          type: { type: 'string', enum: ['project', 'section', 'route', 'modal', 'element'] },
          id: { type: 'string' },
          sectionId: { type: 'string', description: 'Section within the project' },
          projectId: { type: 'string', description: 'Project context for a section target' },
          highlight: {
            type: 'object',
            description: 'Optional emphasis after scrolling. Pass navTarget.highlight from content_search through unchanged, or set text to a short verbatim passage to mark on the page.',
            properties: {
              text: { type: 'string' }
            }
          }
        },
        required: ['type', 'id']
      },
      behavior: {
        type: 'object',
        properties: {
          openIfNeeded: { type: 'boolean' },
          closeBlocking: { type: 'boolean' },
          waitForReadyMs: { type: 'number' },
          scrollBehavior: { type: 'string', enum: ['smooth', 'instant'] },
          allowInterruption: { type: 'boolean' }
        }
      },
      scope: {
        type: 'object',
        description: 'Optional constraints (route/modalId/projectId)',
        properties: {
          route: { type: 'string' },
          modalId: { type: 'string' },
          projectId: { type: 'string' }
        }
      },
      idempotencyKey: {
        type: 'string',
        description: 'Unique key to prevent duplicate navigation'
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

// Auto-navigation consent toggle (conversation-engine Req 13.8, Block G2, P36).
// Spoken flips MUST be this tool call — the toggle is real state the visitor
// can see on the pill; the agent may enable it ONLY after explicit visitor
// consent in-conversation (guidance-enforced; the tool call is the honest
// transcript evidence either way).
export const setAutoNavigationToolDefinition: UnifiedToolDefinition = {
  name: 'set_auto_navigation',
  description:
    'Flip the visitor-visible auto-navigation consent toggle. enabled=true ONLY after the visitor explicitly agreed to you navigating for them (e.g. accepted a tour); enabled=false whenever they ask you to stop navigating. While OFF you must ask before commit-level navigation.',
  parameters: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'true = visitor consented to autonomous navigation; false = ask-before-navigating mode',
      },
    },
    required: ['enabled'],
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      autoNavigation: { type: 'boolean' },
    },
  },
};

// Job-description intake form (conversation-engine Req 13.4, Block G3).
// 7.16 split (A): this form is RECRUITER-ONLY — its submission runs the
// job-analysis-against-owner-background pipeline (reflink-gated +
// enableJobAnalysis server-side — this tool only opens UI, it grants
// nothing). Client/project requests go through client_request_form instead.
export const jobDescriptionFormToolDefinition: UnifiedToolDefinition = {
  name: 'job_description_form',
  description:
    'Open the job-description intake form — ONLY for recruiters/employers evaluating whether to HIRE the owner for a role: the visitor pastes or drops the job posting, and it is analyzed against his background. NEVER open it for a prospective client who wants a project built or quoted — that is client_request_form. You will be told when the analysis completes so you can offer a spoken summary, a read-aloud, or to let them read in peace.',
  parameters: { type: 'object', properties: {} },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};

// Client/project-request intake (ai-assistant 7.16, split (A)). Opens the
// pass-to-owner modal: message + contact + optional pasted spec; the
// submission writes a ConversationLead row and notifies the owner (H2 seam).
// The visitor's own submit click is the consent moment — the model never
// submits this form itself without explicit confirmation (fill_field gate).
export const clientRequestFormToolDefinition: UnifiedToolDefinition = {
  name: 'client_request_form',
  description:
    'Open the client/project-request intake — for prospective CLIENTS who want project work built, quoted, or discussed, or any visitor who wants to leave the owner a message or question. They can type or dictate a message, leave contact details, and optionally paste a project spec; submitting passes it directly to the owner. This is NOT the recruiter job-analysis form.',
  parameters: { type: 'object', properties: {} },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};

// Generic dictation text-fill (ai-assistant 7.16b — the real use case the
// D18 "form-filling tools" backlog line waited for). Targets any visible
// field by SemanticIDRegistry id/alias, element id, name, or label text;
// works on the client-request intake, the homepage contact form, and any
// future form. Consent gate mirrors lead_capture: submission requires the
// model to attest explicit visitor confirmation. HONESTY (6.10): the result
// reports what actually landed — a failed fill fails, never narrates success.
export const fillFieldToolDefinition: UnifiedToolDefinition = {
  name: 'fill_field',
  description:
    'Type dictated text into ONE named form field on the current page (semantic id, element id, name, or field label), optionally submitting its form afterwards. The result reports what the field actually contains — repeat it back when accuracy matters. submit requires submitConfirmed: true, which you may set ONLY after the visitor explicitly confirmed submission in this conversation; never submit on your own initiative.',
  parameters: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        description: 'Which field: semantic id, element id, name attribute, or visible label text',
      },
      value: {
        type: 'string',
        description: 'Text to put in the field (replaces current content). Omit when only submitting.',
      },
      submit: {
        type: 'boolean',
        description: 'Also submit the form the field belongs to. Requires submitConfirmed.',
      },
      submitConfirmed: {
        type: 'boolean',
        description: 'true ONLY if the visitor explicitly confirmed, in this conversation, that the form should be submitted now.',
      },
    },
    required: ['field'],
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      field: { type: 'string' },
      currentValue: { type: 'string' },
      submitted: { type: 'boolean' },
    },
  },
};

// Export all client-side tool definitions
export const clientToolDefinitions: UnifiedToolDefinition[] = [
  // Removed: navigateToToolDefinition, showProjectDetailsToolDefinition, reportUIStateToolDefinition
  scrollIntoViewToolDefinition,
  highlightTextToolDefinition,
  clearHighlightsToolDefinition,
  focusElementToolDefinition,
  uiDescribeToolDefinition,
  uiDetailsToolDefinition,
  uiIntentToolDefinition,
  setAutoNavigationToolDefinition,
  jobDescriptionFormToolDefinition,
  clientRequestFormToolDefinition,
  fillFieldToolDefinition
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

            // The search text is arbitrary (model- or chunk-supplied): escape
            // regex metacharacters, and build DOM nodes rather than innerHTML.
            const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedText})`, 'gi');

            textNodes.forEach(textNode => {
              if (textNode.textContent && textNode.textContent.toLowerCase().includes(text.toLowerCase())) {
                const parent = textNode.parentElement;
                if (parent) {
                  const fragment = document.createDocumentFragment();
                  for (const part of textNode.textContent.split(regex)) {
                    if (part.toLowerCase() === text.toLowerCase()) {
                      const mark = document.createElement('span');
                      mark.className = `${className}-text`;
                      mark.textContent = part;
                      fragment.appendChild(mark);
                    } else if (part) {
                      fragment.appendChild(document.createTextNode(part));
                    }
                  }
                  parent.replaceChild(fragment, textNode);
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

  /**
   * Auto-navigation consent toggle (Req 13.8, G2, P36). The store fans the
   * change out to the pill (visible control) and the adapter (floating-block
   * policy line + turn evidence for server persistence) — the tool result is
   * honest state, never a claim.
   */
  async ['set_auto_navigation'](args: { enabled?: boolean } | string, _sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('set_auto_navigation', args, async () => {
      let params = args as { enabled?: boolean };
      if (typeof args === 'string') {
        try {
          params = JSON.parse(args);
        } catch {
          return { success: false, message: 'Invalid JSON parameters for set_auto_navigation', error: 'bad_args' };
        }
      }
      if (typeof params.enabled !== 'boolean') {
        return { success: false, message: 'set_auto_navigation requires boolean `enabled`', error: 'bad_args' };
      }
      const { setAutoNav } = await import('@/lib/ai/autonav');
      const value = setAutoNav(params.enabled, 'tool');
      return {
        success: true,
        message: `Auto-navigation is now ${value ? 'ON — you may navigate for the visitor until they turn it off' : 'OFF — ask before commit-level navigation'}`,
        data: { autoNavigation: value },
      };
    });
  }

  /**
   * Job-description form opener (Req 13.4, G3). Opening is the tool's whole
   * job — the submission outcome reaches the model later through the context
   * buffer (`jd_analysis` key) when the analysis completes, and a dismissal
   * becomes turn evidence so the graph knows the form was declined (read-aloud
   * fallback per design-ux-and-behavior §2.5).
   */
  async ['job_description_form'](_args: unknown, _sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('job_description_form', {}, async () => {
      const { setJdFormOpen } = await import('@/lib/ai/jd-form');
      setJdFormOpen(true);
      return {
        success: true,
        message:
          'Job-description form opened. The visitor can paste the posting or drop a text file; you will be told when the analysis completes. If they close it without submitting, they may prefer to read the posting aloud instead.',
      };
    });
  }

  /**
   * Client/project-request form opener (7.16 split (A)). Opening is the whole
   * job — the submission outcome reaches the model through the context buffer
   * (`client_request` key), and a dismissal becomes context so the model can
   * fall back to capturing the request conversationally via lead_capture.
   */
  async ['client_request_form'](_args: unknown, _sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('client_request_form', {}, async () => {
      const { setClientRequestFormOpen } = await import('@/lib/ai/client-request-form');
      setClientRequestFormOpen(true);
      return {
        success: true,
        message:
          'Client-request form opened. The visitor can type a message, leave contact details, and optionally paste a project spec — or dictate any field to you (fill_field). You will be told when they submit or close it. Submitting is THEIR action (or yours only after their explicit confirmation).',
      };
    });
  }

  /**
   * fill_field (7.16b): generic dictation text-fill. Resolution order:
   * SemanticIDRegistry id → registry alias → [data-semantic-id] → #id →
   * [name] → [data-testid] → visible label text. React-controlled inputs need
   * the NATIVE value setter + a bubbling input event (plain `.value=` is
   * invisible to React — known trap); the result reads the value BACK from the
   * DOM so the model reports what actually landed (6.10 honesty). Submission
   * is consent-gated: submit without submitConfirmed performs the fill (if
   * any) but never the submit.
   */
  async ['fill_field'](args: any, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('fill_field', args, async () => {
      let params = args as { field?: string; value?: string; submit?: boolean; submitConfirmed?: boolean };
      if (typeof args === 'string') {
        try {
          params = JSON.parse(args);
        } catch {
          return { success: false, message: 'Invalid JSON parameters for fill_field', error: 'bad_args' };
        }
      }
      const fieldName = typeof params.field === 'string' ? params.field.trim() : '';
      if (!fieldName) {
        return { success: false, message: 'fill_field requires `field` — a semantic id, element id, name, or label', error: 'bad_args' };
      }

      const el = await this._resolveFillTarget(fieldName);
      if (!el) {
        return {
          success: false,
          message: `Field "${fieldName}" not found on the current page. ${this._describeFillableFields()}`,
          error: 'field_not_found',
        };
      }

      const hasValue = typeof params.value === 'string';
      let currentValue = el.value;

      if (hasValue) {
        try {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {
          /* focus/scroll are best-effort — the fill below is what matters */
        }
        // React trap: assign through the NATIVE prototype setter, then fire a
        // bubbling input event, or React's controlled state never sees it.
        const proto =
          el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : el instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, params.value);
        else el.value = params.value as string;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // HONESTY: read back what the DOM (and thus React state) actually holds.
        currentValue = el.value;
        if (currentValue !== params.value) {
          return {
            success: false,
            message: `Fill FAILED for "${fieldName}": the field now contains "${currentValue}" instead of the requested text (the input may be read-only, disabled, or rejecting the value). Do not tell the visitor it was filled.`,
            error: 'fill_verification_failed',
            data: { field: fieldName, currentValue },
          };
        }
        UIElementManager.highlightElement(el);
      }

      if (params.submit === true) {
        if (params.submitConfirmed !== true) {
          return {
            success: hasValue,
            message: hasValue
              ? `Filled "${fieldName}" (it now contains: "${currentValue}"). NOT submitted — ask the visitor to explicitly confirm submission first, then call fill_field again with submit and submitConfirmed both true.`
              : 'NOT submitted: explicit visitor confirmation is required first. Ask the visitor whether to submit the form, then call again with submitConfirmed: true.',
            data: { field: fieldName, currentValue, submitted: false },
            ...(hasValue ? {} : { error: 'submit_consent_required' }),
          };
        }
        const form = el.closest('form');
        if (!form) {
          return {
            success: false,
            message: `Field "${fieldName}" was ${hasValue ? 'filled but' : ''} its form could not be found — no <form> ancestor. Ask the visitor to press the submit button themselves.`,
            error: 'form_not_found',
            data: { field: fieldName, currentValue, submitted: false },
          };
        }
        // requestSubmit (not submit()) so the form's own onSubmit handler and
        // validation run — that IS the submission the visitor confirmed.
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return {
          success: true,
          message: `${hasValue ? `Filled "${fieldName}" and submitted` : 'Submitted'} the form (submit dispatched — the form's own UI shows the outcome; a context update will tell you if this was the client-request intake).`,
          data: { field: fieldName, currentValue, submitted: true },
        };
      }

      return {
        success: true,
        message: `Filled "${fieldName}". The field now contains: "${currentValue}". Not submitted.`,
        data: { field: fieldName, currentValue, submitted: false },
      };
    }, sessionId);
  }

  /** Resolve a fill_field target to a fillable element. */
  private async _resolveFillTarget(
    field: string
  ): Promise<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null> {
    const fillable = (el: Element | null): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null => {
      if (!el) return null;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        return el;
      }
      // A container handle (e.g. a labeled wrapper): use its single field.
      const inner = el.querySelectorAll('input, textarea, select');
      return inner.length === 1 ? (inner[0] as HTMLInputElement) : null;
    };

    // 1-2: SemanticIDRegistry id, then alias (the registry auto-discovers
    // [data-semantic-id] elements and carries aliases).
    try {
      const { getSemanticIDRegistry } = await import('@/lib/navigation/SemanticIDRegistry');
      const registry = getSemanticIDRegistry();
      const direct = fillable(registry.resolveSemanticID(field));
      if (direct) return direct;
      const aliasId = registry.findSemanticIDByAlias(field);
      if (aliasId) {
        const viaAlias = fillable(registry.resolveSemanticID(aliasId));
        if (viaAlias) return viaAlias;
      }
    } catch {
      /* registry unavailable — DOM fallbacks below still work */
    }

    // 3-7: DOM fallbacks, scoped. An OPEN AI overlay (the intake/JD modals
    // carry data-ai-surface) wins over the page behind it — "the message
    // field" while the intake modal is open means the MODAL's field, not the
    // background contact form's #message (live-drill finding, 2026-07-17).
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(field) : field.replace(/["\\]/g, '\\$&');
    const surfaces = Array.from(document.querySelectorAll('[data-ai-surface]'));
    const scopes: Array<Element | Document> = [...surfaces.reverse(), document];
    for (const scope of scopes) {
      for (const selector of [`[data-semantic-id="${esc}"]`, `#${esc}`, `[name="${esc}"]`, `[data-testid="${esc}"]`]) {
        try {
          const hit = fillable(scope.querySelector(selector));
          if (hit) return hit;
        } catch {
          /* invalid selector for this form of the name — try the next */
        }
      }
      // visible label text ("Email", "Your message"...)
      const wanted = field.toLowerCase();
      for (const label of Array.from(scope.querySelectorAll('label'))) {
        const text = (label.textContent ?? '').trim().toLowerCase().replace(/\s*\*$/, '');
        if (text === wanted || (wanted.length > 2 && text.includes(wanted))) {
          const forId = label.getAttribute('for');
          const target = forId
            ? (scope instanceof Document ? scope : document).getElementById?.(forId) ?? document.getElementById(forId)
            : label.querySelector('input, textarea, select');
          const hit = fillable(target);
          if (hit) return hit;
        }
      }
      // Last pass per scope: a UNIQUE handle-substring match ("contact" →
      // client-request-contact when it is the only such field in the open
      // modal). Ambiguity (2+ matches) falls through to the honest not-found
      // error, whose field listing lets the model pick the exact handle.
      if (wanted.length > 2) {
        const partial = Array.from(scope.querySelectorAll('input, textarea, select')).filter((el) => {
          const input = el as HTMLInputElement;
          if (input.type === 'hidden' || input.disabled) return false;
          const handle = `${input.getAttribute('data-semantic-id') ?? ''} ${input.id} ${input.name ?? ''} ${input.getAttribute('data-testid') ?? ''}`.toLowerCase();
          return handle.includes(wanted);
        });
        if (partial.length === 1) {
          const hit = fillable(partial[0]);
          if (hit) return hit;
        }
      }
    }
    return null;
  }

  /** Honest recovery help: what CAN be filled on this page right now. */
  private _describeFillableFields(): string {
    const handles: string[] = [];
    for (const el of Array.from(document.querySelectorAll('input, textarea, select'))) {
      const input = el as HTMLInputElement;
      if (input.type === 'hidden' || input.disabled) continue;
      const handle = input.getAttribute('data-semantic-id') || input.id || input.name || input.getAttribute('data-testid');
      if (handle) handles.push(handle);
      if (handles.length >= 15) break;
    }
    return handles.length
      ? `Fillable fields currently on the page: ${handles.join(', ')}.`
      : 'No fillable form fields are visible on the current page — open the relevant form first (client_request_form, or navigate to the contact section).';
  }

  /**
   * ui_details (7.1e): read the retained full view context straight from the
   * PassiveFIDManager singleton — client memory, no /api round trip. The
   * manager's prefetch-on-navigation keeps the buffer warm before the model
   * can ask; an empty buffer (no navigation yet) is an honest miss, not an
   * error.
   */
  async ['ui_details'](args: any = {}, sessionId?: string): Promise<NavigationResult> {
    return this.executeAndReport('ui_details', args, async () => {
      try {
        const { PassiveFIDManager } = await import('@/lib/ai/PassiveFIDManager');
        const manager = PassiveFIDManager.getInstance();
        let details = manager.getRetainedDetails();
        if (!details) {
          // Cold start (question before the first navigation retained
          // anything): fetch the CURRENT view context on demand through the
          // same path the fid publisher uses, instead of erroring (owner
          // console report 2026-07-15: "No retained view context yet").
          try {
            const { UIManager } = await import('@/lib/navigation/UIManager');
            await manager.getOrFetchContext(UIManager.getInstance().getUIStateForPassiveFID());
            details = manager.getRetainedDetails();
          } catch (fetchError) {
            console.warn('ui_details cold-start fetch failed:', fetchError);
          }
        }
        if (!details) {
          return {
            success: false,
            message:
              'No view context is available yet. Use ui_describe for raw UI state or content_search for portfolio content.',
          };
        }
        return {
          success: true,
          message: `Current-view detail for ${details.currentProject ?? `route "${details.route}"`} (navKey ${details.navKey} — do not re-call until NAV_CONTEXT changes)`,
          data: details,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to read retained view details',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }, sessionId);
  }

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