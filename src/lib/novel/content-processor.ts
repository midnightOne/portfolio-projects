/**
 * Shared content processing utilities for Novel editor and display
 * This ensures consistency between editing and viewing experiences
 */

import { JSONContent } from '@tiptap/react';

export interface ProcessedContent {
  json: JSONContent;
  text: string;
  isEmpty: boolean;
}

/**
 * Sanitizes JSON content to remove empty text nodes and fix structure
 */
export function sanitizeJSONContent(content: JSONContent): JSONContent {
  if (!content || typeof content !== 'object') {
    return { type: 'doc', content: [] };
  }

  const sanitizeNode = (node: JSONContent): JSONContent | null => {
    if (!node || typeof node !== 'object') {
      return null;
    }

    // Handle text nodes - remove if empty
    if (node.type === 'text') {
      if (!node.text || node.text.trim() === '') {
        return null; // Remove empty text nodes
      }
      return node;
    }

    // Handle other nodes with content
    if (node.content && Array.isArray(node.content)) {
      const sanitizedContent = node.content
        .map(sanitizeNode)
        .filter(Boolean) as JSONContent[];

      // For paragraphs, ensure they have at least some content or are explicitly empty
      if (node.type === 'paragraph' && sanitizedContent.length === 0) {
        return {
          ...node,
          content: [] // Empty paragraph is allowed
        };
      }

      return {
        ...node,
        content: sanitizedContent
      };
    }

    // Return node as-is if no content array
    return node;
  };

  const sanitized = sanitizeNode(content);
  
  // Ensure we always return a valid document structure
  if (!sanitized || sanitized.type !== 'doc') {
    return { type: 'doc', content: [] };
  }

  return sanitized;
}

/**
 * Converts plain text to Novel JSON format
 */
export function textToNovelJSON(text: string): JSONContent {
  if (!text || !text.trim()) {
    return { type: 'doc', content: [] };
  }

  const paragraphs = text.split('\n').map(paragraph => ({
    type: 'paragraph' as const,
    content: paragraph.trim() ? [{ type: 'text' as const, text: paragraph }] : []
  }));

  return {
    type: 'doc',
    content: paragraphs.length > 0 ? paragraphs : []
  };
}

/**
 * Converts Novel JSON to plain text
 */
export function novelJSONToText(content: JSONContent): string {
  if (!content || !content.content) {
    return '';
  }

  const extractText = (node: JSONContent): string => {
    if (node.type === 'text') {
      return node.text || '';
    }

    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('');
    }

    return '';
  };

  return content.content.map(node => {
    const text = extractText(node);
    // Add line breaks for block elements
    if (node.type === 'paragraph' || node.type === 'heading') {
      return text + '\n';
    }
    return text;
  }).join('').trim();
}

/**
 * Processes any content input and returns a standardized format
 */
export function processContent(input: string | JSONContent | null | undefined): ProcessedContent {
  if (!input) {
    const emptyJSON = { type: 'doc', content: [] } as JSONContent;
    return {
      json: emptyJSON,
      text: '',
      isEmpty: true
    };
  }

  if (typeof input === 'string') {
    const json = textToNovelJSON(input);
    return {
      json: sanitizeJSONContent(json),
      text: input,
      isEmpty: !input.trim()
    };
  }

  if (typeof input === 'object') {
    const sanitized = sanitizeJSONContent(input);
    const text = novelJSONToText(sanitized);
    return {
      json: sanitized,
      text,
      isEmpty: !text.trim()
    };
  }

  // Fallback
  const emptyJSON = { type: 'doc', content: [] } as JSONContent;
  return {
    json: emptyJSON,
    text: '',
    isEmpty: true
  };
}

/**
 * Validates if content is a valid Novel JSON structure
 */
export function isValidNovelJSON(content: any): content is JSONContent {
  return (
    content &&
    typeof content === 'object' &&
    content.type === 'doc' &&
    Array.isArray(content.content)
  );
}

/**
 * Checks if two content objects are equivalent
 */
export function areContentsEqual(a: JSONContent | string, b: JSONContent | string): boolean {
  const processedA = processContent(a);
  const processedB = processContent(b);
  
  // Compare the text representation for simplicity
  return processedA.text === processedB.text;
}