/**
 * Smart Content Generator with Simplified T0-T3 Structure and Heading-Bounded Chunking
 *
 * Produces the SCAFFOLD for the stage-based pipeline (D28/D48):
 * - T0: Project metadata (system-generated, no AI, no manual edit, 1 per project)
 * - T1: Placeholder (filled by the summaries stage, 1 per project)
 * - T2: Heading chunks (H1/H2/H3 with parent-child nesting) — auto-populated
 *   verbatim when the CUMULATIVE subtree fits the budget, otherwise a
 *   placeholder for the summaries stage (Req 9.3 cumulative parents)
 * - T3: Heading-bounded verbatim chunks (never cross heading boundaries)
 *
 * No AI calls and no provider clients live here: summaries belong to the
 * summaries stage (SummaryGenerationService → the M1 secondary-LLM job path),
 * embeddings to the embeddings stage. The legacy one-shot
 * `generateHierarchicalContent` path (pre-stage-pipeline) was removed in the
 * 2026-07-12 hygiene pass along with its OpenAI client.
 */

import { HierarchicalContentParser, EnhancedProjectIndex, HierarchicalSection } from './HierarchicalContentParser';
import { T3HeadingBoundedChunking } from './T3HeadingBoundedChunking';
import ChunkingConfigService from './ChunkingConfigService';

export interface TierContent {
  tier: number;
  chunkId: string;
  title?: string;
  content: string;
  tokenCount: number;
  embedding?: number[];
  embeddingModel?: string; // actual model id used for `embedding` (D4 — never hardcoded)
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
  private contentParser: HierarchicalContentParser;
  private t3Chunker: T3HeadingBoundedChunking;

  constructor(chunkingConfig?: { targetChunkSize?: number; maxSectionSize?: number; minSectionSize?: number; sectionBoundaryOverlap?: number; splitStrategy?: 'paragraph' | 'sentence' | 'token' }) {
    this.contentParser = HierarchicalContentParser.getInstance();

    // Initialize T3 chunker with config
    this.t3Chunker = new T3HeadingBoundedChunking(chunkingConfig);
  }

  /**
   * Generate scaffold: T0, placeholders (T1, T2), and fully populated T3 chunks.
   * NO AI summary generation - that happens in the summaries stage (for T1 and large T2s)
   */
  async generateScaffoldOnly(project: any): Promise<SmartGenerationResult> {
    const startTime = Date.now();

    console.log('[SmartContentGenerator] Generating scaffold (T0 + placeholders + T3)...');

    // Get enhanced project index
    const enhancedIndex = await this.contentParser.indexProjectHierarchical(project.id);

    const tiers: TierContent[] = [];

    // T0: System metadata (no AI, no manual edit)
    tiers.push(await this.generateT0Metadata(project));

    // T1: Create placeholder (to be filled by summaries stage)
    tiers.push(this.createT1Placeholder(project, enhancedIndex));

    // T3: Generate fully populated terminal chunks from actual content FIRST
    // We need these to determine if T2s can use raw content
    const t3Chunks = this.t3Chunker.generateT3Chunks(project, enhancedIndex);

    // Get T2 max length from chunking config (in tokens)
    const chunkingConfigService = ChunkingConfigService.getInstance();
    const chunkingConfig = await chunkingConfigService.getDefaultConfig();
    const t2MaxTokens = chunkingConfig.t2MaxLength; // Already in tokens

    console.log(`[SmartContentGenerator] Using T2 max length from config: ${t2MaxTokens} tokens`);

    // T2: Create chunks for all headings
    // If section content fits budget, use raw content; otherwise create placeholder
    const headingSections = enhancedIndex.hierarchicalSections.filter(s =>
      s.nodeType === 'heading' && s.headingLevel >= 1 && s.headingLevel <= 3
    );

    let t2AutoPopulated = 0;
    let t2PlaceholdersCreated = 0;

    for (const section of headingSections) {
      const t2Chunk = await this.createT2ChunkOrPlaceholder(section, project, enhancedIndex, t3Chunks, t2MaxTokens);
      tiers.push(t2Chunk);

      if (t2Chunk.metadata.needsAIGeneration) {
        t2PlaceholdersCreated++;
      } else {
        t2AutoPopulated++;
      }
    }

    // Add all T3 chunks
    tiers.push(...t3Chunks);

    console.log(`[SmartContentGenerator] Scaffold complete: T0=1, T1=1, T2=${headingSections.length} (${t2AutoPopulated} auto-populated, ${t2PlaceholdersCreated} placeholders), T3=${t3Chunks.length}`);

    // Validate that chunks don't cross heading boundaries
    this.validateHeadingBoundaries(tiers);

    const processingTime = Date.now() - startTime;

    return {
      tiers,
      costSavings: {
        sectionsSkipped: 0,
        tokensSkipped: 0,
        estimatedCostSaved: 0
      },
      processingStats: {
        totalSections: enhancedIndex.hierarchicalSections.length,
        regeneratedSections: 0, // No summaries generated yet
        reusedSections: 0,
        processingTime
      }
    };
  }

  /**
   * Create T1 placeholder (empty, marked for AI generation)
   */
  private createT1Placeholder(project: any, enhancedIndex: EnhancedProjectIndex): TierContent {
    return {
      tier: 1,
      chunkId: 'summary',
      title: `${project.title} - Project Summary`,
      content: '[TO BE GENERATED BY SUMMARIES STAGE]',
      tokenCount: 0,
      parentChunkId: 'metadata',
      rootChunkId: 'metadata',
      derivationPath: 'metadata → summary',
      metadata: {
        type: 'project-summary',
        placeholder: true,
        needsAIGeneration: true,
        editable: true,
        source: 'pending-ai',
        generationMode: 'pending'
      }
    };
  }

  /**
   * Create T2 chunk - use raw content if it fits budget, otherwise create placeholder
   */
  private async createT2ChunkOrPlaceholder(
    section: HierarchicalSection,
    project: any,
    enhancedIndex: EnhancedProjectIndex,
    t3Chunks: TierContent[],
    t2MaxTokens: number
  ): Promise<TierContent> {
    // Determine parent chunk ID
    let parentChunkId = 'summary'; // Default to T1
    if (section.headingLevel > 1 && section.parentSectionId) {
      const parentSection = enhancedIndex.hierarchicalSections.find(s =>
        s.id === section.parentSectionId && s.nodeType === 'heading'
      );
      if (parentSection) {
        parentChunkId = parentSection.anchorId;
      }
    }

    // Cumulative subtree content (Req 9.3): a T2 represents its own prose PLUS
    // every descendant section's material. The auto-populate decision must be
    // made on the whole subtree — deciding on own-prose alone made parents
    // with children auto-populate excluding all child content.
    const descendantAnchorIds = this.getDescendantHeadingAnchorIds(section, enhancedIndex);
    const subtreeAnchorIds = new Set([section.anchorId, ...descendantAnchorIds]);
    const subtreeT3Chunks = t3Chunks.filter(
      t3 => t3.sectionGroup && subtreeAnchorIds.has(t3.sectionGroup)
    );
    const combinedContent = subtreeT3Chunks.map(t3 => t3.content).join('\n\n');
    const totalTokens = this.estimateTokenCount(combinedContent);

    // If the CUMULATIVE subtree fits within T2 budget, use it verbatim
    if (totalTokens <= t2MaxTokens && combinedContent.length > 0) {
      console.log(`[T2AutoPopulate] Section "${section.title}": subtree of ${subtreeT3Chunks.length} T3(s) across ${subtreeAnchorIds.size} section(s) = ${totalTokens} tokens fits budget (${t2MaxTokens}), using raw content`);

      return {
        tier: 2,
        chunkId: section.anchorId,
        title: section.title,
        content: combinedContent,
        tokenCount: totalTokens,
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
          placeholder: false,
          needsAIGeneration: false,
          editable: true,
          source: 'auto-populated',
          generationMode: 'extracted',
          contentHash: section.contentHash,
          includesSubsections: true,
          hasChildSections: descendantAnchorIds.length > 0,
          autoPopulated: true,
          originalTokenCount: totalTokens
        }
      };
    }

    // Subtree too large - create placeholder for cumulative AI summary
    console.log(`[T2Placeholder] Section "${section.title}": subtree ${totalTokens} tokens exceeds budget (${t2MaxTokens}), needs AI summary`);

    return {
      tier: 2,
      chunkId: section.anchorId,
      title: section.title,
      content: '[TO BE GENERATED BY SUMMARIES STAGE]',
      tokenCount: 0,
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
        placeholder: true,
        needsAIGeneration: true,
        editable: true,
        source: 'pending-ai',
        generationMode: 'pending',
        contentHash: section.contentHash,
        includesSubsections: true,
        hasChildSections: descendantAnchorIds.length > 0
      }
    };
  }

  /**
   * Anchor ids of every descendant heading of a section (transitive closure
   * over parentSectionId). Used to gather a T2's cumulative subtree.
   */
  private getDescendantHeadingAnchorIds(
    section: HierarchicalSection,
    enhancedIndex: EnhancedProjectIndex
  ): string[] {
    const headings = enhancedIndex.hierarchicalSections.filter(s => s.nodeType === 'heading');
    const byParent = new Map<string, HierarchicalSection[]>();
    for (const heading of headings) {
      if (!heading.parentSectionId) continue;
      const siblings = byParent.get(heading.parentSectionId) ?? [];
      siblings.push(heading);
      byParent.set(heading.parentSectionId, siblings);
    }

    const anchorIds: string[] = [];
    const stack = [section.id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const child of byParent.get(id) ?? []) {
        anchorIds.push(child.anchorId);
        stack.push(child.id);
      }
    }
    return anchorIds;
  }

  /**
   * Generate T0 metadata tier (system-generated, no AI, no manual edit, 1 per project)
   */
  private async generateT0Metadata(project: any): Promise<TierContent> {
    const content = JSON.stringify({
      title: project.title,
      tags: project.tags?.map((tag: any) => tag.name) || [],
      technologies: project.tags?.map((tag: any) => tag.name) || [],
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

  private estimateTokenCount(content: string): number {
    return Math.ceil(content.length / 4);
  }
}
