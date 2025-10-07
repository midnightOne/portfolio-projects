/**
 * T3 Heading-Bounded Chunking
 * 
 * Chunks content between headings (H1/H2/H3) by token limits,
 * never crossing heading boundaries.
 */

import { EnhancedProjectIndex, HierarchicalSection } from '../services/project-indexer';
import { TierContent } from './SmartContentGenerator';

export class T3HeadingBoundedChunking {
  private readonly TARGET_CHUNK_TOKENS = 300;
  private readonly MAX_CHUNK_TOKENS = 400;

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

      console.log(`[T3Generation] Processing heading: "${currentHeading.title}" (H${currentHeading.headingLevel})`);

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
        const t3Chunk: TierContent = {
          tier: 3,
          chunkId: `t3-${currentHeading.anchorId}-${chunkIndex}`,
          title: chunkIndex === 0 
            ? currentHeading.title 
            : `${currentHeading.title} (part ${chunkIndex + 1})`,
          content: chunkContent,
          tokenCount: this.estimateTokenCount(chunkContent),
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
   * Chunk content by token limits while respecting sentence/paragraph boundaries
   */
  private chunkContentByTokens(content: string): string[] {
    const chunks: string[] = [];
    const totalTokens = this.estimateTokenCount(content);

    // If content is small enough, return as single chunk
    if (totalTokens <= this.MAX_CHUNK_TOKENS) {
      return [content];
    }

    // Split by paragraphs first (double newline)
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokenCount(paragraph);
      
      // If this single paragraph is too large, split it by sentences
      if (paragraphTokens > this.MAX_CHUNK_TOKENS) {
        // Save current chunk if it has content
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }
        
        // Split large paragraph by sentences
        const sentences = this.splitBySentences(paragraph);
        let sentenceChunk = '';
        let sentenceTokens = 0;
        
        for (const sentence of sentences) {
          const sentTokens = this.estimateTokenCount(sentence);
          
          if (sentenceTokens + sentTokens > this.MAX_CHUNK_TOKENS && sentenceChunk.length > 0) {
            chunks.push(sentenceChunk.trim());
            sentenceChunk = sentence;
            sentenceTokens = sentTokens;
          } else {
            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            sentenceTokens += sentTokens;
          }
        }
        
        if (sentenceChunk.trim().length > 0) {
          chunks.push(sentenceChunk.trim());
        }
        continue;
      }
      
      // Check if adding this paragraph exceeds max tokens
      if (currentTokens + paragraphTokens > this.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        // Save current chunk and start new one
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      } else {
        // Add to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Split text by sentences
   */
  private splitBySentences(text: string): string[] {
    // Split by sentence-ending punctuation followed by space or newline
    return text
      .split(/([.!?]+[\s\n]+)/)
      .reduce((acc: string[], part, i, arr) => {
        if (i % 2 === 0 && part.trim()) {
          const sentence = part + (arr[i + 1] || '');
          acc.push(sentence);
        }
        return acc;
      }, [])
      .filter(s => s.trim().length > 0);
  }

  /**
   * Estimate token count (~4 chars per token)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

