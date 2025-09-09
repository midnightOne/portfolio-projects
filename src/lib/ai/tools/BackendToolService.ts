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

  private constructor() {
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
   * Execute a server-side tool
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    sessionId: string,
    accessLevel: 'basic' | 'limited' | 'premium',
    reflinkId?: string,
    userId?: string
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
        userId
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
      // Use context injector to load filtered project context
      const filteredContext = await contextInjector.loadFilteredContext(
        context.sessionId,
        `Load project context for ${projectId}`,
        context.reflinkId,
        {
          projectId,
          includeContent,
          includeMedia,
          includeTechnicalDetails,
          accessLevel: context.accessLevel
        }
      );

      // For now, return structured mock data that can be enhanced with real project data
      const contextData = {
        projectId,
        title: `Project ${projectId}`,
        briefSummary: 'Project context loaded with access control filtering',
        detailedSummary: filteredContext.publicContext || 'Detailed project analysis available',
        keyTechnologies: ['javascript', 'typescript', 'react'],
        mainTopics: ['web development', 'frontend'],
        contentStructure: {
          totalSections: 0,
          headingHierarchy: [],
          contentTypes: [],
          estimatedReadTime: 0
        },
        sections: includeContent ? [] : undefined,
        mediaContext: includeMedia ? [] : undefined,
        keywords: [],
        topics: [],
        technologies: [],
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId
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
      // Use context injector to get filtered profile data
      const filteredContext = await contextInjector.loadFilteredContext(
        context.sessionId,
        'Load user profile information',
        context.reflinkId,
        {
          includePrivate: includePrivate && context.accessLevel === 'premium',
          includeSkills,
          includeExperience,
          accessLevel: context.accessLevel
        }
      );

      // Return structured profile data with access control
      const profileData = {
        name: 'Portfolio Owner',
        title: 'Full-Stack Developer',
        bio: 'Experienced developer with expertise in modern web technologies',
        skills: includeSkills ? ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python'] : [],
        experience: includeExperience ? '5+ years of professional development experience' : undefined,
        contact: {
          email: includePrivate && context.accessLevel === 'premium' ? 'contact@example.com' : undefined,
          linkedin: 'https://linkedin.com/in/developer',
          github: 'https://github.com/developer',
          website: 'https://portfolio.example.com'
        },
        location: 'Remote',
        availability: 'Available for new opportunities',
        interests: ['Web Development', 'AI/ML', 'Open Source'],
        education: 'Computer Science Degree',
        certifications: ['AWS Certified', 'React Certified'],
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId
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
      // Use context injector for access-controlled project search
      const filteredContext = await contextInjector.loadFilteredContext(
        context.sessionId,
        `Search projects: ${query}`,
        context.reflinkId,
        {
          searchQuery: query,
          tags,
          category,
          limit,
          includeContent: includeContent && context.accessLevel !== 'basic',
          accessLevel: context.accessLevel
        }
      );

      // Mock search results that can be enhanced with real project indexing
      const mockResults = [
        {
          id: 'project-1',
          title: 'React Dashboard Application',
          description: 'Modern dashboard built with React and TypeScript',
          tags: ['react', 'typescript', 'dashboard'],
          relevanceScore: 0.95,
          matchingSections: [
            {
              title: 'Technical Implementation',
              summary: 'Built using React hooks and TypeScript for type safety',
              importance: 0.9
            }
          ]
        },
        {
          id: 'project-2',
          title: 'Node.js API Gateway',
          description: 'Microservices API gateway with authentication',
          tags: ['nodejs', 'api', 'microservices'],
          relevanceScore: 0.78,
          matchingSections: [
            {
              title: 'Architecture Overview',
              summary: 'RESTful API with JWT authentication and rate limiting',
              importance: 0.8
            }
          ]
        }
      ];

      // Apply filtering based on query and tags
      let filteredResults = mockResults;

      if (query) {
        const queryLower = query.toLowerCase();
        filteredResults = mockResults.filter(project =>
          project.title.toLowerCase().includes(queryLower) ||
          project.description.toLowerCase().includes(queryLower) ||
          project.tags.some(tag => tag.toLowerCase().includes(queryLower))
        );
      }

      if (tags && tags.length > 0) {
        filteredResults = filteredResults.filter(project =>
          project.tags.some(tag => tags.includes(tag))
        );
      }

      return {
        query,
        tags,
        category,
        results: filteredResults.slice(0, limit),
        totalResults: filteredResults.length,
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId
      };

    } catch (error) {
      throw new Error(`Failed to search projects: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async handleGetProjectSummary(
    args: any,
    context: ServerToolExecutionContext
  ): Promise<any> {
    const { includePrivate = false, maxProjects = 20, sortBy = 'date' } = args;

    try {
      // Use context injector for access-controlled project summary
      const filteredContext = await contextInjector.loadFilteredContext(
        context.sessionId,
        'Get project summary',
        context.reflinkId,
        {
          includePrivate: includePrivate && context.accessLevel === 'premium',
          maxProjects,
          sortBy,
          accessLevel: context.accessLevel
        }
      );

      // Mock project summary data
      const summaryData = {
        totalProjects: 12,
        categories: {
          'web development': 8,
          'mobile development': 2,
          'api development': 4,
          'artificial intelligence': 3
        },
        recentProjects: [
          {
            id: 'project-1',
            title: 'React Dashboard Application',
            description: 'Modern dashboard built with React and TypeScript',
            tags: ['react', 'typescript', 'dashboard'],
            lastUpdated: '2024-01-15',
            visibility: 'PUBLIC'
          },
          {
            id: 'project-2',
            title: 'Node.js API Gateway',
            description: 'Microservices API gateway with authentication',
            tags: ['nodejs', 'api', 'microservices'],
            lastUpdated: '2024-01-10',
            visibility: 'PUBLIC'
          }
        ],
        topTags: ['react', 'typescript', 'nodejs', 'python', 'javascript', 'api', 'dashboard'],
        topTechnologies: ['react', 'typescript', 'nodejs', 'python', 'javascript', 'postgresql', 'docker'],
        projectsByVisibility: {
          public: includePrivate && context.accessLevel === 'premium' ? 10 : 12,
          private: includePrivate && context.accessLevel === 'premium' ? 2 : 0
        },
        lastUpdated: '2024-01-15',
        accessLevel: context.accessLevel,
        filteredForReflink: !!context.reflinkId
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
}

// Export singleton instance
export const backendToolService = BackendToolService.getInstance();