/**
 * Shared Novel/Tiptap extensions configuration
 * Used by both editor and display components for consistency
 */

// Import the extensions that Novel re-exports
import { StarterKit } from 'novel';

export interface NovelExtensionsConfig {
  placeholder?: string;
  editable?: boolean;
  enablePlaceholder?: boolean;
}

/**
 * Base extensions used by both editor and display
 * Uses Novel's StarterKit to avoid version conflicts
 */
export function getBaseExtensions(config: NovelExtensionsConfig = {}) {
  // Return basic StarterKit which Novel re-exports
  return [
    StarterKit.configure({
      // Basic configuration for consistent behavior
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),
  ];
}

/**
 * Extensions specifically for the editor (editable mode)
 */
export function getEditorExtensions(config: NovelExtensionsConfig = {}) {
  return getBaseExtensions(config);
}

/**
 * Extensions for display/read-only mode
 */
export function getDisplayExtensions() {
  return getBaseExtensions();
}

/**
 * Default editor props for consistent behavior
 */
export const getEditorProps = (className: string = '') => ({
  attributes: {
    class: `novel-content focus:outline-none ${className}`,
    style: 'white-space: pre-wrap; word-wrap: break-word;',
  },
  handleDOMEvents: {
    focus: () => {
      // Custom focus handling can go here
      return false;
    },
    blur: () => {
      // Custom blur handling can go here
      return false;
    },
  },
});

/**
 * Default display props for read-only content
 */
export const getDisplayProps = (className: string = '') => ({
  attributes: {
    class: `novel-display-content ${className}`,
  },
  editable: false,
});