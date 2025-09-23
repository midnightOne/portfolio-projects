/**
 * Client-Side Tool Definitions
 * 
 * This file defines all client-side tools that execute directly in the browser
 * for UI navigation, manipulation, and immediate user interface interactions.
 */

import { UnifiedToolDefinition } from './types';

// Navigation Tools - Direct browser execution
export const navigateToToolDefinition: UnifiedToolDefinition = {
  name: 'navigateTo',
  description: 'INTERNAL/RECOVERY TOOL: Low-level page navigation. Use ui_navigate instead for better reliability. Only use this for debugging or when ui_navigate fails.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The exact URL path to navigate to. For projects, use "/projects?project=exact-slug" format. For other pages: "/about", "/contact", etc.'
      },
      newTab: {
        type: 'boolean',
        description: 'Whether to open in a new tab',
        default: false
      }
    },
    required: ['path']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      currentUrl: { type: 'string' }
    }
  }
};

export const showProjectDetailsToolDefinition: UnifiedToolDefinition = {
  name: 'showProjectDetails',
  description: 'INTERNAL/RECOVERY TOOL: Low-level project modal display. Use ui_navigate with project target instead for better reliability.',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The exact project slug (e.g., "e-commerce-platform", "task-management-app"). Use searchProjects to find the correct slug if uncertain.'
      },
      highlightSections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of section IDs to highlight within the project',
        default: []
      }
    },
    required: ['projectId']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      projectId: { type: 'string' },
      highlightedSections: { type: 'array', items: { type: 'string' } }
    }
  }
};



export const scrollIntoViewToolDefinition: UnifiedToolDefinition = {
  name: 'scrollIntoView',
  description: 'INTERNAL/RECOVERY TOOL: Low-level element scrolling. Use ui_navigate with section target instead for better reliability and context awareness.',
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
  description: 'INTERNAL/RECOVERY TOOL: Low-level text highlighting. Use ui_navigate for navigation with automatic highlighting, or use this only for specific emphasis needs.',
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

export const reportUIStateToolDefinition: UnifiedToolDefinition = {
  name: 'reportUIState',
  description: 'Report current UI state to the server for context awareness.',
  parameters: {
    type: 'object',
    properties: {
      state: {
        type: 'object',
        description: 'Current UI state information',
        properties: {
          currentModal: {
            type: 'string',
            description: 'Currently open modal identifier'
          },
          currentSection: {
            type: 'string',
            description: 'Current section being viewed'
          },
          activeHighlights: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of currently active highlight selectors'
          },
          scrollPosition: {
            type: 'number',
            description: 'Current scroll position in pixels'
          },
          timestamp: {
            type: 'number',
            description: 'Timestamp of the state capture'
          }
        },
        required: ['timestamp']
      }
    },
    required: ['state']
  },
  executionContext: 'client',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      stateReported: { type: 'boolean' }
    }
  }
};

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

// PRIMARY NAVIGATION TOOL - Use this for all navigation requests
export const uiNavigateToolDefinition: UnifiedToolDefinition = {
  name: 'ui_navigate',
  description: 'PRIMARY NAVIGATION TOOL: Achieve any navigation goal declaratively. The UI will automatically plan and execute all required steps. Use this instead of step-by-step tools like navigateTo, scrollIntoView, etc.',
  parameters: {
    type: 'object',
    properties: {
      epoch: {
        type: 'number',
        description: 'Agent\'s last-known UI state version (optional)'
      },
      target: {
        type: 'object',
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'section' },
              id: { type: 'string', description: 'Section identifier (e.g., "hero", "about", "contact")' },
              projectId: { type: 'string', description: 'Optional project context for section navigation' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { const: 'route' },
              id: { type: 'string', description: 'Route identifier (e.g., "home", "projects", "about")' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { const: 'project' },
              id: { type: 'string', description: 'Project slug (e.g., "e-commerce-platform")' },
              sectionId: { type: 'string', description: 'Optional section to scroll to within project' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { const: 'modal' },
              id: { type: 'string', description: 'Modal ID or operation ("close", "close-all", or specific modal ID)' },
              parentContext: { type: 'string', description: 'Optional parent context for modal' }
            },
            required: ['type', 'id']
          },
          {
            type: 'object',
            properties: {
              type: { const: 'element' },
              id: { type: 'string', description: 'Element ID for tabs, accordions, etc.' }
            },
            required: ['type', 'id']
          }
        ]
      },
      behavior: {
        type: 'object',
        properties: {
          openIfNeeded: { type: 'boolean', default: true, description: 'Open modal or navigate if required' },
          closeBlocking: { type: 'boolean', default: true, description: 'Close top modal if it blocks target' },
          waitForReadyMs: { type: 'number', default: 1500, description: 'Wait for loader/transition' },
          scrollBehavior: { type: 'string', enum: ['smooth', 'instant'], default: 'smooth' },
          allowInterruption: { type: 'boolean', default: true, description: 'Allow this navigation to be interrupted by new requests' }
        }
      },
      scope: {
        type: 'object',
        properties: {
          route: { type: 'string', description: 'Limit scope to specific route' },
          modalId: { type: 'string', description: 'Limit scope to specific modal' },
          projectId: { type: 'string', description: 'Limit scope to specific project' }
        }
      },
      idempotencyKey: {
        type: 'string',
        description: 'Unique key to prevent duplicate navigation actions'
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
      executedSteps: { type: 'array', items: { type: 'string' } },
      totalTime: { type: 'number' }
    }
  }
};

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
  navigateToToolDefinition,
  showProjectDetailsToolDefinition,
  scrollIntoViewToolDefinition,
  highlightTextToolDefinition,
  clearHighlightsToolDefinition,
  focusElementToolDefinition,
  reportUIStateToolDefinition,
  fillFormFieldToolDefinition,
  submitFormToolDefinition,
  animateElementToolDefinition,
  uiNavigateToolDefinition,
  uiDescribeToolDefinition,
  uiIntentToolDefinition
];

// Individual tools are already exported above with their definitions