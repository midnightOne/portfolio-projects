/**
 * Hierarchical Content Parser (D48 content-source entry point)
 *
 * Parses a project's Tiptap/ArticleContent into hierarchical sections with
 * tier assignments, content hashes, and change maps for the semantic pipeline.
 * Extracted from the retired Gen-1 project-indexer (D37) — this is the single
 * entry point through which ingestion reads project content structure.
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

export interface EnhancedProjectIndex extends ProjectIndex {
  hierarchicalSections: HierarchicalSection[];
  contentChangeMap: ContentChangeMap;
  tierMappings: TierMapping[];
}

export interface ContentChangeMap {
  unchanged: string[];                // Section IDs that haven't changed
  modified: string[];                 // Section IDs that need regeneration
  added: string[];                    // New sections
  removed: string[];                  // Deleted sections
  articleHashChanged: boolean;        // Whether overall article changed
}

export interface TierMapping {
  sectionId: string;
  tier: number;                       // 2 or 3
  chunkId: string;                    // Generated chunk ID
  parentChunkId?: string;             // Parent chunk relationship
  sectionGroup: string;               // Grouping identifier
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
  /** Real Tiptap heading level (node.attrs.level). Without it every heading
   *  defaulted to level 1, flattening the hierarchy — no heading ever had
   *  children, so parent sections could not summarize their subsections. */
  sourceHeadingLevel?: number;
}

export interface HierarchicalSection extends IndexedSection {
  // Enhanced fields for tier mapping
  headingLevel: number;               // 1-6 for H1-H6, 0 for non-headings
  parentSectionId?: string;           // Parent heading ID
  childSectionIds: string[];          // Child heading/content IDs
  tierAssignment: number;             // Auto-assigned tier (2 or 3)
  anchorId: string;                   // Semantic anchor for navigation
  tiptapPosition: {
    start: number;                    // Tiptap document position
    end: number;                      // Tiptap document position
  };
  contentHash: string;                // Hash for change detection
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

/**
 * Hierarchical content parser — singleton
 */
export class HierarchicalContentParser {
  private static instance: HierarchicalContentParser;
  private indexCache = new Map<string, ProjectIndex>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  static getInstance(): HierarchicalContentParser {
    if (!HierarchicalContentParser.instance) {
      HierarchicalContentParser.instance = new HierarchicalContentParser();
    }
    return HierarchicalContentParser.instance;
  }

  /**
   * Generate enhanced hierarchical index for a specific project
   */
  async indexProjectHierarchical(projectId: string): Promise<EnhancedProjectIndex> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        articleContent: true,
        tags: true
      }
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Get basic project index first
    const basicIndex = await this.indexProject(projectId);
    
    // Generate hierarchical sections
    const hierarchicalSections = await this.generateHierarchicalSections(project, basicIndex.sections);
    
    // Detect content changes
    const contentChangeMap = await this.detectContentChanges(projectId, hierarchicalSections);
    
    // Generate tier mappings
    const tierMappings = this.generateTierMappings(hierarchicalSections);

    return {
      ...basicIndex,
      hierarchicalSections,
      contentChangeMap,
      tierMappings
    };
  }

  /**
   * Generate hierarchical sections with parent-child relationships
   */
  private async generateHierarchicalSections(
    project: any, 
    basicSections: IndexedSection[]
  ): Promise<HierarchicalSection[]> {
    const hierarchicalSections: HierarchicalSection[] = [];
    const sectionMap = new Map<string, HierarchicalSection>();

    // Convert basic sections to hierarchical sections
    for (const section of basicSections) {
      const hierarchicalSection: HierarchicalSection = {
        ...section,
        // Prefer the REAL Tiptap level — the markdown-hash fallback made every
        // heading level 1, so no heading ever had children.
        headingLevel: section.nodeType === 'heading'
          ? (section.sourceHeadingLevel ?? this.extractHeadingLevel(section.nodeType, section.title))
          : this.extractHeadingLevel(section.nodeType, section.title),
        parentSectionId: undefined,
        childSectionIds: [],
        tierAssignment: this.assignTier(section),
        anchorId: this.generateAnchorId(section.title || section.id),
        tiptapPosition: {
          start: section.startOffset,
          end: section.endOffset
        },
        contentHash: this.generateContentHash(section.content)
      };

      hierarchicalSections.push(hierarchicalSection);
      sectionMap.set(section.id, hierarchicalSection);
    }

    // Build parent-child relationships
    this.buildHierarchicalRelationships(hierarchicalSections);

    return hierarchicalSections;
  }

  /**
   * Extract heading level from nodeType and title
   */
  private extractHeadingLevel(nodeType: string, title?: string): number {
    if (nodeType === 'heading') {
      // Try to extract level from title or default to 1
      const match = title?.match(/^(#{1,6})\s/);
      return match ? match[1].length : 1;
    }
    return 0; // Non-heading content
  }

  /**
   * Assign tier based on heading level and content type (simplified T0-T3 structure)
   */
  private assignTier(section: IndexedSection): number {
    if (section.nodeType === 'heading') {
      // All headings (H1/H2/H3) are T2 in simplified structure
      return 2;
    }
    // Content blocks are T3 (terminal tier)
    return 3;
  }

  /**
   * Generate semantic anchor ID from title
   */
  private generateAnchorId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate content hash for change detection
   */
  private generateContentHash(content: string): string {
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Build parent-child relationships between sections
   */
  private buildHierarchicalRelationships(sections: HierarchicalSection[]): void {
    const headingStack: HierarchicalSection[] = [];

    for (const section of sections) {
      if (section.nodeType === 'heading') {
        // Pop headings of same or lower level
        while (headingStack.length > 0 && 
               headingStack[headingStack.length - 1].headingLevel >= section.headingLevel) {
          headingStack.pop();
        }

        // Set parent relationship
        if (headingStack.length > 0) {
          const parent = headingStack[headingStack.length - 1];
          section.parentSectionId = parent.id;
          parent.childSectionIds.push(section.id);
        }

        headingStack.push(section);
      } else {
        // Content blocks belong to the current heading
        if (headingStack.length > 0) {
          const parent = headingStack[headingStack.length - 1];
          section.parentSectionId = parent.id;
          parent.childSectionIds.push(section.id);
        }
      }
    }
  }

  /**
   * Detect content changes compared to existing chunks
   */
  private async detectContentChanges(
    projectId: string, 
    hierarchicalSections: HierarchicalSection[]
  ): Promise<ContentChangeMap> {
    // Get project slug first
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true }
    });
    
    if (!project) {
      return {
        unchanged: [],
        modified: [],
        added: hierarchicalSections.map(s => s.id),
        removed: [],
        articleHashChanged: true
      };
    }

    // Get existing chunks for this project
    const existingChunks = await prisma.contextChunk.findMany({
      where: {
        entity: {
          entityType: 'PROJECT',
          slug: project.slug
        }
      }
    });

    const existingHashes = new Map<string, string>();
    existingChunks.forEach(chunk => {
      const hash = chunk.metadata && typeof chunk.metadata === 'object' 
        ? (chunk.metadata as any).contentHash 
        : null;
      if (hash) {
        existingHashes.set(chunk.chunkId, hash);
      }
    });

    const changeMap: ContentChangeMap = {
      unchanged: [],
      modified: [],
      added: [],
      removed: [],
      articleHashChanged: false
    };

    // Check each section for changes
    for (const section of hierarchicalSections) {
      // Generate chunk ID consistent with SmartContentGenerator
      let chunkId: string;
      if (section.nodeType === 'heading' && section.headingLevel === 1) {
        chunkId = `h1-${section.anchorId}`;
      } else {
        chunkId = `${section.nodeType}-${section.anchorId}`;
      }
      
      const existingHash = existingHashes.get(chunkId);

      if (!existingHash) {
        changeMap.added.push(section.id);
      } else if (existingHash !== section.contentHash) {
        changeMap.modified.push(section.id);
      } else {
        changeMap.unchanged.push(section.id);
      }
    }

    // Check for removed sections
    for (const [chunkId] of existingHashes) {
      const stillExists = hierarchicalSections.some(s => {
        let expectedChunkId: string;
        if (s.nodeType === 'heading' && s.headingLevel === 1) {
          expectedChunkId = `h1-${s.anchorId}`;
        } else {
          expectedChunkId = `${s.nodeType}-${s.anchorId}`;
        }
        return expectedChunkId === chunkId;
      });
      if (!stillExists) {
        changeMap.removed.push(chunkId);
      }
    }

    // Check if article hash changed (for T1 regeneration)
    const currentArticleHash = this.generateContentHash(
      hierarchicalSections.map(s => s.content).join('\n')
    );
    const existingArticleHash = existingChunks.find(c => c.chunkId === 'summary')?.metadata;
    changeMap.articleHashChanged = !existingArticleHash || 
      (existingArticleHash as any)?.articleHash !== currentArticleHash;

    return changeMap;
  }

  /**
   * Generate tier mappings for hierarchical sections
   */
  private generateTierMappings(hierarchicalSections: HierarchicalSection[]): TierMapping[] {
    const mappings: TierMapping[] = [];

    for (const section of hierarchicalSections) {
      const chunkId = `${section.nodeType}-${section.anchorId}`;
      const parentChunkId = section.parentSectionId 
        ? hierarchicalSections.find(s => s.id === section.parentSectionId)?.anchorId
        : section.tierAssignment === 2 ? 'summary' : undefined;

      mappings.push({
        sectionId: section.id,
        tier: section.tierAssignment,
        chunkId,
        parentChunkId: parentChunkId ? `${section.nodeType}-${parentChunkId}` : parentChunkId,
        sectionGroup: section.anchorId
      });
    }

    return mappings;
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
      const contentHash = this.generateProjectContentHash(project);

      // Check if we have a cached version with same content hash
      if (cached && cached.contentHash === contentHash) {
        return cached;
      }

      // Parse Tiptap content
      const tiptapContent = project.articleContent?.jsonContent as unknown as TiptapContentData | null;
      
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

      // Cache the result (in-memory only — ProjectAIIndex persistence retired, D37)
      this.indexCache.set(projectId, projectIndex);

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
      const createdSection = this.shouldCreateSection(node);
      if (createdSection) {
        const sectionId = `section-${++sectionCounter}`;
        let title = this.extractSectionTitle(node);

        // Real-world content sometimes arrives with a whole block pasted into
        // ONE heading node ("Payment Processing\n- bullet\n- bullet"). The
        // first line is the heading; everything after it is section BODY.
        // Folding it all into the title produced monster anchor ids, left the
        // section with no T3 source (summaries stage skipped it, writing the
        // 0-token placeholder that trips the dashboard's 'corrupted' flag),
        // and made the section invisible to search (owner, 2026-07-08).
        let headingBody: string | null = null;
        if (node.type === 'heading' && title.includes('\n')) {
          const [firstLine, ...rest] = title.split('\n');
          title = firstLine.trim();
          headingBody = rest.join('\n').trim() || null;
        }

        const sectionContent = headingBody !== null ? title : nodeContent;
        const sectionMarkdown = headingBody !== null ? title : nodeMarkdown;

        sections.push({
          id: sectionId,
          title,
          summary: this.generateSectionSummary(sectionContent, sectionMarkdown),
          content: sectionContent,
          markdownContent: sectionMarkdown,
          startOffset: nodeStart,
          endOffset: currentOffset,
          keywords: this.extractSectionKeywords(sectionContent),
          importance: this.calculateSectionImportance(node, sectionContent),
          nodeType: node.type,
          depth,
          projectId,
          sourceHeadingLevel: node.type === 'heading' ? (node.attrs?.level ?? 1) : undefined
        });

        // The salvaged body becomes a normal content section directly after
        // its heading — hierarchy building attaches it as the heading's child,
        // so the T3 chunker gives the section real, searchable content.
        if (headingBody) {
          sections.push({
            id: `section-${++sectionCounter}`,
            title: `${title} — details`,
            summary: this.generateSectionSummary(headingBody, headingBody),
            content: headingBody,
            markdownContent: headingBody,
            startOffset: nodeStart,
            endOffset: currentOffset,
            keywords: this.extractSectionKeywords(headingBody),
            importance: this.calculateSectionImportance(node, headingBody),
            nodeType: 'paragraph',
            depth: depth + 1,
            projectId
          });
        }
      }

      // Process children ONLY if we didn't create a section for this node
      // This prevents duplicate content when parent containers (like bulletList)
      // already contain all their children's text
      const shouldProcessChildren = !createdSection || node.type === 'doc';
      if (shouldProcessChildren && node.content) {
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
  private generateProjectContentHash(project: any): string {
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
export const hierarchicalContentParser = HierarchicalContentParser.getInstance();