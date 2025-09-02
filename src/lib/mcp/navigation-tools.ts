/**
 * MCP Navigation Tools
 * 
 * Client-side navigation tools that can be executed by voice agents
 * to manipulate the UI, open modals, scroll to sections, and highlight content.
 */

import type {
  MCPTool,
  MCPToolResult,
  MCPNavigationTool,
  OpenProjectModalArgs,
  NavigateToProjectArgs,
  ScrollToSectionArgs,
  HighlightTextArgs,
  ClearHighlightsArgs,
  FocusElementArgs,
  AnimateElementArgs,
  NavigationState,
  HighlightState
} from './types';

// Navigation state management
let navigationState: NavigationState = {
  currentModal: null,
  currentSection: null,
  activeHighlights: {},
  scrollPosition: 0,
  history: [],
  timestamp: Date.now()
};

// Utility functions
const updateNavigationState = (updates: Partial<NavigationState>) => {
  navigationState = {
    ...navigationState,
    ...updates,
    timestamp: Date.now()
  };
};

const addToHistory = (action: string, target: string, metadata?: Record<string, any>) => {
  navigationState.history.push({
    action,
    target,
    timestamp: Date.now(),
    metadata
  });
  
  // Keep only last 50 entries
  if (navigationState.history.length > 50) {
    navigationState.history = navigationState.history.slice(-50);
  }
};

const reportStateToServer = async (state: NavigationState) => {
  try {
    await fetch('/api/ai/mcp/navigation-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
  } catch (error) {
    console.warn('Failed to report navigation state to server:', error);
  }
};

// Tool implementations
const openProjectModalTool: MCPNavigationTool = {
  definition: {
    name: 'openProjectModal',
    description: 'Open a project modal with optional section highlighting',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to open'
        },
        highlightSections: {
          type: 'array',
          description: 'Optional array of section IDs to highlight',
          items: {
            type: 'string',
            description: 'Section ID to highlight'
          }
        }
      },
      required: ['projectId']
    }
  },
  executor: async (args: OpenProjectModalArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      
      // Find project modal trigger (could be a button or link)
      const projectTrigger = document.querySelector(`[data-project-id="${args.projectId}"]`) ||
                           document.querySelector(`[href*="${args.projectId}"]`) ||
                           document.querySelector(`[data-testid="project-${args.projectId}"]`);
      
      if (!projectTrigger) {
        throw new Error(`Project trigger not found for ID: ${args.projectId}`);
      }
      
      // Click the trigger to open modal
      if (projectTrigger instanceof HTMLElement) {
        projectTrigger.click();
      }
      
      // Wait for modal to open
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update navigation state
      updateNavigationState({
        currentModal: `project-${args.projectId}`,
        currentSection: null
      });
      
      // Add to history
      addToHistory('openProjectModal', args.projectId, {
        highlightSections: args.highlightSections
      });
      
      // Apply highlights if specified
      if (args.highlightSections && args.highlightSections.length > 0) {
        for (const sectionId of args.highlightSections) {
          await highlightTextTool.executor({
            selector: `#${sectionId}, [data-section="${sectionId}"]`,
            type: 'outline',
            duration: 'persistent',
            intensity: 'medium'
          });
        }
      }
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          projectId: args.projectId,
          modalOpened: true,
          highlightedSections: args.highlightSections || []
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error opening project modal',
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - Date.now(),
          source: 'client'
        }
      };
    }
  },
  fallback: async (args: OpenProjectModalArgs, error: Error): Promise<MCPToolResult> => {
    // Fallback: try to navigate to project page instead
    try {
      window.location.href = `/projects/${args.projectId}`;
      return {
        success: true,
        data: { fallbackUsed: true, navigatedToPage: true },
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: `Modal and fallback failed: ${error.message}`,
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  },
  validation: (args: any): boolean => {
    return typeof args.projectId === 'string' && args.projectId.length > 0;
  }
};

const navigateToProjectTool: MCPNavigationTool = {
  definition: {
    name: 'navigateToProject',
    description: 'Navigate to a project page by slug',
    inputSchema: {
      type: 'object',
      properties: {
        projectSlug: {
          type: 'string',
          description: 'The slug of the project to navigate to'
        }
      },
      required: ['projectSlug']
    }
  },
  executor: async (args: NavigateToProjectArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      
      // Navigate to project page
      window.location.href = `/projects/${args.projectSlug}`;
      
      // Update navigation state
      updateNavigationState({
        currentModal: null,
        currentSection: `project-${args.projectSlug}`
      });
      
      // Add to history
      addToHistory('navigateToProject', args.projectSlug);
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          projectSlug: args.projectSlug,
          navigated: true
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error navigating to project',
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  },
  validation: (args: any): boolean => {
    return typeof args.projectSlug === 'string' && args.projectSlug.length > 0;
  }
};

const scrollToSectionTool: MCPNavigationTool = {
  definition: {
    name: 'scrollToSection',
    description: 'Scroll to a specific section on the page',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: {
          type: 'string',
          description: 'The ID of the section to scroll to'
        },
        behavior: {
          type: 'string',
          description: 'Scroll behavior',
          enum: ['smooth', 'instant']
        },
        block: {
          type: 'string',
          description: 'Vertical alignment',
          enum: ['start', 'center', 'end', 'nearest']
        }
      },
      required: ['sectionId']
    }
  },
  executor: async (args: ScrollToSectionArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      
      // Find the target element
      const targetElement = document.getElementById(args.sectionId) ||
                          document.querySelector(`[data-section="${args.sectionId}"]`) ||
                          document.querySelector(`[data-testid="${args.sectionId}"]`);
      
      if (!targetElement) {
        throw new Error(`Section not found: ${args.sectionId}`);
      }
      
      // Scroll to element
      targetElement.scrollIntoView({
        behavior: args.behavior || 'smooth',
        block: args.block || 'start',
        inline: 'nearest'
      });
      
      // Update navigation state
      updateNavigationState({
        currentSection: args.sectionId,
        scrollPosition: window.scrollY
      });
      
      // Add to history
      addToHistory('scrollToSection', args.sectionId, {
        behavior: args.behavior,
        block: args.block
      });
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          sectionId: args.sectionId,
          scrolled: true,
          scrollPosition: window.scrollY
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error scrolling to section',
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  },
  validation: (args: any): boolean => {
    return typeof args.sectionId === 'string' && args.sectionId.length > 0;
  }
};

const highlightTextTool: MCPNavigationTool = {
  definition: {
    name: 'highlightText',
    description: 'Highlight text or elements on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for elements to highlight'
        },
        text: {
          type: 'string',
          description: 'Optional specific text to highlight within elements'
        },
        type: {
          type: 'string',
          description: 'Type of highlight',
          enum: ['spotlight', 'outline', 'color', 'glow']
        },
        duration: {
          type: 'string',
          description: 'Duration of highlight',
          enum: ['persistent', 'timed']
        },
        timing: {
          type: 'number',
          description: 'Duration in milliseconds for timed highlights'
        },
        intensity: {
          type: 'string',
          description: 'Intensity of highlight',
          enum: ['subtle', 'medium', 'strong']
        }
      },
      required: ['selector']
    }
  },
  executor: async (args: HighlightTextArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      
      // Find target elements
      const elements = document.querySelectorAll(args.selector);
      
      if (elements.length === 0) {
        throw new Error(`No elements found for selector: ${args.selector}`);
      }
      
      const highlightId = `highlight-${Date.now()}`;
      const type = args.type || 'outline';
      const intensity = args.intensity || 'medium';
      
      // Apply highlight styles
      elements.forEach((element, index) => {
        if (element instanceof HTMLElement) {
          const elementId = `${highlightId}-${index}`;
          element.setAttribute('data-highlight-id', elementId);
          
          // Apply highlight based on type and intensity
          switch (type) {
            case 'outline':
              element.style.outline = intensity === 'subtle' ? '1px solid rgba(59, 130, 246, 0.5)' :
                                    intensity === 'medium' ? '2px solid rgba(59, 130, 246, 0.8)' :
                                    '3px solid rgba(59, 130, 246, 1)';
              element.style.outlineOffset = '2px';
              break;
            case 'color':
              element.style.backgroundColor = intensity === 'subtle' ? 'rgba(59, 130, 246, 0.1)' :
                                            intensity === 'medium' ? 'rgba(59, 130, 246, 0.2)' :
                                            'rgba(59, 130, 246, 0.3)';
              break;
            case 'glow':
              element.style.boxShadow = intensity === 'subtle' ? '0 0 5px rgba(59, 130, 246, 0.5)' :
                                      intensity === 'medium' ? '0 0 10px rgba(59, 130, 246, 0.8)' :
                                      '0 0 15px rgba(59, 130, 246, 1)';
              break;
            case 'spotlight':
              // Create spotlight overlay
              const spotlight = document.createElement('div');
              spotlight.style.position = 'fixed';
              spotlight.style.top = '0';
              spotlight.style.left = '0';
              spotlight.style.width = '100vw';
              spotlight.style.height = '100vh';
              spotlight.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
              spotlight.style.pointerEvents = 'none';
              spotlight.style.zIndex = '9999';
              spotlight.setAttribute('data-highlight-id', elementId);
              
              const rect = element.getBoundingClientRect();
              const clipPath = `circle(${Math.max(rect.width, rect.height) / 2 + 20}px at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px)`;
              spotlight.style.clipPath = `polygon(0% 0%, 0% 100%, ${rect.left}px 100%, ${rect.left}px ${rect.top}px, ${rect.right}px ${rect.top}px, ${rect.right}px ${rect.bottom}px, ${rect.left}px ${rect.bottom}px, ${rect.left}px 100%, 100% 100%, 100% 0%)`;
              
              document.body.appendChild(spotlight);
              break;
          }
          
          // Add transition for smooth appearance
          element.style.transition = 'all 0.3s ease-in-out';
        }
      });
      
      // Store highlight state
      const highlightState: HighlightState = {
        selector: args.selector,
        type,
        intensity,
        startTime: Date.now(),
        duration: args.duration === 'timed' ? args.timing : undefined
      };
      
      navigationState.activeHighlights[highlightId] = highlightState;
      
      // Set up automatic removal for timed highlights
      if (args.duration === 'timed' && args.timing) {
        setTimeout(() => {
          clearHighlightsTool.executor({ selector: args.selector });
        }, args.timing);
      }
      
      // Add to history
      addToHistory('highlightText', args.selector, {
        type,
        intensity,
        duration: args.duration,
        timing: args.timing
      });
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          selector: args.selector,
          highlightId,
          elementsHighlighted: elements.length,
          type,
          intensity
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error highlighting text',
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  },
  validation: (args: any): boolean => {
    return typeof args.selector === 'string' && args.selector.length > 0;
  }
};

const clearHighlightsTool: MCPNavigationTool = {
  definition: {
    name: 'clearHighlights',
    description: 'Clear highlights from elements',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Optional CSS selector to clear specific highlights. If not provided, clears all highlights.'
        }
      }
    }
  },
  executor: async (args: ClearHighlightsArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      let clearedCount = 0;
      
      if (args.selector) {
        // Clear specific highlights
        const elements = document.querySelectorAll(args.selector);
        elements.forEach(element => {
          if (element instanceof HTMLElement) {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.style.backgroundColor = '';
            element.style.boxShadow = '';
            element.style.transition = '';
            element.removeAttribute('data-highlight-id');
            clearedCount++;
          }
        });
        
        // Remove spotlight overlays for this selector
        document.querySelectorAll(`[data-highlight-id*="${args.selector}"]`).forEach(overlay => {
          overlay.remove();
        });
      } else {
        // Clear all highlights
        document.querySelectorAll('[data-highlight-id]').forEach(element => {
          if (element instanceof HTMLElement) {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.style.backgroundColor = '';
            element.style.boxShadow = '';
            element.style.transition = '';
            element.removeAttribute('data-highlight-id');
            clearedCount++;
          }
        });
        
        // Remove all spotlight overlays
        document.querySelectorAll('[data-highlight-id]').forEach(overlay => {
          if (overlay.parentElement === document.body) {
            overlay.remove();
          }
        });
        
        // Clear all highlight state
        navigationState.activeHighlights = {};
      }
      
      // Add to history
      addToHistory('clearHighlights', args.selector || 'all');
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          selector: args.selector || 'all',
          clearedCount
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error clearing highlights',
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  }
};

const focusElementTool: MCPNavigationTool = {
  definition: {
    name: 'focusElement',
    description: 'Focus on a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to focus'
        }
      },
      required: ['selector']
    }
  },
  executor: async (args: FocusElementArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      
      const element = document.querySelector(args.selector);
      
      if (!element) {
        throw new Error(`Element not found for selector: ${args.selector}`);
      }
      
      if (element instanceof HTMLElement) {
        element.focus();
        
        // Scroll into view if needed
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
      
      // Add to history
      addToHistory('focusElement', args.selector);
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          selector: args.selector,
          focused: true
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error focusing element',
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  },
  validation: (args: any): boolean => {
    return typeof args.selector === 'string' && args.selector.length > 0;
  }
};

const animateElementTool: MCPNavigationTool = {
  definition: {
    name: 'animateElement',
    description: 'Animate an element with specified animation',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to animate'
        },
        animation: {
          type: 'object',
          description: 'Animation configuration',
          properties: {
            type: {
              type: 'string',
              description: 'Animation type (pulse, bounce, shake, etc.)'
            },
            duration: {
              type: 'number',
              description: 'Animation duration in milliseconds'
            },
            easing: {
              type: 'string',
              description: 'Animation easing function'
            },
            delay: {
              type: 'number',
              description: 'Animation delay in milliseconds'
            }
          }
        }
      },
      required: ['selector', 'animation']
    }
  },
  executor: async (args: AnimateElementArgs): Promise<MCPToolResult> => {
    try {
      const startTime = Date.now();
      
      const elements = document.querySelectorAll(args.selector);
      
      if (elements.length === 0) {
        throw new Error(`No elements found for selector: ${args.selector}`);
      }
      
      const { type, duration = 500, easing = 'ease-in-out', delay = 0 } = args.animation;
      
      // Apply animation to each element
      elements.forEach((element, index) => {
        if (element instanceof HTMLElement) {
          const elementDelay = delay + (index * 100); // Stagger animations
          
          setTimeout(() => {
            // Apply animation based on type
            switch (type) {
              case 'pulse':
                element.style.animation = `pulse ${duration}ms ${easing}`;
                break;
              case 'bounce':
                element.style.animation = `bounce ${duration}ms ${easing}`;
                break;
              case 'shake':
                element.style.animation = `shake ${duration}ms ${easing}`;
                break;
              case 'fadeIn':
                element.style.opacity = '0';
                element.style.transition = `opacity ${duration}ms ${easing}`;
                setTimeout(() => {
                  element.style.opacity = '1';
                }, 10);
                break;
              case 'slideIn':
                element.style.transform = 'translateX(-100%)';
                element.style.transition = `transform ${duration}ms ${easing}`;
                setTimeout(() => {
                  element.style.transform = 'translateX(0)';
                }, 10);
                break;
              default:
                element.style.animation = `${type} ${duration}ms ${easing}`;
            }
            
            // Clean up after animation
            setTimeout(() => {
              element.style.animation = '';
              element.style.transition = '';
            }, duration + 100);
          }, elementDelay);
        }
      });
      
      // Add to history
      addToHistory('animateElement', args.selector, {
        animationType: type,
        duration,
        easing,
        delay
      });
      
      // Report state to server
      await reportStateToServer(navigationState);
      
      return {
        success: true,
        data: {
          selector: args.selector,
          animationType: type,
          elementsAnimated: elements.length,
          duration,
          easing,
          delay
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error animating element',
        metadata: {
          timestamp: Date.now(),
          executionTime: 0,
          source: 'client'
        }
      };
    }
  },
  validation: (args: any): boolean => {
    return typeof args.selector === 'string' && 
           args.selector.length > 0 && 
           typeof args.animation === 'object' && 
           typeof args.animation.type === 'string';
  }
};

// Export navigation tools
export const navigationTools = new Map<string, MCPNavigationTool>([
  ['openProjectModal', openProjectModalTool],
  ['navigateToProject', navigateToProjectTool],
  ['scrollToSection', scrollToSectionTool],
  ['highlightText', highlightTextTool],
  ['clearHighlights', clearHighlightsTool],
  ['focusElement', focusElementTool],
  ['animateElement', animateElementTool]
]);

// Export navigation state getter
export const getNavigationState = (): NavigationState => ({ ...navigationState });

// Export state update function
export const updateNavigationStateExternal = (updates: Partial<NavigationState>) => {
  updateNavigationState(updates);
};

// Export history functions
export const getNavigationHistory = () => [...navigationState.history];
export const clearNavigationHistory = () => {
  navigationState.history = [];
  updateNavigationState({ history: [] });
};