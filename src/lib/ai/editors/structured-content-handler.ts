/**
 * Structured content handler for managing JSON-based content structures
 * Handles block-based content modification and rich text formatting preservation
 */

import { StructuredContent, ContentBlock, TextChange } from './types';
import { ContentParser } from './content-parser';

export interface BlockModification {
  blockId: string;
  operation: 'update' | 'insert' | 'delete' | 'move';
  content?: Partial<ContentBlock>;
  position?: number;
  targetPosition?: number;
}

export interface FormattingPreservationOptions {
  preserveLinks: boolean;
  preserveImages: boolean;
  preserveFormatting: boolean;
  preserveStructure: boolean;
}

export interface ContentModificationResult {
  success: boolean;
  modifiedContent: StructuredContent;
  appliedChanges: BlockModification[];
  warnings: string[];
  errors: string[];
}

export class StructuredContentHandler {
  private content: StructuredContent;
  private preservationOptions: FormattingPreservationOptions;

  constructor(
    content: StructuredContent,
    preservationOptions: Partial<FormattingPreservationOptions> = {}
  ) {
    this.content = this.deepClone(content);
    this.preservationOptions = {
      preserveLinks: true,
      preserveImages: true,
      preserveFormatting: true,
      preserveStructure: true,
      ...preservationOptions
    };
  }

  /**
   * Apply text changes while preserving structure
   */
  applyTextChanges(changes: TextChange[]): ContentModificationResult {
    const result: ContentModificationResult = {
      success: true,
      modifiedContent: this.deepClone(this.content),
      appliedChanges: [],
      warnings: [],
      errors: []
    };

    try {
      // Sort changes by position (descending) to avoid position shifts
      const sortedChanges = [...changes].sort((a, b) => b.start - a.start);
      
      for (const change of sortedChanges) {
        const blockModifications = this.applyTextChangeToBlocks(change);
        result.appliedChanges.push(...blockModifications);
      }

      result.modifiedContent = this.content;
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to apply text changes: ${error}`);
    }

    return result;
  }

  /**
   * Apply block modifications
   */
  applyBlockModifications(modifications: BlockModification[]): ContentModificationResult {
    const result: ContentModificationResult = {
      success: true,
      modifiedContent: this.deepClone(this.content),
      appliedChanges: [],
      warnings: [],
      errors: []
    };

    try {
      for (const modification of modifications) {
        const success = this.applyBlockModification(modification);
        if (success) {
          result.appliedChanges.push(modification);
        } else {
          result.warnings.push(`Failed to apply modification to block ${modification.blockId}`);
        }
      }

      result.modifiedContent = this.content;
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to apply block modifications: ${error}`);
    }

    return result;
  }

  /**
   * Insert new block at position
   */
  insertBlock(block: ContentBlock, position?: number): boolean {
    try {
      if (position === undefined || position >= this.content.content.length) {
        this.content.content.push(block);
      } else {
        this.content.content.splice(position, 0, block);
      }
      return true;
    } catch (error) {
      console.error('Failed to insert block:', error);
      return false;
    }
  }

  /**
   * Update existing block
   */
  updateBlock(blockId: string, updates: Partial<ContentBlock>): boolean {
    try {
      const block = this.findBlockById(blockId);
      if (!block) {
        return false;
      }

      // Apply updates while preserving structure
      Object.assign(block, updates);
      
      // Ensure ID is not changed
      block.id = blockId;
      
      return true;
    } catch (error) {
      console.error('Failed to update block:', error);
      return false;
    }
  }

  /**
   * Delete block by ID
   */
  deleteBlock(blockId: string): boolean {
    try {
      return this.deleteBlockRecursive(this.content.content, blockId);
    } catch (error) {
      console.error('Failed to delete block:', error);
      return false;
    }
  }

  /**
   * Move block to new position
   */
  moveBlock(blockId: string, newPosition: number): boolean {
    try {
      const blockIndex = this.content.content.findIndex(block => block.id === blockId);
      if (blockIndex === -1) {
        return false;
      }

      const [block] = this.content.content.splice(blockIndex, 1);
      
      const insertPosition = Math.min(newPosition, this.content.content.length);
      this.content.content.splice(insertPosition, 0, block);
      
      return true;
    } catch (error) {
      console.error('Failed to move block:', error);
      return false;
    }
  }

  /**
   * Find blocks by type
   */
  findBlocksByType(type: string): ContentBlock[] {
    return this.findBlocksByTypeRecursive(this.content.content, type);
  }

  /**
   * Find blocks containing specific text
   */
  findBlocksByText(searchText: string, caseSensitive: boolean = false): ContentBlock[] {
    const search = caseSensitive ? searchText : searchText.toLowerCase();
    return this.findBlocksByTextRecursive(this.content.content, search, caseSensitive);
  }

  /**
   * Extract all links from content
   */
  extractLinks(): Array<{ blockId: string; href: string; text: string }> {
    const links: Array<{ blockId: string; href: string; text: string }> = [];
    this.extractLinksRecursive(this.content.content, links);
    return links;
  }

  /**
   * Extract all images from content
   */
  extractImages(): Array<{ blockId: string; src: string; alt: string }> {
    const images: Array<{ blockId: string; src: string; alt: string }> = [];
    this.extractImagesRecursive(this.content.content, images);
    return images;
  }

  /**
   * Preserve formatting during AI operations
   */
  preserveFormattingInText(originalText: string, modifiedText: string): string {
    if (!this.preservationOptions.preserveFormatting) {
      return modifiedText;
    }

    // Extract formatting markers from original text
    const formatMarkers = this.extractFormatMarkers(originalText);
    
    // Apply formatting to modified text
    return this.applyFormatMarkers(modifiedText, formatMarkers);
  }

  /**
   * Convert to different formats while preserving structure
   */
  toHtml(): string {
    return ContentParser.structuredToHtml(this.content);
  }

  toPlainText(): string {
    return ContentParser.extractPlainText(this.content);
  }

  toMarkdown(): string {
    return this.convertToMarkdown(this.content);
  }

  /**
   * Get content statistics
   */
  getStatistics(): {
    blockCount: number;
    wordCount: number;
    characterCount: number;
    linkCount: number;
    imageCount: number;
    blockTypes: Record<string, number>;
  } {
    const blockTypes: Record<string, number> = {};
    let blockCount = 0;
    
    this.countBlocksRecursive(this.content.content, blockTypes, (count) => {
      blockCount = count;
    });

    const plainText = this.toPlainText();
    const wordCount = plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
    const characterCount = plainText.length;
    const linkCount = this.extractLinks().length;
    const imageCount = this.extractImages().length;

    return {
      blockCount,
      wordCount,
      characterCount,
      linkCount,
      imageCount,
      blockTypes
    };
  }

  /**
   * Validate content structure
   */
  validate(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate overall structure
    if (!ContentParser.validateStructuredContent(this.content)) {
      errors.push('Invalid content structure');
    }

    // Validate individual blocks
    this.validateBlocksRecursive(this.content.content, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private methods
  private applyTextChangeToBlocks(change: TextChange): BlockModification[] {
    const modifications: BlockModification[] = [];
    let currentPosition = 0;

    for (const block of this.content.content) {
      const blockText = this.getBlockText(block);
      const blockStart = currentPosition;
      const blockEnd = currentPosition + blockText.length;

      // Check if change overlaps with this block
      if (change.start < blockEnd && change.end > blockStart) {
        const relativeStart = Math.max(0, change.start - blockStart);
        const relativeEnd = Math.min(blockText.length, change.end - blockStart);
        
        // Apply change to block content
        const newContent = blockText.substring(0, relativeStart) +
                          change.newText +
                          blockText.substring(relativeEnd);

        this.updateBlockText(block, newContent);
        
        modifications.push({
          blockId: block.id,
          operation: 'update',
          content: { content: newContent }
        });
      }

      currentPosition = blockEnd + 1; // +1 for newline between blocks
    }

    return modifications;
  }

  private applyBlockModification(modification: BlockModification): boolean {
    switch (modification.operation) {
      case 'update':
        return modification.content ? 
          this.updateBlock(modification.blockId, modification.content) : 
          false;
      
      case 'insert':
        return modification.content && modification.content.id ? 
          this.insertBlock(modification.content as ContentBlock, modification.position) : 
          false;
      
      case 'delete':
        return this.deleteBlock(modification.blockId);
      
      case 'move':
        return modification.targetPosition !== undefined ? 
          this.moveBlock(modification.blockId, modification.targetPosition) : 
          false;
      
      default:
        return false;
    }
  }

  private findBlockById(blockId: string): ContentBlock | null {
    return this.findBlockByIdRecursive(this.content.content, blockId);
  }

  private findBlockByIdRecursive(blocks: ContentBlock[], blockId: string): ContentBlock | null {
    for (const block of blocks) {
      if (block.id === blockId) {
        return block;
      }
      
      if (block.children) {
        const found = this.findBlockByIdRecursive(block.children, blockId);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }

  private deleteBlockRecursive(blocks: ContentBlock[], blockId: string): boolean {
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].id === blockId) {
        blocks.splice(i, 1);
        return true;
      }
      
      if (blocks[i].children) {
        if (this.deleteBlockRecursive(blocks[i].children!, blockId)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private findBlocksByTypeRecursive(blocks: ContentBlock[], type: string): ContentBlock[] {
    const found: ContentBlock[] = [];
    
    for (const block of blocks) {
      if (block.type === type) {
        found.push(block);
      }
      
      if (block.children) {
        found.push(...this.findBlocksByTypeRecursive(block.children, type));
      }
    }
    
    return found;
  }

  private findBlocksByTextRecursive(
    blocks: ContentBlock[], 
    searchText: string, 
    caseSensitive: boolean
  ): ContentBlock[] {
    const found: ContentBlock[] = [];
    
    for (const block of blocks) {
      const blockText = caseSensitive ? block.content : block.content.toLowerCase();
      if (blockText.includes(searchText)) {
        found.push(block);
      }
      
      if (block.children) {
        found.push(...this.findBlocksByTextRecursive(block.children, searchText, caseSensitive));
      }
    }
    
    return found;
  }

  private extractLinksRecursive(
    blocks: ContentBlock[], 
    links: Array<{ blockId: string; href: string; text: string }>
  ): void {
    for (const block of blocks) {
      if (block.type === 'link' && block.attributes?.href) {
        links.push({
          blockId: block.id,
          href: block.attributes.href,
          text: block.content
        });
      }
      
      if (block.children) {
        this.extractLinksRecursive(block.children, links);
      }
    }
  }

  private extractImagesRecursive(
    blocks: ContentBlock[], 
    images: Array<{ blockId: string; src: string; alt: string }>
  ): void {
    for (const block of blocks) {
      if (block.type === 'image' && block.attributes?.src) {
        images.push({
          blockId: block.id,
          src: block.attributes.src,
          alt: block.attributes.alt || block.content
        });
      }
      
      if (block.children) {
        this.extractImagesRecursive(block.children, images);
      }
    }
  }

  private getBlockText(block: ContentBlock): string {
    let text = block.content;
    
    if (block.children) {
      text += block.children.map(child => this.getBlockText(child)).join(' ');
    }
    
    return text;
  }

  private updateBlockText(block: ContentBlock, newText: string): void {
    block.content = newText;
  }

  private extractFormatMarkers(text: string): Array<{ type: string; start: number; end: number; data?: any }> {
    const markers: Array<{ type: string; start: number; end: number; data?: any }> = [];
    
    // Extract markdown-style formatting
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
      { regex: /\*(.*?)\*/g, type: 'italic' },
      { regex: /`(.*?)`/g, type: 'code' },
      { regex: /\[(.*?)\]\((.*?)\)/g, type: 'link' }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        markers.push({
          type: pattern.type,
          start: match.index,
          end: match.index + match[0].length,
          data: pattern.type === 'link' ? { href: match[2], text: match[1] } : undefined
        });
      }
    }

    return markers.sort((a, b) => a.start - b.start);
  }

  private applyFormatMarkers(
    text: string, 
    markers: Array<{ type: string; start: number; end: number; data?: any }>
  ): string {
    // This is a simplified implementation
    // In a real scenario, you'd need more sophisticated formatting preservation
    return text;
  }

  private convertToMarkdown(content: StructuredContent): string {
    return content.content.map(block => this.blockToMarkdown(block)).join('\n\n');
  }

  private blockToMarkdown(block: ContentBlock): string {
    switch (block.type) {
      case 'heading':
        const level = block.attributes?.level || 1;
        return '#'.repeat(level) + ' ' + block.content;
      
      case 'paragraph':
        return block.content;
      
      case 'list':
        const items = block.children?.map(child => '- ' + child.content).join('\n') || '';
        return items;
      
      case 'code':
        const language = block.attributes?.language || '';
        return '```' + language + '\n' + block.content + '\n```';
      
      case 'quote':
        return '> ' + block.content;
      
      case 'link':
        const href = block.attributes?.href || '#';
        return `[${block.content}](${href})`;
      
      case 'image':
        const src = block.attributes?.src || '';
        const alt = block.attributes?.alt || block.content;
        return `![${alt}](${src})`;
      
      default:
        return block.content;
    }
  }

  private countBlocksRecursive(
    blocks: ContentBlock[], 
    blockTypes: Record<string, number>,
    setTotal: (count: number) => void
  ): void {
    let totalCount = 0;
    
    for (const block of blocks) {
      totalCount++;
      blockTypes[block.type] = (blockTypes[block.type] || 0) + 1;
      
      if (block.children) {
        this.countBlocksRecursive(block.children, blockTypes, (childCount) => {
          totalCount += childCount;
        });
      }
    }
    
    setTotal(totalCount);
  }

  private validateBlocksRecursive(
    blocks: ContentBlock[], 
    errors: string[], 
    warnings: string[]
  ): void {
    for (const block of blocks) {
      // Validate required fields
      if (!block.id) {
        errors.push(`Block missing ID: ${JSON.stringify(block)}`);
      }
      
      if (!block.type) {
        errors.push(`Block missing type: ${block.id}`);
      }
      
      // Validate content
      if (block.content === undefined && (!block.children || block.children.length === 0)) {
        warnings.push(`Block has no content or children: ${block.id}`);
      }
      
      // Validate children
      if (block.children) {
        this.validateBlocksRecursive(block.children, errors, warnings);
      }
    }
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}