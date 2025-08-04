'use client';

import React, { useCallback, useRef, useEffect } from 'react';

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

export interface TextChange {
  start: number;
  end: number;
  newText: string;
  reasoning?: string;
}

export interface EditorAdapter {
  getSelection(): TextSelection | null;
  applyChange(change: TextChange): void;
  getFullContent(): string;
  setFullContent(content: string): void;
  focus(): void;
}

/**
 * Textarea adapter for plain text editing
 */
export class TextareaAdapter implements EditorAdapter {
  private element: HTMLTextAreaElement;
  private onContentChange?: (content: string) => void;

  constructor(element: HTMLTextAreaElement, onContentChange?: (content: string) => void) {
    this.element = element;
    this.onContentChange = onContentChange;
  }

  getSelection(): TextSelection | null {
    const start = this.element.selectionStart;
    const end = this.element.selectionEnd;
    
    if (start === end) {
      return null;
    }
    
    const text = this.element.value.substring(start, end);
    return { text, start, end };
  }

  applyChange(change: TextChange): void {
    const currentValue = this.element.value;
    const newValue = currentValue.substring(0, change.start) + 
                    change.newText + 
                    currentValue.substring(change.end);
    
    this.element.value = newValue;
    
    // Update cursor position to end of inserted text
    const newCursorPosition = change.start + change.newText.length;
    this.element.setSelectionRange(newCursorPosition, newCursorPosition);
    
    // Trigger change event
    const event = new Event('input', { bubbles: true });
    this.element.dispatchEvent(event);
    
    // Call content change callback
    if (this.onContentChange) {
      this.onContentChange(newValue);
    }
  }

  getFullContent(): string {
    return this.element.value;
  }

  setFullContent(content: string): void {
    this.element.value = content;
    
    // Trigger change event
    const event = new Event('input', { bubbles: true });
    this.element.dispatchEvent(event);
    
    // Call content change callback
    if (this.onContentChange) {
      this.onContentChange(content);
    }
  }

  focus(): void {
    this.element.focus();
  }
}

/**
 * Future: Tiptap adapter for rich text editing
 * This is a placeholder for future implementation
 */
export class TiptapAdapter implements EditorAdapter {
  private editor: any; // Tiptap editor instance
  private onContentChange?: (content: string) => void;

  constructor(editor: any, onContentChange?: (content: string) => void) {
    this.editor = editor;
    this.onContentChange = onContentChange;
  }

  getSelection(): TextSelection | null {
    // TODO: Implement Tiptap selection detection
    // This would work with Tiptap's selection API
    console.warn('TiptapAdapter.getSelection() not yet implemented');
    return null;
  }

  applyChange(change: TextChange): void {
    // TODO: Implement Tiptap text replacement
    // This would use Tiptap's transaction API
    console.warn('TiptapAdapter.applyChange() not yet implemented');
  }

  getFullContent(): string {
    // TODO: Return Tiptap content as text or HTML
    console.warn('TiptapAdapter.getFullContent() not yet implemented');
    return '';
  }

  setFullContent(content: string): void {
    // TODO: Set Tiptap content
    console.warn('TiptapAdapter.setFullContent() not yet implemented');
  }

  focus(): void {
    if (this.editor && this.editor.commands) {
      this.editor.commands.focus();
    }
  }
}

/**
 * Future: Novel editor adapter for JSON-based content
 * This is a placeholder for future implementation
 */
export class NovelAdapter implements EditorAdapter {
  private editor: any; // Novel editor instance
  private onContentChange?: (content: string) => void;

  constructor(editor: any, onContentChange?: (content: string) => void) {
    this.editor = editor;
    this.onContentChange = onContentChange;
  }

  getSelection(): TextSelection | null {
    // TODO: Implement Novel selection detection
    // This would work with Novel's JSON structure
    console.warn('NovelAdapter.getSelection() not yet implemented');
    return null;
  }

  applyChange(change: TextChange): void {
    // TODO: Implement Novel text replacement
    // This would modify the JSON structure
    console.warn('NovelAdapter.applyChange() not yet implemented');
  }

  getFullContent(): string {
    // TODO: Extract text content from Novel's JSON structure
    console.warn('NovelAdapter.getFullContent() not yet implemented');
    return '';
  }

  setFullContent(content: string): void {
    // TODO: Convert text to Novel's JSON structure
    console.warn('NovelAdapter.setFullContent() not yet implemented');
  }

  focus(): void {
    if (this.editor && this.editor.focus) {
      this.editor.focus();
    }
  }
}

export interface TextSelectionManagerProps {
  adapter: EditorAdapter;
  onSelectionChange?: (selection: TextSelection | null) => void;
  onContentChange?: (content: string) => void;
  children: React.ReactNode;
}

/**
 * Text Selection Manager component
 * Manages text selection and change application across different editor types
 */
export function TextSelectionManager({
  adapter,
  onSelectionChange,
  onContentChange,
  children
}: TextSelectionManagerProps) {
  const selectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastSelection = useRef<TextSelection | null>(null);

  // Check for selection changes periodically
  const checkSelection = useCallback(() => {
    const currentSelection = adapter.getSelection();
    
    // Compare with last selection to avoid unnecessary updates
    const selectionChanged = 
      (!lastSelection.current && currentSelection) ||
      (lastSelection.current && !currentSelection) ||
      (lastSelection.current && currentSelection && (
        lastSelection.current.start !== currentSelection.start ||
        lastSelection.current.end !== currentSelection.end ||
        lastSelection.current.text !== currentSelection.text
      ));

    if (selectionChanged) {
      lastSelection.current = currentSelection;
      if (onSelectionChange) {
        onSelectionChange(currentSelection);
      }
    }
  }, [adapter, onSelectionChange]);

  // Start/stop selection monitoring
  useEffect(() => {
    // Start monitoring selection changes
    selectionCheckInterval.current = setInterval(checkSelection, 100);

    return () => {
      if (selectionCheckInterval.current) {
        clearInterval(selectionCheckInterval.current);
      }
    };
  }, [checkSelection]);

  // Apply text changes through the adapter
  const applyChange = useCallback((change: TextChange) => {
    adapter.applyChange(change);
    
    // Notify about content change
    if (onContentChange) {
      const newContent = adapter.getFullContent();
      onContentChange(newContent);
    }
    
    // Clear selection after applying change
    if (onSelectionChange) {
      onSelectionChange(null);
    }
  }, [adapter, onContentChange, onSelectionChange]);

  // Apply full content replacement
  const setFullContent = useCallback((content: string) => {
    adapter.setFullContent(content);
    
    // Notify about content change
    if (onContentChange) {
      onContentChange(content);
    }
    
    // Clear selection after content change
    if (onSelectionChange) {
      onSelectionChange(null);
    }
  }, [adapter, onContentChange, onSelectionChange]);

  // Get current selection
  const getCurrentSelection = useCallback(() => {
    return adapter.getSelection();
  }, [adapter]);

  // Get full content
  const getFullContent = useCallback(() => {
    return adapter.getFullContent();
  }, [adapter]);

  // Focus the editor
  const focusEditor = useCallback(() => {
    adapter.focus();
  }, [adapter]);

  // Provide methods to children through context or props
  const managerMethods = {
    applyChange,
    setFullContent,
    getCurrentSelection,
    getFullContent,
    focusEditor
  };

  // Clone children and pass manager methods
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { textSelectionManager: managerMethods } as any);
    }
    return child;
  });

  return <>{childrenWithProps}</>;
}

/**
 * Hook for using text selection manager methods
 */
export function useTextSelectionManager() {
  // This would be used with React Context in a full implementation
  // For now, return placeholder methods
  return {
    applyChange: (change: TextChange) => {
      console.warn('useTextSelectionManager: applyChange not connected to manager');
    },
    setFullContent: (content: string) => {
      console.warn('useTextSelectionManager: setFullContent not connected to manager');
    },
    getCurrentSelection: () => {
      console.warn('useTextSelectionManager: getCurrentSelection not connected to manager');
      return null;
    },
    getFullContent: () => {
      console.warn('useTextSelectionManager: getFullContent not connected to manager');
      return '';
    },
    focusEditor: () => {
      console.warn('useTextSelectionManager: focusEditor not connected to manager');
    }
  };
}

/**
 * Utility function to create appropriate adapter based on editor type
 */
export function createEditorAdapter(
  editorType: 'textarea' | 'tiptap' | 'novel',
  element: any,
  onContentChange?: (content: string) => void
): EditorAdapter {
  switch (editorType) {
    case 'textarea':
      return new TextareaAdapter(element as HTMLTextAreaElement, onContentChange);
    case 'tiptap':
      return new TiptapAdapter(element, onContentChange);
    case 'novel':
      return new NovelAdapter(element, onContentChange);
    default:
      throw new Error(`Unsupported editor type: ${editorType}`);
  }
}

/**
 * Utility function to detect text selection in any element
 */
export function detectTextSelection(element: HTMLElement): TextSelection | null {
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  
  const range = selection.getRangeAt(0);
  
  // Check if selection is within the target element
  if (!element.contains(range.commonAncestorContainer)) {
    return null;
  }
  
  const selectedText = selection.toString();
  
  if (!selectedText) {
    return null;
  }
  
  // For complex elements, we'd need to calculate positions relative to text content
  // This is a simplified implementation
  return {
    text: selectedText,
    start: 0, // Would need proper calculation
    end: selectedText.length // Would need proper calculation
  };
}

/**
 * Utility function to apply text changes with precise positioning
 */
export function applyTextChangeWithPosition(
  originalText: string,
  change: TextChange
): string {
  // Validate change positions
  if (change.start < 0 || change.end > originalText.length || change.start > change.end) {
    throw new Error('Invalid text change positions');
  }
  
  return originalText.substring(0, change.start) + 
         change.newText + 
         originalText.substring(change.end);
}

/**
 * Utility function to find text position in content
 */
export function findTextPosition(content: string, searchText: string, startFrom: number = 0): {
  start: number;
  end: number;
} | null {
  const index = content.indexOf(searchText, startFrom);
  
  if (index === -1) {
    return null;
  }
  
  return {
    start: index,
    end: index + searchText.length
  };
}

export default TextSelectionManager;