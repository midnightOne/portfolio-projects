/**
 * Smart Content Generator with Incremental Processing
 * 
 * Generates hierarchical content tiers based on Tiptap document structure
 * with intelligent change detection and cost optimization.
 */

import { PrismaClient } from '@prisma/client';
import { ProjectIndexer, EnhancedProjectIndex, HierarchicalSection, ContentChangeMap } from '../services/project-indexer';
import OpenAI from 'openai';

const prisma = new PrismaClient();

export interface TierContent {
  tier: number;
  chunkId: string;
  title?: string;
  content: string;
  tokenCount: number;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface SmartGenerationResult {
  tiers: TierContent[];
  costSavings: {
    sectionsSkipped: number;
    tokensSkipped: number;
    estimatedCostSaved: number;
  };
  processingStats: {
    totalSections: number;
    regeneratedSections: number;
    reusedSections: number;
    processingTime: number;
  };
}

export class SmartContentGenerator {
  private projectIndexer: ProjectIndexer;
  private openai: OpenAI | null;
  private embeddingModel = 'text-embedding-3-small';
  private embeddingDimensions = 1536;
  
  // Cost tracking (approximate costs in USD)
  private readonly EMBEDDING_COST_PER_1K_TOKENS = 0.00002;
  private readonly GPT4_MINI_COST_PER_1K_TOKENS = 0.00015;

  constructor() {
    this.projectIndexer = ProjectIndexer.getInstance();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('OPENAI_API_KEY not found - AI generation will be skipped');
      this.openai = null;
    }
  }

  /**
   * Generate hierarchical content with smart incremental processing
   */
  async generateHierarchicalContent(project: any): Promise<SmartGenerationResult> {
    const startTime = Date.now();
    
    // Get enhanced project index with change detection
    const enhancedIndex = await this.projectIndexer.indexProjectHierarchical(project.id);
    
    const tiers: TierContent[] = [];
    let tokensSkipped = 0;
    let sectionsSkipped = 0;
    let estimatedCostSaved = 0;

    // T0: Always regenerate (lightweight metadata)
    tiers.push(await this.generateT0Metadata(project));

    // T1: Regenerate only if project summary changed
    if (enhancedIndex.contentChangeMap.articleHashChanged) {
      tiers.push(await this.generateT1Summary(project, enhancedIndex));
    } else {
      const existingT1 = await this.loadExistingTier(project, 'summary');
      if (existingT1) {
        tiers.push(existingT1);
        tokensSkipped += existingT1.tokenCount;
        sectionsSkipped += 1;
        estimatedCostSaved += this.GPT4_MINI_COST_PER_1K_TOKENS * (existingT1.tokenCount / 1000);
      } else {
        tiers.push(await this.generateT1Summary(project, enhancedIndex));
      }
    }

    // T2: Process H1 sections (only changed ones)
    const h1Sections = enhancedIndex.hierarchicalSections.filter(s => 
      s.nodeType === 'heading' && s.headingLevel === 1
    );
    
    for (const section of h1Sections) {
      if (this.needsRegeneration(section, enhancedIndex.contentChangeMap)) {
        tiers.push(await this.generateT2FromH1(section, project));
      } else {
        const existing = await this.loadExistingTier(project, `h1-${section.anchorId}`);
        if (existing) {
          tiers.push(existing);
          tokensSkipped += existing.tokenCount;
          sectionsSkipped += 1;
          estimatedCostSaved += this.GPT4_MINI_COST_PER_1K_TOKENS * (existing.tokenCount / 1000);
        }
      }
    }

    // T3: Process H2/H3 sections and content blocks (only changed ones)
    const detailedSections = enhancedIndex.hierarchicalSections.filter(s => 
      (s.nodeType === 'heading' && s.headingLevel > 1) || s.nodeType !== 'heading'
    );
    
    for (const section of detailedSections) {
      if (this.needsRegeneration(section, enhancedIndex.contentChangeMap)) {
        tiers.push(await this.generateT3FromSection(section, project, enhancedIndex));
      } else {
        const existing = await this.loadExistingTier(project, `${section.nodeType}-${section.anchorId}`);
        if (existing) {
          tiers.push(existing);
          tokensSkipped += existing.tokenCount;
          sectionsSkipped += 1;
          estimatedCostSaved += this.GPT4_MINI_COST_PER_1K_TOKENS * (existing.tokenCount / 1000);
        }
      }
    }

    // T4: Re-chunk only if article content changed significantly
    if (this.hasSignificantContentChange(enhancedIndex.contentChangeMap)) {
      const newChunks = await this.generateT4Chunks(project);
      tiers.push(...newChunks);
    } else {
      const existingChunks = await this.loadExistingT4Chunks(project);
      tiers.push(...existingChunks);
      tokensSkipped += existingChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
      sectionsSkipped += existingChunks.length;
    }

    const processingTime = Date.now() - startTime;

    return {
      tiers,
      costSavings: {
        sectionsSkipped,
        tokensSkipped,
        estimatedCostSaved
      },
      processingStats: {
        totalSections: enhancedIndex.hierarchicalSections.length,
        regeneratedSections: enhancedIndex.hierarchicalSections.length - sectionsSkipped,
        reusedSections: sectionsSkipped,
        processingTime
      }
    };
  }

  /**
   * Generate T0 metadata tier
   */
  private async generateT0Metadata(project: any): Promise<TierContent> {
    const content = JSON.stringify({
      title: project.title,
      tags: project.tags?.map((tag: any) => tag.name) || [],
      technologies: project.aiIndex?.technologies || [],
      workDate: project.workDate
    });

    return {
      tier: 0,
      chunkId: 'metadata',
      title: 'Project Metadata',
      content,
      tokenCount: this.estimateTokenCount(content),
      metadata: {
        type: 'metadata',
        importance: 1.0,
        source: 'auto-generated',
        parentChunkId: null,
        rootChunkId: 'metadata',
        sectionGroup: 'root',
        derivationPath: 'T0'
      }
    };
  }

  /**
   * Generate T1 project summary
   */
  private async generateT1Summary(project: any, enhancedIndex: EnhancedProjectIndex): Promise<TierContent> {
    let content: string;

    if (this.openai) {
      // Generate AI summary
      content = await this.generateAISummary(project, enhancedIndex) || 
                [project.description, project.briefOverview].filter(Boolean).join('\n\n');
    } else {
      // Fallback to existing content
      content = [project.description, project.briefOverview].filter(Boolean).join('\n\n');
    }

    return {
      tier: 1,
      chunkId: 'summary',
      title: 'Project Summary',
      content,
      tokenCount: this.estimateTokenCount(content),
      metadata: {
        type: 'summary',
        importance: 0.9,
        source: this.openai ? 'ai-generated' : 'extracted',
        parentChunkId: 'metadata',
        rootChunkId: 'metadata',
        sectionGroup: 'root',
        derivationPath: 'T0→T1',
        articleHash: this.generateContentHash(
          enhancedIndex.hierarchicalSections.map(s => s.content).join('\n')
        )
      }
    };
  }

  /**
   * Generate T2 content from H1 section
   */
  private async generateT2FromH1(section: HierarchicalSection, project: any): Promise<TierContent> {
    let content: string;

    if (this.openai && section.content.length > 200) {
      // Generate concise summary for long sections
      content = await this.generateSectionSummary(section, 'concise') || section.summary || section.content;
    } else {
      // Use existing summary or content for short sections
      content = section.summary || section.content;
    }

    return {
      tier: 2,
      chunkId: `h1-${section.anchorId}`,
      title: section.title,
      content,
      tokenCount: this.estimateTokenCount(content),
      metadata: {
        type: 'h1-section',
        nodeType: 'heading',
        headingLevel: 1,
        anchorId: section.anchorId,
        tiptapPosition: section.tiptapPosition,
        parentChunkId: 'summary',
        rootChunkId: 'metadata',
        sectionGroup: section.anchorId,
        derivationPath: `T0→T1→T2:${section.anchorId}`,
        source: this.openai && section.content.length > 200 ? 'ai-generated' : 'extracted',
        contentHash: section.contentHash
      }
    };
  }

  /**
   * Generate T3 content from H2/H3 sections or content blocks
   */
  private async generateT3FromSection(
    section: HierarchicalSection, 
    project: any, 
    enhancedIndex: EnhancedProjectIndex
  ): Promise<TierContent> {
    let content: string;

    if (section.nodeType === 'heading' && this.openai && section.content.length > 300) {
      // Generate detailed summary for long heading sections
      content = await this.generateSectionSummary(section, 'detailed') || section.content;
    } else {
      // Use existing content for short sections or non-headings
      content = section.content;
    }

    const parentH1 = this.findParentH1Section(section, enhancedIndex.hierarchicalSections);
    const parentChunkId = parentH1 ? `h1-${parentH1.anchorId}` : 'summary';

    return {
      tier: 3,
      chunkId: `${section.nodeType}-${section.anchorId}`,
      title: section.title || `${section.nodeType} content`,
      content,
      tokenCount: this.estimateTokenCount(content),
      metadata: {
        type: section.nodeType,
        nodeType: section.nodeType,
        headingLevel: section.headingLevel,
        anchorId: section.anchorId,
        tiptapPosition: section.tiptapPosition,
        parentChunkId,
        rootChunkId: 'metadata',
        sectionGroup: parentH1?.anchorId || section.anchorId,
        derivationPath: `T0→T1→T2:${parentH1?.anchorId || 'parent'}→T3:${section.anchorId}`,
        source: section.nodeType === 'heading' && this.openai && section.content.length > 300 
          ? 'ai-generated' : 'extracted',
        contentHash: section.contentHash
      }
    };
  }

  /**
   * Generate T4 content chunks
   */
  private async generateT4Chunks(project: any): Promise<TierContent[]> {
    if (!project.articleContent?.content) {
      return [];
    }

    const chunks = this.chunkContent(project.articleContent.content, 300, 50);
    const t4Chunks: TierContent[] = [];

    chunks.forEach((chunk, index) => {
      t4Chunks.push({
        tier: 4,
        chunkId: `full-content-${index}`,
        title: `Content Chunk ${index + 1}`,
        content: chunk,
        tokenCount: this.estimateTokenCount(chunk),
        metadata: {
          type: 'full-content-chunk',
          chunkIndex: index,
          totalChunks: chunks.length,
          contentType: project.articleContent.contentType,
          source: 'article-content',
          parentChunkId: 'summary', // Could be enhanced to find best parent
          rootChunkId: 'metadata',
          sectionGroup: 'full-content',
          derivationPath: `T0→T1→...→T4.${index + 1}`
        }
      });
    });

    return t4Chunks;
  }

  // Helper methods
  private needsRegeneration(section: HierarchicalSection, changeMap: ContentChangeMap): boolean {
    return changeMap.added.includes(section.id) || changeMap.modified.includes(section.id);
  }

  private hasSignificantContentChange(changeMap: ContentChangeMap): boolean {
    return changeMap.articleHashChanged || 
           changeMap.added.length > 0 || 
           changeMap.modified.length > 2; // Threshold for significant change
  }

  private findParentH1Section(
    section: HierarchicalSection, 
    allSections: HierarchicalSection[]
  ): HierarchicalSection | null {
    if (!section.parentSectionId) return null;
    
    let current = allSections.find(s => s.id === section.parentSectionId);
    while (current) {
      if (current.nodeType === 'heading' && current.headingLevel === 1) {
        return current;
      }
      current = current.parentSectionId ? 
        allSections.find(s => s.id === current!.parentSectionId) : null;
    }
    return null;
  }

  private async loadExistingTier(project: any, chunkId: string): Promise<TierContent | null> {
    const chunk = await prisma.contextChunk.findFirst({
      where: {
        chunkId,
        entity: {
          entityType: 'PROJECT',
          slug: project.slug
        }
      }
    });

    if (!chunk) return null;

    return {
      tier: chunk.tier,
      chunkId: chunk.chunkId,
      title: chunk.title || undefined,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata as Record<string, any>
    };
  }

  private async loadExistingT4Chunks(project: any): Promise<TierContent[]> {
    const chunks = await prisma.contextChunk.findMany({
      where: {
        tier: 4,
        entity: {
          entityType: 'PROJECT',
          slug: project.slug
        }
      },
      orderBy: { chunkId: 'asc' }
    });

    return chunks.map(chunk => ({
      tier: chunk.tier,
      chunkId: chunk.chunkId,
      title: chunk.title || undefined,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata as Record<string, any>
    }));
  }

  private async generateAISummary(project: any, enhancedIndex: EnhancedProjectIndex): Promise<string | null> {
    if (!this.openai) return null;

    try {
      const prompt = `Create a concise project summary (50-100 words) for:

Title: ${project.title}
Description: ${project.description}
Key Sections: ${enhancedIndex.hierarchicalSections
  .filter(s => s.nodeType === 'heading' && s.headingLevel === 1)
  .map(s => s.title)
  .join(', ')}

Focus on the main purpose, key technologies, and primary outcomes.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.6
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      return null;
    }
  }

  private async generateSectionSummary(section: HierarchicalSection, type: 'concise' | 'detailed'): Promise<string | null> {
    if (!this.openai) return null;

    const maxWords = type === 'concise' ? '50-100' : '150-300';
    const maxTokens = type === 'concise' ? 150 : 400;

    try {
      const prompt = `Create a ${type} summary (${maxWords} words) for this section:

Title: ${section.title}
Content: ${section.content.substring(0, 1000)}

${type === 'concise' 
  ? 'Focus on the main point and key takeaways.' 
  : 'Include technical details, implementation notes, and specific outcomes.'}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.6
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('Failed to generate section summary:', error);
      return null;
    }
  }

  private chunkContent(content: string, chunkSize: number, overlap: number): string[] {
    const words = content.split(/\s+/);
    const chunks: string[] = [];
    
    const wordsPerChunk = Math.floor(chunkSize * 0.75);
    const overlapWords = Math.floor(overlap * 0.75);
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  private estimateTokenCount(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private generateContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}