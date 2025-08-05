/**
 * Textarea adapter for plain text editing
 */

import { BaseEditorAdapter } from './base-adapter';
import { EditorCapabilities, TextSelection, TextChange } from './types';

export class TextareaAdapter extends BaseEditorAdapter {
  private element: HTMLTextAreaElement | any;
  private selectionCheckInterval: NodeJS.Timeout | null = null;
  private lastSelection: TextSelection | null = null;

  constructor(element: HTMLTextAreaElement | any) {
    super('textarea', {
      supportsRichText: false,
      supportsStructuredContent: false,
      supportsUndo: true, // Browser native undo
      supportsSelection: true,
      supportsFormatting: false,
      supportedFormats: ['text/plain']
    });

    this.element = element;
    this.setupEventListeners();
    this.startSelectionMonitoring();
  }

  getContent(): string {
    return this.element.value;
  }

  setContent(content: string): void {
    if (typeof content !== 'string') {
      throw new Error('TextareaAdapter only supports string content');
    }

    this.element.value = content;
    this.triggerInputEvent();
    this.notifyContentChange();
  }

  getSelection(): TextSelection | null {
    const start = this.element.selectionStart;
    const end = this.element.selectionEnd;
    
    if (start === end) {
      return null;
    }
    
    const text = this.element.value.substring(start, end);
    return this.createSelectionContext({ text, start, end });
  }

  setSelection(start: number, end: number): void {
    this.element.setSelectionRange(start, end);
    this.element.focus();
  }

  applyChange(change: TextChange): void {
    this.validateChange(change);
    
    const currentValue = this.element.value;
    const newValue = currentValue.substring(0, change.start) + 
                    change.newText + 
                    currentValue.substring(change.end);
    
    this.element.value = newValue;
    
    // Update cursor position to end of inserted text
    const newCursorPosition = change.start + change.newText.length;
    this.element.setSelectionRange(newCursorPosition, newCursorPosition);
    
    this.triggerInputEvent();
    this.notifyContentChange();
  }

  focus(): void {
    this.element.focus();
  }

  blur(): void {
    this.element.blur();
  }

  destroy(): void {
    this.stopSelectionMonitoring();
    this.removeEventListeners();
  }

  // Private methods
  private setupEventListeners(): void {
    this.element.addEventListener('input', this.handleInput);
    this.element.addEventListener('focus', this.handleFocus);
    this.element.addEventListener('blur', this.handleBlur);
  }

  private removeEventListeners(): void {
    this.element.removeEventListener('input', this.handleInput);
    this.element.removeEventListener('focus', this.handleFocus);
    this.element.removeEventListener('blur', this.handleBlur);
  }

  private handleInput = (): void => {
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

  private triggerInputEvent(): void {
    const event = new Event('input', { bubbles: true });
    this.element.dispatchEvent(event);
  }

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
    
    // Compare with last selection to avoid unnecessary updates
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
}