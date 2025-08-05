/**
 * Selection manager for handling text selection across different editor types
 * Provides unified selection detection and management
 */

import { EditorAdapter } from './types';
import { TextSelection, SelectionContext } from './types';

export class SelectionManager {
  private adapters: Map<string, EditorAdapter> = new Map();
  private activeAdapter: EditorAdapter | null = null;
  private selectionListeners: Set<(selection: TextSelection | null) => void> = new Set();
  private contextListeners: Set<(context: SelectionContext | null) => void> = new Set();

  /**
   * Register an editor adapter
   */
  registerAdapter(id: string, adapter: EditorAdapter): void {
    this.adapters.set(id, adapter);
    
    // Set up selection change listener
    adapter.onSelectionChange((selection) => {
      if (adapter === this.activeAdapter) {
        this.notifySelectionChange(selection);
        
        if (selection) {
          const context = this.createSelectionContext(selection, adapter);
          this.notifyContextChange(context);
        } else {
          this.notifyContextChange(null);
        }
      }
    });
  }

  /**
   * Unregister an editor adapter
   */
  unregisterAdapter(id: string): void {
    const adapter = this.adapters.get(id);
    if (adapter) {
      if (adapter === this.activeAdapter) {
        this.activeAdapter = null;
      }
      adapter.destroy();
      this.adapters.delete(id);
    }
  }

  /**
   * Set the active adapter
   */
  setActiveAdapter(id: string): void {
    const adapter = this.adapters.get(id);
    if (adapter) {
      this.activeAdapter = adapter;
      
      // Immediately notify of current selection
      const selection = adapter.getSelection();
      this.notifySelectionChange(selection);
      
      if (selection) {
        const context = this.createSelectionContext(selection, adapter);
        this.notifyContextChange(context);
      } else {
        this.notifyContextChange(null);
      }
    }
  }

  /**
   * Get the current selection from the active adapter
   */
  getCurrentSelection(): TextSelection | null {
    if (!this.activeAdapter) {
      return null;
    }
    
    return this.activeAdapter.getSelection();
  }

  /**
   * Get selection context with surrounding text
   */
  getSelectionContext(contextRadius: number = 100): SelectionContext | null {
    const selection = this.getCurrentSelection();
    if (!selection || !this.activeAdapter) {
      return null;
    }

    return this.createSelectionContext(selection, this.activeAdapter, contextRadius);
  }

  /**
   * Apply a text change to the active adapter
   */
  applyChange(change: { start: number; end: number; newText: string; reasoning?: string }): void {
    if (!this.activeAdapter) {
      throw new Error('No active adapter available');
    }

    this.activeAdapter.applyChange(change);
  }

  /**
   * Set selection in the active adapter
   */
  setSelection(start: number, end: number): void {
    if (!this.activeAdapter) {
      return;
    }

    this.activeAdapter.setSelection(start, end);
  }

  /**
   * Clear selection in the active adapter
   */
  clearSelection(): void {
    if (!this.activeAdapter) {
      return;
    }

    this.activeAdapter.clearSelection();
  }

  /**
   * Focus the active adapter
   */
  focus(): void {
    if (!this.activeAdapter) {
      return;
    }

    this.activeAdapter.focus();
  }

  /**
   * Get all registered adapter IDs
   */
  getAdapterIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get adapter by ID
   */
  getAdapter(id: string): EditorAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get the active adapter ID
   */
  getActiveAdapterId(): string | null {
    if (!this.activeAdapter) {
      return null;
    }

    for (const [id, adapter] of this.adapters) {
      if (adapter === this.activeAdapter) {
        return id;
      }
    }

    return null;
  }

  /**
   * Check if there's an active selection
   */
  hasSelection(): boolean {
    const selection = this.getCurrentSelection();
    return selection !== null && selection.text.length > 0;
  }

  /**
   * Get the selected text
   */
  getSelectedText(): string {
    const selection = this.getCurrentSelection();
    return selection ? selection.text : '';
  }

  /**
   * Get the full content from the active adapter
   */
  getFullContent(): string {
    if (!this.activeAdapter) {
      return '';
    }

    return this.activeAdapter.getTextContent();
  }

  /**
   * Listen for selection changes
   */
  onSelectionChange(listener: (selection: TextSelection | null) => void): () => void {
    this.selectionListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  /**
   * Listen for selection context changes
   */
  onContextChange(listener: (context: SelectionContext | null) => void): () => void {
    this.contextListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.contextListeners.delete(listener);
    };
  }

  /**
   * Find text in the active adapter
   */
  findText(searchText: string, startFrom: number = 0): { start: number; end: number } | null {
    if (!this.activeAdapter) {
      return null;
    }

    const content = this.activeAdapter.getTextContent();
    const index = content.indexOf(searchText, startFrom);
    
    if (index === -1) {
      return null;
    }

    return {
      start: index,
      end: index + searchText.length
    };
  }

  /**
   * Replace text in the active adapter
   */
  replaceText(searchText: string, replaceText: string, replaceAll: boolean = false): number {
    if (!this.activeAdapter) {
      return 0;
    }

    const content = this.activeAdapter.getTextContent();
    let replacements = 0;
    let searchFrom = 0;

    do {
      const position = this.findText(searchText, searchFrom);
      if (!position) {
        break;
      }

      this.applyChange({
        start: position.start,
        end: position.end,
        newText: replaceText
      });

      replacements++;
      searchFrom = position.start + replaceText.length;
    } while (replaceAll);

    return replacements;
  }

  /**
   * Get statistics about the active adapter's content
   */
  getContentStats(): {
    wordCount: number;
    characterCount: number;
    estimatedTokens: number;
    hasSelection: boolean;
    selectionLength: number;
  } | null {
    if (!this.activeAdapter) {
      return null;
    }

    const selection = this.getCurrentSelection();
    
    return {
      wordCount: this.activeAdapter.getWordCount(),
      characterCount: this.activeAdapter.getCharacterCount(),
      estimatedTokens: this.activeAdapter.estimateTokens(),
      hasSelection: selection !== null,
      selectionLength: selection ? selection.text.length : 0
    };
  }

  /**
   * Cleanup all adapters
   */
  destroy(): void {
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    
    this.adapters.clear();
    this.activeAdapter = null;
    this.selectionListeners.clear();
    this.contextListeners.clear();
  }

  // Private methods
  private createSelectionContext(
    selection: TextSelection, 
    adapter: EditorAdapter, 
    contextRadius: number = 100
  ): SelectionContext {
    const fullText = adapter.getTextContent();
    const beforeStart = Math.max(0, selection.start - contextRadius);
    const afterEnd = Math.min(fullText.length, selection.end + contextRadius);
    
    return {
      selectedText: selection.text,
      beforeText: fullText.substring(beforeStart, selection.start),
      afterText: fullText.substring(selection.end, afterEnd),
      fullText,
      selectionStart: selection.start,
      selectionEnd: selection.end,
      contextRadius
    };
  }

  private notifySelectionChange(selection: TextSelection | null): void {
    for (const listener of this.selectionListeners) {
      try {
        listener(selection);
      } catch (error) {
        console.error('Error in selection change listener:', error);
      }
    }
  }

  private notifyContextChange(context: SelectionContext | null): void {
    for (const listener of this.contextListeners) {
      try {
        listener(context);
      } catch (error) {
        console.error('Error in context change listener:', error);
      }
    }
  }
}

// Global selection manager instance
let globalSelectionManager: SelectionManager | null = null;

/**
 * Get the global selection manager instance
 */
export function getGlobalSelectionManager(): SelectionManager {
  if (!globalSelectionManager) {
    globalSelectionManager = new SelectionManager();
  }
  return globalSelectionManager;
}

/**
 * Reset the global selection manager
 */
export function resetGlobalSelectionManager(): void {
  if (globalSelectionManager) {
    globalSelectionManager.destroy();
    globalSelectionManager = null;
  }
}