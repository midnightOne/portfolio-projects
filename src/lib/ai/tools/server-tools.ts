/**
 * Server-Side Tool Definitions
 * 
 * This file defines all server-side tools that require backend processing
 * for context loading, job analysis, user profiles, and data processing.
 */

import { UnifiedToolDefinition } from './types';

// Context Loading Tools - Server-side data access
export const loadProjectContextToolDefinition: UnifiedToolDefinition = {
  name: 'loadProjectContext',
  description: 'Load detailed context for a specific project from the server database.',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The ID or slug of the project to load context for'
      },
      includeContent: {
        type: 'boolean',
        description: 'Whether to include full article content',
        default: false
      },
      includeMedia: {
        type: 'boolean',
        description: 'Whether to include media information and metadata',
        default: false
      },
      includeTechnicalDetails: {
        type: 'boolean',
        description: 'Whether to include technical implementation details',
        default: true
      }
    },
    required: ['projectId']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          project: { type: 'object' },
          content: { type: 'string' },
          media: { type: 'array' },
          technicalDetails: { type: 'object' }
        }
      },
      message: { type: 'string' }
    }
  }
};

export const loadUserProfileToolDefinition: UnifiedToolDefinition = {
  name: 'loadUserProfile',
  description: 'Load user profile information for AI context and personalization.',
  parameters: {
    type: 'object',
    properties: {
      includePrivate: {
        type: 'boolean',
        description: 'Whether to include private profile information (requires authentication)',
        default: false
      },
      includeSkills: {
        type: 'boolean',
        description: 'Whether to include skills and expertise information',
        default: true
      },
      includeExperience: {
        type: 'boolean',
        description: 'Whether to include work experience details',
        default: true
      }
    }
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          profile: { type: 'object' },
          skills: { type: 'array' },
          experience: { type: 'array' },
          education: { type: 'array' }
        }
      },
      message: { type: 'string' }
    }
  }
};

export const searchProjectsToolDefinition: UnifiedToolDefinition = {
  name: 'searchProjects',
  description: 'Search projects by keywords, tags, or content for relevant matches.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by specific tags'
      },
      category: {
        type: 'string',
        description: 'Filter by project category'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 10
      },
      includeContent: {
        type: 'boolean',
        description: 'Whether to search within project content',
        default: true
      }
    },
    required: ['query']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          projects: { type: 'array' },
          totalResults: { type: 'number' },
          searchQuery: { type: 'string' }
        }
      },
      message: { type: 'string' }
    }
  }
};

export const getProjectSummaryToolDefinition: UnifiedToolDefinition = {
  name: 'getProjectSummary',
  description: 'Get a comprehensive summary of all projects for context building.',
  parameters: {
    type: 'object',
    properties: {
      includePrivate: {
        type: 'boolean',
        description: 'Whether to include private projects',
        default: false
      },
      maxProjects: {
        type: 'number',
        description: 'Maximum number of projects to include',
        default: 20
      },
      sortBy: {
        type: 'string',
        enum: ['date', 'title', 'category', 'priority'],
        description: 'Sort order for projects',
        default: 'date'
      }
    }
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          projects: { type: 'array' },
          totalCount: { type: 'number' },
          categories: { type: 'array' },
          tags: { type: 'array' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// Job Analysis Tools - Server-side AI processing
export const processJobSpecToolDefinition: UnifiedToolDefinition = {
  name: 'processJobSpec',
  description: 'Process and analyze a job specification against portfolio owner background.',
  parameters: {
    type: 'object',
    properties: {
      jobSpec: {
        type: 'string',
        description: 'The job specification text to analyze'
      },
      analysisType: {
        type: 'string',
        enum: ['quick', 'detailed', 'comprehensive'],
        description: 'Type of analysis to perform',
        default: 'detailed'
      },
      includeSkillsMatch: {
        type: 'boolean',
        description: 'Whether to include skills matching analysis',
        default: true
      },
      includeExperienceMatch: {
        type: 'boolean',
        description: 'Whether to include experience matching analysis',
        default: true
      },
      generateReport: {
        type: 'boolean',
        description: 'Whether to generate a formatted report',
        default: true
      }
    },
    required: ['jobSpec']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          analysis: { type: 'object' },
          skillsMatch: { type: 'object' },
          experienceMatch: { type: 'object' },
          report: { type: 'string' },
          matchScore: { type: 'number' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// Intent Analysis Tools - Server-side AI processing
export const analyzeUserIntentToolDefinition: UnifiedToolDefinition = {
  name: 'analyzeUserIntent',
  description: 'Analyze user intent from conversation context for better responses.',
  parameters: {
    type: 'object',
    properties: {
      userMessage: {
        type: 'string',
        description: 'The user message to analyze'
      },
      conversationHistory: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
              description: 'Message role'
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
        },
        description: 'Previous conversation messages for context'
      },
      currentContext: {
        type: 'object',
        description: 'Current navigation and UI context',
        properties: {
          currentPage: { type: 'string' },
          currentModal: { type: 'string' },
          recentActions: { type: 'array' }
        }
      }
    },
    required: ['userMessage']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          confidence: { type: 'number' },
          entities: { type: 'array' },
          suggestedActions: { type: 'array' }
        }
      },
      message: { type: 'string' }
    }
  }
};

export const generateNavigationSuggestionsToolDefinition: UnifiedToolDefinition = {
  name: 'generateNavigationSuggestions',
  description: 'Generate navigation suggestions based on user intent and available content.',
  parameters: {
    type: 'object',
    properties: {
      userIntent: {
        type: 'string',
        description: 'Analyzed user intent or explicit request'
      },
      currentLocation: {
        type: 'string',
        description: 'Current page or section user is viewing'
      },
      availableProjects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            category: { type: 'string' }
          }
        },
        description: 'List of available projects for navigation'
      },
      maxSuggestions: {
        type: 'number',
        description: 'Maximum number of suggestions to generate',
        default: 5
      }
    },
    required: ['userIntent']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          suggestions: { type: 'array' },
          reasoning: { type: 'string' },
          priority: { type: 'array' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// Navigation History Tools - Server-side session management
export const getNavigationHistoryToolDefinition: UnifiedToolDefinition = {
  name: 'getNavigationHistory',
  description: 'Get navigation history for the current session to avoid repetition.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Optional session ID to get history for'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of history entries to return',
        default: 20
      },
      includeToolCalls: {
        type: 'boolean',
        description: 'Whether to include tool call history',
        default: true
      }
    }
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          history: { type: 'array' },
          sessionId: { type: 'string' },
          totalEntries: { type: 'number' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// Contact and Communication Tools - Server-side form processing
export const submitContactFormToolDefinition: UnifiedToolDefinition = {
  name: 'submitContactForm',
  description: 'Submit contact form data to the server for processing and notification.',
  parameters: {
    type: 'object',
    properties: {
      formData: {
        type: 'object',
        description: 'Contact form data',
        properties: {
          name: { type: 'string', description: 'Contact name' },
          email: { type: 'string', description: 'Contact email address' },
          subject: { type: 'string', description: 'Message subject' },
          message: { type: 'string', description: 'Message content' },
          company: { type: 'string', description: 'Company name (optional)' },
          phone: { type: 'string', description: 'Phone number (optional)' }
        },
        required: ['name', 'email', 'message']
      },
      source: {
        type: 'string',
        description: 'Source of the contact (voice, chat, form)',
        default: 'voice'
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'Priority level for the contact',
        default: 'normal'
      }
    },
    required: ['formData']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          confirmationNumber: { type: 'string' },
          estimatedResponse: { type: 'string' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// File Processing Tools - Server-side document analysis
export const processUploadedFileToolDefinition: UnifiedToolDefinition = {
  name: 'processUploadedFile',
  description: 'Process uploaded files (resumes, job specs) for analysis and context.',
  parameters: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'ID of the uploaded file to process'
      },
      fileType: {
        type: 'string',
        enum: ['resume', 'job_spec', 'document', 'other'],
        description: 'Type of file being processed'
      },
      analysisType: {
        type: 'string',
        enum: ['extract_text', 'analyze_content', 'compare_skills', 'full_analysis'],
        description: 'Type of analysis to perform',
        default: 'full_analysis'
      },
      includeInContext: {
        type: 'boolean',
        description: 'Whether to include processed content in conversation context',
        default: true
      }
    },
    required: ['fileId', 'fileType']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          extractedText: { type: 'string' },
          analysis: { type: 'object' },
          skills: { type: 'array' },
          summary: { type: 'string' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// Export all server-side tool definitions
export const serverToolDefinitions: UnifiedToolDefinition[] = [
  loadProjectContextToolDefinition,
  loadUserProfileToolDefinition,
  searchProjectsToolDefinition,
  getProjectSummaryToolDefinition,
  processJobSpecToolDefinition,
  analyzeUserIntentToolDefinition,
  generateNavigationSuggestionsToolDefinition,
  getNavigationHistoryToolDefinition,
  submitContactFormToolDefinition,
  processUploadedFileToolDefinition
];

// Individual tools are already exported above with their definitions