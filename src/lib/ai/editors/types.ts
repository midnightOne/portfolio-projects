/**
 * Core types for editor abstraction layer
 */

export interface TextSelection {
  text: string;
  start: number;
  end: number;
  context?: {
    before: string;
    after: string;
  };
}

export interface TextChange {
  start: number;
  end: number;
  newText: string;
  reasoning?: string;
  preserveFormatting?: boolean;
}

export interface ContentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'quote' | 'link' | 'image';
  content: string;
  attributes?: Record<string, any>;
  children?: ContentBlock[];
}

export interface StructuredContent {
  type: 'doc';
  content: ContentBlock[];
  version?: string;
}

export interface EditorState {
  content: string | StructuredContent;
  selection: TextSelection | null;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
}

export interface EditorCapabilities {
  supportsRichText: boolean;
  supportsStructuredContent: boolean;
  supportsUndo: boolean;
  supportsSelection: boolean;
  supportsFormatting: boolean;
  supportedFormats: string[];
}

export type EditorType = 'textarea' | 'tiptap' | 'novel';

export interface EditorAdapter {
  readonly type: EditorType;
  readonly capabilities: EditorCapabilities;
  
  // Content operations
  getContent(): string | StructuredContent;
  setContent(content: string | StructuredContent): void;
  getTextContent(): string; // Always returns plain text
  
  // Selection operations
  getSelection(): TextSelection | null;
  setSelection(start: number, end: number): void;
  clearSelection(): void;
  
  // Change operations
  applyChange(change: TextChange): void;
  applyChanges(changes: TextChange[]): void;
  
  // State operations
  getState(): EditorState;
  focus(): void;
  blur(): void;
  
  // Event handling
  onContentChange(callback: (content: string | StructuredContent) => void): void;
  onSelectionChange(callback: (selection: TextSelection | null) => void): void;
  
  // Utility methods
  estimateTokens(): number;
  getWordCount(): number;
  getCharacterCount(): number;
  
  // Cleanup
  destroy(): void;
}

export interface EditorDetectionResult {
  type: EditorType;
  element: HTMLElement;
  instance?: any; // Editor instance for rich text editors
}

export interface ContentParseResult {
  plainText: string;
  structuredContent?: StructuredContent;
  metadata: {
    wordCount: number;
    characterCount: number;
    estimatedTokens: number;
    hasFormatting: boolean;
    hasLinks: boolean;
    hasImages: boolean;
  };
}

export interface SelectionContext {
  selectedText: string;
  beforeText: string;
  afterText: string;
  fullText: string;
  selectionStart: number;
  selectionEnd: number;
  contextRadius: number;
}

export interface EditorEventHandlers {
  onContentChange?: (content: string | StructuredContent) => void;
  onSelectionChange?: (selection: TextSelection | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onError?: (error: Error) => void;
}