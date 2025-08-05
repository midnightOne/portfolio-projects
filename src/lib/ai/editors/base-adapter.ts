/**
 * Base adapter class providing common functionality for all editor types
 */

import { 
  EditorAdapter, 
  EditorType, 
  EditorCapabilities, 
  TextSelection, 
  TextChange, 
  EditorState, 
  StructuredContent,
  EditorEventHandlers
} from './types';

export abstract class BaseEditorAdapter implements EditorAdapter {
  protected eventHandlers: EditorEventHandlers = {};
  protected _isDirty = false;
  protected _lastContent: string | StructuredContent = '';

  constructor(
    public readonly type: EditorType,
    public readonly capabilities: EditorCapabilities
  ) {}

  // Abstract methods that must be implemented by subclasses
  abstract getContent(): string | StructuredContent;
  abstract setContent(content: string | StructuredContent): void;
  abstract getSelection(): TextSelection | null;
  abstract setSelection(start: number, end: number): void;
  abstract applyChange(change: TextChange): void;
  abstract focus(): void;
  abstract blur(): void;
  abstract destroy(): void;

  // Common implementations
  getTextContent(): string {
    const content = this.getContent();
    if (typeof content === 'string') {
      return content;
    }
    return this.extractTextFromStructured(content);
  }

  clearSelection(): void {
    const selection = this.getSelection();
    if (selection) {
      this.setSelection(selection.start, selection.start);
    }
  }

  applyChanges(changes: TextChange[]): void {
    // Sort changes by position (descending) to avoid position shifts
    const sortedChanges = [...changes].sort((a, b) => b.start - a.start);
    
    for (const change of sortedChanges) {
      this.applyChange(change);
    }
  }

  getState(): EditorState {
    return {
      content: this.getContent(),
      selection: this.getSelection(),
      canUndo: this.capabilities.supportsUndo,
      canRedo: this.capabilities.supportsUndo,
      isDirty: this._isDirty
    };
  }

  onContentChange(callback: (content: string | StructuredContent) => void): void {
    this.eventHandlers.onContentChange = callback;
  }

  onSelectionChange(callback: (selection: TextSelection | null) => void): void {
    this.eventHandlers.onSelectionChange = callback;
  }

  estimateTokens(): number {
    const text = this.getTextContent();
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  getWordCount(): number {
    const text = this.getTextContent();
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  getCharacterCount(): number {
    return this.getTextContent().length;
  }

  // Protected helper methods
  protected extractTextFromStructured(content: StructuredContent): string {
    if (!content.content) return '';
    
    return content.content.map(block => this.extractTextFromBlock(block)).join('\n');
  }

  protected extractTextFromBlock(block: any): string {
    if (typeof block === 'string') return block;
    
    if (block.type === 'text') {
      return block.text || '';
    }
    
    if (block.content) {
      if (Array.isArray(block.content)) {
        return block.content.map((child: any) => this.extractTextFromBlock(child)).join('');
      }
      if (typeof block.content === 'string') {
        return block.content;
      }
    }
    
    if (block.children) {
      return block.children.map((child: any) => this.extractTextFromBlock(child)).join('');
    }
    
    return '';
  }

  protected notifyContentChange(): void {
    const currentContent = this.getContent();
    const hasChanged = JSON.stringify(currentContent) !== JSON.stringify(this._lastContent);
    
    if (hasChanged) {
      this._isDirty = true;
      this._lastContent = currentContent;
      
      if (this.eventHandlers.onContentChange) {
        this.eventHandlers.onContentChange(currentContent);
      }
    }
  }

  protected notifySelectionChange(selection: TextSelection | null): void {
    if (this.eventHandlers.onSelectionChange) {
      this.eventHandlers.onSelectionChange(selection);
    }
  }

  protected notifyError(error: Error): void {
    if (this.eventHandlers.onError) {
      this.eventHandlers.onError(error);
    } else {
      console.error('Editor adapter error:', error);
    }
  }

  protected validateChange(change: TextChange): void {
    const content = this.getTextContent();
    
    if (change.start < 0 || change.end > content.length || change.start > change.end) {
      throw new Error(`Invalid text change positions: start=${change.start}, end=${change.end}, content length=${content.length}`);
    }
  }

  protected createSelectionContext(selection: TextSelection, contextRadius: number = 100): TextSelection {
    const fullText = this.getTextContent();
    const beforeStart = Math.max(0, selection.start - contextRadius);
    const afterEnd = Math.min(fullText.length, selection.end + contextRadius);
    
    return {
      ...selection,
      context: {
        before: fullText.substring(beforeStart, selection.start),
        after: fullText.substring(selection.end, afterEnd)
      }
    };
  }
}