/**
 * Smart Content Generator with Simplified T0-T3 Structure and Heading-Bounded Chunking
 * 
 * Implements simplified 4-tier hierarchy (T0-T3) with heading-bounded chunking:
 * - T0: Project metadata (system-generated, no AI, no manual edit, 1 per project)
 * - T1: Project summary (AI or user-pasted, editable, 1 per project)
 * - T2: Heading-based summaries (H1/H2/H3 with proper parent-child nesting)
 * - T3: Heading-bounded hybrid chunking (never cross heading boundaries)
 */

import { PrismaClient } from '@prisma/client';
import { ProjectIndexer, EnhancedProjectIndex, HierarchicalSection, ContentChangeMap } from '../services/project-indexer';
import OpenAI from 'openai';
import { semanticBudgetManager } from './SemanticBudgetManager';
import { getSummaryGenerationService } from './SummaryGenerationService';

const prisma = new PrismaClient();

export interface TierContent {
  tier: number;
  chunkId: string;
  title?: string;
  content: string;
  tokenCount: number;
  embedding?: number[];
  metadata: Record<string, any>;
  // Enhanced hierarchical fields
  parentChunkId?: string;
  rootChunkId: string;
  sectionGroup?: string;
  derivationPath: string;
  // Section-relative positioning for T3 chunks
  sectionStartLine?: number;
  sectionEndLine?: number;
  sectionBounded?: boolean;
  chunkIndexInSection?: number;
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
  private summaryService = getSummaryGenerationService();
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
   * Generate hierarchical content with simplified T0-T3 structure and heading-bounded chunking
   */
  async generateHierarchicalContent(project: any): Promise<SmartGenerationResult> {
    const startTime = Date.now();

    // Get enhanced project index with change detection
    const enhancedIndex = await this.projectIndexer.indexProjectHierarchical(project.id);

    const tiers: TierContent[] = [];
    let tokensSkipped = 0;
    let sectionsSkipped = 0;
    let estimatedCostSaved = 0;

    // T0: Always regenerate (lightweight metadata, no AI, no manual edit)
    tiers.push(await this.generateT0Metadata(project));

    // T1: Regenerate only if project summary changed (AI or user-pasted, editable)
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

    // T2: Process all headings (H1/H2/H3) with proper parent-child nesting
    const headingSections = enhancedIndex.hierarchicalSections.filter(s =>
      s.nodeType === 'heading' && s.headingLevel >= 1 && s.headingLevel <= 3
    );

    for (const section of headingSections) {
      if (this.needsRegeneration(section, enhancedIndex.contentChangeMap)) {
        tiers.push(await this.generateT2FromHeading(section, project, enhancedIndex));
      } else {
        const existing = await this.loadExistingTier(project, section.anchorId);
        if (existing) {
          tiers.push(existing);
          tokensSkipped += existing.tokenCount;
          sectionsSkipped += 1;
          estimatedCostSaved += this.GPT4_MINI_COST_PER_1K_TOKENS * (existing.tokenCount / 1000);
        }
      }
    }

    // T3: Generate heading-bounded chunks (never cross heading boundaries)
    const t3Chunks = await this.generateT3HeadingBoundedChunks(project, enhancedIndex);
    tiers.push(...t3Chunks);

    // Validate that chunks don't cross heading boundaries
    this.validateHeadingBoundaries(tiers);

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
   * Generate T0 metadata tier (system-generated, no AI, no manual edit, 1 per project)
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
      parentChunkId: undefined, // Root node
      rootChunkId: 'metadata',
      sectionGroup: 'root',
      derivationPath: 'T0',
      metadata: {
        type: 'metadata',
        importance: 1.0,
        source: 'system-generated',
        generationMode: 'system',
        editable: false
      }
    };
  }

  /**
   * Generate T1 project summary (AI or user-pasted, editable, 1 per project)
   */
  private async generateT1Summary(project: any, enhancedIndex: EnhancedProjectIndex): Promise<TierContent> {
    let content: string;
    let source: string;
    let importance = 0.9;

    // Prepare content for summary generation
    const sourceContent = [
      project.title,
      project.description,
      project.briefOverview,
      // Include key sections for context
      enhancedIndex.hierarchicalSections
        .filter(s => s.nodeType === 'heading' && s.headingLevel === 1)
        .map(s => `${s.title}: ${s.content.substring(0, 200)}`)
        .join('\n\n')
    ].filter(Boolean).join('\n\n');

    if (this.summaryService && sourceContent.length > 100) {
      try {
        // Use SummaryGenerationService with anti-hallucination measures
        const result = await this.summaryService.generateSummary({
          content: sourceContent,
          type: 'T1',
          projectId: project.id,
          metadata: {
            projectTitle: project.title,
            projectSlug: project.slug
          }
        });

        content = result.summary;
        source = 'ai-generated';

        // Adjust importance based on confidence score
        importance = 0.8 + (result.confidenceScore * 0.2); // 0.8-1.0 range

        console.log(`[SmartContentGenerator] T1 summary generated:`, {
          projectId: project.id,
          confidence: result.confidenceScore.toFixed(3),
          cost: result.cost.toFixed(4),
          tokensUsed: result.tokensUsed,
          importance: importance.toFixed(3)
        });
      } catch (error) {
        console.error('Failed to generate T1 summary with SummaryGenerationService:', error);
        // Fallback to existing content
        content = [project.description, project.briefOverview].filter(Boolean).join('\n\n');
        source = 'extracted';
      }
    } else {
      // Fallback to existing content
      content = [project.description, project.briefOverview].filter(Boolean).join('\n\n');
      source = 'extracted';
    }

    return {
      tier: 1,
      chunkId: 'summary',
      title: 'Project Summary',
      content,
      tokenCount: this.estimateTokenCount(content),
      parentChunkId: 'metadata',
      rootChunkId: 'metadata',
      sectionGroup: 'root',
      derivationPath: 'T0→T1',
      metadata: {
        type: 'summary',
        importance,
        source,
        generationMode: source === 'ai-generated' ? 'ai' : 'manual',
        editable: true,
        articleHash: this.generateContentHash(
          enhancedIndex.hierarchicalSections.map(s => s.content).join('\n')
        )
      }
    };
  }

  /**
   * Generate T2 content from heading (H1/H2/H3 with proper parent-child nesting)
   */
  private async generateT2FromHeading(
    section: HierarchicalSection,
    project: any,
    enhancedIndex: EnhancedProjectIndex
  ): Promise<TierContent> {
    let content: string;
    let source: string;
    let importance = 0.7; // Base importance for T2

    // Extract section content including all subsections for T2 summaries
    const sectionWithSubsections = this.extractSectionContentWithSubsections(section, enhancedIndex);

    if (this.summaryService && sectionWithSubsections.length > 200) {
      try {
        // Use SummaryGenerationService for T2 section summaries
        const result = await this.summaryService.generateSummary({
          content: sectionWithSubsections,
          type: 'T2',
          projectId: project.id,
          sectionTitle: section.title,
          metadata: {
            headingLevel: section.headingLevel,
            anchorId: section.anchorId,
            sectionGroup: section.anchorId
          }
        });

        content = result.summary;
        source = 'ai-generated';

        // Adjust importance based on heading level and confidence
        const levelBonus = section.headingLevel === 1 ? 0.2 : section.headingLevel === 2 ? 0.1 : 0;
        importance = 0.6 + levelBonus + (result.confidenceScore * 0.2);

        console.log(`[SmartContentGenerator] T2 summary generated for "${section.title}":`, {
          headingLevel: section.headingLevel,
          confidence: result.confidenceScore.toFixed(3),
          cost: result.cost.toFixed(4),
          tokensUsed: result.tokensUsed,
          importance: importance.toFixed(3)
        });
      } catch (error) {
        console.error(`Failed to generate T2 summary for section "${section.title}":`, error);
        // Fallback to existing content
        content = section.summary || sectionWithSubsections;
        source = 'extracted';
      }
    } else {
      // Use existing summary or content for short sections
      content = section.summary || sectionWithSubsections;
      source = 'extracted';

      // Adjust importance for extracted content based on heading level
      importance = section.headingLevel === 1 ? 0.8 : section.headingLevel === 2 ? 0.7 : 0.6;
    }

    // Determine parent chunk based on heading hierarchy
    const parentChunkId = this.findParentT2ChunkId(section, enhancedIndex);

    return {
      tier: 2,
      chunkId: section.anchorId,
      title: section.title,
      content,
      tokenCount: this.estimateTokenCount(content),
      parentChunkId,
      rootChunkId: 'metadata',
      sectionGroup: section.anchorId,
      derivationPath: this.buildDerivationPath(section, enhancedIndex),
      metadata: {
        type: 'heading-summary',
        nodeType: 'heading',
        headingLevel: section.headingLevel,
        anchorId: section.anchorId,
        tiptapPosition: section.tiptapPosition,
        importance,
        source,
        generationMode: source === 'ai-generated' ? 'ai' : 'manual',
        editable: true,
        contentHash: section.contentHash,
        includesSubsections: true
      }
    };
  }

  /**
   * Parse content into sections bounded by headings
   */
  private parseHeadingBoundedSections(
    content: string,
    hierarchicalSections: HierarchicalSection[]
  ): Array<{
    sectionId: string;
    headingText: string;
    headingLevel: number;
    content: string;
    startLine: number;
    endLine: number;
    parentT2ChunkId: string;
  }> {
    const sections: Array<{
      sectionId: string;
      headingText: string;
      headingLevel: number;
      content: string;
      startLine: number;
      endLine: number;
      parentT2ChunkId: string;
    }> = [];

    const lines = content.split('\n');
    let currentSection: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is a heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section if exists
        if (currentSection) {
          currentSection.endLine = i - 1;
          currentSection.content = lines.slice(currentSection.startLine + 1, i).join('\n');
          sections.push(currentSection);
        }

        // Start new section
        const headingLevel = headingMatch[1].length;
        const headingText = headingMatch[2];
        const sectionId = this.generateAnchorId(headingText);

        // Find corresponding hierarchical section for parent T2 chunk
        const hierarchicalSection = hierarchicalSections.find(s =>
          s.anchorId === sectionId || s.title === headingText
        );

        currentSection = {
          sectionId,
          headingText,
          headingLevel,
          startLine: i,
          endLine: lines.length - 1, // Will be updated when next heading found
          content: '',
          parentT2ChunkId: hierarchicalSection?.anchorId || 'summary'
        };
      }
    }

    // Add final section
    if (currentSection) {
      currentSection.content = lines.slice(currentSection.startLine + 1).join('\n');
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Apply heading-bounded chunking algorithm with three strategies
   */
  private applyHeadingBoundedChunking(
    section: {
      sectionId: string;
      headingText: string;
      headingLevel: number;
      content: string;
      startLine: number;
      endLine: number;
      parentT2ChunkId: string;
    },
    enhancedIndex: EnhancedProjectIndex
  ): TierContent[] {
    const chunks: TierContent[] = [];
    const sectionTokenCount = this.estimateTokenCount(section.content);

    // Strategy 1: Single chunk (small sections)
    if (sectionTokenCount <= 400) {
      chunks.push(this.createT3Chunk(
        section,
        section.content,
        0, // chunkIndex
        1, // totalChunks
        0, // sectionStartLine (relative to section)
        section.content.split('\n').length - 1 // sectionEndLine
      ));
      return chunks;
    }

    // Strategy 2: Split within boundaries (large sections)
    if (sectionTokenCount > 400) {
      const sectionChunks = this.splitSectionIntelligently(section);
      sectionChunks.forEach((chunkContent, index) => {
        const chunkLines = chunkContent.split('\n');
        const startLine = index === 0 ? 0 : this.calculateChunkStartLine(section.content, chunkContent, index);
        const endLine = startLine + chunkLines.length - 1;

        chunks.push(this.createT3Chunk(
          section,
          chunkContent,
          index,
          sectionChunks.length,
          startLine,
          endLine
        ));
      });
      return chunks;
    }

    // Strategy 3: Merge with parent (tiny sections) - handled in Strategy 1
    return chunks;
  }

  /**
   * Create T3 chunk with heading-bounded metadata
   */
  private createT3Chunk(
    section: {
      sectionId: string;
      headingText: string;
      headingLevel: number;
      parentT2ChunkId: string;
    },
    content: string,
    chunkIndex: number,
    totalChunks: number,
    sectionStartLine: number,
    sectionEndLine: number
  ): TierContent {
    const chunkId = totalChunks === 1
      ? `section-${section.sectionId}`
      : `section-${section.sectionId}-${chunkIndex}`;

    return {
      tier: 3,
      chunkId,
      title: totalChunks === 1
        ? `${section.headingText} Content`
        : `${section.headingText} Part ${chunkIndex + 1}`,
      content,
      tokenCount: this.estimateTokenCount(content),
      parentChunkId: section.parentT2ChunkId,
      rootChunkId: 'metadata',
      sectionGroup: section.sectionId,
      derivationPath: `T0→T1→T2:${section.parentT2ChunkId}→T3:${section.sectionId}.${chunkIndex + 1}`,
      sectionStartLine,
      sectionEndLine,
      sectionBounded: true, // Never crosses heading boundaries
      chunkIndexInSection: chunkIndex,
      metadata: {
        type: 'heading-bounded-chunk',
        headingLevel: section.headingLevel,
        sectionId: section.sectionId,
        chunkIndex,
        totalChunks,
        source: 'heading-bounded-chunking',
        generationMode: 'automatic',
        editable: true,
        sectionBounded: true
      }
    };
  }

  /**
   * Extract section content including all subsections for T2 summaries
   */
  private extractSectionContentWithSubsections(
    section: HierarchicalSection,
    enhancedIndex: EnhancedProjectIndex
  ): string {
    let content = section.content;

    // Find all child sections and include their content
    const childSections = enhancedIndex.hierarchicalSections.filter(s =>
      s.parentSectionId === section.id
    );

    for (const child of childSections) {
      content += '\n\n' + child.content;
      // Recursively include grandchildren
      content += '\n' + this.extractSectionContentWithSubsections(child, enhancedIndex);
    }

    return content;
  }

  /**
   * Find parent T2 chunk ID based on heading hierarchy
   */
  private findParentT2ChunkId(
    section: HierarchicalSection,
    enhancedIndex: EnhancedProjectIndex
  ): string {
    if (section.headingLevel === 1) {
      return 'summary'; // H1 sections are children of T1 summary
    }

    // Find parent heading
    const parentSection = enhancedIndex.hierarchicalSections.find(s =>
      s.id === section.parentSectionId && s.nodeType === 'heading'
    );

    return parentSection ? parentSection.anchorId : 'summary';
  }

  /**
   * Build derivation path for hierarchical structure
   */
  private buildDerivationPath(
    section: HierarchicalSection,
    enhancedIndex: EnhancedProjectIndex
  ): string {
    const path = ['T0', 'T1'];

    // Build path through parent headings
    const buildPath = (currentSection: HierarchicalSection): void => {
      if (currentSection.parentSectionId) {
        const parent = enhancedIndex.hierarchicalSections.find(s =>
          s.id === currentSection.parentSectionId && s.nodeType === 'heading'
        );
        if (parent) {
          buildPath(parent);
        }
      }
      path.push(`T2:${currentSection.anchorId}`);
    };

    buildPath(section);
    return path.join('→');
  }

  /**
   * Split section intelligently using natural boundaries
   */
  private splitSectionIntelligently(section: {
    content: string;
    sectionId: string;
  }): string[] {
    const chunks: string[] = [];
    const targetChunkSize = 300; // tokens
    const maxChunkSize = 500; // tokens
    const overlapSize = 25; // tokens

    // Split by paragraphs first (preferred natural boundary)
    const paragraphs = section.content.split(/\n\s*\n/);
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokenCount(paragraph);

      // If adding this paragraph would exceed max size, save current chunk
      if (currentTokens + paragraphTokens > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());

        // Start new chunk with overlap from previous chunk
        const overlapContent = this.getLastNTokens(currentChunk, overlapSize);
        currentChunk = overlapContent + '\n\n' + paragraph;
        currentTokens = this.estimateTokenCount(currentChunk);
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      }

      // If current chunk reaches target size, consider saving it
      if (currentTokens >= targetChunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }
    }

    // Add final chunk if any content remains
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [section.content];
  }

  /**
   * Get last N tokens from content for overlap
   */
  private getLastNTokens(content: string, tokenCount: number): string {
    const words = content.split(/\s+/);
    const wordCount = Math.floor(tokenCount * 0.75); // Rough token to word conversion
    return words.slice(-wordCount).join(' ');
  }

  /**
   * Calculate chunk start line within section
   */
  private calculateChunkStartLine(sectionContent: string, chunkContent: string, chunkIndex: number): number {
    const sectionLines = sectionContent.split('\n');
    const chunkLines = chunkContent.split('\n');

    // Find where this chunk starts in the section
    for (let i = 0; i <= sectionLines.length - chunkLines.length; i++) {
      const sectionSlice = sectionLines.slice(i, i + chunkLines.length).join('\n');
      if (sectionSlice.includes(chunkLines[0])) {
        return i;
      }
    }

    return chunkIndex * 10; // Fallback estimate
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
   * Validate that chunks don't cross heading boundaries
   */
  private validateHeadingBoundaries(chunks: TierContent[]): void {
    const t3Chunks = chunks.filter(c => c.tier === 3);

    for (const chunk of t3Chunks) {
      if (!chunk.sectionBounded) {
        console.warn(`Warning: T3 chunk ${chunk.chunkId} is not section-bounded`);
      }

      // Validate that chunk content doesn't contain heading markers
      const headingPattern = /^#{1,6}\s+/gm;
      if (headingPattern.test(chunk.content)) {
        throw new Error(
          `Invalid T3 chunk ${chunk.chunkId}: contains heading markers. ` +
          `T3 chunks must never cross heading boundaries.`
        );
      }
    }
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
      parentChunkId: chunk.parentChunkId || undefined,
      rootChunkId: chunk.rootChunkId || 'metadata',
      sectionGroup: chunk.sectionGroup || undefined,
      derivationPath: (chunk.metadata as any)?.derivationPath || `T${chunk.tier}`,
      sectionStartLine: (chunk as any).sectionStartLine || undefined,
      sectionEndLine: (chunk as any).sectionEndLine || undefined,
      sectionBounded: (chunk as any).sectionBounded || false,
      chunkIndexInSection: (chunk as any).chunkIndexInSection || undefined,
      metadata: chunk.metadata as Record<string, any>
    };
  }

  // Removed loadExistingT4Chunks - no longer needed with T0-T3 structure

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

  /**
   * Generate T3 heading-bounded chunks (actual content without AI summarization)
   * Enhanced with comprehensive diagnostics and logging
   */
  private async generateT3HeadingBoundedChunks(
    project: any,
    enhancedIndex: EnhancedProjectIndex
  ): Promise<TierContent[]> {
    const t3Chunks: TierContent[] = [];

    console.log(`[T3Generation] Starting T3 generation for project ${project.id}`);
    console.log(`[T3Generation] Total hierarchical sections: ${enhancedIndex.hierarchicalSections.length}`);

    // Analyze all sections for debugging
    const sectionAnalysis = this.analyzeSectionTypesForT3(enhancedIndex.hierarchicalSections);
    console.log(`[T3Generation] Section analysis:`, sectionAnalysis);

    // Get all content sections that have actual content (paragraphs and code blocks, not headings)
    const contentSections = enhancedIndex.hierarchicalSections.filter(s =>
      (s.nodeType === 'paragraph' || s.nodeType === 'codeBlock') && s.content.trim().length > 50
    );

    console.log(`[T3Generation] Content sections after filtering (paragraph/codeBlock >50 chars): ${contentSections.length}`);

    // If no content sections found, try alternative strategies
    if (contentSections.length === 0) {
      console.log(`[T3Generation] No content sections found, trying fallback strategies...`);
      
      // Strategy 1: Try with lower content threshold for paragraphs and code blocks
      const shortContentSections = enhancedIndex.hierarchicalSections.filter(s =>
        (s.nodeType === 'paragraph' || s.nodeType === 'codeBlock') && s.content.trim().length > 10
      );
      console.log(`[T3Generation] Short content sections (paragraph/codeBlock >10 chars): ${shortContentSections.length}`);

      // Strategy 2: Try all sections with content (including headings)
      const allSectionsWithContent = enhancedIndex.hierarchicalSections.filter(s =>
        s.content && s.content.trim().length > 20
      );
      console.log(`[T3Generation] All sections with content >20 chars: ${allSectionsWithContent.length}`);

      // Use the best available strategy
      if (shortContentSections.length > 0) {
        console.log(`[T3Generation] Using short content sections strategy`);
        for (const section of shortContentSections) {
          const t3Chunk = await this.createT3ChunkFromSection(section, project, enhancedIndex, 'short-content');
          if (t3Chunk) {
            t3Chunks.push(t3Chunk);
          }
        }
      } else if (allSectionsWithContent.length > 0) {
        console.log(`[T3Generation] Using all sections with content strategy`);
        for (const section of allSectionsWithContent) {
          const t3Chunk = await this.createT3ChunkFromSection(section, project, enhancedIndex, 'all-content');
          if (t3Chunk) {
            t3Chunks.push(t3Chunk);
          }
        }
      } else {
        console.log(`[T3Generation] No suitable sections found for T3 generation`);
      }
    } else {
      // Process normal content sections
      console.log(`[T3Generation] Using normal content sections strategy`);
      for (const section of contentSections) {
        const t3Chunk = await this.createT3ChunkFromSection(section, project, enhancedIndex, 'normal-content');
        if (t3Chunk) {
          t3Chunks.push(t3Chunk);
        }
      }
    }

    console.log(`[T3Generation] Generated ${t3Chunks.length} T3 chunks with original content`);
    
    // Log sample of generated chunks for debugging
    if (t3Chunks.length > 0) {
      console.log(`[T3Generation] Sample T3 chunk:`, {
        chunkId: t3Chunks[0].chunkId,
        title: t3Chunks[0].title,
        contentLength: t3Chunks[0].content.length,
        tokenCount: t3Chunks[0].tokenCount,
        parentChunkId: t3Chunks[0].parentChunkId
      });
    }

    return t3Chunks;
  }

  /**
   * Analyze section types for T3 generation debugging
   */
  private analyzeSectionTypesForT3(sections: HierarchicalSection[]): {
    totalSections: number;
    byNodeType: Record<string, number>;
    contentSectionsByLength: {
      empty: number;
      short: number; // 1-50 chars
      medium: number; // 51-200 chars
      long: number; // >200 chars
    };
    sampleSections: Array<{
      nodeType: string;
      contentLength: number;
      title?: string;
      id: string;
    }>;
  } {
    const byNodeType: Record<string, number> = {};
    const contentSectionsByLength = { empty: 0, short: 0, medium: 0, long: 0 };
    const sampleSections: Array<{
      nodeType: string;
      contentLength: number;
      title?: string;
      id: string;
    }> = [];

    sections.forEach((section, index) => {
      // Count by node type
      byNodeType[section.nodeType] = (byNodeType[section.nodeType] || 0) + 1;

      // Analyze content length
      const contentLength = section.content?.trim().length || 0;
      if (contentLength === 0) {
        contentSectionsByLength.empty++;
      } else if (contentLength <= 50) {
        contentSectionsByLength.short++;
      } else if (contentLength <= 200) {
        contentSectionsByLength.medium++;
      } else {
        contentSectionsByLength.long++;
      }

      // Collect samples (first 5 sections)
      if (index < 5) {
        sampleSections.push({
          nodeType: section.nodeType,
          contentLength,
          title: section.title,
          id: section.id
        });
      }
    });

    return {
      totalSections: sections.length,
      byNodeType,
      contentSectionsByLength,
      sampleSections
    };
  }

  /**
   * Create T3 chunk from section with enhanced logging
   */
  private async createT3ChunkFromSection(
    section: HierarchicalSection,
    project: any,
    enhancedIndex: EnhancedProjectIndex,
    strategy: string
  ): Promise<TierContent | null> {
    try {
      // Find the parent heading for this content section
      const parentHeading = this.findParentHeading(section, enhancedIndex.hierarchicalSections);

      // Generate content-derived title for T3 chunks
      const contentTitle = this.generateContentTitle(section.content);

      // Create T3 chunk with actual content (no AI summarization)
      const t3ChunkId = `t3-${project.slug}-${section.id}`;

      console.log(`[T3Generation] Creating T3 chunk with strategy '${strategy}':`, {
        chunkId: t3ChunkId,
        sectionId: section.id,
        contentLength: section.content.length,
        parentHeading: parentHeading?.title || 'none',
        title: contentTitle
      });

      const t3Chunk: TierContent = {
        tier: 3,
        chunkId: t3ChunkId,
        title: contentTitle, // Use content-derived title
        content: section.content, // Use actual content without summarization
        tokenCount: this.estimateTokenCount(section.content),
        parentChunkId: parentHeading?.anchorId || 'project-summary',
        rootChunkId: 'metadata',
        sectionGroup: parentHeading?.title || 'Content',
        derivationPath: 'T0 → T1 → T2 → T3',
        sectionStartLine: 0, // Default to 0
        sectionEndLine: section.content.split('\n').length - 1,
        sectionBounded: true, // T3 chunks are section-bounded
        chunkIndexInSection: 0, // Default to 0
        metadata: {
          type: 'content',
          importance: 0.7,
          source: 'original-content',
          generationMode: 'system',
          editable: true,
          aiGenerated: false, // T3 contains original content
          sectionId: section.id,
          parentHeadingId: parentHeading?.id,
          headingLevel: parentHeading?.headingLevel || 0,
          generationStrategy: strategy
        }
      };

      return t3Chunk;

    } catch (error) {
      console.error(`[T3Generation] Failed to create T3 chunk for section ${section.id}:`, error);
      return null;
    }
  }

  /**
   * Generate content-derived title for T3 chunks
   */
  private generateContentTitle(content: string): string {
    // Clean the content
    const cleanContent = content.trim();

    // Strategy 1: Use first sentence if it's a good length (10-80 chars)
    const sentences = cleanContent.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();

    if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 80) {
      return firstSentence;
    }

    // Strategy 2: Use first paragraph if it's reasonable (10-100 chars)
    const paragraphs = cleanContent.split(/\n\s*\n/);
    const firstParagraph = paragraphs[0]?.trim();

    if (firstParagraph && firstParagraph.length >= 10 && firstParagraph.length <= 100) {
      return firstParagraph;
    }

    // Strategy 3: Use first 60 characters with word boundary
    if (cleanContent.length > 60) {
      const truncated = cleanContent.substring(0, 60);
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 20 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }

    // Strategy 4: Use the content as-is if it's short
    return cleanContent.length > 0 ? cleanContent : 'Content Section';
  }

  /**
   * Find the parent heading for a content section
   */
  private findParentHeading(
    section: HierarchicalSection,
    allSections: HierarchicalSection[]
  ): HierarchicalSection | null {
    // Look for the closest preceding heading
    const sectionIndex = allSections.findIndex(s => s.id === section.id);
    if (sectionIndex === -1) return null;

    // Search backwards for the nearest heading
    for (let i = sectionIndex - 1; i >= 0; i--) {
      const candidate = allSections[i];
      if (candidate.nodeType === 'heading') {
        return candidate;
      }
    }

    return null;
  }
}