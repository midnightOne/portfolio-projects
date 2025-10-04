/**
 * Content Change Detection System
 * 
 * Implements surgical change detection for semantic content management.
 * Uses diff-based comparison to identify section-level changes without requiring
 * invisible IDs or cross-spec dependencies.
 * 
 * Key Features:
 * - Heading-bounded change detection
 * - Section-level cost estimation
 * - Surgical update recommendations
 * - Content hash-based change tracking
 * - Configurable thresholds
 */

import { prisma } from '@/lib/database/connection';
import { ProjectIndexer, HierarchicalSection } from '../services/project-indexer';
import crypto from 'crypto';

// Change detection interfaces
export interface ContentChangeDetection {
  projectId: string;
  previousHash: string;
  currentHash: string;
  changeScope: 'none' | 'minor' | 'moderate' | 'major' | 'new';
  sectionChanges: SectionChangeDetection[];
  affectedSections: SectionChangeDetection[];
  affectedChunks: AffectedChunk[];
  recommendedAction: 'skip' | 'selective' | 'full';
  estimatedCost: number;
  estimatedTokens: number;
  metrics: ChangeMetrics;
  detectedAt: Date;
}

export interface SectionChangeDetection {
  sectionId: string;
  headingText: string;
  headingLevel: number;
  changeType: 'unchanged' | 'content-modified' | 'heading-added' | 'heading-removed' | 'heading-moved';
  previousHash?: string;
  currentHash?: string;
  affectedT2ChunkId?: string;
  affectedT3ChunkIds: string[];
  regenerationRequired: boolean;
  estimatedTokens: number;
  estimatedCost: number;
}

export interface AffectedChunk {
  chunkId: string;
  tier: number;
  changeType: 'preserve' | 'regenerate' | 'delete';
  reason: string;
}

export interface ChangeMetrics {
  totalSections: number;
  unchangedSections: number;
  modifiedSections: number;
  addedSections: number;
  removedSections: number;
  movedSections: number;
  structuralChanges: boolean;
  characterChangePercentage: number;
  sectionModificationCount: number;
}

export interface HeadingMatch {
  oldHeading?: ParsedHeading;
  newHeading?: ParsedHeading;
  matchType: 'unchanged' | 'modified' | 'added' | 'removed' | 'moved';
  confidence: number; // 0-1 matching confidence
  similarityScore: number;
}

export interface ParsedHeading {
  id: string;
  text: string;
  level: number;
  position: number;
  sectionContent: string;
  contentHash: string;
  t2ChunkId?: string;
  t3ChunkIds: string[];
}

export interface ChangeDetectionConfig {
  sectionChangePercent: number;     // % sections changed to trigger full regen
  minorChangeThreshold: number;     // Max sections for "minor" classification
  characterChangeThreshold: number; // % character change for "moderate"
  headingMatchThreshold: number;    // Similarity threshold for heading matching
  costPerToken: number;             // Cost estimation per token
}

/**
 * Main ContentChangeDetector class
 */
export class ContentChangeDetector {
  private projectIndexer: ProjectIndexer;
  private config: ChangeDetectionConfig;

  // Cost estimation constants (approximate costs in USD)
  private readonly EMBEDDING_COST_PER_1K_TOKENS = 0.00002; // text-embedding-3-small
  private readonly GPT4_MINI_COST_PER_1K_TOKENS = 0.00015; // gpt-4o-mini input tokens

  constructor(config?: Partial<ChangeDetectionConfig>) {
    this.projectIndexer = ProjectIndexer.getInstance();
    this.config = {
      sectionChangePercent: 0.2,        // 20% sections changed = major
      minorChangeThreshold: 2,          // ≤2 sections = minor
      characterChangeThreshold: 0.05,   // 5% character change = moderate
      headingMatchThreshold: 0.7,       // 70% similarity for heading match
      costPerToken: this.GPT4_MINI_COST_PER_1K_TOKENS,
      ...config
    };
  }

  /**
   * Main change detection method
   * Detects changes between old and new content versions
   */
  async detectChanges(
    projectId: string,
    newContent: string,
    previousHash?: string
  ): Promise<ContentChangeDetection> {
    const detectedAt = new Date();
    
    // 1. Generate current content hash
    const currentHash = this.generateContentHash(newContent);
    
    // 2. Quick check: if overall hash matches, no changes
    if (previousHash && currentHash === previousHash) {
      return this.createNoChangeResult(projectId, previousHash, currentHash, detectedAt);
    }

    // 3. Get project data for analysis
    const project = await this.getProjectData(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // 4. Parse heading structures from both versions
    const newHeadings = await this.parseHeadingsFromContent(newContent, project);
    const oldHeadings = await this.getStoredHeadings(projectId);

    // 5. Detect section-level changes
    const sectionChanges = await this.detectSectionChanges(
      oldHeadings,
      newHeadings,
      newContent,
      project
    );

    // 6. Calculate change metrics
    const metrics = this.calculateChangeMetrics(oldHeadings, newHeadings, sectionChanges);

    // 7. Determine change scope
    const changeScope = this.determineChangeScope(metrics);

    // 8. Recommend action
    const recommendedAction = this.recommendAction(changeScope, sectionChanges);

    // 9. Estimate cost (only for affected sections)
    const { estimatedCost, estimatedTokens } = await this.estimateRegenerationCost(sectionChanges);

    // 10. Identify affected chunks
    const affectedChunks = await this.identifyAffectedChunks(projectId, sectionChanges);

    // 11. Filter affected sections (only those requiring regeneration)
    const affectedSections = sectionChanges.filter(s => s.regenerationRequired);

    return {
      projectId,
      previousHash: previousHash || '',
      currentHash,
      changeScope,
      sectionChanges,
      affectedSections,
      affectedChunks,
      recommendedAction,
      estimatedCost,
      estimatedTokens,
      metrics,
      detectedAt
    };
  }

  /**
   * Parse headings from content using ProjectIndexer
   */
  private async parseHeadingsFromContent(
    content: string,
    project: any
  ): Promise<ParsedHeading[]> {
    try {
      // Create a temporary project object with the new content
      const tempProject = {
        ...project,
        articleContent: {
          ...project.articleContent,
          content: content,
          jsonContent: this.parseContentToTiptap(content)
        }
      };

      // Use ProjectIndexer to get hierarchical sections
      const enhancedIndex = await this.projectIndexer.indexProjectHierarchical(project.id);
      
      // Convert hierarchical sections to ParsedHeading format
      const headings: ParsedHeading[] = [];
      
      for (const section of enhancedIndex.hierarchicalSections) {
        if (section.nodeType === 'heading' && section.headingLevel > 0) {
          const sectionContent = await this.extractSectionContent(section, content);
          
          headings.push({
            id: section.anchorId,
            text: section.title || '',
            level: section.headingLevel,
            position: section.startOffset,
            sectionContent,
            contentHash: this.generateContentHash(sectionContent),
            t2ChunkId: `h${section.headingLevel}-${section.anchorId}`,
            t3ChunkIds: this.generateT3ChunkIds(section, sectionContent)
          });
        }
      }

      return headings.sort((a, b) => a.position - b.position);
    } catch (error) {
      console.error('Error parsing headings from content:', error);
      return [];
    }
  }

  /**
   * Get stored headings from existing chunks
   */
  private async getStoredHeadings(projectId: string): Promise<ParsedHeading[]> {
    try {
      // Get project slug
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { slug: true }
      });

      if (!project) return [];

      // Get existing T2 chunks (headings)
      const existingChunks = await prisma.contextChunk.findMany({
        where: {
          entity: {
            entityType: 'PROJECT',
            slug: project.slug
          },
          tier: 2 // T2 chunks represent headings
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      const headings: ParsedHeading[] = [];

      for (const chunk of existingChunks) {
        const metadata = chunk.metadata as any;
        
        // Extract heading level from chunk ID or metadata
        const headingLevel = this.extractHeadingLevelFromChunkId(chunk.chunkId) || 
                           metadata?.headingLevel || 1;

        // Get associated T3 chunks
        const t3Chunks = await prisma.contextChunk.findMany({
          where: {
            parentChunkId: chunk.id,
            tier: 3
          },
          select: { chunkId: true }
        });

        // Get contentHash from chunk or generate it
        const chunkData = chunk as any; // Type assertion for fields that might not be in Prisma types
        const contentHash = chunkData.contentHash || this.generateContentHash(chunk.content);

        headings.push({
          id: chunk.chunkId.replace(/^h\d+-/, ''), // Remove heading prefix
          text: chunk.title || '',
          level: headingLevel,
          position: metadata?.position || 0,
          sectionContent: chunk.content,
          contentHash,
          t2ChunkId: chunk.chunkId,
          t3ChunkIds: t3Chunks.map(c => c.chunkId)
        });
      }

      return headings.sort((a, b) => a.position - b.position);
    } catch (error) {
      console.error('Error getting stored headings:', error);
      return [];
    }
  }

  /**
   * Detect changes at section level using heading-bounded approach
   */
  private async detectSectionChanges(
    oldHeadings: ParsedHeading[],
    newHeadings: ParsedHeading[],
    newContent: string,
    project: any
  ): Promise<SectionChangeDetection[]> {
    const changes: SectionChangeDetection[] = [];

    // 1. Match headings between old and new versions
    const headingMatches = this.matchHeadings(oldHeadings, newHeadings);

    // 2. Process each match to detect changes
    for (const match of headingMatches) {
      const change = await this.analyzeSectionChange(match, newContent, project);
      changes.push(change);
    }

    return changes;
  }

  /**
   * Match headings using text similarity and position proximity
   */
  private matchHeadings(
    oldHeadings: ParsedHeading[],
    newHeadings: ParsedHeading[]
  ): HeadingMatch[] {
    const matches: HeadingMatch[] = [];
    const usedNewHeadings = new Set<string>();
    const usedOldHeadings = new Set<string>();

    // 1. First pass: exact text matches
    for (const oldHeading of oldHeadings) {
      const exactMatch = newHeadings.find(
        newHeading => 
          !usedNewHeadings.has(newHeading.id) &&
          newHeading.text === oldHeading.text &&
          newHeading.level === oldHeading.level
      );

      if (exactMatch) {
        matches.push({
          oldHeading,
          newHeading: exactMatch,
          matchType: 'unchanged',
          confidence: 1.0,
          similarityScore: 1.0
        });
        usedNewHeadings.add(exactMatch.id);
        usedOldHeadings.add(oldHeading.id);
      }
    }

    // 2. Second pass: fuzzy text matches
    for (const oldHeading of oldHeadings) {
      if (usedOldHeadings.has(oldHeading.id)) continue;

      let bestMatch: ParsedHeading | null = null;
      let bestScore = 0;

      for (const newHeading of newHeadings) {
        if (usedNewHeadings.has(newHeading.id)) continue;

        const similarity = this.calculateTextSimilarity(oldHeading.text, newHeading.text);
        const levelMatch = oldHeading.level === newHeading.level ? 1 : 0.5;
        const positionProximity = this.calculatePositionProximity(
          oldHeading.position,
          newHeading.position,
          Math.max(oldHeadings.length, newHeadings.length)
        );

        const score = (similarity * 0.6) + (levelMatch * 0.3) + (positionProximity * 0.1);

        if (score > bestScore && score >= this.config.headingMatchThreshold) {
          bestScore = score;
          bestMatch = newHeading;
        }
      }

      if (bestMatch) {
        matches.push({
          oldHeading,
          newHeading: bestMatch,
          matchType: bestScore === 1.0 ? 'unchanged' : 'modified',
          confidence: bestScore,
          similarityScore: this.calculateTextSimilarity(oldHeading.text, bestMatch.text)
        });
        usedNewHeadings.add(bestMatch.id);
        usedOldHeadings.add(oldHeading.id);
      }
    }

    // 3. Handle unmatched headings
    for (const oldHeading of oldHeadings) {
      if (!usedOldHeadings.has(oldHeading.id)) {
        matches.push({
          oldHeading,
          matchType: 'removed',
          confidence: 1.0,
          similarityScore: 0
        });
      }
    }

    for (const newHeading of newHeadings) {
      if (!usedNewHeadings.has(newHeading.id)) {
        matches.push({
          newHeading,
          matchType: 'added',
          confidence: 1.0,
          similarityScore: 0
        });
      }
    }

    return matches;
  }

  /**
   * Analyze section change for a heading match
   */
  private async analyzeSectionChange(
    match: HeadingMatch,
    newContent: string,
    project: any
  ): Promise<SectionChangeDetection> {
    const { oldHeading, newHeading, matchType } = match;

    // Handle added headings
    if (matchType === 'added' && newHeading) {
      const estimatedTokens = this.estimateTokenCount(newHeading.sectionContent);
      return {
        sectionId: newHeading.id,
        headingText: newHeading.text,
        headingLevel: newHeading.level,
        changeType: 'heading-added',
        currentHash: newHeading.contentHash,
        affectedT3ChunkIds: newHeading.t3ChunkIds,
        regenerationRequired: true,
        estimatedTokens,
        estimatedCost: this.calculateSectionCost(estimatedTokens)
      };
    }

    // Handle removed headings
    if (matchType === 'removed' && oldHeading) {
      return {
        sectionId: oldHeading.id,
        headingText: oldHeading.text,
        headingLevel: oldHeading.level,
        changeType: 'heading-removed',
        previousHash: oldHeading.contentHash,
        affectedT2ChunkId: oldHeading.t2ChunkId,
        affectedT3ChunkIds: oldHeading.t3ChunkIds,
        regenerationRequired: false, // Just delete, no regeneration
        estimatedTokens: 0,
        estimatedCost: 0
      };
    }

    // Handle matched headings (unchanged or modified)
    if (oldHeading && newHeading) {
      const contentChanged = oldHeading.contentHash !== newHeading.contentHash;
      const estimatedTokens = contentChanged ? this.estimateTokenCount(newHeading.sectionContent) : 0;

      return {
        sectionId: newHeading.id,
        headingText: newHeading.text,
        headingLevel: newHeading.level,
        changeType: contentChanged ? 'content-modified' : 'unchanged',
        previousHash: oldHeading.contentHash,
        currentHash: newHeading.contentHash,
        affectedT2ChunkId: oldHeading.t2ChunkId,
        affectedT3ChunkIds: contentChanged ? newHeading.t3ChunkIds : [],
        regenerationRequired: contentChanged,
        estimatedTokens,
        estimatedCost: this.calculateSectionCost(estimatedTokens)
      };
    }

    // Fallback (shouldn't happen)
    throw new Error('Invalid heading match state');
  }

  /**
   * Calculate change metrics
   */
  private calculateChangeMetrics(
    oldHeadings: ParsedHeading[],
    newHeadings: ParsedHeading[],
    sectionChanges: SectionChangeDetection[]
  ): ChangeMetrics {
    const totalSections = newHeadings.length;
    const unchangedSections = sectionChanges.filter(s => s.changeType === 'unchanged').length;
    const modifiedSections = sectionChanges.filter(s => s.changeType === 'content-modified').length;
    const addedSections = sectionChanges.filter(s => s.changeType === 'heading-added').length;
    const removedSections = sectionChanges.filter(s => s.changeType === 'heading-removed').length;
    const movedSections = sectionChanges.filter(s => s.changeType === 'heading-moved').length;

    // Calculate character change percentage
    const oldTotalChars = oldHeadings.reduce((sum, h) => sum + h.sectionContent.length, 0);
    const newTotalChars = newHeadings.reduce((sum, h) => sum + h.sectionContent.length, 0);
    const characterChangePercentage = oldTotalChars > 0 
      ? Math.abs(newTotalChars - oldTotalChars) / oldTotalChars 
      : 1;

    // Check for structural changes
    const structuralChanges = addedSections > 0 || removedSections > 0 || movedSections > 0;

    return {
      totalSections,
      unchangedSections,
      modifiedSections,
      addedSections,
      removedSections,
      movedSections,
      structuralChanges,
      characterChangePercentage,
      sectionModificationCount: modifiedSections + addedSections + removedSections
    };
  }

  /**
   * Determine change scope based on metrics
   */
  private determineChangeScope(metrics: ChangeMetrics): 'none' | 'minor' | 'moderate' | 'major' | 'new' {
    const { 
      totalSections, 
      sectionModificationCount, 
      characterChangePercentage,
      structuralChanges 
    } = metrics;

    // No changes
    if (sectionModificationCount === 0) {
      return 'none';
    }

    // New content (no existing sections)
    if (totalSections > 0 && metrics.unchangedSections === 0) {
      return 'new';
    }

    // Major changes
    if (structuralChanges && sectionModificationCount > totalSections * this.config.sectionChangePercent) {
      return 'major';
    }

    // Moderate changes
    if (characterChangePercentage > this.config.characterChangeThreshold || 
        sectionModificationCount > this.config.minorChangeThreshold) {
      return 'moderate';
    }

    // Minor changes
    return 'minor';
  }

  /**
   * Recommend action based on change scope and section changes
   */
  private recommendAction(
    changeScope: 'none' | 'minor' | 'moderate' | 'major' | 'new',
    sectionChanges: SectionChangeDetection[]
  ): 'skip' | 'selective' | 'full' {
    switch (changeScope) {
      case 'none':
        return 'skip';
      
      case 'minor':
      case 'moderate':
        // Check if we can do selective regeneration
        const regenerationRequired = sectionChanges.filter(s => s.regenerationRequired).length;
        return regenerationRequired > 0 ? 'selective' : 'skip';
      
      case 'major':
      case 'new':
        return 'full';
      
      default:
        return 'selective';
    }
  }

  /**
   * Estimate regeneration cost for affected sections only
   */
  private async estimateRegenerationCost(
    sectionChanges: SectionChangeDetection[]
  ): Promise<{ estimatedCost: number; estimatedTokens: number }> {
    let totalTokens = 0;
    let totalCost = 0;

    for (const change of sectionChanges) {
      if (change.regenerationRequired) {
        totalTokens += change.estimatedTokens;
        totalCost += change.estimatedCost;
      }
    }

    return {
      estimatedCost: totalCost,
      estimatedTokens: totalTokens
    };
  }

  /**
   * Identify affected chunks for regeneration
   */
  private async identifyAffectedChunks(
    projectId: string,
    sectionChanges: SectionChangeDetection[]
  ): Promise<AffectedChunk[]> {
    const affectedChunks: AffectedChunk[] = [];

    for (const change of sectionChanges) {
      switch (change.changeType) {
        case 'unchanged':
          // Preserve existing chunks
          if (change.affectedT2ChunkId) {
            affectedChunks.push({
              chunkId: change.affectedT2ChunkId,
              tier: 2,
              changeType: 'preserve',
              reason: 'Section content unchanged'
            });
          }
          change.affectedT3ChunkIds.forEach(chunkId => {
            affectedChunks.push({
              chunkId,
              tier: 3,
              changeType: 'preserve',
              reason: 'Section content unchanged'
            });
          });
          break;

        case 'content-modified':
          // Regenerate T2 and T3 chunks for this section
          if (change.affectedT2ChunkId) {
            affectedChunks.push({
              chunkId: change.affectedT2ChunkId,
              tier: 2,
              changeType: 'regenerate',
              reason: 'Section content modified'
            });
          }
          change.affectedT3ChunkIds.forEach(chunkId => {
            affectedChunks.push({
              chunkId,
              tier: 3,
              changeType: 'regenerate',
              reason: 'Section content modified'
            });
          });
          break;

        case 'heading-added':
          // New chunks will be created (no existing chunks to affect)
          break;

        case 'heading-removed':
          // Delete existing chunks
          if (change.affectedT2ChunkId) {
            affectedChunks.push({
              chunkId: change.affectedT2ChunkId,
              tier: 2,
              changeType: 'delete',
              reason: 'Section removed'
            });
          }
          change.affectedT3ChunkIds.forEach(chunkId => {
            affectedChunks.push({
              chunkId,
              tier: 3,
              changeType: 'delete',
              reason: 'Section removed'
            });
          });
          break;
      }
    }

    return affectedChunks;
  }

  /**
   * Store change detection results for audit trail
   */
  async storeChangeDetectionResults(
    detection: ContentChangeDetection
  ): Promise<void> {
    try {
      // Store in a change detection log table (would need to be added to schema)
      // For now, we'll store in metadata of the content entity
      
      const project = await prisma.project.findUnique({
        where: { id: detection.projectId },
        select: { slug: true }
      });

      if (!project) return;

      // Update content entity with change detection metadata
      await prisma.contentEntity.updateMany({
        where: {
          entityType: 'PROJECT',
          slug: project.slug
        },
        data: {
          updatedAt: new Date()
          // Could add changeDetectionLog field to store detection results
        }
      });

      console.log(`🔍 Change detection completed for project ${detection.projectId}:`, {
        changeScope: detection.changeScope,
        affectedSections: detection.affectedSections.length,
        estimatedCost: detection.estimatedCost.toFixed(4),
        recommendedAction: detection.recommendedAction
      });

    } catch (error) {
      console.error('Error storing change detection results:', error);
    }
  }

  // Helper methods

  private createNoChangeResult(
    projectId: string,
    previousHash: string,
    currentHash: string,
    detectedAt: Date
  ): ContentChangeDetection {
    return {
      projectId,
      previousHash,
      currentHash,
      changeScope: 'none',
      sectionChanges: [],
      affectedSections: [],
      affectedChunks: [],
      recommendedAction: 'skip',
      estimatedCost: 0,
      estimatedTokens: 0,
      metrics: {
        totalSections: 0,
        unchangedSections: 0,
        modifiedSections: 0,
        addedSections: 0,
        removedSections: 0,
        movedSections: 0,
        structuralChanges: false,
        characterChangePercentage: 0,
        sectionModificationCount: 0
      },
      detectedAt
    };
  }

  private async getProjectData(projectId: string): Promise<any> {
    return await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        articleContent: true,
        tags: true
      }
    });
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private parseContentToTiptap(content: string): any {
    // Simple markdown-to-tiptap conversion
    // In a real implementation, this would be more sophisticated
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: content
            }
          ]
        }
      ]
    };
  }

  private async extractSectionContent(section: any, fullContent: string): Promise<string> {
    // If section has content property, use it directly
    if (section.content && section.content.length > 0) {
      return section.content;
    }
    
    // If section has markdownContent, use it
    if (section.markdownContent && section.markdownContent.length > 0) {
      return section.markdownContent;
    }
    
    // Fallback: Extract content based on position if offsets are available
    if (section.startOffset !== undefined && section.endOffset !== undefined) {
      const start = section.startOffset;
      const end = section.endOffset;
      return fullContent.substring(start, end);
    }
    
    // Last resort: return empty string (this shouldn't happen)
    console.warn(`Unable to extract content for section: ${section.title || section.id}`);
    return '';
  }

  private generateT3ChunkIds(section: any, sectionContent: string): string[] {
    // Generate T3 chunk IDs based on section content
    const chunkSize = 300; // tokens
    const estimatedTokens = this.estimateTokenCount(sectionContent);
    const numChunks = Math.ceil(estimatedTokens / chunkSize);
    
    const chunkIds: string[] = [];
    for (let i = 0; i < numChunks; i++) {
      chunkIds.push(`${section.anchorId}-chunk-${i}`);
    }
    
    return chunkIds;
  }

  private extractHeadingLevelFromChunkId(chunkId: string): number | null {
    const match = chunkId.match(/^h(\d+)-/);
    return match ? parseInt(match[1]) : null;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculatePositionProximity(pos1: number, pos2: number, maxDistance: number): number {
    const distance = Math.abs(pos1 - pos2);
    return Math.max(0, 1 - (distance / maxDistance));
  }

  private estimateTokenCount(text: string): number {
    // Use character-based approximation for token counting
    // GPT-4 tokenization: ~1 token per 4 characters for English text
    // This is more accurate than word-based (words/0.75) and doesn't require tiktoken WASM
    return Math.ceil(text.length / 4);
  }

  private calculateSectionCost(tokens: number): number {
    // Cost for both embedding and summarization
    const embeddingCost = (tokens / 1000) * this.EMBEDDING_COST_PER_1K_TOKENS;
    const summarizationCost = (tokens / 1000) * this.GPT4_MINI_COST_PER_1K_TOKENS;
    return embeddingCost + summarizationCost;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ChangeDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ChangeDetectionConfig {
    return { ...this.config };
  }
}

export default ContentChangeDetector;