/**
 * T3 Heading-Bounded Chunking
 * 
 * Chunks content between headings (H1/H2/H3) by token limits,
 * never crossing heading boundaries.
 */

import { EnhancedProjectIndex, HierarchicalSection } from './HierarchicalContentParser';
import { TierContent } from './SmartContentGenerator';
import { chunkTextByParagraphs } from './bounded-text-chunking';

export interface ChunkingConfig {
  targetChunkSize: number;
  maxSectionSize: number;
  minSectionSize: number;
  sectionBoundaryOverlap: number;
  splitStrategy: 'paragraph' | 'sentence' | 'token';
}

export class T3HeadingBoundedChunking {
  private targetChunkTokens: number;
  private maxChunkTokens: number;
  private minSectionSize: number;
  private sectionOverlap: number;
  private splitStrategy: 'paragraph' | 'sentence' | 'token';

  constructor(config?: Partial<ChunkingConfig>) {
    // Use config if provided, otherwise use defaults
    this.targetChunkTokens = config?.targetChunkSize ?? 300;
    this.maxChunkTokens = config?.maxSectionSize ?? 400;
    this.minSectionSize = config?.minSectionSize ?? 50;
    this.sectionOverlap = config?.sectionBoundaryOverlap ?? 0;
    this.splitStrategy = config?.splitStrategy ?? 'token';
    
    console.log(`[T3HeadingBoundedChunking] Initialized with config:`, {
      targetChunkTokens: this.targetChunkTokens,
      maxChunkTokens: this.maxChunkTokens,
      minSectionSize: this.minSectionSize,
      sectionOverlap: this.sectionOverlap,
      splitStrategy: this.splitStrategy
    });
  }

  /**
   * Generate T3 chunks from hierarchical sections
   */
  generateT3Chunks(
    project: any,
    enhancedIndex: EnhancedProjectIndex
  ): TierContent[] {
    const t3Chunks: TierContent[] = [];

    console.log(`[T3Generation] Starting heading-bounded T3 generation for project ${project.id}`);

    // Get all heading sections (H1/H2/H3)
    const headings = enhancedIndex.hierarchicalSections.filter(s =>
      s.nodeType === 'heading' && s.headingLevel >= 1 && s.headingLevel <= 3
    );

    console.log(`[T3Generation] Found ${headings.length} heading sections (H1/H2/H3)`);

    // For each heading, collect all content until the next heading
    for (let i = 0; i < headings.length; i++) {
      const currentHeading = headings[i];
      const nextHeading = headings[i + 1];

      console.log(`[T3Generation] Processing heading: "${currentHeading.title}" (H${currentHeading.headingLevel}, anchorId: ${currentHeading.anchorId})`);

      // Find all content sections between this heading and the next
      const contentBetweenHeadings = this.collectContentBetweenHeadings(
        currentHeading,
        nextHeading,
        enhancedIndex.hierarchicalSections
      );

      if (contentBetweenHeadings.length === 0) {
        console.log(`[T3Generation] No content found for "${currentHeading.title}"`);
        continue;
      }

      // Combine all content into a single text block
      const combinedContent = contentBetweenHeadings.join('\n\n').trim();
      
      if (combinedContent.length < 10) {
        console.log(`[T3Generation] Skipping "${currentHeading.title}": content too short`);
        continue;
      }

      const tokenCount = this.estimateTokenCount(combinedContent);
      console.log(`[T3Generation] Section "${currentHeading.title}": ${combinedContent.length} chars, ~${tokenCount} tokens`);

      // Chunk the combined content by token limits
      const sectionChunks = this.chunkContentByTokens(combinedContent);

      console.log(`[T3Generation] Created ${sectionChunks.length} chunks for "${currentHeading.title}"`);

      // Create T3 chunks from the token-based splits
      sectionChunks.forEach((chunkContent, chunkIndex) => {
        const tokenCount = this.estimateTokenCount(chunkContent);
        
        console.log(`[T3Generation]   -> T3 chunk ${chunkIndex}: ${tokenCount} tokens, sectionGroup="${currentHeading.anchorId}"`);
        
        const t3Chunk: TierContent = {
          tier: 3,
          chunkId: `t3-${currentHeading.anchorId}-${chunkIndex}`,
          title: chunkIndex === 0 
            ? currentHeading.title 
            : `${currentHeading.title} (part ${chunkIndex + 1})`,
          content: chunkContent,
          tokenCount,
          parentChunkId: currentHeading.anchorId, // T2 chunk ID
          rootChunkId: 'metadata',
          sectionGroup: currentHeading.anchorId,
          derivationPath: `metadata → summary → ${currentHeading.anchorId} → chunk-${chunkIndex}`,
          sectionBounded: true,
          chunkIndexInSection: chunkIndex,
          metadata: {
            type: 'content-chunk',
            parentHeading: currentHeading.title,
            headingLevel: currentHeading.headingLevel,
            chunkIndexInSection: chunkIndex,
            totalChunksInSection: sectionChunks.length,
            sectionGroup: currentHeading.anchorId,
            source: 'original-content',
            generationMode: 'extracted',
            editable: true
          }
        };

        t3Chunks.push(t3Chunk);
      });
    }

    console.log(`[T3Generation] Generated ${t3Chunks.length} T3 chunks total`);
    
    return t3Chunks;
  }

  /**
   * Collect all content sections between two headings
   */
  private collectContentBetweenHeadings(
    currentHeading: HierarchicalSection,
    nextHeading: HierarchicalSection | undefined,
    allSections: HierarchicalSection[]
  ): string[] {
    const contentPieces: string[] = [];

    // Find the index range
    const startIndex = allSections.findIndex(s => s.id === currentHeading.id);
    const endIndex = nextHeading 
      ? allSections.findIndex(s => s.id === nextHeading.id)
      : allSections.length;

    // Collect all content sections between start and end
    for (let i = startIndex + 1; i < endIndex; i++) {
      const section = allSections[i];
      
      // Skip headings (we only want content)
      if (section.nodeType === 'heading') continue;
      
      // Include paragraphs, code blocks, lists, etc. - EVERYTHING between headings
      if (section.content && section.content.trim().length > 0) {
        contentPieces.push(section.content.trim());
      }
    }

    return contentPieces;
  }

  /**
   * Chunk content by token limits respecting the configured split strategy
   */
  private chunkContentByTokens(content: string): string[] {
    if (this.splitStrategy === 'token') {
      // Pure token-based splitting with overlap
      return this.chunkByPureTokens(content);
    } else if (this.splitStrategy === 'sentence') {
      // Split by sentences while respecting token limits
      return this.chunkBySentences(content);
    } else {
      // Split by paragraphs while respecting token limits
      return this.chunkByParagraphs(content);
    }
  }

  /**
   * Chunk by paragraphs while respecting token limits (original method)
   */
  private chunkByParagraphs(content: string): string[] {
    const chunks = chunkTextByParagraphs(content, {
      targetTokens: this.targetChunkTokens,
      maxTokens: this.maxChunkTokens,
    });
    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Chunk by sentences while respecting token limits
   */
  private chunkBySentences(text: string): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      // If adding this sentence would exceed MAX, save current chunk and start new
      if (currentTokens + sentenceTokens > this.maxChunkTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } 
      // If current chunk reaches TARGET, consider starting new chunk
      else if (currentTokens >= this.targetChunkTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      }
      // Otherwise, add to current chunk
      else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Chunk by pure token count with overlap
   */
  private chunkByPureTokens(content: string): string[] {
    const chunks: string[] = [];
    const words = content.split(/\s+/);
    const estimatedTokens = this.estimateTokenCount(content);
    
    if (estimatedTokens <= this.maxChunkTokens) {
      return [content];
    }
    
    let currentChunk: string[] = [];
    let currentTokens = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordTokens = this.estimateTokenCount(word);
      
      if (currentTokens + wordTokens > this.maxChunkTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        
        // Apply overlap: keep last N tokens
        if (this.sectionOverlap > 0) {
          const overlapWords = Math.ceil(this.sectionOverlap / 0.75); // Rough conversion
          currentChunk = currentChunk.slice(-overlapWords);
          currentTokens = this.estimateTokenCount(currentChunk.join(' '));
        } else {
          currentChunk = [];
          currentTokens = 0;
        }
      }
      
      currentChunk.push(word);
      currentTokens += wordTokens;
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Estimate token count (~4 chars per token)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
