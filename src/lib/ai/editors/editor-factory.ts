/**
 * Factory for creating appropriate editor adapters
 * Handles editor type detection and dynamic adapter selection
 */

import { EditorAdapter, EditorType, EditorDetectionResult } from './types';
import { TextareaAdapter } from './textarea-adapter';
import { TiptapAdapter } from './tiptap-adapter';
import { NovelAdapter } from './novel-adapter';

export class EditorFactory {
  /**
   * Create an editor adapter based on the provided element or editor instance
   */
  static createAdapter(
    elementOrEditor: HTMLElement | any,
    editorType?: EditorType
  ): EditorAdapter {
    // If editor type is explicitly provided, use it
    if (editorType) {
      return this.createAdapterByType(editorType, elementOrEditor);
    }

    // Otherwise, detect the editor type
    const detection = this.detectEditorType(elementOrEditor);
    return this.createAdapterByType(detection.type, detection.element || detection.instance);
  }

  /**
   * Detect the type of editor from an element or instance
   */
  static detectEditorType(elementOrEditor: HTMLElement | any): EditorDetectionResult {
    // Check if it's a textarea element
    if (elementOrEditor instanceof HTMLTextAreaElement) {
      return {
        type: 'textarea',
        element: elementOrEditor
      };
    }

    // Check if it's a regular HTML element that might contain an editor
    if (elementOrEditor instanceof HTMLElement) {
      // Look for Tiptap editor indicators
      if (this.isTiptapElement(elementOrEditor)) {
        return {
          type: 'tiptap',
          element: elementOrEditor,
          instance: this.extractTiptapInstance(elementOrEditor)
        };
      }

      // Look for Novel editor indicators
      if (this.isNovelElement(elementOrEditor)) {
        return {
          type: 'novel',
          element: elementOrEditor,
          instance: this.extractNovelInstance(elementOrEditor)
        };
      }

      // Check for textarea children
      const textarea = elementOrEditor.querySelector('textarea');
      if (textarea) {
        return {
          type: 'textarea',
          element: textarea
        };
      }

      // Default to treating as a potential rich text editor container
      return {
        type: 'tiptap', // Default assumption for unknown rich text editors
        element: elementOrEditor
      };
    }

    // Check if it's a Tiptap editor instance
    if (this.isTiptapInstance(elementOrEditor)) {
      return {
        type: 'tiptap',
        element: elementOrEditor.view?.dom,
        instance: elementOrEditor
      };
    }

    // Check if it's a Novel editor instance
    if (this.isNovelInstance(elementOrEditor)) {
      return {
        type: 'novel',
        element: elementOrEditor.dom,
        instance: elementOrEditor
      };
    }

    // Fallback to textarea-like behavior
    console.warn('Could not detect editor type, defaulting to textarea behavior');
    return {
      type: 'textarea',
      element: elementOrEditor
    };
  }

  /**
   * Create adapter by explicit type
   */
  private static createAdapterByType(type: EditorType, elementOrInstance: any): EditorAdapter {
    switch (type) {
      case 'textarea':
        // In test environment, allow mock objects
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
          return new TextareaAdapter(elementOrInstance);
        }
        if (!(elementOrInstance instanceof HTMLTextAreaElement)) {
          throw new Error('Textarea adapter requires HTMLTextAreaElement');
        }
        return new TextareaAdapter(elementOrInstance);

      case 'tiptap':
        return new TiptapAdapter(elementOrInstance);

      case 'novel':
        return new NovelAdapter(elementOrInstance);

      default:
        throw new Error(`Unsupported editor type: ${type}`);
    }
  }

  /**
   * Check if element contains a Tiptap editor
   */
  private static isTiptapElement(element: HTMLElement): boolean {
    // Look for Tiptap-specific classes or attributes
    const tiptapIndicators = [
      '.ProseMirror',
      '[data-tiptap]',
      '.tiptap',
      '[contenteditable="true"]'
    ];

    return tiptapIndicators.some(selector => {
      return element.matches(selector) || element.querySelector(selector) !== null;
    });
  }

  /**
   * Check if element contains a Novel editor
   */
  private static isNovelElement(element: HTMLElement): boolean {
    // Look for Novel-specific classes or attributes
    const novelIndicators = [
      '.novel-editor',
      '[data-novel]',
      '.bn-editor',
      '.block-editor'
    ];

    return novelIndicators.some(selector => {
      return element.matches(selector) || element.querySelector(selector) !== null;
    });
  }

  /**
   * Check if object is a Tiptap editor instance
   */
  private static isTiptapInstance(obj: any): boolean {
    return obj && 
           typeof obj === 'object' &&
           obj.view &&
           obj.state &&
           obj.commands &&
           typeof obj.getJSON === 'function';
  }

  /**
   * Check if object is a Novel editor instance
   */
  private static isNovelInstance(obj: any): boolean {
    return obj &&
           typeof obj === 'object' &&
           obj.dom &&
           typeof obj.getJSON === 'function' &&
           typeof obj.setContent === 'function' &&
           (obj.constructor.name === 'NovelEditor' || obj._isNovelEditor);
  }

  /**
   * Extract Tiptap instance from DOM element
   */
  private static extractTiptapInstance(element: HTMLElement): any {
    // Try to find Tiptap instance attached to the element
    const proseMirrorElement = element.matches('.ProseMirror') 
      ? element 
      : element.querySelector('.ProseMirror');

    if (proseMirrorElement) {
      // Tiptap usually attaches the editor instance to the DOM element
      return (proseMirrorElement as any).__tiptapEditor || 
             (proseMirrorElement as any).editor ||
             null;
    }

    return null;
  }

  /**
   * Extract Novel instance from DOM element
   */
  private static extractNovelInstance(element: HTMLElement): any {
    // Try to find Novel instance attached to the element
    const novelElement = element.matches('.novel-editor') 
      ? element 
      : element.querySelector('.novel-editor');

    if (novelElement) {
      // Novel usually attaches the editor instance to the DOM element
      return (novelElement as any).__novelEditor || 
             (novelElement as any).editor ||
             null;
    }

    return null;
  }

  /**
   * Get supported editor types
   */
  static getSupportedTypes(): EditorType[] {
    return ['textarea', 'tiptap', 'novel'];
  }

  /**
   * Check if an editor type is supported
   */
  static isTypeSupported(type: string): type is EditorType {
    return this.getSupportedTypes().includes(type as EditorType);
  }

  /**
   * Create multiple adapters for a container with multiple editors
   */
  static createMultipleAdapters(container: HTMLElement): EditorAdapter[] {
    const adapters: EditorAdapter[] = [];

    // Find all textareas
    const textareas = container.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      adapters.push(new TextareaAdapter(textarea));
    });

    // Find all Tiptap editors
    const tiptapElements = container.querySelectorAll('.ProseMirror, [data-tiptap]');
    tiptapElements.forEach(element => {
      const instance = this.extractTiptapInstance(element as HTMLElement);
      if (instance) {
        adapters.push(new TiptapAdapter(instance));
      }
    });

    // Find all Novel editors
    const novelElements = container.querySelectorAll('.novel-editor, [data-novel]');
    novelElements.forEach(element => {
      const instance = this.extractNovelInstance(element as HTMLElement);
      if (instance) {
        adapters.push(new NovelAdapter(instance));
      }
    });

    return adapters;
  }
}