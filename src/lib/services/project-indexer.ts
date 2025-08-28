/**
 * Project Indexer Service
 * Generates searchable summaries and indexes for AI context management
 * Integrates with Rich Content System's Tiptap structure and Media Management System
 */

import { prisma } from '@/lib/database/connection';
import { tiptapToMarkdown, tiptapToPlainText, TiptapContentData } from '@/lib/tiptap-markdown-converter';
import { JSONContent } from '@tiptap/react';

export interface ProjectIndex {
  projectId: string;
  summary: string;
  sections: IndexedSection[];
  keywords: string[];
  topics: string[];
  technologies: string[];
  mediaContext: MediaContext[];
  lastUpdated: Date;
  contentHash: string; // For change detection
}

export interface IndexedSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  markdownContent: string;
  startOffset: number;
  endOffset: number;
  keywords: string[];
  importance: number; // 0-1 relevance score
  nodeType: string; // Tiptap node type
  depth: number; // Heading depth for hierarchy
  projectId?: string; // Track which project this section belongs to
}

export interface MediaContext {
  id: string;
  type: 'image' | 'video' | 'carousel' | 'interactive' | 'download';
  title?: string;
  description?: string;
  altText?: string;
  url?: string;
  context: string; // Surrounding content context
  relevanceScore: number;
}

export interface ProjectSummary {
  projectId: string;
  title: string;
  briefSummary: string;
  detailedSummary: string;
  keyTechnologies: string[];
  mainTopics: string[];
  contentStructure: ContentStructure;
  mediaOverview: MediaOverview;
}

export interface ContentStructure {
  totalSections: number;
  headingHierarchy: HeadingNode[];
  contentTypes: string[];
  estimatedReadTime: number;
}

export interface HeadingNode {
  level: number;
  title: string;
  sectionId: string;
  children: HeadingNode[];
}

export interface MediaOverview {
  totalImages: number;
  totalVideos: number;
  hasCarousels: boolean;
  hasInteractiveContent: boolean;
  hasDownloads: boolean;
  mediaDescriptions: string[];
}

/**
 * Main ProjectIndexer service class
 */
export class ProjectIndexer {
  private static instance: ProjectIndexer;
  private indexCache = new Map<string, ProjectIndex>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  static getInstance(): ProjectIndexer {
    if (!ProjectIndexer.instance) {
      ProjectIndexer.instance = new ProjectIndexer();
    }
    return ProjectIndexer.instance;
  }

  /**
   * Generate or update index for a specific project
   */
  async indexProject(projectId: string): Promise<ProjectIndex> {
    try {
      // Check cache first
      const cached = this.indexCache.get(projectId);
      if (cached && Date.now() - cached.lastUpdated.getTime() < this.CACHE_TTL) {
        return cached;
      }

      // Fetch project data with all related content
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          articleContent: true,
          mediaItems: {
            orderBy: { displayOrder: 'asc' }
          },
          carousels: {
            include: {
              images: {
                include: {
                  mediaItem: true
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          interactiveExamples: {
            orderBy: { displayOrder: 'asc' }
          },
          downloadableFiles: {
            orderBy: { uploadDate: 'desc' }
          },
          externalLinks: {
            orderBy: { order: 'asc' }
          },
          tags: true
        }
      });

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Generate content hash for change detection
      const contentHash = this.generateContentHash(project);

      // Check if we have a cached version with same content hash
      if (cached && cached.contentHash === contentHash) {
        return cached;
      }

      // Parse Tiptap content
      const tiptapContent = project.articleContent?.jsonContent as TiptapContentData | null;
      
      // Generate sections from Tiptap structure
      const sections = tiptapContent ? this.extractSections(tiptapContent, projectId) : [];
      
      // Extract keywords and topics
      const { keywords, topics, technologies } = this.extractKeywordsAndTopics(
        project,
        sections,
        tiptapContent
      );

      // Generate media context
      const mediaContext = this.extractMediaContext(project, tiptapContent);

      // Create project summary
      const summary = this.generateProjectSummary(project, sections, mediaContext);

      const projectIndex: ProjectIndex = {
        projectId,
        summary,
        sections,
        keywords,
        topics,
        technologies,
        mediaContext,
        lastUpdated: new Date(),
        contentHash
      };

      // Cache the result
      this.indexCache.set(projectId, projectIndex);

      // Store in database for persistence (optional - for analytics)
      await this.storeIndexInDatabase(projectIndex);

      return projectIndex;

    } catch (error) {
      console.error(`Error indexing project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Extract sections from Tiptap content structure
   */
  private extractSections(content: TiptapContentData, projectId: string): IndexedSection[] {
    const sections: IndexedSection[] = [];
    let currentOffset = 0;
    let sectionCounter = 0;

    const processNode = (node: JSONContent, depth: number = 0): void => {
      if (!node.type) return;

      const nodeStart = currentOffset;
      let nodeContent = '';
      let nodeMarkdown = '';

      // Extract text content and markdown
      if (node.type === 'text') {
        nodeContent = node.text || '';
        nodeMarkdown = nodeContent;
        currentOffset += nodeContent.length;
      } else {
        // For non-text nodes, convert to markdown
        nodeMarkdown = tiptapToMarkdown({ type: 'doc', content: [node] });
        nodeContent = tiptapToPlainText({ type: 'doc', content: [node] });
        currentOffset += nodeContent.length;
      }

      // Create sections for important content blocks
      if (this.shouldCreateSection(node)) {
        const sectionId = `section-${++sectionCounter}`;
        const title = this.extractSectionTitle(node);
        const summary = this.generateSectionSummary(nodeContent, nodeMarkdown);
        const keywords = this.extractSectionKeywords(nodeContent);
        const importance = this.calculateSectionImportance(node, nodeContent);

        sections.push({
          id: sectionId,
          title,
          summary,
          content: nodeContent,
          markdownContent: nodeMarkdown,
          startOffset: nodeStart,
          endOffset: currentOffset,
          keywords,
          importance,
          nodeType: node.type,
          depth,
          projectId
        });
      }

      // Process children
      if (node.content) {
        node.content.forEach(child => processNode(child, depth + 1));
      }
    };

    content.content.forEach(node => processNode(node));

    return sections;
  }

  /**
   * Determine if a node should create a section
   */
  private shouldCreateSection(node: JSONContent): boolean {
    const sectionTypes = [
      'heading',
      'paragraph',
      'blockquote',
      'codeBlock',
      'bulletList',
      'orderedList',
      'table',
      'imageCarousel',
      'interactiveEmbed',
      'downloadButton',
      'projectReference'
    ];

    return sectionTypes.includes(node.type || '');
  }

  /**
   * Extract title from a section node
   */
  private extractSectionTitle(node: JSONContent): string {
    if (node.type === 'heading') {
      return tiptapToPlainText({ type: 'doc', content: [node] }).trim();
    }

    if (node.type === 'imageCarousel') {
      return node.attrs?.title || 'Image Carousel';
    }

    if (node.type === 'interactiveEmbed') {
      return node.attrs?.title || 'Interactive Content';
    }

    if (node.type === 'downloadButton') {
      return node.attrs?.label || 'Downloads';
    }

    if (node.type === 'projectReference') {
      return node.attrs?.title || 'Project Reference';
    }

    // For other types, use the node type as title
    return (node.type?.charAt(0).toUpperCase() || '') + (node.type?.slice(1) || '') || 'Content';
  }

  /**
   * Generate a summary for a section
   */
  private generateSectionSummary(content: string, markdown: string): string {
    // For now, use first 200 characters as summary
    // In a real implementation, you might use AI to generate better summaries
    const summary = content.trim().substring(0, 200);
    return summary.length < content.length ? summary + '...' : summary;
  }

  /**
   * Extract keywords from section content
   */
  private extractSectionKeywords(content: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Return top keywords
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate importance score for a section
   */
  private calculateSectionImportance(node: JSONContent, content: string): number {
    let importance = 0.5; // Base importance

    // Heading importance based on level
    if (node.type === 'heading') {
      const level = node.attrs?.level || 1;
      importance = Math.max(0.9 - (level - 1) * 0.15, 0.3);
    }

    // Special content types
    if (node.type === 'codeBlock') importance += 0.2;
    if (node.type === 'imageCarousel') importance += 0.15;
    if (node.type === 'interactiveEmbed') importance += 0.25;
    if (node.type === 'downloadButton') importance += 0.1;

    // Content length factor
    const lengthFactor = Math.min(content.length / 500, 1) * 0.1;
    importance += lengthFactor;

    return Math.min(importance, 1);
  }

  /**
   * Extract keywords, topics, and technologies from project
   */
  private extractKeywordsAndTopics(
    project: any,
    sections: IndexedSection[],
    tiptapContent: TiptapContentData | null
  ): { keywords: string[]; topics: string[]; technologies: string[] } {
    const allText = [
      project.title,
      project.description || '',
      project.briefOverview || '',
      ...sections.map(s => s.content)
    ].join(' ');

    // Extract from tags
    const tagKeywords = project.tags?.map((tag: any) => tag.name.toLowerCase()) || [];

    // Extract from content
    const contentKeywords = this.extractSectionKeywords(allText);

    // Combine and deduplicate
    const keywords = Array.from(new Set([...tagKeywords, ...contentKeywords]));

    // Extract technologies (simple pattern matching)
    const technologies = this.extractTechnologies(allText);

    // Extract topics (broader categories)
    const topics = this.extractTopics(allText, sections);

    return {
      keywords: keywords.slice(0, 20),
      topics: topics.slice(0, 10),
      technologies: technologies.slice(0, 15)
    };
  }

  /**
   * Extract media context from project
   */
  private extractMediaContext(project: any, tiptapContent: TiptapContentData | null): MediaContext[] {
    const mediaContext: MediaContext[] = [];

    // Process regular media items
    project.mediaItems?.forEach((media: any, index: number) => {
      mediaContext.push({
        id: media.id,
        type: media.type.toLowerCase(),
        title: media.altText,
        description: media.description,
        altText: media.altText,
        url: media.url,
        context: `Media item ${index + 1} in project`,
        relevanceScore: 0.7
      });
    });

    // Process carousels
    project.carousels?.forEach((carousel: any) => {
      mediaContext.push({
        id: carousel.id,
        type: 'carousel',
        title: carousel.title,
        description: carousel.description,
        context: `Image carousel with ${carousel.images?.length || 0} images`,
        relevanceScore: 0.8
      });
    });

    // Process interactive examples
    project.interactiveExamples?.forEach((example: any) => {
      mediaContext.push({
        id: example.id,
        type: 'interactive',
        title: example.title,
        description: example.description,
        url: example.url,
        context: `Interactive ${example.type} example`,
        relevanceScore: 0.9
      });
    });

    // Process downloadable files
    project.downloadableFiles?.forEach((file: any) => {
      mediaContext.push({
        id: file.id,
        type: 'download',
        title: file.originalName,
        description: file.description,
        context: `Downloadable ${file.fileType} file`,
        relevanceScore: 0.6
      });
    });

    return mediaContext;
  }

  /**
   * Generate overall project summary
   */
  private generateProjectSummary(
    project: any,
    sections: IndexedSection[],
    mediaContext: MediaContext[]
  ): string {
    const parts = [
      `Project: ${project.title}`,
      project.briefOverview ? `Overview: ${project.briefOverview}` : '',
      project.description ? `Description: ${project.description}` : '',
      sections.length > 0 ? `Content sections: ${sections.length}` : '',
      mediaContext.length > 0 ? `Media items: ${mediaContext.length}` : '',
      project.tags?.length > 0 ? `Tags: ${project.tags.map((t: any) => t.name).join(', ')}` : ''
    ].filter(Boolean);

    return parts.join('\n');
  }

  /**
   * Extract technology keywords
   */
  private extractTechnologies(text: string): string[] {
    const techPatterns = [
      // Programming languages
      /\b(javascript|typescript|python|java|c\+\+|c#|php|ruby|go|rust|swift|kotlin)\b/gi,
      // Frameworks
      /\b(react|vue|angular|svelte|next\.?js|nuxt|express|django|flask|spring|laravel)\b/gi,
      // Databases
      /\b(mysql|postgresql|mongodb|redis|sqlite|firebase|supabase)\b/gi,
      // Cloud/DevOps
      /\b(aws|azure|gcp|docker|kubernetes|vercel|netlify|heroku)\b/gi,
      // Tools
      /\b(git|webpack|vite|babel|eslint|prettier|jest|cypress)\b/gi
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

  /**
   * Extract topic categories
   */
  private extractTopics(text: string, sections: IndexedSection[]): string[] {
    const topicPatterns = [
      { pattern: /\b(web development|frontend|backend|fullstack)\b/gi, topic: 'web development' },
      { pattern: /\b(mobile|ios|android|react native|flutter)\b/gi, topic: 'mobile development' },
      { pattern: /\b(ai|machine learning|deep learning|neural network)\b/gi, topic: 'artificial intelligence' },
      { pattern: /\b(data science|analytics|visualization|dashboard)\b/gi, topic: 'data science' },
      { pattern: /\b(ui|ux|design|interface|user experience)\b/gi, topic: 'design' },
      { pattern: /\b(api|rest|graphql|microservices|backend)\b/gi, topic: 'api development' },
      { pattern: /\b(database|sql|nosql|data modeling)\b/gi, topic: 'database' },
      { pattern: /\b(devops|deployment|ci\/cd|automation)\b/gi, topic: 'devops' },
      { pattern: /\b(security|authentication|authorization|encryption)\b/gi, topic: 'security' },
      { pattern: /\b(performance|optimization|caching|scaling)\b/gi, topic: 'performance' }
    ];

    const topics = new Set<string>();
    
    topicPatterns.forEach(({ pattern, topic }) => {
      if (pattern.test(text)) {
        topics.add(topic);
      }
    });

    return Array.from(topics);
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those', 'i',
      'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
      'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
      'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is',
      'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
      'do', 'does', 'did', 'doing', 'will', 'would', 'should', 'could', 'can', 'may',
      'might', 'must', 'shall', 'should', 'ought'
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Generate content hash for change detection
   */
  private generateContentHash(project: any): string {
    const hashContent = JSON.stringify({
      title: project.title,
      description: project.description,
      briefOverview: project.briefOverview,
      articleContent: project.articleContent?.jsonContent,
      mediaItems: project.mediaItems?.map((m: any) => ({ id: m.id, url: m.url })),
      tags: project.tags?.map((t: any) => t.name),
      updatedAt: project.updatedAt
    });

    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < hashContent.length; i++) {
      const char = hashContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Store index in database for persistence and analytics
   */
  private async storeIndexInDatabase(index: ProjectIndex): Promise<void> {
    try {
      // Use Prisma upsert for better type safety and compatibility
      await prisma.projectAIIndex.upsert({
        where: {
          projectId: index.projectId,
        },
        update: {
          summary: index.summary,
          keywords: index.keywords,
          topics: index.topics,
          technologies: index.technologies,
          sectionsCount: index.sections.length,
          mediaCount: index.mediaContext.length,
          contentHash: index.contentHash,
          updatedAt: new Date(),
        },
        create: {
          projectId: index.projectId,
          summary: index.summary,
          keywords: index.keywords,
          topics: index.topics,
          technologies: index.technologies,
          sectionsCount: index.sections.length,
          mediaCount: index.mediaContext.length,
          contentHash: index.contentHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // Don't fail the indexing if database storage fails
      console.warn('Failed to store index in database:', error);
    }
  }

  /**
   * Get project summary for AI context
   */
  async getProjectSummary(projectId: string): Promise<ProjectSummary | null> {
    try {
      const index = await this.indexProject(projectId);
      
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          title: true,
          briefOverview: true,
          description: true,
          tags: { select: { name: true } }
        }
      });

      if (!project) return null;

      // Build content structure
      const headingHierarchy = this.buildHeadingHierarchy(index.sections);
      const contentTypes = Array.from(new Set(index.sections.map(s => s.nodeType)));
      const estimatedReadTime = Math.ceil(
        index.sections.reduce((total, section) => total + section.content.length, 0) / 1000
      );

      // Build media overview
      const mediaOverview: MediaOverview = {
        totalImages: index.mediaContext.filter(m => m.type === 'image').length,
        totalVideos: index.mediaContext.filter(m => m.type === 'video').length,
        hasCarousels: index.mediaContext.some(m => m.type === 'carousel'),
        hasInteractiveContent: index.mediaContext.some(m => m.type === 'interactive'),
        hasDownloads: index.mediaContext.some(m => m.type === 'download'),
        mediaDescriptions: index.mediaContext
          .filter(m => m.description)
          .map(m => m.description!)
          .slice(0, 5)
      };

      return {
        projectId,
        title: project.title,
        briefSummary: project.briefOverview || '',
        detailedSummary: index.summary,
        keyTechnologies: index.technologies,
        mainTopics: index.topics,
        contentStructure: {
          totalSections: index.sections.length,
          headingHierarchy,
          contentTypes,
          estimatedReadTime
        },
        mediaOverview
      };

    } catch (error) {
      console.error(`Error getting project summary for ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Build heading hierarchy from sections
   */
  private buildHeadingHierarchy(sections: IndexedSection[]): HeadingNode[] {
    const headings = sections.filter(s => s.nodeType === 'heading');
    const hierarchy: HeadingNode[] = [];
    const stack: HeadingNode[] = [];

    headings.forEach(section => {
      const level = section.depth || 1;
      const node: HeadingNode = {
        level,
        title: section.title,
        sectionId: section.id,
        children: []
      };

      // Find the correct parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        hierarchy.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return hierarchy;
  }

  /**
   * Search relevant content based on query
   */
  async searchRelevantContent(
    projectIds: string[],
    query: string,
    limit: number = 10
  ): Promise<IndexedSection[]> {
    const relevantSections: Array<IndexedSection & { relevanceScore: number }> = [];

    // Index all projects if not already cached
    for (const projectId of projectIds) {
      try {
        const index = await this.indexProject(projectId);
        
        // Score sections based on query relevance
        index.sections.forEach(section => {
          const relevanceScore = this.calculateRelevanceScore(section, query);
          if (relevanceScore > 0.1) { // Minimum relevance threshold
            relevantSections.push({
              ...section,
              projectId, // Ensure projectId is set
              relevanceScore: relevanceScore * section.importance
            });
          }
        });
      } catch (error) {
        console.warn(`Failed to index project ${projectId} for search:`, error);
      }
    }

    // Sort by relevance and return top results
    return relevantSections
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
      .map(({ relevanceScore, ...section }) => section);
  }

  /**
   * Calculate relevance score for a section based on query
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

    return Math.min(score, 1);
  }

  /**
   * Clear cache for a specific project
   */
  clearProjectCache(projectId: string): void {
    this.indexCache.delete(projectId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.indexCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; projects: string[] } {
    return {
      size: this.indexCache.size,
      projects: Array.from(this.indexCache.keys())
    };
  }
}

// Export singleton instance
export const projectIndexer = ProjectIndexer.getInstance();