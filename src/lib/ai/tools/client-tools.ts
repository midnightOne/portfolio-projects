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
  description: 'Navigate to a specific page or URL in the portfolio.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The URL path to navigate to (e.g., "/projects", "/about", "/contact")'
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
  description: 'Show details for a specific project in a modal, optionally highlighting sections.',
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
  description: 'Scroll to bring a specific element into view on the current page.',
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
  description: 'Highlight specific text or elements on the page for visual emphasis.',
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
  animateElementToolDefinition
];

// Individual tools are already exported above with their definitions