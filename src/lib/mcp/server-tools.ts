/**
 * MCP Server Tools
 * 
 * Server-side tools that can be called by voice agents to load context,
 * process data, and interact with the backend systems.
 */

import type {
  MCPTool,
  MCPServerTool,
  LoadProjectContextArgs,
  LoadUserProfileArgs,
  ProcessJobSpecArgs,
  GetNavigationHistoryArgs,
  ReportUIStateArgs
} from './types';

// Server tool definitions
const loadProjectContextTool: MCPServerTool = {
  definition: {
    name: 'loadProjectContext',
    description: 'Load detailed context for a specific project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to load context for'
        },
        includeContent: {
          type: 'boolean',
          description: 'Whether to include full article content'
        },
        includeMedia: {
          type: 'boolean',
          description: 'Whether to include media information'
        }
      },
      required: ['projectId']
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return typeof args.projectId === 'string' && args.projectId.length > 0;
  }
};

const loadUserProfileTool: MCPServerTool = {
  definition: {
    name: 'loadUserProfile',
    description: 'Load user profile information for AI context',
    inputSchema: {
      type: 'object',
      properties: {
        includePrivate: {
          type: 'boolean',
          description: 'Whether to include private profile information (requires authentication)'
        }
      }
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return true; // No required arguments
  }
};

const processJobSpecTool: MCPServerTool = {
  definition: {
    name: 'processJobSpec',
    description: 'Process and analyze a job specification',
    inputSchema: {
      type: 'object',
      properties: {
        jobSpec: {
          type: 'string',
          description: 'The job specification text to analyze'
        },
        analysisType: {
          type: 'string',
          description: 'Type of analysis to perform',
          enum: ['quick', 'detailed']
        }
      },
      required: ['jobSpec']
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return typeof args.jobSpec === 'string' && args.jobSpec.length > 0;
  }
};

const getNavigationHistoryTool: MCPServerTool = {
  definition: {
    name: 'getNavigationHistory',
    description: 'Get navigation history for the current session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Optional session ID to get history for'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of history entries to return'
        }
      }
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return true; // No required arguments
  }
};

const reportUIStateTool: MCPServerTool = {
  definition: {
    name: 'reportUIState',
    description: 'Report current UI state to the server',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'object',
          description: 'Current UI state information',
          properties: {
            currentModal: {
              type: 'string',
              description: 'Currently open modal'
            },
            currentSection: {
              type: 'string',
              description: 'Current section being viewed'
            },
            activeHighlights: {
              type: 'array',
              description: 'List of currently active highlights',
              items: {
                type: 'string',
                description: 'Highlight identifier'
              }
            },
            scrollPosition: {
              type: 'number',
              description: 'Current scroll position'
            },
            timestamp: {
              type: 'number',
              description: 'Timestamp of the state'
            }
          }
        }
      },
      required: ['state']
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return typeof args.state === 'object' && 
           typeof args.state.timestamp === 'number';
  }
};

// Additional server tools for enhanced functionality
const searchProjectsTool: MCPServerTool = {
  definition: {
    name: 'searchProjects',
    description: 'Search projects by keywords, tags, or content',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        tags: {
          type: 'array',
          description: 'Filter by tags',
          items: {
            type: 'string',
            description: 'Tag name'
          }
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return'
        }
      },
      required: ['query']
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return typeof args.query === 'string' && args.query.length > 0;
  }
};

const getProjectSummaryTool: MCPServerTool = {
  definition: {
    name: 'getProjectSummary',
    description: 'Get a summary of all projects for context',
    inputSchema: {
      type: 'object',
      properties: {
        includePrivate: {
          type: 'boolean',
          description: 'Whether to include private projects'
        },
        maxProjects: {
          type: 'number',
          description: 'Maximum number of projects to include'
        }
      }
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return true; // No required arguments
  }
};

const analyzeUserIntentTool: MCPServerTool = {
  definition: {
    name: 'analyzeUserIntent',
    description: 'Analyze user intent from conversation context',
    inputSchema: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'string',
          description: 'The user message to analyze'
        },
        conversationHistory: {
          type: 'array',
          description: 'Previous conversation messages',
          items: {
            type: 'object',
            description: 'Conversation message object',
            properties: {
              role: {
                type: 'string',
                description: 'Message role (user or assistant)',
                enum: ['user', 'assistant']
              },
              content: {
                type: 'string',
                description: 'Message content'
              },
              timestamp: {
                type: 'number',
                description: 'Message timestamp'
              }
            }
          }
        },
        currentContext: {
          type: 'object',
          description: 'Current navigation and UI context'
        }
      },
      required: ['userMessage']
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return typeof args.userMessage === 'string' && args.userMessage.length > 0;
  }
};

const generateNavigationSuggestionsTool: MCPServerTool = {
  definition: {
    name: 'generateNavigationSuggestions',
    description: 'Generate navigation suggestions based on user intent and context',
    inputSchema: {
      type: 'object',
      properties: {
        userIntent: {
          type: 'string',
          description: 'Analyzed user intent'
        },
        currentLocation: {
          type: 'string',
          description: 'Current page or section'
        },
        availableProjects: {
          type: 'array',
          description: 'List of available projects',
          items: {
            type: 'object',
            description: 'Project information object',
            properties: {
              id: { type: 'string', description: 'Project ID' },
              title: { type: 'string', description: 'Project title' },
              tags: { 
                type: 'array', 
                description: 'Project tags',
                items: { type: 'string', description: 'Tag name' } 
              }
            }
          }
        }
      },
      required: ['userIntent']
    }
  },
  endpoint: '/api/ai/tools/execute', // Updated to use unified endpoint
  method: 'POST',
  validation: (args: any): boolean => {
    return typeof args.userIntent === 'string' && args.userIntent.length > 0;
  }
};

// Export server tools
export const serverTools = new Map<string, MCPServerTool>([
  ['loadProjectContext', loadProjectContextTool],
  ['loadUserProfile', loadUserProfileTool],
  ['processJobSpec', processJobSpecTool],
  ['getNavigationHistory', getNavigationHistoryTool],
  ['reportUIState', reportUIStateTool],
  ['searchProjects', searchProjectsTool],
  ['getProjectSummary', getProjectSummaryTool],
  ['analyzeUserIntent', analyzeUserIntentTool],
  ['generateNavigationSuggestions', generateNavigationSuggestionsTool]
]);

// Note: getServerToolDefinitions function has been removed
// Use UnifiedToolRegistry.getServerToolDefinitions() instead

// Export individual tools for easier access
export {
  loadProjectContextTool,
  loadUserProfileTool,
  processJobSpecTool,
  getNavigationHistoryTool,
  reportUIStateTool,
  searchProjectsTool,
  getProjectSummaryTool,
  analyzeUserIntentTool,
  generateNavigationSuggestionsTool
};