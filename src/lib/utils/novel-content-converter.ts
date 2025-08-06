/**
 * Utility functions to convert plain text content to Novel's JSON format
 */

import { JSONContent } from '@tiptap/react';

export interface NovelContent {
  type: 'doc';
  content: JSONContent[];
}

/**
 * Convert plain text with markdown-like formatting to Novel JSON format
 */
export function convertTextToNovelJSON(text: string): NovelContent {
  if (!text || !text.trim()) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }]
    };
  }

  const lines = text.split('\n');
  const content: JSONContent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines but add them as empty paragraphs if they're between content
    if (!line.trim()) {
      // Only add empty paragraph if there's content before and after
      if (i > 0 && i < lines.length - 1 && 
          lines[i - 1].trim() && lines[i + 1].trim()) {
        content.push({ type: 'paragraph', content: [] });
      }
      continue;
    }

    // Handle headings
    if (line.startsWith('# ')) {
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: line.substring(2) }]
      });
    } else if (line.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.substring(3) }]
      });
    } else if (line.startsWith('### ')) {
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.substring(4) }]
      });
    }
    // Handle bullet points
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Check if we're starting a new list or continuing one
      const lastItem = content[content.length - 1];
      if (lastItem && lastItem.type === 'bulletList') {
        // Add to existing list
        lastItem.content!.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: line.substring(2) }]
          }]
        });
      } else {
        // Start new list
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: line.substring(2) }]
            }]
          }]
        });
      }
    }
    // Handle numbered lists
    else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '');
      const lastItem = content[content.length - 1];
      if (lastItem && lastItem.type === 'orderedList') {
        // Add to existing list
        lastItem.content!.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text }]
          }]
        });
      } else {
        // Start new list
        content.push({
          type: 'orderedList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text }]
            }]
          }]
        });
      }
    }
    // Handle regular paragraphs with inline formatting
    else {
      const paragraphContent = parseInlineFormatting(line);
      content.push({
        type: 'paragraph',
        content: paragraphContent
      });
    }
  }

  // Ensure we have at least one paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] });
  }

  return {
    type: 'doc',
    content
  };
}

/**
 * Parse inline formatting like **bold**, *italic*, `code`
 */
function parseInlineFormatting(text: string): JSONContent[] {
  const content: JSONContent[] = [];
  let currentText = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    // Handle bold **text**
    if (char === '*' && nextChar === '*') {
      // Add any accumulated text
      if (currentText) {
        content.push({ type: 'text', text: currentText });
        currentText = '';
      }
      
      // Find the closing **
      const closeIndex = text.indexOf('**', i + 2);
      if (closeIndex !== -1) {
        const boldText = text.substring(i + 2, closeIndex);
        content.push({
          type: 'text',
          text: boldText,
          marks: [{ type: 'bold' }]
        });
        i = closeIndex + 2;
        continue;
      }
    }
    // Handle italic *text*
    else if (char === '*' && nextChar !== '*') {
      // Add any accumulated text
      if (currentText) {
        content.push({ type: 'text', text: currentText });
        currentText = '';
      }
      
      // Find the closing *
      const closeIndex = text.indexOf('*', i + 1);
      if (closeIndex !== -1) {
        const italicText = text.substring(i + 1, closeIndex);
        content.push({
          type: 'text',
          text: italicText,
          marks: [{ type: 'italic' }]
        });
        i = closeIndex + 1;
        continue;
      }
    }
    // Handle code `text`
    else if (char === '`') {
      // Add any accumulated text
      if (currentText) {
        content.push({ type: 'text', text: currentText });
        currentText = '';
      }
      
      // Find the closing `
      const closeIndex = text.indexOf('`', i + 1);
      if (closeIndex !== -1) {
        const codeText = text.substring(i + 1, closeIndex);
        content.push({
          type: 'text',
          text: codeText,
          marks: [{ type: 'code' }]
        });
        i = closeIndex + 1;
        continue;
      }
    }

    // Regular character
    currentText += char;
    i++;
  }

  // Add any remaining text
  if (currentText) {
    content.push({ type: 'text', text: currentText });
  }

  // Return at least empty content if nothing was parsed
  return content.length > 0 ? content : [{ type: 'text', text: '' }];
}

/**
 * Convert Novel JSON back to plain text (for backward compatibility)
 */
export function convertNovelJSONToText(novelContent: NovelContent): string {
  if (!novelContent || !novelContent.content) {
    return '';
  }

  return novelContent.content.map(node => {
    switch (node.type) {
      case 'heading':
        const level = node.attrs?.level || 1;
        const prefix = '#'.repeat(level) + ' ';
        return prefix + extractTextFromNode(node);
      
      case 'paragraph':
        return extractTextFromNode(node);
      
      case 'bulletList':
        return node.content?.map(item => 
          '- ' + extractTextFromNode(item)
        ).join('\n') || '';
      
      case 'orderedList':
        return node.content?.map((item, index) => 
          `${index + 1}. ` + extractTextFromNode(item)
        ).join('\n') || '';
      
      default:
        return extractTextFromNode(node);
    }
  }).join('\n\n');
}

/**
 * Extract plain text from a node, handling inline formatting
 */
function extractTextFromNode(node: JSONContent): string {
  if (!node.content) {
    return '';
  }

  return node.content.map(child => {
    if (child.type === 'text') {
      let text = child.text || '';
      
      // Apply formatting markers for plain text representation
      if (child.marks) {
        child.marks.forEach(mark => {
          switch (mark.type) {
            case 'bold':
              text = `**${text}**`;
              break;
            case 'italic':
              text = `*${text}*`;
              break;
            case 'code':
              text = `\`${text}\``;
              break;
          }
        });
      }
      
      return text;
    } else if (child.type === 'paragraph') {
      return extractTextFromNode(child);
    }
    
    return '';
  }).join('');
}