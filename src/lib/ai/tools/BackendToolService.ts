/**
 * Backend Tool Service
 * 
 * Simplified server-side tool execution service that replaces the MCP server.
 * Focuses solely on server-side tool logic: project context, job analysis, user profiles, etc.
 * Integrates with existing services: contextInjector and other portfolio services.
 */

import { UnifiedToolDefinition, UnifiedToolResult, ServerToolExecutionContext } from './types';
import { serverToolDefinitions } from './server-tools';
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

        case 'processJobSpec':
          result = await this.handleProcessJobSpec(parameters, context);
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

        // NEW: Hierarchical content tools
        case 'content_getHierarchy':
          result = await this.handleContentHierarchy(parameters, context);
          break;

        case 'content_searchSection':
          result = await this.handleSectionSearch(parameters, context);
          break;

        case 'content_getRelated':
          result = await this.handleRelatedContent(parameters, context);
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
        contentStructure: await this.buildContentStructure(projectId, projectData),
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
        name: 'Kirill Prymachov',
        title: 'XR/AI Developer',
        bio: 'Experienced game developer with expertise in realtime 3D mutiplayer games, AR/VR and applied AI engineering',
        skills: includeSkills ? [
          'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js',
          'Python', 'PostgreSQL', 'Prisma', 'Tailwind CSS', 'Git', 'Unity', 'Unreal Engine', 'Technical art (shaders)'
        ] : [],
        experience: includeExperience ? '7+ years of professional development experience' : undefined,
        contact: {
          email: includePrivate && context.accessLevel === 'premium' ? 'contact@example.com' : undefined,
          linkedin: 'https://linkedin.com/in/developer',
          github: 'https://github.com/developer',
          website: 'https://portfolio.example.com'
        },
        location: 'New York',
        availability: 'Available for new opportunities',
        interests: ['XR', 'applied/agentic AI', 'game development', 'AR applications of the future'],
        education: 'Computer Science Degree',
        certifications: [],
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

  // handleOpenProject method removed - deprecated tool superseded by content_search + ui_intent

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

  // Helper methods for intent analysis removed - no longer needed after removing meta-tools

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

      // Enhance scope with UI state context (for ranking only, not filtering)
      const scopeEnhanceStart = Date.now();
      const enhancedScope = this._enhanceScopeWithUIState(scope, uiState);
      backendTimings.scopeEnhancement = Date.now() - scopeEnhanceStart;

      // Enhance filters with UI state context
      const filterEnhanceStart = Date.now();
      const enhancedFilters = this._enhanceFiltersWithUIState(filters, uiState);
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
  private _enhanceScopeWithUIState(scope: any, uiState?: any): any {
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

    return enhancedScope;
  }

  /**
   * Enhance search filters with UI state context
   */
  private _enhanceFiltersWithUIState(filters: any, uiState?: any): any {
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

    // F-I-D context is now handled passively via NAV_CONTEXT messages
    // No active F-I-D integration in search tools

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

  /**
   * Build content structure from semantic data
   */
  private async buildContentStructure(projectId: string, projectData: any): Promise<{
    totalSections: number;
    headingHierarchy: Array<{ level: number; title: string; id?: string }>;
    contentTypes: string[];
    estimatedReadTime: number;
    semanticItems?: Array<{ id: string; oneLiner: string; type: string; tier: number }>;
  }> {
    try {
      const { prisma } = await import('@/lib/database/connection');

      // First, get the actual project to find the real project ID
      const project = await prisma.project.findFirst({
        where: {
          OR: [
            { slug: projectId },
            { id: projectId }
          ]
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (!project) {
        console.warn('Project not found for content structure:', projectId);
        return {
          totalSections: 0,
          headingHierarchy: [],
          contentTypes: [],
          estimatedReadTime: 0,
          semanticItems: []
        };
      }

      const actualProjectId = project.id;

      // Get AI Index data for semantic information
      const aiIndex = await prisma.projectAIIndex.findUnique({
        where: { projectId: actualProjectId },
        select: {
          sectionsCount: true,
          mediaCount: true,
          keywords: true,
          topics: true,
          technologies: true,
          summary: true
        }
      });

      // Get article content for structure analysis
      const articleContent = await prisma.articleContent.findFirst({
        where: { projectId: actualProjectId },
        select: {
          jsonContent: true,
          contentType: true
        }
      });

      let headingHierarchy: Array<{ level: number; title: string; id?: string }> = [];
      let contentTypes: string[] = [];
      let estimatedReadTime = 0;
      let semanticItems: Array<{ id: string; oneLiner: string; type: string; tier: number }> = [];

      // Extract structure from JSON content
      if (articleContent?.jsonContent && articleContent.contentType === 'json') {
        const jsonContent = articleContent.jsonContent as any;

        console.log("jsonContent: " + jsonContent.content);  
        
        if (jsonContent.content && Array.isArray(jsonContent.content)) {
          // Extract headings for hierarchy
          const headings = jsonContent.content.filter((block: any) => 
            block.type === 'heading'
          );
          
          headingHierarchy = headings.map((heading: any, index: number) => ({
            level: heading.attrs?.level || 1,
            title: this.extractTextFromContent(heading.content) || `Section ${index + 1}`,
            id: `section-${index + 1}`
          }));

          // Extract content types
          const types = new Set(jsonContent.content.map((block: any) => block.type));
          contentTypes = Array.from(types);

          // Estimate reading time (rough calculation: 200 words per minute)
          const wordCount = this.estimateWordCount(jsonContent.content);
          estimatedReadTime = Math.ceil(wordCount / 200);

          // Generate semantic items from headings and key content
          semanticItems = headings.slice(0, 10).map((heading: any, index: number) => ({
            id: `semantic-${index + 1}`,
            oneLiner: this.extractTextFromContent(heading.content) || `Section ${index + 1}`,
            type: 'content',
            tier: index < 3 ? 1 : index < 7 ? 2 : 3
          }));

          // Add technology-based semantic items
          if (aiIndex?.technologies) {
            const techArray = Array.isArray(aiIndex.technologies) ? aiIndex.technologies : [];
            techArray.slice(0, 5).forEach((tech: string, index: number) => {
              semanticItems.push({
                id: `tech-${index + 1}`,
                oneLiner: `${tech} implementation and usage`,
                type: 'technical',
                tier: 1
              });
            });
          }
        }
      }

      return {
        totalSections: aiIndex?.sectionsCount || headingHierarchy.length || 0,
        headingHierarchy,
        contentTypes,
        estimatedReadTime,
        semanticItems
      };

    } catch (error) {
      console.warn('Failed to build content structure:', error);
      
      // Return basic structure on error
      return {
        totalSections: 0,
        headingHierarchy: [],
        contentTypes: [],
        estimatedReadTime: 0,
        semanticItems: []
      };
    }
  }

  /**
   * Extract text content from TipTap content structure
   */
  private extractTextFromContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    
    return content.map(item => {
      if (item.type === 'text') {
        return item.text || '';
      } else if (item.content) {
        return this.extractTextFromContent(item.content);
      }
      return '';
    }).join('').trim();
  }

  /**
   * Estimate word count from content blocks
   */
  private estimateWordCount(content: any[]): number {
    if (!Array.isArray(content)) return 0;
    
    let wordCount = 0;
    
    content.forEach(block => {
      if (block.type === 'paragraph' || block.type === 'heading') {
        const text = this.extractTextFromContent(block.content || []);
        wordCount += text.split(/\s+/).filter(word => word.length > 0).length;
      } else if (block.type === 'codeBlock') {
        // Code blocks count as fewer "reading" words
        const text = this.extractTextFromContent(block.content || []);
        wordCount += Math.ceil(text.split(/\s+/).length * 0.3);
      }
    });
    
    return wordCount;
  }

  // ============================================================================
  // NEW: HIERARCHICAL CONTENT TOOL HANDLERS
  // ============================================================================

  /**
   * Handle content hierarchy retrieval
   */
  private async handleContentHierarchy(
    parameters: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    try {
      const { chunkId } = parameters;

      console.log('Content hierarchy request:', {
        chunkId,
        sessionId: context.sessionId
      });

      if (!chunkId) {
        throw new Error('Chunk ID is required');
      }

      // Get hierarchy using ContentSearchService
      const hierarchy = await this.contentSearchService.getContentHierarchy(chunkId);

      console.log('Content hierarchy completed:', {
        chunkId,
        ancestors: hierarchy.ancestors.length,
        descendants: hierarchy.descendants.length,
        siblings: hierarchy.siblings.length,
        sessionId: context.sessionId
      });

      return {
        success: true,
        data: hierarchy
      };

    } catch (error) {
      console.error('Content hierarchy failed:', error);
      throw new Error(`Content hierarchy retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle section search within content groups
   */
  private async handleSectionSearch(
    parameters: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    try {
      const { sectionGroup, query, maxTier = 4 } = parameters;

      console.log('Section search request:', {
        sectionGroup,
        query,
        maxTier,
        sessionId: context.sessionId
      });

      if (!sectionGroup || !query) {
        throw new Error('Section group and query are required');
      }

      // Search within section using ContentSearchService
      const results = await this.contentSearchService.searchWithinSection(sectionGroup, query, maxTier);

      console.log('Section search completed:', {
        sectionGroup,
        query,
        results: results.length,
        sessionId: context.sessionId
      });

      return {
        success: true,
        data: {
          items: results
        }
      };

    } catch (error) {
      console.error('Section search failed:', error);
      throw new Error(`Section search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle related content retrieval across tiers
   */
  private async handleRelatedContent(
    parameters: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    try {
      const { rootChunkId, includeTiers = [1, 2, 3] } = parameters;

      console.log('Related content request:', {
        rootChunkId,
        includeTiers,
        sessionId: context.sessionId
      });

      if (!rootChunkId) {
        throw new Error('Root chunk ID is required');
      }

      // Get related content using ContentSearchService
      const relatedContent = await this.contentSearchService.getRelatedContentAcrossTiers(rootChunkId, includeTiers);

      console.log('Related content completed:', {
        rootChunkId,
        summary: relatedContent.summary ? 'found' : 'none',
        keyPoints: relatedContent.keyPoints.length,
        details: relatedContent.details.length,
        fullContent: relatedContent.fullContent.length,
        sessionId: context.sessionId
      });

      return {
        success: true,
        data: relatedContent
      };

    } catch (error) {
      console.error('Related content failed:', error);
      throw new Error(`Related content retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const backendToolService = BackendToolService.getInstance();