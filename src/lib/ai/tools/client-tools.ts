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

// Form Interaction Tools - Client-side form manipulation
export const fillFormFieldToolDefinition: UnifiedToolDefinition = {
  name: 'fillFormField',
  description: 'Fill a specific form field with provided data.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the form field to fill'
      },
      value: {
        type: 'string',
        description: 'Value to fill in the form field'
      },
      fieldType: {
        type: 'string',
        enum: ['text', 'email', 'textarea', 'select', 'checkbox', 'radio'],
        description: 'Type of form field',
        default: 'text'
      }
    },
    required: ['selector', 'value']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      fieldFilled: { type: 'boolean' },
      value: { type: 'string' }
    }
  }
};

export const submitFormToolDefinition: UnifiedToolDefinition = {
  name: 'submitForm',
  description: 'Submit a form after validation and user confirmation.',
  parameters: {
    type: 'object',
    properties: {
      formSelector: {
        type: 'string',
        description: 'CSS selector for the form to submit'
      },
      confirmationRequired: {
        type: 'boolean',
        description: 'Whether to ask for user confirmation before submitting',
        default: true
      }
    },
    required: ['formSelector']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      formSubmitted: { type: 'boolean' },
      confirmationGiven: { type: 'boolean' }
    }
  }
};

// Animation and Visual Effects Tools
export const animateElementToolDefinition: UnifiedToolDefinition = {
  name: 'animateElement',
  description: 'Apply animation effects to elements for visual demonstration.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for elements to animate'
      },
      animation: {
        type: 'object',
        description: 'Animation configuration',
        properties: {
          type: {
            type: 'string',
            enum: ['pulse', 'bounce', 'shake', 'glow', 'fade'],
            description: 'Type of animation effect'
          },
          duration: {
            type: 'number',
            description: 'Animation duration in milliseconds',
            default: 1000
          },
          iterations: {
            type: 'number',
            description: 'Number of animation iterations (0 for infinite)',
            default: 1
          }
        },
        required: ['type']
      }
    },
    required: ['selector', 'animation']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      elementsAnimated: { type: 'number' },
      animationType: { type: 'string' }
    }
  }
};

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
  fillFormFieldToolDefinition,
  submitFormToolDefinition,
  animateElementToolDefinition,
  uiDescribeToolDefinition,
  uiIntentToolDefinition
];

// Individual tools are already exported above with their definitions