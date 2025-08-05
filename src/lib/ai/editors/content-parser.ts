/**
 * Content parser for handling different content formats
 * Supports conversion between plain text, HTML, and structured JSON
 */

import { StructuredContent, ContentBlock, ContentParseResult } from './types';

export class ContentParser {
  /**
   * Parse content and extract metadata
   */
  static parseContent(content: string | StructuredContent): ContentParseResult {
    if (typeof content === 'string') {
      return this.parseTextContent(content);
    } else {
      return this.parseStructuredContent(content);
    }
  }

  /**
   * Parse plain text content
   */
  private static parseTextContent(text: string): ContentParseResult {
    const plainText = text;
    const wordCount = this.countWords(text);
    const characterCount = text.length;
    const estimatedTokens = this.estimateTokens(text);
    
    // Check for basic formatting indicators
    const hasFormatting = this.detectBasicFormatting(text);
    const hasLinks = this.detectLinks(text);
    const hasImages = this.detectImages(text);

    return {
      plainText,
      metadata: {
        wordCount,
        characterCount,
        estimatedTokens,
        hasFormatting,
        hasLinks,
        hasImages
      }
    };
  }

  /**
   * Parse structured content
   */
  private static parseStructuredContent(content: StructuredContent): ContentParseResult {
    const plainText = this.extractPlainText(content);
    const wordCount = this.countWords(plainText);
    const characterCount = plainText.length;
    const estimatedTokens = this.estimateTokens(plainText);
    
    const hasFormatting = this.hasRichFormatting(content);
    const hasLinks = this.hasContentType(content, 'link');
    const hasImages = this.hasContentType(content, 'image');

    return {
      plainText,
      structuredContent: content,
      metadata: {
        wordCount,
        characterCount,
        estimatedTokens,
        hasFormatting,
        hasLinks,
        hasImages
      }
    };
  }

  /**
   * Extract plain text from structured content
   */
  static extractPlainText(content: StructuredContent): string {
    if (!content.content) {
      return '';
    }

    return content.content
      .map(block => this.extractTextFromBlock(block))
      .join('\n')
      .trim();
  }

  /**
   * Extract text from a content block
   */
  private static extractTextFromBlock(block: ContentBlock): string {
    let text = '';

    // Add the block's direct content
    if (block.content) {
      text += block.content;
    }

    // Add text from children
    if (block.children && block.children.length > 0) {
      const childText = block.children
        .map(child => this.extractTextFromBlock(child))
        .join(' ');
      text += (text ? ' ' : '') + childText;
    }

    return text;
  }

  /**
   * Convert plain text to structured content
   */
  static textToStructured(text: string): StructuredContent {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    const content: ContentBlock[] = paragraphs.map((paragraph, index) => ({
      id: this.generateId(),
      type: 'paragraph',
      content: paragraph.trim()
    }));

    return {
      type: 'doc',
      content,
      version: '1.0'
    };
  }

  /**
   * Convert HTML to structured content
   */
  static htmlToStructured(html: string): StructuredContent {
    // This is a simplified implementation
    // In a real scenario, you'd use a proper HTML parser
    
    const content: ContentBlock[] = [];
    
    // Simple regex-based parsing for common elements
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
    
    let match;
    
    // Parse paragraphs
    while ((match = paragraphRegex.exec(html)) !== null) {
      content.push({
        id: this.generateId(),
        type: 'paragraph',
        content: this.stripHtmlTags(match[1])
      });
    }
    
    // Parse headings
    while ((match = headingRegex.exec(html)) !== null) {
      content.push({
        id: this.generateId(),
        type: 'heading',
        content: this.stripHtmlTags(match[2]),
        attributes: { level: parseInt(match[1]) }
      });
    }
    
    // If no structured content found, treat as single paragraph
    if (content.length === 0) {
      content.push({
        id: this.generateId(),
        type: 'paragraph',
        content: this.stripHtmlTags(html)
      });
    }

    return {
      type: 'doc',
      content,
      version: '1.0'
    };
  }

  /**
   * Convert structured content to HTML
   */
  static structuredToHtml(content: StructuredContent): string {
    if (!content.content) {
      return '';
    }

    return content.content
      .map(block => this.blockToHtml(block))
      .join('\n');
  }

  /**
   * Convert a content block to HTML
   */
  private static blockToHtml(block: ContentBlock): string {
    switch (block.type) {
      case 'paragraph':
        return `<p>${this.escapeHtml(block.content)}</p>`;
      
      case 'heading':
        const level = block.attributes?.level || 1;
        return `<h${level}>${this.escapeHtml(block.content)}</h${level}>`;
      
      case 'list':
        const listItems = block.children
          ?.map(child => `<li>${this.escapeHtml(child.content)}</li>`)
          .join('\n') || '';
        return `<ul>\n${listItems}\n</ul>`;
      
      case 'code':
        const language = block.attributes?.language || '';
        return `<pre><code class="language-${language}">${this.escapeHtml(block.content)}</code></pre>`;
      
      case 'quote':
        return `<blockquote>${this.escapeHtml(block.content)}</blockquote>`;
      
      case 'link':
        const href = block.attributes?.href || '#';
        return `<a href="${this.escapeHtml(href)}">${this.escapeHtml(block.content)}</a>`;
      
      case 'image':
        const src = block.attributes?.src || '';
        const alt = block.attributes?.alt || block.content || '';
        return `<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}" />`;
      
      default:
        return `<p>${this.escapeHtml(block.content)}</p>`;
    }
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate token count
   */
  private static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Detect basic formatting in plain text
   */
  private static detectBasicFormatting(text: string): boolean {
    // Look for markdown-like formatting
    const formatPatterns = [
      /\*\*.*?\*\*/, // Bold
      /\*.*?\*/, // Italic
      /`.*?`/, // Code
      /^#+\s/, // Headings
      /^\s*[-*+]\s/, // Lists
      /^\s*\d+\.\s/ // Numbered lists
    ];

    return formatPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect links in text
   */
  private static detectLinks(text: string): boolean {
    const linkPatterns = [
      /https?:\/\/[^\s]+/,
      /\[.*?\]\(.*?\)/, // Markdown links
      /<a\s+[^>]*href/i // HTML links
    ];

    return linkPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect images in text
   */
  private static detectImages(text: string): boolean {
    const imagePatterns = [
      /!\[.*?\]\(.*?\)/, // Markdown images
      /<img\s+[^>]*src/i // HTML images
    ];

    return imagePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if structured content has rich formatting
   */
  private static hasRichFormatting(content: StructuredContent): boolean {
    if (!content.content) {
      return false;
    }

    return content.content.some(block => 
      block.type !== 'paragraph' || 
      (block.attributes && Object.keys(block.attributes).length > 0) ||
      (block.children && block.children.length > 0)
    );
  }

  /**
   * Check if structured content has blocks of a specific type
   */
  private static hasContentType(content: StructuredContent, type: string): boolean {
    if (!content.content) {
      return false;
    }

    return this.findBlocksOfType(content.content, type).length > 0;
  }

  /**
   * Find all blocks of a specific type
   */
  private static findBlocksOfType(blocks: ContentBlock[], type: string): ContentBlock[] {
    const found: ContentBlock[] = [];

    for (const block of blocks) {
      if (block.type === type) {
        found.push(block);
      }

      if (block.children) {
        found.push(...this.findBlocksOfType(block.children, type));
      }
    }

    return found;
  }

  /**
   * Strip HTML tags from text
   */
  private static stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Escape HTML characters
   */
  private static escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
  }

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Validate structured content
   */
  static validateStructuredContent(content: StructuredContent): boolean {
    try {
      if (!content || typeof content !== 'object') {
        return false;
      }

      if (content.type !== 'doc') {
        return false;
      }

      if (!Array.isArray(content.content)) {
        return false;
      }

      // Validate each block
      return content.content.every(block => this.validateContentBlock(block));
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate a content block
   */
  private static validateContentBlock(block: ContentBlock): boolean {
    if (!block || typeof block !== 'object') {
      return false;
    }

    if (!block.id || typeof block.id !== 'string') {
      return false;
    }

    if (!block.type || typeof block.type !== 'string') {
      return false;
    }

    if (block.content !== undefined && typeof block.content !== 'string') {
      return false;
    }

    if (block.children && !Array.isArray(block.children)) {
      return false;
    }

    // Recursively validate children
    if (block.children) {
      return block.children.every(child => this.validateContentBlock(child));
    }

    return true;
  }
}