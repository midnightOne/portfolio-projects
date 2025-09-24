/**
 * Backend Tool Service
 * 
 * Simplified server-side tool execution service that replaces the MCP server.
 * Focuses solely on server-side tool logic: project context, job analysis, user profiles, etc.
 * Integrates with existing services: contextInjector and other portfolio services.
 */

import { UnifiedToolDefinition, UnifiedToolResult, ServerToolExecutionContext } from './types';
import { serverToolDefinitions } from './server-tools';
import { contextInjector } from '@/lib/services/ai/context-injector';
import { projectIndexer } from '@/lib/services/project-indexer';
import ContentSearchService from '@/lib/content/ContentSearchService';
import { contextFrameManager, ContextSwapConfig } from '../ContextFrameManager';

export interface BackendToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  sessionId: string;
  accessLevel: 'basic' | 'limited' | 'premium';
  reflinkId?: string;
  userId?: string;
}

/**
 * Backend Tool Service - Simplified MCP replacement
 */
export class BackendToolService {
  private static instance: BackendToolService;
  private toolDefinitions: Map<string, UnifiedToolDefinition> = new Map();
  private contentSearchService: ContentSearchService;

  private constructor() {
    this.contentSearchService = new ContentSearchService();
    this.initializeTools();
  }

  static getInstance(): BackendToolService {
    if (!BackendToolService.instance) {
      BackendToolService.instance = new BackendToolService();
    }
    return BackendToolService.instance;
  }

  /**
   * Initialize tool definitions
   */
  private initializeTools(): void {
    serverToolDefinitions.forEach(tool => {
      this.toolDefinitions.set(tool.name, tool);
    });
    console.log(`BackendToolService initialized with ${this.toolDefinitions.size} server tools`);
  }

  /**
   * Get available server tool definitions
   */
  getAvailableTools(): UnifiedToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * Get tool definition by name
   */
  getToolDefinition(toolName: string): UnifiedToolDefinition | undefined {
    return this.toolDefinitions.get(toolName);
  }

  /**
   * Get F-I-D context for server-side tool execution
   */
  async getFIDContext(uiState?: any, userIntent?: string): Promise<{
    frame: any;
    index: any;
    details: any;
    totalTokens: number;
    budgetExceeded: boolean;
  }> {
    try {
      const config: ContextSwapConfig = {
        route: uiState?.currentRoute || 'home',
        projectId: uiState?.currentProject || undefined,
        userIntent,
        lastActions: uiState?.visibleAnchors || []
      };

      return await contextFrameManager.getCompleteContext(config);
    } catch (error) {
      console.error('Failed to get F-I-D context for server tool:', error);

      // Return minimal context on error
      return {
        frame: { systemRules: '', voiceSettings: {}, routingPrimer: '', tokenCount: 0 },
        index: { route: 'home', projectSummaries: [], routeMetadata: {}, availableTransitions: [], tokenCount: 0 },
        details: { contentChunks: [], searchResults: [], tokenCount: 0, truncated: false },
        totalTokens: 0,
        budgetExceeded: false
      };
    }
  }

  /**
   * Execute a server-side tool
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    sessionId: string,
    accessLevel: 'basic' | 'limited' | 'premium',
    reflinkId?: string,
    userId?: string,
    uiState?: any
  ): Promise<UnifiedToolResult> {
    const startTime = Date.now();

    try {
      // Validate tool exists and is server-side
      const toolDef = this.toolDefinitions.get(toolName);
      if (!toolDef) {
        return {
          success: false,
          error: `Server tool '${toolName}' not found`,
          metadata: {
            timestamp: Date.now(),
            executionTime: Date.now() - startTime,
            source: 'server',
            sessionId
          }
        };
      }

      if (toolDef.executionContext !== 'server') {
        return {
          success: false,
          error: `Tool '${toolName}' is not a server-side tool`,
          metadata: {
            timestamp: Date.now(),
            executionTime: Date.now() - startTime,
            source: 'server',
            sessionId
          }
        };
      }

      // Create execution context
      const context: ServerToolExecutionContext = {
        sessionId,
        accessLevel,
        reflinkId,
        userId,
        uiState
      };

      // Route to appropriate handler
      let result: any;
      switch (toolName) {
        case 'loadProjectContext':
          result = await this.handleLoadProjectContext(parameters, context);
          break;

        case 'loadUserProfile':
          result = await this.handleLoadUserProfile(parameters, context);
          break;

        case 'searchProjects':
          result = await this.handleSearchProjects(parameters, context);
          break;

        case 'getProjectSummary':
          result = await this.handleGetProjectSummary(parameters, context);
          break;

        case 'openProject':
          result = await this.handleOpenProject(parameters, context);
          break;

        case 'processJobSpec':
          result = await this.handleProcessJobSpec(parameters, context);
          break;

        case 'analyzeUserIntent':
          result = await this.handleAnalyzeUserIntent(parameters, context);
          break;

        case 'generateNavigationSuggestions':
          result = await this.handleGenerateNavigationSuggestions(parameters, context);
          break;

        case 'getNavigationHistory':
          result = await this.handleGetNavigationHistory(parameters, context);
          break;

        case 'submitContactForm':
          result = await this.handleSubmitContactForm(parameters, context);
          break;

        case 'processUploadedFile':
          result = await this.handleProcessUploadedFile(parameters, context);
          break;

        case 'content_search':
          result = await this.handleContentSearch(parameters, context);
          break;

        case 'content_get':
          result = await this.handleContentGet(parameters, context);
          break;

        default:
          return {
            success: false,
            error: `Unknown server tool: ${toolName}`,
            metadata: {
              timestamp: Date.now(),
              executionTime: Date.now() - startTime,
              source: 'server',
              sessionId
            }
          };
      }

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server',
          sessionId
        }
      };

    } catch (error) {
      console.error(`Backend tool execution failed for ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error',
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server',
          sessionId
        }
      };
    }
  }

  /**
   * Tool Handlers - Server-side business logic
   */

  private async handleLoadProjectContext(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { projectId, includeContent = false, includeMedia = false, includeTechnicalDetails = true } = args;

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('@/lib/database/connection');
      
      // Try to load real project data from database
      let projectData = null;
      try {
        projectData = await prisma.project.findFirst({
          where: {
            OR: [
              { slug: projectId },
              { id: projectId }
            ],
            status: 'PUBLISHED',
            visibility: 'PUBLIC'
          },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            briefOverview: true,
            workDate: true,
            tags: {
              select: {
                name: true
              }
            },
            mediaItems: includeMedia ? {
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
                altText: true,
                type: true
              },
              take: 5
            } : false
          }
        });
      } catch (dbError) {
        console.warn('Failed to load project from database:', dbError);
      }

      // Return structured project context data
      const contextData = {
        projectId,
        title: projectData?.title || `Project ${projectId}`,
        briefSummary: projectData?.description || projectData?.briefOverview || 'Project context loaded',
        detailedSummary: projectData?.briefOverview || 'Detailed project analysis available',
        keyTechnologies: projectData?.tags?.map(t => t.name) || ['javascript', 'typescript', 'react'],
        mainTopics: ['web development', 'frontend'],
        contentStructure: {
          totalSections: 0,
          headingHierarchy: [],
          contentTypes: [],
          estimatedReadTime: 0
        },
        sections: includeContent ? [] : undefined,
        mediaContext: includeMedia ? (projectData?.mediaItems || []) : undefined,
        keywords: [],
        topics: [],
        technologies: projectData?.tags?.map(t => t.name) || [],
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId,
        projectFound: !!projectData,
        loadedDirectly: true // Flag to indicate this was loaded without contextInjector
      };

      return contextData;

    } catch (error) {
      throw new Error(`Failed to load project context: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleLoadUserProfile(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { includePrivate = false, includeSkills = true, includeExperience = true } = args;

    try {
      // Return structured profile data directly without contextInjector to avoid hanging
      // TODO: In the future, this could load real profile data from database
      const profileData = {
        name: 'Portfolio Owner',
        title: 'Full-Stack Developer',
        bio: 'Experienced developer with expertise in modern web technologies',
        skills: includeSkills ? [
          'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 
          'Python', 'PostgreSQL', 'Prisma', 'Tailwind CSS', 'Git'
        ] : [],
        experience: includeExperience ? '5+ years of professional development experience' : undefined,
        contact: {
          email: includePrivate && context.accessLevel === 'premium' ? 'contact@example.com' : undefined,
          linkedin: 'https://linkedin.com/in/developer',
          github: 'https://github.com/developer',
          website: 'https://portfolio.example.com'
        },
        location: 'Remote',
        availability: 'Available for new opportunities',
        interests: ['Web Development', 'AI/ML', 'Open Source', 'Full-Stack Development'],
        education: 'Computer Science Degree',
        certifications: ['AWS Certified', 'React Certified'],
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId,
        profileLoadedDirectly: true // Flag to indicate this was loaded without contextInjector
      };

      return profileData;

    } catch (error) {
      throw new Error(`Failed to load user profile: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleSearchProjects(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { query, tags, category, limit = 10, includeContent = true } = args;

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('@/lib/database/connection');

      // Fetch projects directly from database instead of HTTP call to avoid hanging
      const projects = await prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          workDate: true,
          status: true,
          visibility: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          tags: {
            select: {
              id: true,
              name: true,
              color: true
            }
          },
          thumbnailImage: {
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              altText: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2 // Get more for filtering
      });

      // Convert projects to search result format
      let searchResults = projects.map((project: any) => ({
        id: project.slug,
        title: project.title,
        description: project.description || project.briefOverview || '',
        slug: project.slug,
        tags: Array.isArray(project.tags) ? project.tags.map((tag: any) => tag.name).filter(Boolean) : [],
        status: project.status,
        viewCount: project.viewCount || 0,
        workDate: project.workDate,
        thumbnailUrl: project.thumbnailImage?.thumbnailUrl || project.thumbnailImage?.url,
        relevanceScore: 1.0, // Will be calculated based on query match
        url: `/projects?project=${project.slug}`, // Correct URL format
        matchingSections: []
      }));

      // Apply search filtering
      if (query) {
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(Boolean);

        searchResults = searchResults.map((project: any) => {
          let score = 0;
          const titleLower = project.title.toLowerCase();
          const descLower = project.description.toLowerCase();

          // Exact title match gets highest score
          if (titleLower === queryLower) {
            score = 1.0;
          }
          // Title contains full query
          else if (titleLower.includes(queryLower)) {
            score = 0.9;
          }
          // Description contains full query
          else if (descLower.includes(queryLower)) {
            score = 0.8;
          }
          // Check individual terms
          else {
            let termMatches = 0;
            queryTerms.forEach(term => {
              if (titleLower.includes(term)) termMatches += 2;
              else if (descLower.includes(term)) termMatches += 1;
              else if (project.tags.some((tag: string) => tag.toLowerCase().includes(term))) termMatches += 1;
            });
            score = Math.min(0.7, termMatches / (queryTerms.length * 2));
          }

          // Special mappings for common user terms
          const specialMappings: Record<string, string[]> = {
            'ecommerce': ['e-commerce-platform'],
            'e-commerce': ['e-commerce-platform'],
            'shop': ['e-commerce-platform'],
            'store': ['e-commerce-platform'],
            'shopping': ['e-commerce-platform'],
            'task': ['task-management-app'],
            'todo': ['task-management-app'],
            'portfolio': ['portfolio-website'],
            'website': ['portfolio-website'],
            'personal': ['portfolio-website']
          };

          Object.entries(specialMappings).forEach(([term, slugs]) => {
            if (queryLower.includes(term) && slugs.includes(project.slug)) {
              console.log(`Special mapping match: "${term}" → ${project.slug}, score boosted to 0.95`);
              score = Math.max(score, 0.95);
            }
          });

          console.log(`Project ${project.slug} scored ${score} for query "${query}"`);
          return { ...project, relevanceScore: score };
        }).filter((project: any) => {
          const passed = project.relevanceScore > 0.1;
          if (!passed) {
            console.log(`Project ${project.slug} filtered out with score ${project.relevanceScore}`);
          }
          return passed;
        });
      }

      // Apply tag filtering (case-insensitive)
      if (tags && tags.length > 0) {
        const tagsLower = tags.map(t => t.toLowerCase());
        searchResults = searchResults.filter((project: any) =>
          project.tags.some((tag: string) => tagsLower.includes(tag.toLowerCase()))
        );
      }

      // Sort by relevance score and limit results
      searchResults.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
      const finalResults = searchResults.slice(0, limit);

      return {
        query,
        tags,
        category,
        results: finalResults,
        totalResults: searchResults.length,
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId,
        searchPerformed: true
      };

    } catch (error) {
      throw new Error(`Failed to search projects: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle opening a project by searching first
   */
  private async handleOpenProject(parameters: any, context: any): Promise<any> {
    try {
      const { projectName, newTab = false } = parameters;

      if (!projectName || typeof projectName !== 'string') {
        return {
          success: false,
          error: 'Project name is required and must be a string',
          data: null,
          metadata: {
            timestamp: Date.now(),
            source: 'backend-tool-service',
            toolName: 'openProject',
            executionTime: 0,
            accessLevel: context.accessLevel
          }
        };
      }

      // First, search for the project
      let searchResult;
      try {
        searchResult = await this.handleSearchProjects({
          query: projectName,
          limit: 10  // Increased to ensure we get all projects
        }, context);
      } catch (searchError) {
        console.error('Search error in openProject:', searchError);
        return {
          success: false,
          error: `Search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`,
          data: {
            projectFound: false,
            searchQuery: projectName,
            suggestions: ['Try "e-commerce", "task management", or "portfolio"']
          },
          metadata: {
            timestamp: Date.now(),
            source: 'backend-tool-service',
            toolName: 'openProject',
            executionTime: Date.now() - Date.now(),
            accessLevel: context.accessLevel
          }
        };
      }

      console.log('Search result in openProject:', {
        hasResults: !!searchResult.results,
        resultsLength: searchResult.results?.length,
        firstResult: searchResult.results?.[0]?.title
      });

      if (!searchResult.results || searchResult.results.length === 0) {
        return {
          success: false,
          error: `No project found matching "${projectName}". Try searching with different keywords.`,
          data: {
            projectFound: false,
            searchQuery: projectName,
            suggestions: ['Try "e-commerce", "task management", or "portfolio"']
          },
          metadata: {
            timestamp: Date.now(),
            source: 'backend-tool-service',
            toolName: 'openProject',
            executionTime: Date.now() - Date.now(),
            accessLevel: context.accessLevel
          }
        };
      }

      const project = searchResult.results[0];
      const navigationUrl = `/projects?project=${project.slug}`;

      return {
        success: true,
        data: {
          projectFound: true,
          projectSlug: project.slug,
          projectTitle: project.title,
          navigationUrl,
          shouldNavigate: true,
          newTab,
          message: `Found "${project.title}". Navigate to: ${navigationUrl}`
        },
        metadata: {
          timestamp: Date.now(),
          source: 'backend-tool-service',
          toolName: 'openProject',
          executionTime: Date.now() - Date.now(),
          accessLevel: context.accessLevel
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: null,
        metadata: {
          timestamp: Date.now(),
          source: 'backend-tool-service',
          toolName: 'openProject',
          executionTime: 0,
          accessLevel: context.accessLevel
        }
      };
    }
  }

  private async handleGetProjectSummary(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { includePrivate = false, sortBy = 'date' } = args;
    const maxProjects = args.maxProjects ?? 20;

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('@/lib/database/connection');

      // Fetch projects directly from database instead of HTTP call to avoid hanging
      const projects = await prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: includePrivate ? undefined : 'PUBLIC'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          workDate: true,
          status: true,
          visibility: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          tags: {
            select: {
              id: true,
              name: true,
              color: true
            },
            take: 5
          },
          thumbnailImage: {
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              altText: true
            }
          }
        },
        orderBy: sortBy === 'date' ? { workDate: 'desc' } :
          sortBy === 'title' ? { title: 'asc' } :
            { createdAt: 'desc' },
        take: maxProjects
      });

      // Process projects for summary
      const recentProjects = projects.map((project: any) => ({
        id: project.slug,
        title: project.title,
        description: project.description || project.briefOverview || '',
        slug: project.slug,
        tags: Array.isArray(project.tags) ? project.tags.map((tag: any) => tag.name).filter(Boolean) : [],
        lastUpdated: project.updatedAt,
        workDate: project.workDate,
        visibility: project.visibility || 'PUBLIC',
        status: project.status,
        viewCount: project.viewCount || 0,
        url: `/projects?project=${project.slug}`, // Correct URL format
        thumbnailUrl: project.thumbnailImage?.thumbnailUrl || project.thumbnailImage?.url
      }));

      // Calculate statistics
      const allTags = recentProjects.flatMap((p: any) => p.tags);
      const tagCounts = allTags.reduce((acc: any, tag: string) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

      const topTags = Object.entries(tagCounts)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10)
        .map(([tag]: any) => tag);

      // Categorize projects (basic categorization based on tags/titles)
      const categories: Record<string, number> = {};
      recentProjects.forEach((project: any) => {
        const title = project.title.toLowerCase();
        const tags = project.tags.map((t: string) => t.toLowerCase());

        if (tags.includes('react') || tags.includes('web') || title.includes('website') || title.includes('web')) {
          categories['web development'] = (categories['web development'] || 0) + 1;
        }
        if (tags.includes('mobile') || tags.includes('app') || title.includes('app')) {
          categories['mobile development'] = (categories['mobile development'] || 0) + 1;
        }
        if (tags.includes('api') || tags.includes('backend') || title.includes('api')) {
          categories['api development'] = (categories['api development'] || 0) + 1;
        }
        if (tags.includes('ai') || tags.includes('ml') || title.includes('ai') || title.includes('machine learning')) {
          categories['artificial intelligence'] = (categories['artificial intelligence'] || 0) + 1;
        }
        if (tags.includes('ecommerce') || tags.includes('e-commerce') || title.includes('ecommerce') || title.includes('e-commerce')) {
          categories['e-commerce'] = (categories['e-commerce'] || 0) + 1;
        }
      });

      const summaryData = {
        totalProjects: projects.length,
        categories,
        recentProjects: recentProjects.slice(0, maxProjects),
        topTags,
        topTechnologies: topTags, // For now, same as tags
        projectsByVisibility: {
          public: projects.filter((p: any) => p.visibility === 'PUBLIC').length,
          private: includePrivate ? projects.filter((p: any) => p.visibility === 'PRIVATE').length : 0
        },
        lastUpdated: projects.length > 0 ? projects[0].updatedAt : new Date().toISOString(),
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId,
        realDataFetched: true
      };

      return summaryData;

    } catch (error) {
      throw new Error(`Failed to get project summary: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleProcessJobSpec(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const {
      jobSpec,
      analysisType = 'detailed',
      includeSkillsMatch = true,
      includeExperienceMatch = true,
      generateReport = true
    } = args;

    // Check if job analysis is allowed for this access level
    if (context.accessLevel === 'basic') {
      throw new Error('Job analysis requires premium access');
    }

    try {
      // Get user profile for comparison
      const profileData = await this.handleLoadUserProfile(
        { includePrivate: false, includeSkills: true, includeExperience: true },
        context
      );

      // Extract requirements from job spec
      const jobRequirements = this.extractJobRequirements(jobSpec);

      // Analyze skills match
      const skillsAnalysis = includeSkillsMatch ?
        this.analyzeSkillsMatch(profileData.skills, jobRequirements.skills) : null;

      // Analyze technology match
      const techAnalysis = this.analyzeTechnologyMatch(
        profileData.skills, // Use profile skills as proxy for technologies
        jobRequirements.technologies
      );

      // Calculate overall match score
      const matchScore = this.calculateMatchScore(skillsAnalysis, techAnalysis, jobRequirements);

      // Generate recommendations
      const recommendations = this.generateJobRecommendations(
        skillsAnalysis,
        techAnalysis,
        null, // No project summary for now
        analysisType
      );

      const analysisData = {
        jobSpec,
        analysisType,
        matchScore,
        skillsAnalysis,
        technologyAnalysis: techAnalysis,
        experienceAnalysis: includeExperienceMatch ? {
          matches: [],
          gaps: [],
          score: 0.7 // Placeholder
        } : null,
        strengths: (skillsAnalysis?.matches || []).concat(techAnalysis.matches),
        gaps: (skillsAnalysis?.gaps || []).concat(techAnalysis.gaps),
        recommendations,
        relevantProjects: [],
        report: generateReport ? this.generateJobAnalysisReport(matchScore, skillsAnalysis, techAnalysis) : null,
        timestamp: Date.now(),
        accessLevel: context.accessLevel,
        processedWithReflink: !!context.reflinkId
      };

      // TODO: Store job analysis for admin review when database integration is ready
      console.log('Job analysis completed:', {
        matchScore: analysisData.matchScore,
        analysisType: analysisData.analysisType,
        sessionId: context.sessionId
      });

      return analysisData;

    } catch (error) {
      throw new Error(`Failed to process job spec: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleAnalyzeUserIntent(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { userMessage, conversationHistory = [], currentContext = {} } = args;

    try {
      // Simple intent analysis using keyword matching and patterns
      const intent = this.classifyUserIntent(userMessage);
      const entities = this.extractEntities(userMessage);
      const confidence = this.calculateIntentConfidence(userMessage, intent, entities);

      // Analyze conversation context
      const contextualInfo = this.analyzeConversationContext(conversationHistory, currentContext);

      // Generate suggested actions based on intent
      const suggestedActions = this.generateSuggestedActions(intent, entities, contextualInfo);

      return {
        userMessage,
        intent: intent.type,
        confidence,
        entities,
        contextualInfo,
        suggestedActions,
        reasoning: intent.reasoning,
        conversationTurn: conversationHistory.length + 1,
        accessLevel: context.accessLevel
      };

    } catch (error) {
      throw new Error(`Failed to analyze user intent: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleGenerateNavigationSuggestions(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { userIntent, currentLocation, availableProjects = [], maxSuggestions = 5 } = args;

    try {
      // Get project summary for context
      const projectSummary = await this.handleGetProjectSummary(
        { includePrivate: false },
        context
      );

      // Generate navigation suggestions based on intent
      const suggestions = [];

      // Intent-based navigation suggestions
      if (userIntent.includes('project') || userIntent.includes('work') || userIntent.includes('portfolio')) {
        const relevantProjects = this.findProjectsForIntent(
          userIntent,
          projectSummary.recentProjects || availableProjects
        );

        relevantProjects.forEach(project => {
          suggestions.push({
            action: 'openProjectModal',
            target: project.id,
            reason: `Relevant project for "${userIntent}" - matches ${project.matchReason}`,
            confidence: project.confidence,
            metadata: {
              projectTitle: project.title,
              tags: project.tags
            }
          });
        });
      }

      // Add other navigation suggestions based on intent patterns
      if (userIntent.includes('skill') || userIntent.includes('technology')) {
        suggestions.push({
          action: 'scrollToSection',
          target: 'skills-section',
          reason: 'User inquiring about technical skills and experience',
          confidence: 0.8,
          metadata: { sectionType: 'skills' }
        });
      }

      if (userIntent.includes('about') || userIntent.includes('background')) {
        suggestions.push({
          action: 'scrollToSection',
          target: 'about-section',
          reason: 'User wants to learn about background and experience',
          confidence: 0.85,
          metadata: { sectionType: 'about' }
        });
      }

      if (userIntent.includes('contact') || userIntent.includes('hire')) {
        suggestions.push({
          action: 'scrollToSection',
          target: 'contact-section',
          reason: 'User interested in making contact',
          confidence: 0.9,
          metadata: { sectionType: 'contact' }
        });
      }

      // Sort by confidence and limit results
      suggestions.sort((a, b) => b.confidence - a.confidence);

      return {
        userIntent,
        currentLocation,
        suggestions: suggestions.slice(0, maxSuggestions),
        totalSuggestions: suggestions.length,
        analysisMetadata: {
          extractedTechnologies: this.extractTechnologies(userIntent),
          intentKeywords: this.extractIntentKeywords(userIntent),
          contextFactors: {
            hasProjects: projectSummary.totalProjects > 0,
            currentLocation,
            accessLevel: context.accessLevel
          }
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate navigation suggestions: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleGetNavigationHistory(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { sessionId, limit = 20, includeToolCalls = true } = args;

    try {
      // For now, return empty history - this would integrate with session storage
      const history = [];

      return {
        sessionId: sessionId || context.sessionId,
        history,
        totalEntries: history.length,
        includeToolCalls,
        accessLevel: context.accessLevel
      };

    } catch (error) {
      throw new Error(`Failed to get navigation history: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleSubmitContactForm(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { formData, source = 'voice', priority = 'normal' } = args;

    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.message) {
        throw new Error('Missing required contact form fields: name, email, message');
      }

      // Generate contact ID and confirmation number
      const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const confirmationNumber = `CONF_${Date.now().toString(36).toUpperCase()}`;

      // TODO: Store contact form submission in database
      console.log('Contact form submitted:', {
        contactId,
        name: formData.name,
        email: formData.email,
        source,
        priority,
        sessionId: context.sessionId,
        reflinkId: context.reflinkId
      });

      return {
        contactId,
        confirmationNumber,
        estimatedResponse: priority === 'urgent' ? '2-4 hours' : '24-48 hours',
        message: 'Contact form submitted successfully',
        submittedAt: new Date().toISOString(),
        source,
        priority
      };

    } catch (error) {
      throw new Error(`Failed to submit contact form: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleProcessUploadedFile(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { fileId, fileType, analysisType = 'full_analysis', includeInContext = true } = args;

    // Check if file processing is allowed for this access level
    if (context.accessLevel === 'basic') {
      throw new Error('File processing requires premium access');
    }

    try {
      // TODO: Implement actual file processing when file upload system is ready
      const mockAnalysis = {
        fileId,
        fileType,
        analysisType,
        extractedText: 'Mock extracted text from uploaded file',
        analysis: {
          documentType: fileType,
          wordCount: 500,
          keyTopics: ['web development', 'javascript', 'react'],
          sentiment: 'professional'
        },
        skills: fileType === 'resume' ? ['JavaScript', 'React', 'Node.js'] : [],
        summary: `Processed ${fileType} file with ${analysisType} analysis`,
        processedAt: new Date().toISOString(),
        includeInContext
      };

      console.log('File processed:', {
        fileId,
        fileType,
        analysisType,
        sessionId: context.sessionId
      });

      return mockAnalysis;

    } catch (error) {
      throw new Error(`Failed to process uploaded file: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Helper methods for job spec processing
   */
  private extractJobRequirements(jobSpec: string): {
    skills: string[];
    technologies: string[];
    experience: string[];
    keywords: string[];
  } {
    const text = jobSpec.toLowerCase();

    // Extract technologies
    const techPatterns = [
      /\b(javascript|typescript|python|java|c\+\+|c#|php|ruby|go|rust|swift|kotlin)\b/g,
      /\b(react|vue|angular|svelte|next\.?js|nuxt|express|django|flask|spring|laravel)\b/g,
      /\b(mysql|postgresql|mongodb|redis|sqlite|firebase|supabase)\b/g,
      /\b(aws|azure|gcp|docker|kubernetes|vercel|netlify|heroku)\b/g,
      /\b(git|webpack|vite|babel|eslint|prettier|jest|cypress)\b/g
    ];

    const technologies = new Set<string>();
    techPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => technologies.add(match));
      }
    });

    // Extract skills
    const skillPatterns = [
      /\b(frontend|backend|fullstack|full-stack)\b/g,
      /\b(ui|ux|design|responsive)\b/g,
      /\b(api|rest|graphql|microservices)\b/g,
      /\b(testing|debugging|optimization)\b/g,
      /\b(agile|scrum|devops|ci\/cd)\b/g
    ];

    const skills = new Set<string>();
    skillPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => skills.add(match));
      }
    });

    // Extract experience requirements
    const experienceMatches = text.match(/(\d+)\+?\s*(years?|yrs?)\s*(of\s*)?(experience|exp)/g) || [];
    const experience = experienceMatches.map(match => match.trim());

    // Extract general keywords
    const keywords = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
      .slice(0, 20);

    return {
      skills: Array.from(skills),
      technologies: Array.from(technologies),
      experience,
      keywords
    };
  }

  private analyzeSkillsMatch(userSkills: string[], jobSkills: string[]): {
    matches: string[];
    gaps: string[];
    score: number;
  } {
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    const jobSkillsLower = jobSkills.map(s => s.toLowerCase());

    const matches = jobSkillsLower.filter(skill =>
      userSkillsLower.some(userSkill =>
        userSkill.includes(skill) || skill.includes(userSkill)
      )
    );

    const gaps = jobSkillsLower.filter(skill => !matches.includes(skill));
    const score = jobSkillsLower.length > 0 ? matches.length / jobSkillsLower.length : 0;

    return { matches, gaps, score };
  }

  private analyzeTechnologyMatch(userTech: string[], jobTech: string[]): {
    matches: string[];
    gaps: string[];
    score: number;
  } {
    const userTechLower = userTech.map(t => t.toLowerCase());
    const jobTechLower = jobTech.map(t => t.toLowerCase());

    const matches = jobTechLower.filter(tech =>
      userTechLower.some(userTechnology =>
        userTechnology.includes(tech) || tech.includes(userTechnology)
      )
    );

    const gaps = jobTechLower.filter(tech => !matches.includes(tech));
    const score = jobTechLower.length > 0 ? matches.length / jobTechLower.length : 0;

    return { matches, gaps, score };
  }

  private calculateMatchScore(
    skillsAnalysis: any,
    techAnalysis: any,
    jobRequirements: any
  ): number {
    const skillsWeight = 0.4;
    const techWeight = 0.4;
    const experienceWeight = 0.2;

    const skillsScore = (skillsAnalysis?.score || 0) * skillsWeight;
    const techScore = techAnalysis.score * techWeight;
    const experienceScore = jobRequirements.experience.length > 0 ? 0.7 : 1.0;
    const weightedExperienceScore = experienceScore * experienceWeight;

    return Math.round((skillsScore + techScore + weightedExperienceScore) * 100);
  }

  private generateJobRecommendations(
    skillsAnalysis: any,
    techAnalysis: any,
    projectSummary: any,
    analysisType: string
  ): string[] {
    const recommendations = [];

    if (skillsAnalysis?.matches.length > 0) {
      recommendations.push(`Highlight your ${skillsAnalysis.matches.join(', ')} experience`);
    }

    if (techAnalysis.matches.length > 0) {
      recommendations.push(`Emphasize projects using ${techAnalysis.matches.join(', ')}`);
    }

    if (skillsAnalysis?.gaps.length > 0) {
      recommendations.push(`Consider learning: ${skillsAnalysis.gaps.slice(0, 3).join(', ')}`);
    }

    return recommendations;
  }

  private generateJobAnalysisReport(matchScore: number, skillsAnalysis: any, techAnalysis: any): string {
    return `Job Analysis Report
    
Match Score: ${matchScore}%

Skills Analysis:
- Matching Skills: ${skillsAnalysis?.matches.join(', ') || 'None identified'}
- Skill Gaps: ${skillsAnalysis?.gaps.join(', ') || 'None identified'}

Technology Analysis:
- Matching Technologies: ${techAnalysis.matches.join(', ') || 'None identified'}
- Technology Gaps: ${techAnalysis.gaps.join(', ') || 'None identified'}

This analysis was generated automatically and should be reviewed for accuracy.`;
  }

  /**
   * Helper methods for intent analysis
   */
  private classifyUserIntent(message: string): { type: string; reasoning: string } {
    const text = message.toLowerCase();

    if (text.match(/\b(project|work|portfolio|example|show|demo)\b/)) {
      return {
        type: 'project_inquiry',
        reasoning: 'User asking about projects or portfolio work'
      };
    }

    if (text.match(/\b(skill|technology|tech|experience|know|can you|able)\b/)) {
      return {
        type: 'skills_inquiry',
        reasoning: 'User asking about technical skills or capabilities'
      };
    }

    if (text.match(/\b(about|background|bio|who|tell me|yourself)\b/)) {
      return {
        type: 'about_inquiry',
        reasoning: 'User wants to learn about background and experience'
      };
    }

    if (text.match(/\b(contact|hire|available|reach|email|phone)\b/)) {
      return {
        type: 'contact_inquiry',
        reasoning: 'User interested in making contact or hiring'
      };
    }

    if (text.match(/\b(job|position|role|requirement|match|fit)\b/)) {
      return {
        type: 'job_analysis',
        reasoning: 'User wants job specification analysis'
      };
    }

    if (text.match(/\b(show|open|go to|navigate|find|where)\b/)) {
      return {
        type: 'navigation_request',
        reasoning: 'User requesting navigation to specific content'
      };
    }

    return {
      type: 'general_inquiry',
      reasoning: 'General conversation or unclear intent'
    };
  }

  private extractEntities(message: string): Record<string, any> {
    const entities: Record<string, any> = {};
    const text = message.toLowerCase();

    // Extract technologies
    const technologies = this.extractTechnologies(text);
    if (technologies.length > 0) {
      entities.technologies = technologies;
    }

    // Extract project-related terms
    const projectTerms = text.match(/\b(project|portfolio|work|example|demo)\b/g);
    if (projectTerms) {
      entities.projectTerms = [...new Set(projectTerms)];
    }

    return entities;
  }

  private extractTechnologies(text: string): string[] {
    const techPattern = /\b(javascript|typescript|react|vue|angular|node|python|java|php|ruby|go|rust|swift|kotlin|html|css|sql|mongodb|postgresql|mysql|redis|docker|kubernetes|aws|azure|gcp)\b/g;
    const matches = text.match(techPattern);
    return matches ? [...new Set(matches)] : [];
  }

  private extractIntentKeywords(text: string): string[] {
    const keywords = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
      .slice(0, 10);
    return keywords;
  }

  private calculateIntentConfidence(message: string, intent: any, entities: any): number {
    // Simple confidence calculation based on keyword matches
    const text = message.toLowerCase();
    let confidence = 0.5; // Base confidence

    // Boost confidence for clear intent patterns
    if (intent.type !== 'general_inquiry') {
      confidence += 0.2;
    }

    // Boost confidence for entity matches
    if (entities.technologies && entities.technologies.length > 0) {
      confidence += 0.1;
    }

    if (entities.projectTerms && entities.projectTerms.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private analyzeConversationContext(conversationHistory: any[], currentContext: any): any {
    return {
      conversationLength: conversationHistory.length,
      recentTopics: [],
      currentPage: currentContext.currentPage || 'unknown',
      currentModal: currentContext.currentModal || null,
      recentActions: currentContext.recentActions || []
    };
  }

  private generateSuggestedActions(intent: any, entities: any, contextualInfo: any): any[] {
    const actions = [];

    if (intent.type === 'project_inquiry') {
      actions.push({
        type: 'navigation',
        action: 'showProjects',
        reason: 'User interested in viewing projects'
      });
    }

    if (intent.type === 'skills_inquiry') {
      actions.push({
        type: 'navigation',
        action: 'showSkills',
        reason: 'User asking about technical skills'
      });
    }

    if (intent.type === 'contact_inquiry') {
      actions.push({
        type: 'navigation',
        action: 'showContact',
        reason: 'User wants to make contact'
      });
    }

    return actions;
  }

  private findProjectsForIntent(intent: string, projects: any[]): any[] {
    return projects.map(project => ({
      ...project,
      confidence: 0.7,
      matchReason: 'keyword match'
    })).slice(0, 3);
  }

  private findProjectsByTechnology(technologies: string[], projects: any[]): any[] {
    return projects.filter(project =>
      project.tags && project.tags.some((tag: string) =>
        technologies.some(tech => tag.toLowerCase().includes(tech.toLowerCase()))
      )
    );
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'];
    return stopWords.includes(word.toLowerCase());
  }

  /**
   * Handle content search using ContentSearchService with UI state context awareness // Entry point for content_search tool
   */
  private async handleContentSearch(
    parameters: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const backendToolStartTime = Date.now();
    const backendTimings: Record<string, number> = {};

    try {
      const {
        query,
        uiState,
        scope = {},
        k = 5,
        maxTier = 3,
        diversifyBy = 'project',
        filters = {}
      } = parameters;

      console.log('Content search request:', {
        query,
        uiState,
        scope,
        k,
        maxTier,
        diversifyBy,
        filters,
        sessionId: context.sessionId
      });

      // Create cache key for request-scoped caching
      const cacheKeyStart = Date.now();
      const cacheKey = `content_search:${JSON.stringify({
        query,
        scope,
        maxTier,
        diversifyBy,
        filters,
        uiContext: {
          route: uiState?.currentRoute,
          project: uiState?.currentProject
        }
      })}`;
      backendTimings.cacheKeyGeneration = Date.now() - cacheKeyStart;

      // Check request-scoped cache
      const cacheCheckStart = Date.now();
      const cachedResult = this._getCachedData(cacheKey, 60); // 60 second cache
      backendTimings.cacheCheck = Date.now() - cacheCheckStart;

      if (cachedResult) {
        console.log('Content search cache hit:', { cacheKey, sessionId: context.sessionId });
        return cachedResult;
      }

      // Get F-I-D context for enhanced search
      const fidContextStart = Date.now();
      const fidContext = await this.getFIDContext(uiState, query);
      backendTimings.fidContextLoading = Date.now() - fidContextStart;

      // Enhance scope with UI state context and F-I-D insights
      const scopeEnhanceStart = Date.now();
      const enhancedScope = this._enhanceScopeWithUIState(scope, uiState, fidContext, query);
      backendTimings.scopeEnhancement = Date.now() - scopeEnhanceStart;

      // Enhance filters with UI state context and F-I-D insights
      const filterEnhanceStart = Date.now();
      const enhancedFilters = this._enhanceFiltersWithUIState(filters, uiState, fidContext);
      backendTimings.filterEnhancement = Date.now() - filterEnhanceStart;

      // Perform content search using ContentSearchService
      const contentSearchStart = Date.now();
      const searchResult = await this.contentSearchService.searchContent({
        query,
        scope: enhancedScope,
        k: Math.min(k + 3, k * 1.5), // Get slightly more results for UI state-aware ranking
        maxTier,
        diversifyBy,
        filters: enhancedFilters
      });
      backendTimings.contentSearchService = Date.now() - contentSearchStart;

      // Apply UI state-aware ranking and filtering
      const rankingStart = Date.now();
      const rankedResults = this._applyUIStateAwareRanking(searchResult.items, uiState, k);
      backendTimings.uiStateRanking = Date.now() - rankingStart;

      // Enhance navigation targets with UI state compatibility
      const enhancementStart = Date.now();
      const enhancedResults = this._enhanceNavigationTargets(rankedResults, uiState);
      backendTimings.navigationEnhancement = Date.now() - enhancementStart;

      const resultBuildStart = Date.now();
      const finalResult = {
        ...searchResult,
        items: enhancedResults,
        searchMetadata: {
          ...searchResult.searchMetadata,
          uiStateEnhanced: true,
          originalResults: searchResult.items.length,
          rankedResults: enhancedResults.length,
          uiContext: {
            currentRoute: uiState?.currentRoute,
            currentProject: uiState?.currentProject,
            breadcrumbPath: uiState?.breadcrumbPath
          }
        }
      };
      backendTimings.resultBuilding = Date.now() - resultBuildStart;

      backendTimings.totalBackendTime = Date.now() - backendToolStartTime;

      console.log('Content search completed with UI state awareness:', {
        query,
        totalResults: finalResult.totalResults,
        originalResults: searchResult.items.length,
        rankedResults: enhancedResults.length,
        uiContext: finalResult.searchMetadata.uiContext,
        searchTime: finalResult.searchMetadata.searchTime,
        sessionId: context.sessionId
      });

      // Log backend tool performance breakdown
      console.log(`[BackendTool] Content search performance breakdown:`, {
        fidContextLoading: `${backendTimings.fidContextLoading}ms`,
        scopeEnhancement: `${backendTimings.scopeEnhancement}ms`,
        filterEnhancement: `${backendTimings.filterEnhancement}ms`,
        cacheKeyGen: `${backendTimings.cacheKeyGeneration}ms`,
        cacheCheck: `${backendTimings.cacheCheck}ms`,
        scopeEnhance: `${backendTimings.scopeEnhancement}ms`,
        filterEnhance: `${backendTimings.filterEnhancement}ms`,
        contentSearch: `${backendTimings.contentSearchService}ms`,
        uiRanking: `${backendTimings.uiStateRanking}ms`,
        navEnhance: `${backendTimings.navigationEnhancement}ms`,
        resultBuild: `${backendTimings.resultBuilding}ms`,
        totalBackend: `${backendTimings.totalBackendTime}ms`
      });

      // Cache the result for request-scoped caching
      const cacheStoreStart = Date.now();
      this._setCachedData(cacheKey, finalResult);
      backendTimings.cacheStore = Date.now() - cacheStoreStart;

      return finalResult;

    } catch (error) {
      console.error('Content search failed:', error);

      // Include UI state context in error messages
      const uiContext = parameters.uiState ?
        ` (UI context: ${parameters.uiState.currentRoute || 'unknown'})` : '';

      throw new Error(`Content search failed${uiContext}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle content retrieval using ContentSearchService with UI state context
   */
  private async handleContentGet(
    parameters: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    try {
      const {
        ids,
        uiState,
        maxTokens = 900,
        includeTiers = [1, 2, 3]
      } = parameters;

      console.log('Content get request:', {
        ids,
        uiState,
        maxTokens,
        includeTiers,
        sessionId: context.sessionId
      });

      // Validate parameters
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Content IDs array is required and must not be empty');
      }

      if (ids.length > 10) {
        throw new Error('Maximum 10 content IDs allowed per request');
      }

      // Create cache key for request-scoped caching
      const cacheKey = `content_get:${JSON.stringify({
        ids: ids.sort(), // Sort for consistent caching
        maxTokens,
        includeTiers,
        uiContext: {
          route: uiState?.currentRoute,
          project: uiState?.currentProject
        }
      })}`;

      // Check request-scoped cache
      const cachedResult = this._getCachedData(cacheKey, 60000); // 60 second cache for content get
      if (cachedResult) {
        console.log('Content get cache hit:', { cacheKey, sessionId: context.sessionId });
        return cachedResult;
      }

      // Get F-I-D context for enhanced content retrieval
      const fidContext = await this.getFIDContext(uiState);

      // Retrieve content using ContentSearchService
      const getResult = await this.contentSearchService.getContent({
        ids,
        maxTokens,
        includeTiers
      });

      // Enhance results with navigation targets compatible with current UI state
      const enhancedItems = getResult.items.map(item => ({
        ...item,
        navTarget: this._createNavigationTargetForContent(item, uiState)
      }));

      const finalResult = {
        ...getResult,
        items: enhancedItems,
        uiStateContext: {
          currentRoute: uiState?.currentRoute,
          currentProject: uiState?.currentProject,
          breadcrumbPath: uiState?.breadcrumbPath,
          navigationTargetsGenerated: enhancedItems.length
        }
      };

      console.log('Content get completed with UI state context:', {
        requestedIds: ids.length,
        returnedItems: finalResult.items.length,
        totalTokens: finalResult.totalTokens,
        truncated: finalResult.truncated,
        uiContext: finalResult.uiStateContext,
        sessionId: context.sessionId
      });

      // Cache the result for request-scoped caching
      this._setCachedData(cacheKey, finalResult);

      return finalResult;

    } catch (error) {
      console.error('Content get failed:', error);

      // Include UI state context in error messages
      const uiContext = parameters.uiState ?
        ` (UI context: ${parameters.uiState.currentRoute || 'unknown'})` : '';

      throw new Error(`Content retrieval failed${uiContext}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * UI State-Aware Helper Methods
   */

  /**
   * Enhance search scope with UI state context and F-I-D insights
   * 
   * IMPORTANT: This should enhance for RANKING, not FILTERING
   * The search should always find relevant content if it exists
   */
  private _enhanceScopeWithUIState(scope: any, uiState?: any, fidContext?: any, query?: string): any {
    if (!uiState) return scope;

    const enhancedScope = { ...scope };

    // NEVER auto-apply filtering based on UI state
    // Only apply explicit scope parameters passed by the agent

    // Only apply route filtering if explicitly provided in scope
    if (scope.route) {
      enhancedScope.route = scope.route;
    }

    // Only apply project filtering if explicitly provided in scope
    if (scope.projectId) {
      enhancedScope.projectId = scope.projectId;
    }

    // Store UI context for ranking enhancement (not filtering)
    enhancedScope._uiContext = {
      currentRoute: uiState.currentRoute,
      currentProject: uiState.currentProject,
      breadcrumbPath: uiState.breadcrumbPath,
      visibleAnchors: uiState.visibleAnchors
    };

    // Store F-I-D context for relevance hints (not filtering)
    if (fidContext?.index?.projectSummaries?.length > 0) {
      enhancedScope._fidHints = {
        relevantProjects: fidContext.index.projectSummaries.slice(0, 3),
        contextRoute: uiState.currentRoute,
        contextProject: uiState.currentProject
      };
    }

    return enhancedScope;
  }

  /**
   * Enhance search filters with UI state context and F-I-D insights
   */
  private _enhanceFiltersWithUIState(filters: any, uiState?: any, fidContext?: any): any {
    const enhancedFilters = { ...filters };

    // Merge active UI filters with explicit filters
    if (uiState?.activeFilters) {
      if (uiState.activeFilters.tags && uiState.activeFilters.tags.length > 0) {
        enhancedFilters.tags = [
          ...(enhancedFilters.tags || []),
          ...uiState.activeFilters.tags
        ];
      }

      if (uiState.activeFilters.techStack && uiState.activeFilters.techStack.length > 0) {
        enhancedFilters.technologies = [
          ...(enhancedFilters.technologies || []),
          ...uiState.activeFilters.techStack
        ];
      }
    }

    // Enhance with F-I-D context insights
    if (fidContext?.index?.projectSummaries?.length > 0) {
      // Extract technologies from relevant projects in F-I-D context
      const contextTechnologies = fidContext.index.projectSummaries
        .flatMap((project: any) => project.technologies || [])
        .filter((tech: string, index: number, arr: string[]) => arr.indexOf(tech) === index); // Remove duplicates

      if (contextTechnologies.length > 0 && !enhancedFilters.technologies) {
        // Only add if no explicit technology filters are set
        enhancedFilters.technologies = contextTechnologies.slice(0, 5); // Limit to top 5
      }
    }

    return enhancedFilters;
  }

  /**
   * Apply UI state-aware ranking to search results
   * 
   * STRATEGY: Prioritize current project results, but always include cross-project results
   * This allows the agent to say "this project doesn't have X, but here's relevant info from Y"
   */
  private _applyUIStateAwareRanking(results: any[], uiState?: any, targetCount: number = 5): any[] {
    if (!uiState || !results.length) {
      return results.slice(0, targetCount);
    }

    // Separate results by project context
    const currentProjectResults: any[] = [];
    const otherProjectResults: any[] = [];

    results.forEach(result => {
      if (uiState.currentProject && result.project === uiState.currentProject) {
        currentProjectResults.push(result);
      } else {
        otherProjectResults.push(result);
      }
    });

    // Apply context-aware scoring
    const scoreResults = (resultList: any[], isCurrentProject: boolean = false) => {
      return resultList.map(result => {
        let contextScore = result.score || 0;

        // Boost current project results significantly
        if (isCurrentProject) {
          contextScore += 0.5;
        }

        // Boost results matching visible anchors
        if (uiState.visibleAnchors && uiState.visibleAnchors.length > 0) {
          const hasVisibleAnchor = uiState.visibleAnchors.some((anchor: string) =>
            result.title?.toLowerCase().includes(anchor.toLowerCase()) ||
            result.oneLiner?.toLowerCase().includes(anchor.toLowerCase())
          );
          if (hasVisibleAnchor) {
            contextScore += 0.25;
          }
        }

        // Boost results matching active filters
        if (uiState.activeFilters?.tags && result.facets?.tech) {
          const tagMatch = uiState.activeFilters.tags.some((tag: string) =>
            result.facets.tech.includes(tag)
          );
          if (tagMatch) {
            contextScore += 0.15;
          }
        }

        return {
          ...result,
          contextScore,
          originalScore: result.score
        };
      });
    };

    // Score both groups
    const scoredCurrentProject = scoreResults(currentProjectResults, true);
    const scoredOtherProjects = scoreResults(otherProjectResults, false);

    // Combine and sort by context score
    const allScoredResults = [...scoredCurrentProject, ...scoredOtherProjects];

    return allScoredResults
      .sort((a, b) => b.contextScore - a.contextScore)
      .slice(0, targetCount)
      .map(({ contextScore, originalScore, ...result }) => ({
        ...result,
        score: contextScore // Update score to reflect context awareness
      }));
  }

  /**
   * Enhance navigation targets with UI state compatibility
   */
  private _enhanceNavigationTargets(results: any[], uiState?: any): any[] {
    return results.map(result => ({
      ...result,
      navTarget: this._createNavigationTargetForContent(result, uiState)
    }));
  }

  /**
   * Create navigation target compatible with current UI state
   */
  private _createNavigationTargetForContent(content: any, uiState?: any): any {
    // Base navigation target
    const navTarget: any = {
      type: 'section',
      id: content.id
    };

    // If content is project-related, create project navigation
    if (content.project) {
      navTarget.type = 'project';
      navTarget.id = content.project;

      // If we're already in the project, navigate to specific section
      if (uiState?.currentProject === content.project) {
        navTarget.type = 'section';
        navTarget.id = content.id;
        navTarget.scope = {
          projectId: content.project
        };
      }
    }

    // Add behavior based on current UI state
    navTarget.behavior = {
      openIfNeeded: true,
      closeBlocking: false,
      scrollBehavior: 'smooth'
    };

    // Add scope context
    if (uiState) {
      navTarget.scope = {
        route: uiState.currentRoute,
        modalId: uiState.currentModal,
        projectId: uiState.currentProject,
        ...navTarget.scope
      };
    }

    return navTarget;
  }

  /**
   * Request-scoped cache for stateless caching
   * Note: This is a simple in-memory cache that gets cleared after each request
   */
  private _requestCache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Get cached data for request-scoped caching
   */
  private _getCachedData(key: string, maxAgeMs: number = 30000): any | null {
    const cached = this._requestCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < maxAgeMs) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached data for request-scoped caching
   */
  private _setCachedData(key: string, data: any): void {
    this._requestCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean up old cache entries (simple cleanup)
    if (this._requestCache.size > 100) {
      const oldestKey = this._requestCache.keys().next().value;
      this._requestCache.delete(oldestKey);
    }
  }
}

// Export singleton instance
export const backendToolService = BackendToolService.getInstance();