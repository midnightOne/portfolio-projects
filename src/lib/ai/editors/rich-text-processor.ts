/**
 * Rich text processor for handling formatting preservation during AI operations
 * Manages links, media elements, and formatting in AI responses
 */

import { StructuredContent, ContentBlock } from './types';

export interface RichTextElement {
  type: 'link' | 'image' | 'bold' | 'italic' | 'code' | 'heading';
  start: number;
  end: number;
  attributes: Record<string, any>;
  content: string;
}

export interface MediaElement {
  type: 'image' | 'video' | 'audio';
  src: string;
  alt?: string;
  title?: string;
  attributes: Record<string, any>;
  position: number;
}

export interface LinkElement {
  href: string;
  text: string;
  title?: string;
  position: number;
  length: number;
}

export interface FormattingPreservationResult {
  processedText: string;
  preservedElements: RichTextElement[];
  warnings: string[];
  errors: string[];
}

export class RichTextProcessor {
  private preserveLinks: boolean;
  private preserveImages: boolean;
  private preserveFormatting: boolean;
  private preserveStructure: boolean;

  constructor(options: {
    preserveLinks?: boolean;
    preserveImages?: boolean;
    preserveFormatting?: boolean;
    preserveStructure?: boolean;
  } = {}) {
    this.preserveLinks = options.preserveLinks ?? true;
    this.preserveImages = options.preserveImages ?? true;
    this.preserveFormatting = options.preserveFormatting ?? true;
    this.preserveStructure = options.preserveStructure ?? true;
  }

  /**
   * Process AI response while preserving rich text elements
   */
  processAIResponse(
    originalContent: string | StructuredContent,
    aiResponse: string,
    context?: { preserveOriginalStructure?: boolean }
  ): FormattingPreservationResult {
    const result: FormattingPreservationResult = {
      processedText: aiResponse,
      preservedElements: [],
      warnings: [],
      errors: []
    };

    try {
      if (typeof originalContent === 'string') {
        return this.processPlainTextResponse(originalContent, aiResponse);
      } else {
        return this.processStructuredResponse(originalContent, aiResponse, context);
      }
    } catch (error) {
      result.errors.push(`Failed to process AI response: ${error}`);
      return result;
    }
  }

  /**
   * Extract rich text elements from content
   */
  extractRichTextElements(content: string | StructuredContent): RichTextElement[] {
    if (typeof content === 'string') {
      return this.extractFromPlainText(content);
    } else {
      return this.extractFromStructuredContent(content);
    }
  }

  /**
   * Extract all links from content
   */
  extractLinks(content: string | StructuredContent): LinkElement[] {
    const elements = this.extractRichTextElements(content);
    return elements
      .filter(el => el.type === 'link')
      .map(el => ({
        href: el.attributes.href || '',
        text: el.content,
        title: el.attributes.title,
        position: el.start,
        length: el.end - el.start
      }));
  }

  /**
   * Extract all media elements from content
   */
  extractMediaElements(content: string | StructuredContent): MediaElement[] {
    const elements = this.extractRichTextElements(content);
    return elements
      .filter(el => el.type === 'image')
      .map(el => ({
        type: 'image' as const,
        src: el.attributes.src || '',
        alt: el.attributes.alt || el.content,
        title: el.attributes.title,
        attributes: el.attributes,
        position: el.start
      }));
  }

  /**
   * Preserve links in AI-modified text
   */
  preserveLinksInText(originalText: string, modifiedText: string): string {
    if (!this.preserveLinks) {
      return modifiedText;
    }

    const originalLinks = this.extractLinks(originalText);
    if (originalLinks.length === 0) {
      return modifiedText;
    }

    let result = modifiedText;
    
    // Try to find and preserve links that still exist in modified text
    for (const link of originalLinks) {
      const linkTextInModified = this.findSimilarText(link.text, modifiedText);
      if (linkTextInModified) {
        const markdownLink = `[${linkTextInModified.text}](${link.href})`;
        result = result.replace(linkTextInModified.text, markdownLink);
      }
    }

    return result;
  }

  /**
   * Preserve images in AI-modified text
   */
  preserveImagesInText(originalText: string, modifiedText: string): string {
    if (!this.preserveImages) {
      return modifiedText;
    }

    const originalImages = this.extractMediaElements(originalText);
    if (originalImages.length === 0) {
      return modifiedText;
    }

    let result = modifiedText;
    
    // Preserve image references
    for (const image of originalImages) {
      const markdownImage = `![${image.alt || ''}](${image.src})`;
      
      // Try to find a good place to insert the image
      const insertPosition = this.findBestImagePosition(result, image.alt || '');
      if (insertPosition !== -1) {
        result = result.slice(0, insertPosition) + 
                markdownImage + 
                result.slice(insertPosition);
      } else {
        // Append at the end if no good position found
        result += '\n\n' + markdownImage;
      }
    }

    return result;
  }

  /**
   * Apply formatting preservation to structured content
   */
  preserveFormattingInStructured(
    originalContent: StructuredContent,
    modifiedBlocks: ContentBlock[]
  ): ContentBlock[] {
    if (!this.preserveFormatting) {
      return modifiedBlocks;
    }

    const result: ContentBlock[] = [];
    
    for (let i = 0; i < modifiedBlocks.length; i++) {
      const modifiedBlock = modifiedBlocks[i];
      const originalBlock = this.findCorrespondingBlock(originalContent, modifiedBlock, i);
      
      if (originalBlock) {
        result.push(this.mergeBlockFormatting(originalBlock, modifiedBlock));
      } else {
        result.push(modifiedBlock);
      }
    }

    return result;
  }

  /**
   * Handle link preservation in AI responses
   */
  handleLinksInAIResponse(
    originalLinks: LinkElement[],
    aiResponse: string
  ): { processedResponse: string; preservedLinks: LinkElement[] } {
    let processedResponse = aiResponse;
    const preservedLinks: LinkElement[] = [];

    for (const link of originalLinks) {
      // Try to find the link text or similar text in AI response
      const similarText = this.findSimilarText(link.text, aiResponse);
      
      if (similarText) {
        // Replace with markdown link
        const markdownLink = `[${similarText.text}](${link.href})`;
        processedResponse = processedResponse.replace(similarText.text, markdownLink);
        
        preservedLinks.push({
          ...link,
          text: similarText.text,
          position: similarText.position
        });
      }
    }

    return { processedResponse, preservedLinks };
  }

  /**
   * Handle media elements in AI responses
   */
  handleMediaInAIResponse(
    originalMedia: MediaElement[],
    aiResponse: string
  ): { processedResponse: string; preservedMedia: MediaElement[] } {
    let processedResponse = aiResponse;
    const preservedMedia: MediaElement[] = [];

    for (const media of originalMedia) {
      if (media.type === 'image') {
        // Try to find reference to the image in AI response
        const imageRef = this.findImageReference(media, aiResponse);
        
        if (imageRef) {
          const markdownImage = `![${media.alt || ''}](${media.src})`;
          processedResponse = processedResponse.replace(imageRef.text, markdownImage);
          
          preservedMedia.push({
            ...media,
            position: imageRef.position
          });
        } else {
          // Add image at appropriate location
          const insertPosition = this.findBestImagePosition(processedResponse, media.alt || '');
          const markdownImage = `![${media.alt || ''}](${media.src})`;
          
          if (insertPosition !== -1) {
            processedResponse = processedResponse.slice(0, insertPosition) + 
                              markdownImage + '\n\n' +
                              processedResponse.slice(insertPosition);
          } else {
            processedResponse += '\n\n' + markdownImage;
          }
          
          preservedMedia.push(media);
        }
      }
    }

    return { processedResponse, preservedMedia };
  }

  /**
   * Validate rich text elements after processing
   */
  validateRichTextElements(
    elements: RichTextElement[],
    processedText: string
  ): { valid: RichTextElement[]; invalid: RichTextElement[]; warnings: string[] } {
    const valid: RichTextElement[] = [];
    const invalid: RichTextElement[] = [];
    const warnings: string[] = [];

    for (const element of elements) {
      try {
        // Check if element positions are still valid
        if (element.start >= 0 && element.end <= processedText.length) {
          const actualContent = processedText.substring(element.start, element.end);
          
          if (actualContent === element.content) {
            valid.push(element);
          } else {
            invalid.push(element);
            warnings.push(`Element content mismatch: expected "${element.content}", got "${actualContent}"`);
          }
        } else {
          invalid.push(element);
          warnings.push(`Element position out of bounds: ${element.start}-${element.end} in text of length ${processedText.length}`);
        }
      } catch (error) {
        invalid.push(element);
        warnings.push(`Error validating element: ${error}`);
      }
    }

    return { valid, invalid, warnings };
  }

  // Private methods
  private processPlainTextResponse(
    originalText: string,
    aiResponse: string
  ): FormattingPreservationResult {
    let processedText = aiResponse;
    const preservedElements: RichTextElement[] = [];
    const warnings: string[] = [];

    // Extract elements from original text
    const originalElements = this.extractFromPlainText(originalText);
    
    // Preserve links
    if (this.preserveLinks) {
      const linkResult = this.handleLinksInAIResponse(
        this.extractLinks(originalText),
        processedText
      );
      processedText = linkResult.processedResponse;
    }

    // Preserve images
    if (this.preserveImages) {
      const mediaResult = this.handleMediaInAIResponse(
        this.extractMediaElements(originalText),
        processedText
      );
      processedText = mediaResult.processedResponse;
    }

    return {
      processedText,
      preservedElements,
      warnings,
      errors: []
    };
  }

  private processStructuredResponse(
    originalContent: StructuredContent,
    aiResponse: string,
    context?: { preserveOriginalStructure?: boolean }
  ): FormattingPreservationResult {
    // For structured content, we need to be more careful about preservation
    // This is a simplified implementation
    return this.processPlainTextResponse(
      this.extractPlainTextFromStructured(originalContent),
      aiResponse
    );
  }

  private extractFromPlainText(text: string): RichTextElement[] {
    const elements: RichTextElement[] = [];

    // Extract markdown-style links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      elements.push({
        type: 'link',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        attributes: { href: match[2] }
      });
    }

    // Extract markdown-style images
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imageRegex.exec(text)) !== null) {
      elements.push({
        type: 'image',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        attributes: { src: match[2], alt: match[1] }
      });
    }

    // Extract other formatting
    const formatPatterns = [
      { regex: /\*\*(.*?)\*\*/g, type: 'bold' as const },
      { regex: /\*(.*?)\*/g, type: 'italic' as const },
      { regex: /`(.*?)`/g, type: 'code' as const }
    ];

    for (const pattern of formatPatterns) {
      while ((match = pattern.regex.exec(text)) !== null) {
        elements.push({
          type: pattern.type,
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
          attributes: {}
        });
      }
    }

    return elements.sort((a, b) => a.start - b.start);
  }

  private extractFromStructuredContent(content: StructuredContent): RichTextElement[] {
    const elements: RichTextElement[] = [];
    let position = 0;

    for (const block of content.content) {
      const blockElements = this.extractFromBlock(block, position);
      elements.push(...blockElements);
      position += this.getBlockTextLength(block) + 1; // +1 for newline
    }

    return elements;
  }

  private extractFromBlock(block: ContentBlock, startPosition: number): RichTextElement[] {
    const elements: RichTextElement[] = [];

    if (block.type === 'link' && block.attributes?.href) {
      elements.push({
        type: 'link',
        start: startPosition,
        end: startPosition + block.content.length,
        content: block.content,
        attributes: block.attributes
      });
    } else if (block.type === 'image' && block.attributes?.src) {
      elements.push({
        type: 'image',
        start: startPosition,
        end: startPosition + block.content.length,
        content: block.content,
        attributes: block.attributes
      });
    }

    // Process children
    if (block.children) {
      let childPosition = startPosition;
      for (const child of block.children) {
        const childElements = this.extractFromBlock(child, childPosition);
        elements.push(...childElements);
        childPosition += this.getBlockTextLength(child);
      }
    }

    return elements;
  }

  private findSimilarText(
    targetText: string,
    searchText: string,
    threshold: number = 0.8
  ): { text: string; position: number } | null {
    const words = targetText.toLowerCase().split(/\s+/);
    const searchLower = searchText.toLowerCase();

    // Try exact match first
    const exactIndex = searchLower.indexOf(targetText.toLowerCase());
    if (exactIndex !== -1) {
      return {
        text: searchText.substring(exactIndex, exactIndex + targetText.length),
        position: exactIndex
      };
    }

    // Try partial matches
    for (const word of words) {
      if (word.length > 3) { // Only consider meaningful words
        const wordIndex = searchLower.indexOf(word);
        if (wordIndex !== -1) {
          // Found a word, try to extract surrounding context
          const start = Math.max(0, wordIndex - 20);
          const end = Math.min(searchText.length, wordIndex + word.length + 20);
          const context = searchText.substring(start, end);
          
          return {
            text: context.trim(),
            position: start
          };
        }
      }
    }

    return null;
  }

  private findImageReference(
    image: MediaElement,
    text: string
  ): { text: string; position: number } | null {
    const searchTerms = [
      image.alt,
      image.title,
      'image',
      'picture',
      'photo'
    ].filter(Boolean);

    for (const term of searchTerms) {
      if (term) {
        const index = text.toLowerCase().indexOf(term.toLowerCase());
        if (index !== -1) {
          return {
            text: term,
            position: index
          };
        }
      }
    }

    return null;
  }

  private findBestImagePosition(text: string, imageAlt: string): number {
    // Try to find a good position to insert the image
    const paragraphs = text.split('\n\n');
    
    if (imageAlt) {
      // Look for paragraphs that mention the image
      for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].toLowerCase().includes(imageAlt.toLowerCase())) {
          // Insert after this paragraph
          const position = paragraphs.slice(0, i + 1).join('\n\n').length;
          return position + 2; // +2 for \n\n
        }
      }
    }

    // Default to middle of text
    return Math.floor(text.length / 2);
  }

  private findCorrespondingBlock(
    originalContent: StructuredContent,
    modifiedBlock: ContentBlock,
    index: number
  ): ContentBlock | null {
    // Try to find by ID first
    if (modifiedBlock.id) {
      const found = this.findBlockById(originalContent.content, modifiedBlock.id);
      if (found) return found;
    }

    // Try to find by index
    if (index < originalContent.content.length) {
      return originalContent.content[index];
    }

    // Try to find by content similarity
    return this.findSimilarBlock(originalContent.content, modifiedBlock);
  }

  private findBlockById(blocks: ContentBlock[], id: string): ContentBlock | null {
    for (const block of blocks) {
      if (block.id === id) {
        return block;
      }
      if (block.children) {
        const found = this.findBlockById(block.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private findSimilarBlock(blocks: ContentBlock[], target: ContentBlock): ContentBlock | null {
    // Simple similarity based on type and content length
    for (const block of blocks) {
      if (block.type === target.type && 
          Math.abs(block.content.length - target.content.length) < 50) {
        return block;
      }
    }
    return null;
  }

  private mergeBlockFormatting(original: ContentBlock, modified: ContentBlock): ContentBlock {
    return {
      ...modified,
      attributes: {
        ...original.attributes,
        ...modified.attributes
      }
    };
  }

  private getBlockTextLength(block: ContentBlock): number {
    let length = block.content.length;
    if (block.children) {
      length += block.children.reduce((sum, child) => sum + this.getBlockTextLength(child), 0);
    }
    return length;
  }

  private extractPlainTextFromStructured(content: StructuredContent): string {
    return content.content.map(block => this.extractTextFromBlock(block)).join('\n');
  }

  private extractTextFromBlock(block: ContentBlock): string {
    let text = block.content;
    if (block.children) {
      text += ' ' + block.children.map(child => this.extractTextFromBlock(child)).join(' ');
    }
    return text;
  }
}