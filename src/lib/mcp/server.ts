/**
 * MCP Server
 * 
 * Server-side MCP implementation that handles tool definitions,
 * client registration, and state synchronization.
 * Integrates with projectIndexer, contextManager, and reflinkManager services.
 */

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  NavigationState,
  MCPError
} from './types';
import { getServerToolDefinitions } from './server-tools';

class MCPServerImpl implements MCPServer {
  private registeredClients = new Set<string>();
  private clientStates = new Map<string, NavigationState>();
  private isInitialized = false;

  constructor() {
    // Initialize server
    this.initialize();
  }

  /**
   * Initialize the MCP server
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('MCP Server initializing...');
      this.isInitialized = true;
      console.log('MCP Server initialized with', this.getAvailableTools().length, 'tools');
    } catch (error) {
      console.error('Failed to initialize MCP Server:', error);
      throw error;
    }
  }

  /**
   * Get available tools
   */
  getAvailableTools(): MCPTool[] {
    return getServerToolDefinitions();
  }

  /**
   * Execute a tool (server-side processing)
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      // Route to appropriate handler based on tool name
      switch (toolCall.name) {
        case 'loadProjectContext':
          return await this.handleLoadProjectContext(toolCall.arguments);
        
        case 'loadUserProfile':
          return await this.handleLoadUserProfile(toolCall.arguments);
        
        case 'processJobSpec':
          return await this.handleProcessJobSpec(toolCall.arguments);
        
        case 'getNavigationHistory':
          return await this.handleGetNavigationHistory(toolCall.arguments);
        
        case 'reportUIState':
          return await this.handleReportUIState(toolCall.arguments);
        
        case 'searchProjects':
          return await this.handleSearchProjects(toolCall.arguments);
        
        case 'getProjectSummary':
          return await this.handleGetProjectSummary(toolCall.arguments);
        
        case 'analyzeUserIntent':
          return await this.handleAnalyzeUserIntent(toolCall.arguments);
        
        case 'generateNavigationSuggestions':
          return await this.handleGenerateNavigationSuggestions(toolCall.arguments);
        
        default:
          throw this.createMCPError('TOOL_NOT_FOUND', `Server tool '${toolCall.name}' not found`, toolCall.name);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error',
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    }
  }

  /**
   * Register a client
   */
  registerClient(clientId: string): void {
    this.registeredClients.add(clientId);
    console.log(`MCP Client registered: ${clientId}`);
  }

  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.registeredClients.delete(clientId);
    this.clientStates.delete(clientId);
    console.log(`MCP Client unregistered: ${clientId}`);
  }

  /**
   * Synchronize navigation state
   */
  async syncNavigationState(clientId: string, state: NavigationState): Promise<void> {
    this.clientStates.set(clientId, state);
    
    // TODO: Persist state to database if needed
    // TODO: Broadcast state changes to other interested parties
    
    console.log(`Navigation state synced for client: ${clientId}`);
  }

  /**
   * Get registered clients
   */
  getRegisteredClients(): string[] {
    return Array.from(this.registeredClients);
  }

  /**
   * Get client state
   */
  getClientState(clientId: string): NavigationState | undefined {
    return this.clientStates.get(clientId);
  }

  // Tool handlers
  private async handleLoadProjectContext(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { projectId, includeContent = false, includeMedia = false } = args;

      // For now, return a structured response that can be enhanced later
      // This will be integrated with the actual services once they're properly set up
      const contextData = {
        projectId,
        title: `Project ${projectId}`,
        briefSummary: 'Project context loading will be implemented with service integration',
        detailedSummary: 'Detailed project analysis and indexing integration pending',
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
        technologies: []
      };

      return {
        success: true,
        data: contextData,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to load project context: ${error}`, 'loadProjectContext');
    }
  }

  private async handleLoadUserProfile(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { includePrivate = false } = args;

      // For now, return a structured response that can be enhanced later
      // This will be integrated with the actual database queries once properly set up
      const profileData = {
        name: 'Portfolio Owner',
        title: 'Full-Stack Developer',
        bio: 'Experienced developer with expertise in modern web technologies',
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python'],
        experience: '5+ years of professional development experience',
        contact: {
          email: includePrivate ? 'contact@example.com' : undefined,
          linkedin: 'https://linkedin.com/in/developer',
          github: 'https://github.com/developer',
          website: 'https://portfolio.example.com'
        },
        location: 'Remote',
        availability: 'Available for new opportunities',
        interests: ['Web Development', 'AI/ML', 'Open Source'],
        education: 'Computer Science Degree',
        certifications: ['AWS Certified', 'React Certified']
      };

      return {
        success: true,
        data: profileData,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to load user profile: ${error}`, 'loadUserProfile');
    }
  }

  private async handleProcessJobSpec(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { jobSpec, analysisType = 'quick' } = args;

      // Get user profile for comparison
      const profileResult = await this.handleLoadUserProfile({ includePrivate: false });
      if (!profileResult.success) {
        throw new Error('Failed to load user profile for comparison');
      }

      const profile = profileResult.data;

      // Extract requirements from job spec (simple keyword matching)
      const jobRequirements = this.extractJobRequirements(jobSpec);
      
      // Analyze skills match
      const skillsAnalysis = this.analyzeSkillsMatch(profile.skills, jobRequirements.skills);
      
      // Analyze technology match using profile data
      const techAnalysis = this.analyzeTechnologyMatch(
        profile.skills, // Use profile skills as proxy for technologies
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
        strengths: skillsAnalysis.matches.concat(techAnalysis.matches),
        gaps: skillsAnalysis.gaps.concat(techAnalysis.gaps),
        recommendations,
        relevantProjects: [],
        timestamp: Date.now()
      };

      // Store job analysis for admin review (will be implemented later)
      // await this.storeJobAnalysis(analysisData);

      return {
        success: true,
        data: analysisData,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to process job spec: ${error}`, 'processJobSpec');
    }
  }

  private async handleGetNavigationHistory(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const clientId = args.sessionId || 'current';
      const clientState = this.clientStates.get(clientId);
      const limit = args.limit || 50;

      const history = clientState?.history.slice(-limit) || [];

      return {
        success: true,
        data: {
          sessionId: clientId,
          history,
          totalEntries: clientState?.history.length || 0
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to get navigation history: ${error}`, 'getNavigationHistory');
    }
  }

  private async handleReportUIState(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const state = args.state as NavigationState;
      const clientId = 'current'; // TODO: Get actual client ID
      
      await this.syncNavigationState(clientId, state);

      return {
        success: true,
        data: {
          clientId,
          stateReceived: true,
          timestamp: state.timestamp
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to report UI state: ${error}`, 'reportUIState');
    }
  }

  private async handleSearchProjects(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { query, tags, limit = 10 } = args;

      // For now, return mock search results that can be enhanced later
      // This will be integrated with the actual database and indexing once properly set up
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

      // Simple filtering by query and tags
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
        success: true,
        data: {
          query,
          tags,
          results: filteredResults.slice(0, limit),
          totalResults: filteredResults.length
        },
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to search projects: ${error}`, 'searchProjects');
    }
  }

  private async handleGetProjectSummary(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { includePrivate = false, maxProjects = 50 } = args;

      // For now, return mock project summary data that can be enhanced later
      // This will be integrated with the actual database queries once properly set up
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
          },
          {
            id: 'project-3',
            title: 'Python ML Pipeline',
            description: 'Machine learning data processing pipeline',
            tags: ['python', 'machine-learning', 'data'],
            lastUpdated: '2024-01-05',
            visibility: includePrivate ? 'PRIVATE' : 'PUBLIC'
          }
        ],
        topTags: ['react', 'typescript', 'nodejs', 'python', 'javascript', 'api', 'dashboard'],
        topTechnologies: ['react', 'typescript', 'nodejs', 'python', 'javascript', 'postgresql', 'docker'],
        projectsByVisibility: {
          public: includePrivate ? 10 : 12,
          private: includePrivate ? 2 : 0
        },
        lastUpdated: '2024-01-15'
      };

      return {
        success: true,
        data: summaryData,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to get project summary: ${error}`, 'getProjectSummary');
    }
  }

  private async handleAnalyzeUserIntent(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { userMessage, conversationHistory = [], currentContext = {} } = args;

      // Simple intent analysis using keyword matching and patterns
      const intent = this.classifyUserIntent(userMessage);
      const entities = this.extractEntities(userMessage);
      const confidence = this.calculateIntentConfidence(userMessage, intent, entities);

      // Analyze conversation context for better understanding
      const contextualInfo = this.analyzeConversationContext(conversationHistory, currentContext);

      // Generate suggested actions based on intent
      const suggestedActions = this.generateSuggestedActions(intent, entities, contextualInfo);

      const analysisData = {
        userMessage,
        intent: intent.type,
        confidence,
        entities,
        contextualInfo,
        suggestedActions,
        reasoning: intent.reasoning,
        conversationTurn: conversationHistory.length + 1
      };

      return {
        success: true,
        data: analysisData,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to analyze user intent: ${error}`, 'analyzeUserIntent');
    }
  }

  private async handleGenerateNavigationSuggestions(args: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { userIntent, currentLocation, availableProjects = [] } = args;

      // Get project summary for context
      const projectSummaryResult = await this.handleGetProjectSummary({ includePrivate: false });
      const projectSummary = projectSummaryResult.success ? projectSummaryResult.data : null;

      // Generate navigation suggestions based on intent
      const suggestions = [];

      // Intent-based navigation suggestions
      if (userIntent.includes('project') || userIntent.includes('work') || userIntent.includes('portfolio')) {
        // Find relevant projects
        const relevantProjects = this.findProjectsForIntent(
          userIntent,
          projectSummary?.recentProjects || availableProjects
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

      if (userIntent.includes('skill') || userIntent.includes('technology') || userIntent.includes('experience')) {
        suggestions.push({
          action: 'scrollToSection',
          target: 'skills-section',
          reason: 'User inquiring about technical skills and experience',
          confidence: 0.8,
          metadata: {
            sectionType: 'skills'
          }
        });
      }

      if (userIntent.includes('about') || userIntent.includes('background') || userIntent.includes('bio')) {
        suggestions.push({
          action: 'scrollToSection',
          target: 'about-section',
          reason: 'User wants to learn about background and experience',
          confidence: 0.85,
          metadata: {
            sectionType: 'about'
          }
        });
      }

      if (userIntent.includes('contact') || userIntent.includes('hire') || userIntent.includes('reach')) {
        suggestions.push({
          action: 'scrollToSection',
          target: 'contact-section',
          reason: 'User interested in making contact',
          confidence: 0.9,
          metadata: {
            sectionType: 'contact'
          }
        });
      }

      // Technology-specific suggestions
      const technologies = this.extractTechnologies(userIntent);
      if (technologies.length > 0) {
        const techProjects = this.findProjectsByTechnology(
          technologies,
          projectSummary?.recentProjects || []
        );

        techProjects.forEach(project => {
          suggestions.push({
            action: 'openProjectModal',
            target: project.id,
            reason: `Project showcasing ${technologies.join(', ')} technology`,
            confidence: 0.75,
            metadata: {
              projectTitle: project.title,
              matchedTechnologies: technologies
            }
          });
        });
      }

      // Sort suggestions by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      const suggestionData = {
        userIntent,
        currentLocation,
        suggestions: suggestions.slice(0, 5), // Limit to top 5 suggestions
        totalSuggestions: suggestions.length,
        analysisMetadata: {
          extractedTechnologies: technologies,
          intentKeywords: this.extractIntentKeywords(userIntent),
          contextFactors: {
            hasProjects: (projectSummary?.totalProjects || 0) > 0,
            currentLocation
          }
        }
      };

      return {
        success: true,
        data: suggestionData,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        }
      };
    } catch (error) {
      throw this.createMCPError('EXECUTION_FAILED', `Failed to generate navigation suggestions: ${error}`, 'generateNavigationSuggestions');
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

    // Extract skills (broader terms)
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
    // Weight different factors
    const skillsWeight = 0.4;
    const techWeight = 0.4;
    const experienceWeight = 0.2;

    const skillsScore = skillsAnalysis.score * skillsWeight;
    const techScore = techAnalysis.score * techWeight;
    
    // Simple experience scoring (placeholder)
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

    // Skill-based recommendations
    if (skillsAnalysis.matches.length > 0) {
      recommendations.push(`Highlight your ${skillsAnalysis.matches.join(', ')} experience`);
    }

    // Technology-based recommendations
    if (techAnalysis.matches.length > 0) {
      recommendations.push(`Emphasize projects using ${techAnalysis.matches.join(', ')}`);
    }

    // Gap recommendations
    if (skillsAnalysis.gaps.length > 0) {
      recommendations.push(`Consider learning: ${skillsAnalysis.gaps.slice(0, 3).join(', ')}`);
    }

    // Project-specific recommendations
    if (projectSummary?.recentProjects) {
      const relevantProjects = projectSummary.recentProjects
        .filter((project: any) => 
          project.tags.some((tag: string) => 
            techAnalysis.matches.includes(tag.toLowerCase())
          )
        )
        .slice(0, 2);

      if (relevantProjects.length > 0) {
        recommendations.push(
          `Showcase these relevant projects: ${relevantProjects.map((p: any) => p.title).join(', ')}`
        );
      }
    }

    return recommendations;
  }

  private findRelevantProjects(projects: any[], jobRequirements: any): any[] {
    return projects
      .filter(project => {
        const projectTags = project.tags || [];
        return jobRequirements.technologies.some((tech: string) =>
          projectTags.some((tag: string) => 
            tag.toLowerCase().includes(tech.toLowerCase())
          )
        );
      })
      .slice(0, 3);
  }

  private async storeJobAnalysis(analysisData: any): Promise<void> {
    try {
      // TODO: Store job analysis in database for admin review
      // This will be implemented once database integration is properly set up
      console.log('Job analysis completed:', {
        matchScore: analysisData.matchScore,
        analysisType: analysisData.analysisType,
        timestamp: analysisData.timestamp
      });
    } catch (error) {
      // Don't fail the analysis if storage fails
      console.warn('Failed to store job analysis:', error);
    }
  }

  /**
   * Helper methods for intent analysis
   */
  private classifyUserIntent(message: string): { type: string; reasoning: string } {
    const text = message.toLowerCase();

    // Project inquiry patterns
    if (text.match(/\b(project|work|portfolio|example|show|demo)\b/)) {
      return {
        type: 'project_inquiry',
        reasoning: 'User asking about projects or portfolio work'
      };
    }

    // Skills inquiry patterns
    if (text.match(/\b(skill|technology|tech|experience|know|can you|able)\b/)) {
      return {
        type: 'skills_inquiry',
        reasoning: 'User asking about technical skills or capabilities'
      };
    }

    // About/background patterns
    if (text.match(/\b(about|background|bio|who|tell me|yourself)\b/)) {
      return {
        type: 'about_inquiry',
        reasoning: 'User wants to learn about background and experience'
      };
    }

    // Contact/hiring patterns
    if (text.match(/\b(contact|hire|available|reach|email|phone)\b/)) {
      return {
        type: 'contact_inquiry',
        reasoning: 'User interested in making contact or hiring'
      };
    }

    // Job analysis patterns
    if (text.match(/\b(job|position|role|requirement|match|fit)\b/)) {
      return {
        type: 'job_analysis',
        reasoning: 'User wants job specification analysis'
      };
    }

    // Navigation patterns
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

    // Extract project types
    const projectTypes = [];
    if (text.match(/\b(web|website|frontend|backend|fullstack)\b/)) {
      projectTypes.push('web development');
    }
    if (text.match(/\b(mobile|app|ios|android)\b/)) {
      projectTypes.push('mobile development');
    }
    if (text.match(/\b(api|backend|server|microservice)\b/)) {
      projectTypes.push('api development');
    }
    if (projectTypes.length > 0) {
      entities.projectTypes = projectTypes;
    }

    // Extract actions
    const actions = [];
    if (text.match(/\b(show|display|open)\b/)) actions.push('show');
    if (text.match(/\b(explain|tell|describe)\b/)) actions.push('explain');
    if (text.match(/\b(find|search|look)\b/)) actions.push('search');
    if (actions.length > 0) {
      entities.actions = actions;
    }

    return entities;
  }

  private calculateIntentConfidence(message: string, intent: any, entities: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on specific keywords
    const text = message.toLowerCase();
    const intentKeywords = this.getIntentKeywords(intent.type);
    
    const matchedKeywords = intentKeywords.filter(keyword => 
      text.includes(keyword)
    );
    
    confidence += (matchedKeywords.length / intentKeywords.length) * 0.3;

    // Increase confidence based on entities
    if (Object.keys(entities).length > 0) {
      confidence += 0.2;
    }

    // Decrease confidence for very short messages
    if (message.length < 10) {
      confidence -= 0.2;
    }

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  private getIntentKeywords(intentType: string): string[] {
    const keywordMap: Record<string, string[]> = {
      project_inquiry: ['project', 'work', 'portfolio', 'example', 'show', 'demo'],
      skills_inquiry: ['skill', 'technology', 'tech', 'experience', 'know', 'can'],
      about_inquiry: ['about', 'background', 'bio', 'who', 'tell', 'yourself'],
      contact_inquiry: ['contact', 'hire', 'available', 'reach', 'email'],
      job_analysis: ['job', 'position', 'role', 'requirement', 'match', 'fit'],
      navigation_request: ['show', 'open', 'go', 'navigate', 'find', 'where']
    };

    return keywordMap[intentType] || [];
  }

  private analyzeConversationContext(history: any[], currentContext: any): any {
    return {
      conversationLength: history.length,
      recentTopics: this.extractRecentTopics(history),
      currentModal: currentContext.currentModal,
      currentSection: currentContext.currentSection,
      hasAskedAboutProjects: history.some((msg: any) => 
        msg.content?.toLowerCase().includes('project')
      ),
      hasAskedAboutSkills: history.some((msg: any) => 
        msg.content?.toLowerCase().includes('skill')
      )
    };
  }

  private extractRecentTopics(history: any[]): string[] {
    const recentMessages = history.slice(-5); // Last 5 messages
    const topics = new Set<string>();

    recentMessages.forEach(msg => {
      if (msg.content) {
        const text = msg.content.toLowerCase();
        if (text.includes('project')) topics.add('projects');
        if (text.includes('skill')) topics.add('skills');
        if (text.includes('experience')) topics.add('experience');
        if (text.includes('technology')) topics.add('technology');
      }
    });

    return Array.from(topics);
  }

  private generateSuggestedActions(intent: any, entities: any, context: any): string[] {
    const actions = [];

    switch (intent.type) {
      case 'project_inquiry':
        actions.push('searchProjects', 'openProjectModal');
        if (entities.technologies) {
          actions.push('highlightText');
        }
        break;
      
      case 'skills_inquiry':
        actions.push('scrollToSection', 'highlightText');
        break;
      
      case 'about_inquiry':
        actions.push('scrollToSection');
        break;
      
      case 'contact_inquiry':
        actions.push('scrollToSection', 'focusElement');
        break;
      
      case 'navigation_request':
        actions.push('navigateToProject', 'scrollToSection', 'openProjectModal');
        break;
      
      default:
        actions.push('searchProjects');
    }

    return actions;
  }

  /**
   * Helper methods for navigation suggestions
   */
  private findProjectsForIntent(intent: string, projects: any[]): any[] {
    const intentLower = intent.toLowerCase();
    const technologies = this.extractTechnologies(intentLower);
    
    return projects
      .map(project => {
        let confidence = 0.3; // Base confidence
        let matchReason = '';

        // Technology matching
        if (technologies.length > 0) {
          const projectTags = (project.tags || []).map((tag: string) => tag.toLowerCase());
          const techMatches = technologies.filter(tech => 
            projectTags.some(tag => tag.includes(tech) || tech.includes(tag))
          );
          
          if (techMatches.length > 0) {
            confidence += 0.4 * (techMatches.length / technologies.length);
            matchReason = `${techMatches.join(', ')} technology`;
          }
        }

        // Title/description matching
        const projectText = (project.title + ' ' + (project.description || '')).toLowerCase();
        const intentWords = intentLower.split(/\s+/).filter(word => word.length > 3);
        const titleMatches = intentWords.filter(word => projectText.includes(word));
        
        if (titleMatches.length > 0) {
          confidence += 0.3 * (titleMatches.length / intentWords.length);
          if (matchReason) {
            matchReason += ` and ${titleMatches.join(', ')} keywords`;
          } else {
            matchReason = `${titleMatches.join(', ')} keywords`;
          }
        }

        return {
          ...project,
          confidence,
          matchReason: matchReason || 'general relevance'
        };
      })
      .filter(project => project.confidence > 0.4)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  private findProjectsByTechnology(technologies: string[], projects: any[]): any[] {
    return projects
      .filter(project => {
        const projectTags = (project.tags || []).map((tag: string) => tag.toLowerCase());
        return technologies.some(tech => 
          projectTags.some(tag => tag.includes(tech) || tech.includes(tag))
        );
      })
      .slice(0, 2);
  }

  private extractTechnologies(text: string): string[] {
    const techPatterns = [
      /\b(javascript|typescript|python|java|c\+\+|c#|php|ruby|go|rust|swift|kotlin)\b/g,
      /\b(react|vue|angular|svelte|next\.?js|nuxt|express|django|flask|spring|laravel)\b/g,
      /\b(mysql|postgresql|mongodb|redis|sqlite|firebase|supabase)\b/g,
      /\b(aws|azure|gcp|docker|kubernetes|vercel|netlify|heroku)\b/g
    ];

    const technologies = new Set<string>();
    techPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => technologies.add(match.toLowerCase()));
      }
    });

    return Array.from(technologies);
  }

  private extractIntentKeywords(intent: string): string[] {
    return intent.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Create MCP error
   */
  private createMCPError(code: MCPError['code'], message: string, toolName?: string): MCPError {
    const error = new Error(message) as MCPError;
    error.code = code;
    error.toolName = toolName;
    return error;
  }
}

// Create singleton instance
const mcpServer = new MCPServerImpl();

// Export server instance and class
export { mcpServer, MCPServerImpl };
export type { MCPServer };