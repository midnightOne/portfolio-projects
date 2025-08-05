/**
 * Editor abstraction layer for AI content operations
 * Supports multiple editor types: textarea, Tiptap, and Novel
 */

export * from './types';
export * from './base-adapter';
export * from './textarea-adapter';
export * from './tiptap-adapter';
export * from './novel-adapter';
export * from './editor-factory';
export * from './content-parser';
export * from './selection-manager';
export * from './structured-content-handler';
export * from './rich-text-processor';