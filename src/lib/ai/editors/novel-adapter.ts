/**
 * Novel adapter for JSON-based content structures
 * Handles Novel editor's specific JSON format and block-based editing
 */

import { BaseEditorAdapter } from './base-adapter';
import { EditorCapabilities, TextSelection, TextChange, StructuredContent, ContentBlock } from './types';

export class NovelAdapter extends BaseEditorAdapter {
  private editor: any; // Novel editor instance
  private selectionCheckInterval: NodeJS.Timeout | null = null;
  private lastSelection: TextSelection | null = null;

  constructor(editor: any) {
    super('novel', {
      supportsRichText: true,
      supportsStructuredContent: true,
      supportsUndo: true,
      supportsSelection: true,
      supportsFormatting: true,
      supportedFormats: ['application/json', 'text/html', 'text/plain']
    });

    this.editor = editor;
    this.setupEventListeners();
    this.startSelectionMonitoring();
  }

  getContent(): StructuredContent {
    if (!this.editor) {
      return { type: 'doc', content: [] };
    }

    try {
      // Get Novel's JSON content
      const json = this.editor.getJSON();
      return this.convertNovelToStructured(json);
    } catch (error) {
      this.notifyError(new Error(`Failed to get Novel content: ${error}`));
      return { type: 'doc', content: [] };
    }
  }

  setContent(content: string | StructuredContent): void {
    if (!this.editor) {
      throw new Error('Novel editor not available');
    }

    try {
      if (typeof content === 'string') {
        // Convert plain text to Novel's JSON structure
        const novelContent = this.convertTextToNovel(content);
        this.editor.setContent(novelContent);
      } else {
        // Convert structured content to Novel format
        const novelContent = this.convertStructuredToNovel(content);
        this.editor.setContent(novelContent);
      }
      
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to set Novel content: ${error}`));
    }
  }

  getSelection(): TextSelection | null {
    if (!this.editor) {
      return null;
    }

    try {
      const selection = this.editor.getSelection();
      
      if (!selection || selection.empty) {
        return null;
      }

      // Calculate text positions in the flattened content
      const textContent = this.getTextContent();
      const { from, to } = selection;
      
      // Convert Novel's position to text position
      const textPositions = this.convertNovelPositionsToText(from, to);
      
      if (!textPositions) {
        return null;
      }

      const selectedText = textContent.substring(textPositions.start, textPositions.end);
      
      return this.createSelectionContext({
        text: selectedText,
        start: textPositions.start,
        end: textPositions.end
      });
    } catch (error) {
      this.notifyError(new Error(`Failed to get Novel selection: ${error}`));
      return null;
    }
  }

  setSelection(start: number, end: number): void {
    if (!this.editor) {
      return;
    }

    try {
      // Convert text positions to Novel's position format
      const novelPositions = this.convertTextPositionsToNovel(start, end);
      
      if (novelPositions) {
        this.editor.setSelection(novelPositions.from, novelPositions.to);
        this.editor.focus();
      }
    } catch (error) {
      this.notifyError(new Error(`Failed to set Novel selection: ${error}`));
    }
  }

  applyChange(change: TextChange): void {
    if (!this.editor) {
      throw new Error('Novel editor not available');
    }

    this.validateChange(change);

    try {
      // Convert text positions to Novel positions
      const novelPositions = this.convertTextPositionsToNovel(change.start, change.end);
      
      if (!novelPositions) {
        throw new Error('Failed to convert text positions to Novel positions');
      }

      // Apply the change using Novel's API
      this.editor.replaceRange(
        novelPositions.from,
        novelPositions.to,
        change.newText
      );
      
      // Update cursor position
      const newTextPosition = change.start + change.newText.length;
      const newNovelPosition = this.convertTextPositionsToNovel(newTextPosition, newTextPosition);
      
      if (newNovelPosition) {
        this.editor.setSelection(newNovelPosition.from, newNovelPosition.from);
      }
      
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to apply Novel change: ${error}`));
    }
  }

  focus(): void {
    if (this.editor && this.editor.focus) {
      this.editor.focus();
    }
  }

  blur(): void {
    if (this.editor && this.editor.blur) {
      this.editor.blur();
    }
  }

  destroy(): void {
    this.stopSelectionMonitoring();
    this.removeEventListeners();
    
    if (this.editor && this.editor.destroy) {
      this.editor.destroy();
    }
  }

  // Novel-specific methods
  insertBlock(type: string, content?: any, position?: number): void {
    if (!this.editor) {
      return;
    }

    try {
      const blockData = this.createNovelBlock(type, content);
      
      if (position !== undefined) {
        this.editor.insertBlockAt(position, blockData);
      } else {
        this.editor.insertBlock(blockData);
      }
      
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to insert Novel block: ${error}`));
    }
  }

  updateBlock(blockId: string, updates: Partial<ContentBlock>): void {
    if (!this.editor) {
      return;
    }

    try {
      this.editor.updateBlock(blockId, updates);
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to update Novel block: ${error}`));
    }
  }

  deleteBlock(blockId: string): void {
    if (!this.editor) {
      return;
    }

    try {
      this.editor.deleteBlock(blockId);
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to delete Novel block: ${error}`));
    }
  }

  // Private methods
  private setupEventListeners(): void {
    if (!this.editor) {
      return;
    }

    this.editor.on('update', this.handleUpdate);
    this.editor.on('focus', this.handleFocus);
    this.editor.on('blur', this.handleBlur);
    this.editor.on('selectionUpdate', this.handleSelectionUpdate);
  }

  private removeEventListeners(): void {
    if (!this.editor) {
      return;
    }

    this.editor.off('update', this.handleUpdate);
    this.editor.off('focus', this.handleFocus);
    this.editor.off('blur', this.handleBlur);
    this.editor.off('selectionUpdate', this.handleSelectionUpdate);
  }

  private handleUpdate = (): void => {
    this.notifyContentChange();
  };

  private handleFocus = (): void => {
    if (this.eventHandlers.onFocus) {
      this.eventHandlers.onFocus();
    }
  };

  private handleBlur = (): void => {
    if (this.eventHandlers.onBlur) {
      this.eventHandlers.onBlur();
    }
  };

  private handleSelectionUpdate = (): void => {
    // Novel provides its own selection update events
    const currentSelection = this.getSelection();
    
    if (JSON.stringify(currentSelection) !== JSON.stringify(this.lastSelection)) {
      this.lastSelection = currentSelection;
      this.notifySelectionChange(currentSelection);
    }
  };

  private startSelectionMonitoring(): void {
    // Novel has built-in selection events, but we'll keep a fallback
    this.selectionCheckInterval = setInterval(() => {
      this.checkSelectionChange();
    }, 200); // Less frequent since Novel has events
  }

  private stopSelectionMonitoring(): void {
    if (this.selectionCheckInterval) {
      clearInterval(this.selectionCheckInterval);
      this.selectionCheckInterval = null;
    }
  }

  private checkSelectionChange(): void {
    const currentSelection = this.getSelection();
    
    if (JSON.stringify(currentSelection) !== JSON.stringify(this.lastSelection)) {
      this.lastSelection = currentSelection;
      this.notifySelectionChange(currentSelection);
    }
  }

  private convertNovelToStructured(novelContent: any): StructuredContent {
    if (!novelContent || !novelContent.blocks) {
      return { type: 'doc', content: [] };
    }

    return {
      type: 'doc',
      content: novelContent.blocks.map((block: any) => this.convertNovelBlock(block)),
      version: novelContent.version || '1.0'
    };
  }

  private convertNovelBlock(block: any): ContentBlock {
    return {
      id: block.id || this.generateId(),
      type: this.mapNovelType(block.type),
      content: this.extractNovelBlockContent(block),
      attributes: block.props || {},
      children: block.children ? block.children.map((child: any) => this.convertNovelBlock(child)) : undefined
    };
  }

  private convertStructuredToNovel(structured: StructuredContent): any {
    return {
      type: 'doc',
      blocks: structured.content.map(block => this.convertStructuredBlockToNovel(block)),
      version: structured.version || '1.0'
    };
  }

  private convertStructuredBlockToNovel(block: ContentBlock): any {
    const novelBlock: any = {
      id: block.id,
      type: this.mapStructuredTypeToNovel(block.type),
      props: block.attributes || {},
      content: []
    };

    if (block.children && block.children.length > 0) {
      novelBlock.children = block.children.map(child => this.convertStructuredBlockToNovel(child));
    } else if (block.content) {
      // Convert text content to Novel's inline content format
      novelBlock.content = [{ type: 'text', text: block.content }];
    }

    return novelBlock;
  }

  private convertTextToNovel(text: string): any {
    const paragraphs = text.split('\n').filter(p => p.trim());
    
    return {
      type: 'doc',
      blocks: paragraphs.map((paragraph, index) => ({
        id: this.generateId(),
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: paragraph }]
      })),
      version: '1.0'
    };
  }

  private extractNovelBlockContent(block: any): string {
    if (!block.content) {
      return '';
    }

    return block.content
      .map((item: any) => {
        if (item.type === 'text') {
          return item.text || '';
        }
        return '';
      })
      .join('');
  }

  private convertNovelPositionsToText(from: number, to: number): { start: number; end: number } | null {
    // This is a simplified implementation
    // In a real implementation, you'd need to traverse the Novel document structure
    // and calculate text positions based on the block structure
    
    try {
      const textContent = this.getTextContent();
      const maxLength = textContent.length;
      
      // Clamp positions to valid range
      const start = Math.max(0, Math.min(from, maxLength));
      const end = Math.max(start, Math.min(to, maxLength));
      
      return { start, end };
    } catch (error) {
      return null;
    }
  }

  private convertTextPositionsToNovel(start: number, end: number): { from: number; to: number } | null {
    // This is a simplified implementation
    // In a real implementation, you'd need to map text positions back to Novel's
    // block-based position system
    
    try {
      return { from: start, to: end };
    } catch (error) {
      return null;
    }
  }

  private createNovelBlock(type: string, content?: any): any {
    const blockTypes: Record<string, any> = {
      paragraph: {
        type: 'paragraph',
        props: {},
        content: content ? [{ type: 'text', text: content }] : []
      },
      heading: {
        type: 'heading',
        props: { level: content?.level || 1 },
        content: content?.text ? [{ type: 'text', text: content.text }] : []
      },
      list: {
        type: 'bulletListItem',
        props: {},
        content: content ? [{ type: 'text', text: content }] : []
      },
      code: {
        type: 'codeBlock',
        props: { language: content?.language || 'text' },
        content: content?.code ? [{ type: 'text', text: content.code }] : []
      },
      quote: {
        type: 'blockquote',
        props: {},
        content: content ? [{ type: 'text', text: content }] : []
      }
    };

    const blockData = blockTypes[type] || blockTypes.paragraph;
    blockData.id = this.generateId();
    
    return blockData;
  }

  private mapNovelType(novelType: string): ContentBlock['type'] {
    const typeMap: Record<string, ContentBlock['type']> = {
      'paragraph': 'paragraph',
      'heading': 'heading',
      'bulletListItem': 'list',
      'numberedListItem': 'list',
      'codeBlock': 'code',
      'blockquote': 'quote',
      'image': 'image',
      'link': 'link'
    };

    return typeMap[novelType] || 'paragraph';
  }

  private mapStructuredTypeToNovel(structuredType: string): string {
    const typeMap: Record<string, string> = {
      'paragraph': 'paragraph',
      'heading': 'heading',
      'list': 'bulletListItem',
      'code': 'codeBlock',
      'quote': 'blockquote',
      'image': 'image',
      'link': 'link'
    };

    return typeMap[structuredType] || 'paragraph';
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}