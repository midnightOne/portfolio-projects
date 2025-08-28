/**
 * Context Manager Service
 * Intelligent context building for AI conversations with session caching and optimization
 * Integrates with Data & API Layer for public project access and portfolio owner profile information
 */

import { projectIndexer, ProjectIndex, IndexedSection } from '@/lib/services/project-indexer';
import { contentSourceManager } from './content-source-manager';

export interface ContextSource {
  id: string;
  type: 'project' | 'about' | 'resume' | 'custom';
  title: string;
  enabled: boolean;
  summary: string;
  lastUpdated: Date;
  priority: number; // 0-1, higher = more important
}

export interface RelevantContent {
  id: string;
  type: 'project' | 'about' | 'resume' | 'experience' | 'skills' | 'custom';
  title: string;
  content: string;
  summary: string;
  relevanceScore: number; // 0-1
  keywords: string[];
  projectId?: string;
  sectionId?: string;
}

export interface CachedContext {
  sessionId: string;
  context: string;
  sources: ContextSource[];
  query: string;
  relevantContent: RelevantContent[];
  tokenCount: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface ContextBuildOptions {
  maxTokens?: number;
  includeProjects?: boolean;
  includeAbout?: boolean;
  includeResume?: boolean;
  prioritizeRecent?: boolean;
  minRelevanceScore?: number;
}

export interface ProfileInfo {
  name: string;
  title: string;
  bio: string;
  skills: string[];
  experience: string;
  contact: {
    email?: string;
    linkedin?: string;
    github?: string;
  };
}

/**
 * Main ContextManager service class
 */
export class ContextManager {
  private static instance: ContextManager;
  private contextCache = new Map<string, CachedContext>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly DEFAULT_MAX_TOKENS = 4000;
  private readonly MIN_RELEVANCE_THRESHOLD = 0.1;

  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  /**
   * Build intelligent context for AI conversations
   */
  async buildContext(
    sources: ContextSource[], 
    query: string, 
    options: ContextBuildOptions = {}
  ): Promise<string> {
    try {
      const {
        maxTokens = this.DEFAULT_MAX_TOKENS,
        includeProjects = true,
        includeAbout = true,
        includeResume = true,
        prioritizeRecent = true,
        minRelevanceScore = this.MIN_RELEVANCE_THRESHOLD
      } = options;

      // Auto-discover and initialize content sources
      await contentSourceManager.autoDiscoverSources();

      // Use the flexible content source system for searching
      const relevantContent = await contentSourceManager.searchContent(query, {
        maxResults: 50,
        minRelevanceScore,
        sortBy: 'relevance'
      });

      // Prioritize content based on relevance and recency
      const prioritizedContent = this.prioritizeContent(relevantContent, query, prioritizeRecent);

      // Build context string within token limits
      const context = this.buildContextString(prioritizedContent, maxTokens);

      return context;

    } catch (error) {
      console.error('Error building context:', error);
      throw error;
    }
  }

  /**
   * Get cached context for a session
   */
  async getCachedContext(sessionId: string): Promise<CachedContext | null> {
    const cached = this.contextCache.get(sessionId);
    
    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cached.expiresAt.getTime()) {
      this.contextCache.delete(sessionId);
      return null;
    }

    return cached;
  }

  /**
   * Set cached context for a session
   */
  async setCachedContext(sessionId: string, context: CachedContext): Promise<void> {
    // Set expiration time
    context.expiresAt = new Date(Date.now() + this.CACHE_TTL);
    
    // Store in cache
    this.contextCache.set(sessionId, context);

    // Clean up expired entries periodically
    this.cleanupExpiredCache();
  }

  /**
   * Search for relevant content across all sources
   */
  async searchRelevantContent(
    query: string,
    options: {
      includeProjects?: boolean;
      includeAbout?: boolean;
      includeResume?: boolean;
      minRelevanceScore?: number;
    } = {}
  ): Promise<RelevantContent[]> {
    const {
      includeProjects = true,
      includeAbout = true,
      includeResume = true,
      minRelevanceScore = this.MIN_RELEVANCE_THRESHOLD
    } = options;

    const relevantContent: RelevantContent[] = [];

    try {
      // Search project content
      if (includeProjects) {
        const projectContent = await this.searchProjectContent(query, minRelevanceScore);
        relevantContent.push(...projectContent);
      }

      // Search about/profile content
      if (includeAbout) {
        const aboutContent = await this.searchAboutContent(query, minRelevanceScore);
        relevantContent.push(...aboutContent);
      }

      // Search resume content (if available)
      if (includeResume) {
        const resumeContent = await this.searchResumeContent(query, minRelevanceScore);
        relevantContent.push(...resumeContent);
      }

      return relevantContent;

    } catch (error) {
      console.error('Error searching relevant content:', error);
      return [];
    }
  }

  /**
   * Search project content using the project indexer
   */
  private async searchProjectContent(query: string, minRelevanceScore: number): Promise<RelevantContent[]> {
    try {
      // Get all public projects
      const response = await fetch('/api/projects?status=PUBLISHED&visibility=PUBLIC&limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch public projects');
      }

      const projectsData = await response.json();
      const projects = projectsData.data?.projects || [];
      const projectIds = projects.map((p: any) => p.id);

      if (projectIds.length === 0) {
        return [];
      }

      // Search using the project indexer
      const relevantSections = await projectIndexer.searchRelevantContent(
        projectIds,
        query,
        20 // Limit to top 20 sections
      );

      // Convert to RelevantContent format
      const relevantContent: RelevantContent[] = [];

      for (const section of relevantSections) {
        // Calculate relevance score
        const relevanceScore = this.calculateRelevanceScore(section, query);
        
        if (relevanceScore >= minRelevanceScore) {
          // Find the project this section belongs to
          const project = projects.find((p: any) => p.id === section.projectId);

          relevantContent.push({
            id: section.id,
            type: 'project',
            title: section.title,
            content: section.content,
            summary: section.summary,
            relevanceScore,
            keywords: section.keywords,
            projectId: section.projectId,
            sectionId: section.id
          });
        }
      }

      return relevantContent;

    } catch (error) {
      console.error('Error searching project content:', error);
      return [];
    }
  }

  /**
   * Search about/profile content
   */
  private async searchAboutContent(query: string, minRelevanceScore: number): Promise<RelevantContent[]> {
    try {
      // Get homepage config which contains about section
      const response = await fetch('/api/homepage-config-public');
      if (!response.ok) {
        throw new Error('Failed to fetch homepage config');
      }

      const configData = await response.json();
      const config = configData.data?.config;
      
      if (!config) {
        return [];
      }

      // Find about section
      const aboutSection = config.sections?.find((section: any) => 
        section.type === 'about' && section.enabled
      );

      if (!aboutSection) {
        return [];
      }

      const aboutConfig = aboutSection.config || {};
      const aboutContent = [
        aboutConfig.content || '',
        ...(aboutConfig.skills || [])
      ].join(' ');

      // Calculate relevance score
      const relevanceScore = this.calculateTextRelevanceScore(aboutContent, query);

      if (relevanceScore >= minRelevanceScore) {
        return [{
          id: 'about-main',
          type: 'about',
          title: 'About',
          content: aboutContent,
          summary: aboutConfig.content || '',
          relevanceScore,
          keywords: aboutConfig.skills || []
        }];
      }

      return [];

    } catch (error) {
      console.error('Error searching about content:', error);
      return [];
    }
  }

  /**
   * Search resume content (placeholder - would need resume data source)
   */
  private async searchResumeContent(query: string, minRelevanceScore: number): Promise<RelevantContent[]> {
    // Placeholder for resume content search
    // In a real implementation, this would search resume data from a database or file
    return [];
  }

  /**
   * Calculate relevance score for indexed sections
   */
  private calculateRelevanceScore(section: IndexedSection, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (queryTerms.length === 0) return 0;

    let score = 0;
    const content = (section.title + ' ' + section.content + ' ' + section.keywords.join(' ')).toLowerCase();

    queryTerms.forEach(term => {
      // Exact matches in title get highest score
      if (section.title.toLowerCase().includes(term)) {
        score += 0.5;
      }
      
      // Matches in keywords get high score
      if (section.keywords.some(keyword => keyword.includes(term))) {
        score += 0.3;
      }
      
      // Matches in content get base score
      const termCount = (content.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(termCount * 0.1, 0.4);
    });

    // Factor in section importance
    return Math.min(score * section.importance, 1);
  }

  /**
   * Calculate relevance score for plain text content
   */
  private calculateTextRelevanceScore(content: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (queryTerms.length === 0) return 0;

    let score = 0;
    const lowerContent = content.toLowerCase();

    queryTerms.forEach(term => {
      const termCount = (lowerContent.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(termCount * 0.2, 0.6);
    });

    return Math.min(score, 1);
  }

  /**
   * Prioritize content based on query relevance and other factors
   */
  prioritizeContent(
    content: RelevantContent[], 
    query: string, 
    prioritizeRecent: boolean = true
  ): RelevantContent[] {
    return content.sort((a, b) => {
      // Primary sort by relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      // Secondary sort by content type priority
      const typePriority: Record<string, number> = { 
        about: 5, 
        project: 4, 
        experience: 3, 
        skills: 2, 
        resume: 1, 
        custom: 0 
      };
      const aPriority = typePriority[a.type] || 0;
      const bPriority = typePriority[b.type] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Tertiary sort by title length (shorter titles often more focused)
      return a.title.length - b.title.length;
    });
  }

  /**
   * Build context string within token limits
   */
  private buildContextString(content: RelevantContent[], maxTokens: number): string {
    const contextParts: string[] = [];
    let currentTokens = 0;

    // Add a header
    contextParts.push('=== PORTFOLIO CONTEXT ===\n');
    currentTokens += this.estimateTokens('=== PORTFOLIO CONTEXT ===\n');

    for (const item of content) {
      // Build content section
      const section = this.buildContentSection(item);
      const sectionTokens = this.estimateTokens(section);

      // Check if adding this section would exceed token limit
      if (currentTokens + sectionTokens > maxTokens) {
        // Try to add a truncated version
        const truncatedSection = this.truncateSection(section, maxTokens - currentTokens);
        if (truncatedSection) {
          contextParts.push(truncatedSection);
        }
        break;
      }

      contextParts.push(section);
      currentTokens += sectionTokens;
    }

    return contextParts.join('\n');
  }

  /**
   * Build a content section for context
   */
  private buildContentSection(item: RelevantContent): string {
    const parts = [
      `## ${item.title} (${item.type.toUpperCase()})`,
      `Relevance: ${(item.relevanceScore * 100).toFixed(1)}%`,
      ''
    ];

    if (item.summary && item.summary !== item.content) {
      parts.push(`Summary: ${item.summary}`);
      parts.push('');
    }

    parts.push(`Content: ${item.content}`);

    if (item.keywords.length > 0) {
      parts.push(`Keywords: ${item.keywords.join(', ')}`);
    }

    parts.push('---');
    parts.push('');

    return parts.join('\n');
  }

  /**
   * Truncate a section to fit within token limits
   */
  private truncateSection(section: string, maxTokens: number): string | null {
    if (maxTokens < 50) return null; // Not enough space for meaningful content

    const lines = section.split('\n');
    const truncatedLines: string[] = [];
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokens(line + '\n');
      
      if (currentTokens + lineTokens > maxTokens) {
        // Add truncation indicator
        if (maxTokens - currentTokens > 20) {
          truncatedLines.push('[Content truncated due to length...]');
        }
        break;
      }

      truncatedLines.push(line);
      currentTokens += lineTokens;
    }

    return truncatedLines.length > 0 ? truncatedLines.join('\n') : null;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Optimize context size to fit within token limits
   */
  optimizeContextSize(context: string, maxTokens: number): string {
    const currentTokens = this.estimateTokens(context);
    
    if (currentTokens <= maxTokens) {
      return context;
    }

    // Calculate how much to truncate
    const targetLength = Math.floor((context.length * maxTokens) / currentTokens);
    
    // Try to truncate at sentence boundaries
    const sentences = context.split(/[.!?]+/);
    let optimizedContext = '';
    let currentLength = 0;

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence + '.';
      
      if (currentLength + sentenceWithPunctuation.length > targetLength) {
        break;
      }

      optimizedContext += sentenceWithPunctuation;
      currentLength += sentenceWithPunctuation.length;
    }

    // If we couldn't fit any complete sentences, do a hard truncate
    if (optimizedContext.length === 0) {
      optimizedContext = context.substring(0, targetLength) + '...';
    }

    return optimizedContext;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [sessionId, cached] of this.contextCache.entries()) {
      if (now > cached.expiresAt.getTime()) {
        this.contextCache.delete(sessionId);
      }
    }
  }

  /**
   * Clear cache for a specific session
   */
  clearSessionCache(sessionId: string): void {
    this.contextCache.delete(sessionId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.contextCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; sessions: string[]; totalTokens: number } {
    let totalTokens = 0;
    
    for (const cached of this.contextCache.values()) {
      totalTokens += cached.tokenCount;
    }

    return {
      size: this.contextCache.size,
      sessions: Array.from(this.contextCache.keys()),
      totalTokens
    };
  }

  /**
   * Build context with caching
   */
  async buildContextWithCaching(
    sessionId: string,
    sources: ContextSource[],
    query: string,
    options: ContextBuildOptions = {}
  ): Promise<{ context: string; fromCache: boolean }> {
    // Check cache first
    const cached = await this.getCachedContext(sessionId);
    
    if (cached && cached.query === query) {
      return { context: cached.context, fromCache: true };
    }

    // Build new context
    const context = await this.buildContext(sources, query, options);
    const relevantContent = await this.searchRelevantContent(query, options);
    
    // Cache the result
    const cachedContext: CachedContext = {
      sessionId,
      context,
      sources,
      query,
      relevantContent,
      tokenCount: this.estimateTokens(context),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.CACHE_TTL)
    };

    await this.setCachedContext(sessionId, cachedContext);

    return { context, fromCache: false };
  }
}

// Export singleton instance
export const contextManager = ContextManager.getInstance();