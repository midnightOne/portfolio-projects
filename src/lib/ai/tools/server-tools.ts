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
  // 7.2b: globally-deprecated legacy tool — dropped from every mint (the
  // guidance disavows it; identity now rides the start frame + the
  // portfolio_overview tool) but STILL EXECUTABLE via /api/ai/tools/execute:
  // PassiveFIDManager.getUserProfile() is a live client-side consumer.
  // Reversible by deleting this flag; owner review flagged in tasks.md
  // (the B5 "full tool set" ruling was about node narrowing, not
  // guidance-disavowed tools).
  modelExposed: false,
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
  // 7.2b: legacy — superseded by portfolio_overview + content_search for
  // models; remains executable server-side. See loadUserProfile note.
  modelExposed: false,
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
  // 7.2b: legacy — the job-analysis flow models drive is job_description_form
  // (G3); remains executable server-side. See loadUserProfile note.
  modelExposed: false,
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
  // 7.2b: legacy — the consent-gated conversion moment models drive is
  // lead_capture (H2); remains executable server-side. See loadUserProfile note.
  modelExposed: false,
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
  // 7.2b: legacy — no model-facing upload flow exists (job specs arrive via
  // job_description_form); remains executable server-side. See loadUserProfile
  // note.
  modelExposed: false,
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

/**
 * 7.2b: the model-facing uiState parameter, shared by content_search and
 * content_get (it was duplicated verbatim). Slimmed to the fields the ranking
 * and navTarget generation actually read; UIManager-internal state
 * (activeFilters, lastUserAction) is not the model's to pass — it never
 * populated them meaningfully, and the server treats absence fine.
 */
const uiStateParameterSchema = {
  type: 'object',
  description: 'Current UI state, copied from your latest NAV_CONTEXT — used for context-aware ranking and navTarget generation',
  properties: {
    currentRoute: { type: 'string', description: 'Current route (home, projects, about)' },
    currentProject: { type: 'string', description: 'Current project slug if a project is open' },
    currentModal: { type: 'string', description: 'Current modal ID if a modal is open' },
    breadcrumbPath: { type: 'string', description: 'Navigation path, e.g. "home.projects.aurora-avatar.technical-details"' },
    visibleAnchors: { type: 'array', items: { type: 'string' }, description: 'Currently visible content anchors' }
  }
};

// Content Search and Retrieval Tools - Semantic search with pgvector
export const contentSearchToolDefinition: UnifiedToolDefinition = {
  name: 'content_search',
  description: 'Semantic search across ALL portfolio content (projects, sections, experience). Results carry navTargets, a relevance score, facets, and a why field explaining each match.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query — specific beats broad ("React components", not "React")'
      },
      uiState: uiStateParameterSchema,
      scope: {
        type: 'object',
        description: 'Optional hard limit on where to search',
        properties: {
          route: { type: 'string' },
          projectId: { type: 'string', description: 'Project ID or slug' },
          entityType: { type: 'string', description: 'PROJECT, BIO, RESUME, …' }
        }
      },
      k: {
        type: 'number',
        description: 'Results to return: 3-5 focused, 8-10 comprehensive',
        default: 5,
        minimum: 1,
        maximum: 20
      },
      maxTier: {
        type: 'number',
        description: 'Max content tier (1=summary, 2=headings, 3=content)',
        enum: [1, 2, 3],
        default: 3
      },
      diversifyBy: {
        type: 'string',
        enum: ['project', 'type'],
        default: 'project'
      },
      filters: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          technologies: { type: 'array', items: { type: 'string' } }
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
  description: 'Fetch full content by ID (from content_search results), with token budget and tier filtering. Results carry navTargets.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Content chunk IDs from content_search results',
        minItems: 1,
        maxItems: 10
      },
      uiState: uiStateParameterSchema,
      maxTokens: {
        type: 'number',
        description: 'Response token budget (500-900 for detailed answers)',
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
        description: 'Content tiers to include (0=metadata, 1=summary, 2=headings, 3=content)',
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

// Hierarchical content tools — internal/diagnostic only (owner, 2026-07-09):
// their inputs (chunkId / sectionGroup) only ever come from a content_search
// result, and content_search results already carry location + snippet, so
// exposing these to the model just bloats the tool list it has to reason over.
export const contentHierarchyToolDefinition: UnifiedToolDefinition = {
  name: 'content_getHierarchy',
  modelExposed: false,
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
  // See hierarchical-tools note above — content_search covers this for models.
  modelExposed: false,
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
  // See hierarchical-tools note above — content_search + content_get cover this.
  modelExposed: false,
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
// Lead capture (conversation-engine Req 15.1/21.3, task H2) — the qualify-then-
// capture conversion moment. Registry tool so graph nodes can allowlist it
// (D47(b)); the row-first + notify mechanics live in lib/ai/leads/lead-capture.
export const leadCaptureToolDefinition: UnifiedToolDefinition = {
  name: 'lead_capture',
  description:
    'Record a qualified visitor lead for the portfolio owner (contact/company/timeline details plus your fit note) and notify him. Call ONLY after the visitor has explicitly agreed in conversation to have their details passed along — ask first ("I\'ll pass this along with your contact — is that okay?"). Never promise availability, price, timeline, or faster contact than "a couple of days".',
  parameters: {
    type: 'object',
    properties: {
      consentConfirmed: {
        type: 'boolean',
        description:
          'true ONLY if the visitor explicitly agreed, in this conversation, to have their details passed to the owner. Without that agreement, ask first instead of calling this tool.',
      },
      fitNote: {
        type: 'string',
        description:
          'Your short summary for the owner: who the visitor is, what they are looking for, and why (or whether) it fits the portfolio. 1-4 sentences.',
      },
      slots: {
        type: 'object',
        description:
          'Details the visitor stated, as short strings — e.g. {"name": …, "company": …, "contact": …, "type": "contract work", "timeline": "Q3"}. Only include what was actually said.',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['consentConfirmed', 'fitNote'],
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          notification: { type: 'string' },
          message: { type: 'string' },
        },
      },
      message: { type: 'string' },
    },
  },
};

/**
 * portfolio_overview (ai-assistant 7.13 + mcp-server task 6): the deep
 * owner/portfolio summary on demand, backed by the ONE start-frame assembly
 * module (`brief` = the mint start frame verbatim; `full` = owner bio T1 +
 * visitor intro + project index). The schema stays tiny deliberately — every
 * minted schema is standing overhead (7.2b).
 */
export const portfolioOverviewToolDefinition: UnifiedToolDefinition = {
  name: 'portfolio_overview',
  description:
    'Overview of the portfolio owner (Kirill) and the portfolio as a whole. Use when asked about the owner or the site in depth, or when you seem to have lost orientation. depth "brief" = compact grounding; "full" = complete bio, site intro, and project index.',
  parameters: {
    type: 'object',
    properties: {
      depth: {
        type: 'string',
        enum: ['brief', 'full'],
        description: 'brief (default) or full',
      },
    },
  },
  executionContext: 'server',
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      overview: { type: 'string' },
      depth: { type: 'string' },
    },
  },
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
  // Conversation-engine H2
  leadCaptureToolDefinition,
  // 7.13 owner/portfolio depth
  portfolioOverviewToolDefinition,
];

// Note: getServerToolDefinitions function has been removed
// Use UnifiedToolRegistry.getServerToolDefinitions() instead
