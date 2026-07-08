/**
 * Server-Side Tool Definitions
 * 
 * This file defines all server-side tools that require backend processing
 * for context loading, job analysis, user profiles, data processing,
 * and content search/retrieval.
 */

import { UnifiedToolDefinition } from './types';

// Context Loading Tools - Server-side data access
export const loadProjectContextToolDefinition: UnifiedToolDefinition = {
  name: 'loadProjectContext',
  // Internal F-I-D plumbing (PassiveFIDManager): its results carry NO section
  // navTargets, so a model using it loses "take me to the X section" asks —
  // the semantic chain (content_search/content_get) is the model-facing path.
  modelExposed: false,
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
          media: { type: 'array', items: { type: 'object' } },
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
          skills: { type: 'array', items: { type: 'string' } },
          experience: { type: 'array', items: { type: 'object' } },
          education: { type: 'array', items: { type: 'object' } }
        }
      },
      message: { type: 'string' }
    }
  }
};

export const searchProjectsToolDefinition: UnifiedToolDefinition = {
  name: 'searchProjects',
  // Internal F-I-D plumbing — see loadProjectContext note.
  modelExposed: false,
  description: 'Search projects by keywords, tags, or content for relevant matches. For navigation, use openProject instead.',
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
          projects: { type: 'array', items: { type: 'object' } },
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
          projects: { type: 'array', items: { type: 'object' } },
          totalCount: { type: 'number' },
          categories: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        }
      },
      message: { type: 'string' }
    }
  }
};

// openProject tool removed - superseded by content_search + ui_intent workflow

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
          skills: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        }
      },
      message: { type: 'string' }
    }
  }
};

// Content Search and Retrieval Tools - Semantic search with pgvector
export const contentSearchToolDefinition: UnifiedToolDefinition = {
  name: 'content_search',
  description: 'Search portfolio content semantically across projects and sections using hybrid search (semantic + metadata filtering) with UI state context awareness.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query to find relevant content'
      },
      uiState: {
        type: 'object',
        description: 'Current UI state context for context-aware search ranking',
        properties: {
          breadcrumbPath: {
            type: 'string',
            description: 'Hierarchical navigation path (e.g., "home.projects.aurora-avatar.technical-details")'
          },
          visibleAnchors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Currently visible content anchors'
          },
          activeFilters: {
            type: 'object',
            properties: {
              searchTerm: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              techStack: { type: 'array', items: { type: 'string' } }
            }
          },
          currentRoute: { type: 'string', description: 'Current route (home, projects, about)' },
          currentProject: { type: 'string', description: 'Current project slug if viewing project' },
          currentModal: { type: 'string', description: 'Current modal ID if modal is open' },
          lastUserAction: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['navigate', 'search', 'filter', 'scroll'] },
              timestamp: { type: 'number' }
            }
          }
        }
      },
      scope: {
        type: 'object',
        properties: {
          route: {
            type: 'string',
            description: 'Limit search to current route context (e.g., "home", "projects")'
          },
          projectId: {
            type: 'string',
            description: 'Limit search to specific project by ID or slug'
          },
          entityType: {
            type: 'string',
            description: 'Limit search to specific entity type (PROJECT, BIO, RESUME, etc.)'
          }
        }
      },
      k: {
        type: 'number',
        description: 'Number of results to return',
        default: 5,
        minimum: 1,
        maximum: 20
      },
      maxTier: {
        type: 'number',
        description: 'Maximum content tier to return (1=summary, 2=headings, 3=content)',
        enum: [1, 2, 3],
        default: 3
      },
      diversifyBy: {
        type: 'string',
        description: 'Diversification strategy for results',
        enum: ['project', 'type'],
        default: 'project'
      },
      filters: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by content tags'
          },
          technologies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by technology stack'
          },
          dateRange: {
            type: 'object',
            properties: {
              from: { type: 'string', format: 'date' },
              to: { type: 'string', format: 'date' }
            },
            description: 'Filter by date range'
          },
          minImportance: {
            type: 'number',
            description: 'Minimum importance score (0-1)',
            minimum: 0,
            maximum: 1
          }
        }
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
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                project: { type: 'string' },
                title: { type: 'string' },
                oneLiner: { type: 'string' },
                why: { type: 'string' },
                navTarget: { type: 'object' },
                score: { type: 'number' },
                facets: { type: 'object' }
              }
            }
          },
          more: { type: 'boolean' },
          totalResults: { type: 'number' },
          searchMetadata: { type: 'object' }
        }
      },
      error: { type: 'string' }
    }
  }
};

export const contentGetToolDefinition: UnifiedToolDefinition = {
  name: 'content_get',
  description: 'Fetch specific content details by ID with token budget control, tier filtering, and UI state context for navigation target generation.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Content chunk IDs to fetch',
        minItems: 1,
        maxItems: 10
      },
      uiState: {
        type: 'object',
        description: 'Current UI state context for navigation target compatibility',
        properties: {
          breadcrumbPath: {
            type: 'string',
            description: 'Hierarchical navigation path (e.g., "home.projects.aurora-avatar.technical-details")'
          },
          visibleAnchors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Currently visible content anchors'
          },
          activeFilters: {
            type: 'object',
            properties: {
              searchTerm: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              techStack: { type: 'array', items: { type: 'string' } }
            }
          },
          currentRoute: { type: 'string', description: 'Current route (home, projects, about)' },
          currentProject: { type: 'string', description: 'Current project slug if viewing project' },
          currentModal: { type: 'string', description: 'Current modal ID if modal is open' },
          lastUserAction: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['navigate', 'search', 'filter', 'scroll'] },
              timestamp: { type: 'number' }
            }
          }
        }
      },
      maxTokens: {
        type: 'number',
        description: 'Token budget for response to prevent context overflow',
        default: 900,
        minimum: 100,
        maximum: 4000
      },
      includeTiers: {
        type: 'array',
        items: {
          type: 'number',
          enum: [0, 1, 2, 3]
        },
        description: 'Which content tiers to include (0=metadata, 1=summary, 2=headings, 3=content)',
        default: [0, 1, 2, 3]
      }
    },
    required: ['ids']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                tokenEstimate: { type: 'number' },
                tier: { type: 'number' },
                title: { type: 'string' },
                metadata: { type: 'object' },
                navTarget: { type: 'object', description: 'Navigation target compatible with current UI state' }
              }
            }
          },
          totalTokens: { type: 'number' },
          truncated: { type: 'boolean' }
        }
      },
      error: { type: 'string' }
    }
  }
};

// NEW: Hierarchical content tools
export const contentHierarchyToolDefinition: UnifiedToolDefinition = {
  name: 'content_getHierarchy',
  description: 'Get the hierarchical relationship of a content chunk (ancestors, descendants, siblings)',
  parameters: {
    type: 'object',
    properties: {
      chunkId: {
        type: 'string',
        description: 'The ID of the content chunk to explore'
      }
    },
    required: ['chunkId']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          ancestors: { type: 'array', items: { type: 'object' } },
          descendants: { type: 'array', items: { type: 'object' } },
          siblings: { type: 'array', items: { type: 'object' } }
        }
      },
      error: { type: 'string' }
    }
  }
};

export const sectionSearchToolDefinition: UnifiedToolDefinition = {
  name: 'content_searchSection',
  description: 'Search within a specific content section or topic group',
  parameters: {
    type: 'object',
    properties: {
      sectionGroup: {
        type: 'string',
        description: 'The section group to search within'
      },
      query: {
        type: 'string',
        description: 'The search query'
      },
      maxTier: {
        type: 'number',
        description: 'Maximum content tier to include (1-3)',
        default: 3
      }
    },
    required: ['sectionGroup', 'query']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } }
        }
      },
      error: { type: 'string' }
    }
  }
};

export const relatedContentToolDefinition: UnifiedToolDefinition = {
  name: 'content_getRelated',
  description: 'Get related content across all tiers for a specific topic or project section',
  parameters: {
    type: 'object',
    properties: {
      rootChunkId: {
        type: 'string',
        description: 'The root chunk ID to get related content for'
      },
      includeTiers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Which tiers to include (default: [1,2,3])',
        default: [1, 2, 3]
      }
    },
    required: ['rootChunkId']
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          summary: { type: 'object' },
          keyPoints: { type: 'array', items: { type: 'object' } },
          details: { type: 'array', items: { type: 'object' } }
          // Note: fullContent removed in T0-T3 simplified structure
        }
      },
      error: { type: 'string' }
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
  submitContactFormToolDefinition,
  processUploadedFileToolDefinition,
  contentSearchToolDefinition,
  contentGetToolDefinition,
  // NEW: Hierarchical content tools
  contentHierarchyToolDefinition,
  sectionSearchToolDefinition,
  relatedContentToolDefinition,
];

// Note: getServerToolDefinitions function has been removed
// Use UnifiedToolRegistry.getServerToolDefinitions() instead
