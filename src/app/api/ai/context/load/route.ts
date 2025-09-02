/**
 * Dynamic Context Loading API - POST /api/ai/context/load
 * Provides on-demand context loading for voice agents with access control
 * Used by MCP tools to request additional context from server
 */

import { NextRequest, NextResponse } from 'next/server';
import { contextInjector } from '@/lib/services/ai/context-injector';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface ContextLoadRequest {
  sessionId: string;
  contextType: 'project' | 'profile' | 'general' | 'navigation';
  query: string;
  reflinkCode?: string;
  projectId?: string;
  options?: {
    maxTokens?: number;
    includeDetails?: boolean;
    format?: 'summary' | 'detailed' | 'conversational';
  };
}

async function contextLoadHandler(request: NextRequest) {
  try {
    const body: ContextLoadRequest = await request.json();
    
    const {
      sessionId,
      contextType,
      query,
      reflinkCode,
      projectId,
      options = {}
    } = body;

    // Validate required fields
    if (!sessionId || !contextType || !query) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'sessionId, contextType, and query are required',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    if (!['project', 'profile', 'general', 'navigation'].includes(contextType)) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'contextType must be one of: project, profile, general, navigation',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Validate access and get capabilities
    const validation = await contextInjector.validateAndFilterContext(sessionId, reflinkCode);

    if (!validation.valid) {
      return NextResponse.json(
        createApiError(
          'ACCESS_DENIED',
          validation.error || 'Access denied',
          { accessLevel: validation.accessLevel },
          request.url
        ),
        { status: 403 }
      );
    }

    // Load context based on type and access level
    const contextData = await this.loadContextByType(
      contextType,
      query,
      sessionId,
      reflinkCode,
      projectId,
      options,
      validation.accessLevel
    );

    // Track usage if reflink is provided
    if (reflinkCode && validation.accessLevel === 'premium') {
      try {
        const reflink = await reflinkManager.getReflinkByCode(reflinkCode);
        if (reflink) {
          await reflinkManager.trackUsage(reflink.id, {
            type: 'llm_request',
            tokens: Math.ceil(JSON.stringify(contextData).length / 4),
            cost: 0.001, // Minimal cost for context loading
            modelUsed: 'context-loader',
            endpoint: '/api/ai/context/load',
            metadata: { contextType, query: query.substring(0, 100) },
          });
        }
      } catch (error) {
        console.error('Failed to track context loading usage:', error);
      }
    }

    const processingTime = Date.now() - startTime;

    const responseData = {
      contextType,
      contextData,
      accessLevel: validation.accessLevel,
      capabilities: validation.capabilities,
      sessionId,
      processingTime,
      tokenCount: Math.ceil(JSON.stringify(contextData).length / 4),
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

/**
 * Load context based on type and access level
 */
async function loadContextByType(
  contextType: string,
  query: string,
  sessionId: string,
  reflinkCode?: string,
  projectId?: string,
  options: any = {},
  accessLevel: string = 'basic'
): Promise<any> {
  const { maxTokens = 2000, includeDetails = false, format = 'conversational' } = options;

  switch (contextType) {
    case 'project':
      return await loadProjectContext(query, projectId, accessLevel, maxTokens, includeDetails);
    
    case 'profile':
      return await loadProfileContext(query, accessLevel, maxTokens, format);
    
    case 'general':
      return await loadGeneralContext(query, sessionId, reflinkCode, maxTokens);
    
    case 'navigation':
      return await loadNavigationContext(query, accessLevel);
    
    default:
      throw new Error(`Unknown context type: ${contextType}`);
  }
}

/**
 * Load project-specific context
 */
async function loadProjectContext(
  query: string,
  projectId?: string,
  accessLevel: string = 'basic',
  maxTokens: number = 2000,
  includeDetails: boolean = false
): Promise<any> {
  try {
    if (projectId) {
      // Load specific project
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const project = await response.json();
        
        return {
          type: 'specific_project',
          project: {
            id: project.id,
            title: project.title,
            description: project.description,
            summary: project.summary,
            tags: project.tags,
            ...(includeDetails && accessLevel !== 'basic' ? {
              content: project.content?.substring(0, maxTokens * 4),
              links: project.links,
              media: project.media,
            } : {}),
          },
          query,
        };
      }
    }

    // Search across all projects
    const response = await fetch('/api/projects?status=PUBLISHED&visibility=PUBLIC&limit=20');
    if (response.ok) {
      const projectsData = await response.json();
      const projects = projectsData.data?.projects || [];
      
      // Filter projects based on query
      const relevantProjects = projects.filter((project: any) => {
        const searchText = `${project.title} ${project.description} ${project.tags?.join(' ')}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      }).slice(0, 5);

      return {
        type: 'project_search',
        projects: relevantProjects.map((project: any) => ({
          id: project.id,
          title: project.title,
          description: project.description,
          summary: project.summary,
          tags: project.tags,
        })),
        query,
        totalFound: relevantProjects.length,
      };
    }

    return { type: 'project_search', projects: [], query, totalFound: 0 };

  } catch (error) {
    console.error('Failed to load project context:', error);
    return { type: 'error', message: 'Failed to load project information' };
  }
}

/**
 * Load profile/about context
 */
async function loadProfileContext(
  query: string,
  accessLevel: string = 'basic',
  maxTokens: number = 2000,
  format: string = 'conversational'
): Promise<any> {
  try {
    // Get homepage config which contains about section
    const response = await fetch('/api/homepage-config-public');
    if (response.ok) {
      const configData = await response.json();
      const config = configData.data?.config;
      
      if (config) {
        const aboutSection = config.sections?.find((section: any) => 
          section.type === 'about' && section.enabled
        );

        if (aboutSection) {
          const aboutConfig = aboutSection.config || {};
          
          return {
            type: 'profile',
            profile: {
              content: aboutConfig.content,
              skills: aboutConfig.skills || [],
              ...(accessLevel !== 'basic' ? {
                experience: aboutConfig.experience,
                education: aboutConfig.education,
                certifications: aboutConfig.certifications,
              } : {}),
            },
            query,
            format,
          };
        }
      }
    }

    return { type: 'profile', profile: null, query };

  } catch (error) {
    console.error('Failed to load profile context:', error);
    return { type: 'error', message: 'Failed to load profile information' };
  }
}

/**
 * Load general context using context injector
 */
async function loadGeneralContext(
  query: string,
  sessionId: string,
  reflinkCode?: string,
  maxTokens: number = 2000
): Promise<any> {
  try {
    const filteredContext = await contextInjector.loadFilteredContext(
      sessionId,
      query,
      reflinkCode,
      { maxTokens }
    );

    return {
      type: 'general',
      context: filteredContext.publicContext,
      sources: filteredContext.contextSources,
      relevantContent: filteredContext.relevantContent.slice(0, 5), // Limit to top 5
      query,
    };

  } catch (error) {
    console.error('Failed to load general context:', error);
    return { type: 'error', message: 'Failed to load general information' };
  }
}

/**
 * Load navigation context
 */
async function loadNavigationContext(
  query: string,
  accessLevel: string = 'basic'
): Promise<any> {
  try {
    // This would integrate with navigation state management
    // For now, return basic navigation information
    
    return {
      type: 'navigation',
      availableActions: [
        'openProjectModal',
        'scrollToSection',
        'highlightText',
        ...(accessLevel === 'premium' ? [
          'navigateToProject',
          'focusElement',
          'animateElement',
        ] : []),
      ],
      currentState: {
        // This would be populated with actual navigation state
        activeModal: null,
        scrollPosition: 0,
        highlightedElements: [],
      },
      query,
    };

  } catch (error) {
    console.error('Failed to load navigation context:', error);
    return { type: 'error', message: 'Failed to load navigation information' };
  }
}

export const POST = withPerformanceTracking(contextLoadHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}