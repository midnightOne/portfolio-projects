/**
 * Tiptap adapter for rich text editing
 * Handles JSON-based content structures and rich text operations
 */

import { BaseEditorAdapter } from './base-adapter';
import { EditorCapabilities, TextSelection, TextChange, StructuredContent, ContentBlock } from './types';

export class TiptapAdapter extends BaseEditorAdapter {
  private editor: any; // Tiptap editor instance
  private selectionCheckInterval: NodeJS.Timeout | null = null;
  private lastSelection: TextSelection | null = null;

  constructor(editor: any) {
    super('tiptap', {
      supportsRichText: true,
      supportsStructuredContent: true,
      supportsUndo: true,
      supportsSelection: true,
      supportsFormatting: true,
      supportedFormats: ['text/html', 'text/plain', 'application/json']
    });

    this.editor = editor;
    this.setupEventListeners();
    this.startSelectionMonitoring();
  }

  getContent(): StructuredContent {
    if (!this.editor) {
      return { type: 'doc', content: [] };
    }

    // Get Tiptap's JSON content
    const json = this.editor.getJSON();
    return this.convertTiptapToStructured(json);
  }

  setContent(content: string | StructuredContent): void {
    if (!this.editor) {
      throw new Error('Tiptap editor not available');
    }

    try {
      if (typeof content === 'string') {
        // Set as HTML or plain text
        if (content.includes('<')) {
          this.editor.commands.setContent(content);
        } else {
          this.editor.commands.setContent(`<p>${content}</p>`);
        }
      } else {
        // Convert structured content to Tiptap format
        const tiptapContent = this.convertStructuredToTiptap(content);
        this.editor.commands.setContent(tiptapContent);
      }
      
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to set Tiptap content: ${error}`));
    }
  }

  getSelection(): TextSelection | null {
    if (!this.editor) {
      return null;
    }

    try {
      const { from, to, empty } = this.editor.state.selection;
      
      if (empty) {
        return null;
      }

      // Get selected text
      const selectedText = this.editor.state.doc.textBetween(from, to);
      
      if (!selectedText) {
        return null;
      }

      return this.createSelectionContext({
        text: selectedText,
        start: from,
        end: to
      });
    } catch (error) {
      this.notifyError(new Error(`Failed to get Tiptap selection: ${error}`));
      return null;
    }
  }

  setSelection(start: number, end: number): void {
    if (!this.editor) {
      return;
    }

    try {
      this.editor.commands.setTextSelection({ from: start, to: end });
      this.editor.commands.focus();
    } catch (error) {
      this.notifyError(new Error(`Failed to set Tiptap selection: ${error}`));
    }
  }

  applyChange(change: TextChange): void {
    if (!this.editor) {
      throw new Error('Tiptap editor not available');
    }

    this.validateChange(change);

    try {
      // Use Tiptap's transaction system for precise text replacement
      const tr = this.editor.state.tr;
      
      // Replace text at the specified range
      tr.replaceWith(
        change.start,
        change.end,
        this.editor.schema.text(change.newText)
      );

      // Apply the transaction
      this.editor.view.dispatch(tr);
      
      // Update cursor position
      const newCursorPosition = change.start + change.newText.length;
      this.editor.commands.setTextSelection(newCursorPosition);
      
      this.notifyContentChange();
    } catch (error) {
      this.notifyError(new Error(`Failed to apply Tiptap change: ${error}`));
    }
  }

  focus(): void {
    if (this.editor && this.editor.commands) {
      this.editor.commands.focus();
    }
  }

  blur(): void {
    if (this.editor && this.editor.view) {
      this.editor.view.dom.blur();
    }
  }

  destroy(): void {
    this.stopSelectionMonitoring();
    this.removeEventListeners();
    
    if (this.editor && this.editor.destroy) {
      this.editor.destroy();
    }
  }

  // Rich text specific methods
  applyFormatting(format: string, attributes?: Record<string, any>): void {
    if (!this.editor) {
      return;
    }

    try {
      switch (format) {
        case 'bold':
          this.editor.commands.toggleBold();
          break;
        case 'italic':
          this.editor.commands.toggleItalic();
          break;
        case 'underline':
          this.editor.commands.toggleUnderline();
          break;
        case 'link':
          if (attributes?.href) {
            this.editor.commands.setLink({ href: attributes.href });
          }
          break;
        case 'heading':
          const level = attributes?.level || 1;
          this.editor.commands.toggleHeading({ level });
          break;
        default:
          console.warn(`Unsupported formatting: ${format}`);
      }
    } catch (error) {
      this.notifyError(new Error(`Failed to apply formatting: ${error}`));
    }
  }

  insertBlock(type: string, content?: string, attributes?: Record<string, any>): void {
    if (!this.editor) {
      return;
    }

    try {
      switch (type) {
        case 'paragraph':
          this.editor.commands.insertContent(`<p>${content || ''}</p>`);
          break;
        case 'heading':
          const level = attributes?.level || 1;
          this.editor.commands.insertContent(`<h${level}>${content || ''}</h${level}>`);
          break;
        case 'list':
          this.editor.commands.toggleBulletList();
          break;
        case 'code':
          this.editor.commands.insertContent(`<code>${content || ''}</code>`);
          break;
        default:
          console.warn(`Unsupported block type: ${type}`);
      }
    } catch (error) {
      this.notifyError(new Error(`Failed to insert block: ${error}`));
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
  }

  private removeEventListeners(): void {
    if (!this.editor) {
      return;
    }

    this.editor.off('update', this.handleUpdate);
    this.editor.off('focus', this.handleFocus);
    this.editor.off('blur', this.handleBlur);
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

  private startSelectionMonitoring(): void {
    this.selectionCheckInterval = setInterval(() => {
      this.checkSelectionChange();
    }, 100);
  }

  private stopSelectionMonitoring(): void {
    if (this.selectionCheckInterval) {
      clearInterval(this.selectionCheckInterval);
      this.selectionCheckInterval = null;
    }
  }

  private checkSelectionChange(): void {
    const currentSelection = this.getSelection();
    
    const selectionChanged = 
      (!this.lastSelection && currentSelection) ||
      (this.lastSelection && !currentSelection) ||
      (this.lastSelection && currentSelection && (
        this.lastSelection.start !== currentSelection.start ||
        this.lastSelection.end !== currentSelection.end ||
        this.lastSelection.text !== currentSelection.text
      ));

    if (selectionChanged) {
      this.lastSelection = currentSelection;
      this.notifySelectionChange(currentSelection);
    }
  }

  private convertTiptapToStructured(tiptapContent: any): StructuredContent {
    if (!tiptapContent || !tiptapContent.content) {
      return { type: 'doc', content: [] };
    }

    return {
      type: 'doc',
      content: tiptapContent.content.map((node: any) => this.convertTiptapNode(node)),
      version: '1.0'
    };
  }

  private convertTiptapNode(node: any): any {
    const converted: any = {
      id: this.generateId(),
      type: this.mapTiptapType(node.type),
      content: '',
      attributes: node.attrs || {}
    };

    if (node.content) {
      if (Array.isArray(node.content)) {
        converted.children = node.content.map((child: any) => this.convertTiptapNode(child));
        converted.content = converted.children.map((child: any) => child.content).join('');
      } else {
        converted.content = node.content;
      }
    }

    if (node.text) {
      converted.content = node.text;
    }

    return converted;
  }

  private convertStructuredToTiptap(structured: StructuredContent): any {
    return {
      type: 'doc',
      content: structured.content.map(block => this.convertStructuredBlock(block))
    };
  }

  private convertStructuredBlock(block: any): any {
    const tiptapNode: any = {
      type: this.mapStructuredType(block.type),
      attrs: block.attributes || {}
    };

    if (block.children && block.children.length > 0) {
      tiptapNode.content = block.children.map((child: any) => this.convertStructuredBlock(child));
    } else if (block.content) {
      tiptapNode.content = [{ type: 'text', text: block.content }];
    }

    return tiptapNode;
  }

  private mapTiptapType(tiptapType: string): ContentBlock['type'] {
    const typeMap: Record<string, ContentBlock['type']> = {
      'paragraph': 'paragraph',
      'heading': 'heading',
      'bulletList': 'list',
      'orderedList': 'list',
      'codeBlock': 'code',
      'blockquote': 'quote'
    };

    return typeMap[tiptapType] || 'paragraph';
  }

  private mapStructuredType(structuredType: string): string {
    const typeMap: Record<string, string> = {
      'paragraph': 'paragraph',
      'heading': 'heading',
      'list': 'bulletList',
      'code': 'codeBlock',
      'quote': 'blockquote'
    };

    return typeMap[structuredType] || 'paragraph';
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}