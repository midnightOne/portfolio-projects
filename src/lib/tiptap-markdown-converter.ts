/**
 * Utility functions to convert between Tiptap JSON and Markdown
 * This allows us to send LLM-friendly formatted content while preserving structure
 */

import { JSONContent } from '@tiptap/react';

export interface TiptapContentData {
  type: 'doc';
  content: JSONContent[];
}

/**
 * Convert Tiptap JSON content to Markdown format for LLM processing
 */
export function tiptapToMarkdown(content: TiptapContentData | JSONContent): string {
  if (!content || !content.content) {
    return '';
  }

  const processNode = (node: JSONContent): string => {
    if (!node.type) return '';

    switch (node.type) {
      case 'doc':
        return node.content?.map(processNode).join('\n\n') || '';

      case 'paragraph':
        const paragraphText = node.content?.map(processNode).join('') || '';
        return paragraphText || '';

      case 'heading':
        const level = node.attrs?.level || 1;
        const headingText = node.content?.map(processNode).join('') || '';
        return '#'.repeat(level) + ' ' + headingText;

      case 'bulletList':
        return node.content?.map(processNode).join('\n') || '';

      case 'orderedList':
        return node.content?.map((item, index) => {
          const itemText = processNode(item);
          return itemText.replace(/^- /, `${index + 1}. `);
        }).join('\n') || '';

      case 'listItem':
        const itemText = node.content?.map(processNode).join('') || '';
        return '- ' + itemText;

      case 'blockquote':
        const quoteText = node.content?.map(processNode).join('\n') || '';
        return quoteText.split('\n').map(line => '> ' + line).join('\n');

      case 'codeBlock':
        const language = node.attrs?.language || '';
        const codeText = node.content?.map(processNode).join('') || '';
        return '```' + language + '\n' + codeText + '\n```';

      case 'hardBreak':
        return '\n';

      case 'horizontalRule':
        return '---';

      case 'text':
        let text = node.text || '';
        
        // Apply text marks
        if (node.marks) {
          for (const mark of node.marks) {
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
              case 'link':
                const href = mark.attrs?.href || '';
                text = `[${text}](${href})`;
                break;
              case 'strike':
                text = `~~${text}~~`;
                break;
            }
          }
        }
        
        return text;

      case 'image':
        const src = node.attrs?.src || '';
        const alt = node.attrs?.alt || '';
        const title = node.attrs?.title || '';
        return `![${alt}](${src}${title ? ` "${title}"` : ''})`;

      // Portfolio-specific extensions - convert to descriptive text
      case 'imageCarousel':
        const images = node.attrs?.images || [];
        if (images.length > 0) {
          return `[Image Carousel: ${images.length} images]`;
        }
        return '[Image Carousel]';

      case 'interactiveEmbed':
        const embedTitle = node.attrs?.title || 'Interactive Content';
        const embedUrl = node.attrs?.url || '';
        return `[Interactive Embed: ${embedTitle}${embedUrl ? ` (${embedUrl})` : ''}]`;

      case 'downloadButton':
        const files = node.attrs?.files || [];
        const label = node.attrs?.label || 'Download';
        return `[Download Button: ${label}${files.length > 0 ? ` - ${files.length} files` : ''}]`;

      case 'projectReference':
        const projectId = node.attrs?.projectId || '';
        const refTitle = node.attrs?.title || `Project ${projectId}`;
        return `[Project Reference: ${refTitle}]`;

      default:
        // For unknown node types, try to process children
        return node.content?.map(processNode).join('') || '';
    }
  };

  return processNode(content);
}

/**
 * Convert Markdown text back to Tiptap JSON format
 */
export function markdownToTiptap(markdown: string): TiptapContentData {
  const lines = markdown.split('\n');
  const content: JSONContent[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n').trim();
      if (text) {
        content.push({
          type: 'paragraph',
          content: parseInlineText(text)
        });
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty line - flush current paragraph
    if (!trimmedLine) {
      flushParagraph();
      continue;
    }

    // Headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineText(headingMatch[2])
      });
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith('> ')) {
      flushParagraph();
      const quoteText = trimmedLine.substring(2);
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: parseInlineText(quoteText)
        }]
      });
      continue;
    }

    // Code block
    if (trimmedLine.startsWith('```')) {
      flushParagraph();
      const language = trimmedLine.substring(3);
      // Note: This is a simplified implementation
      // In a real implementation, you'd need to collect all lines until the closing ```
      content.push({
        type: 'codeBlock',
        attrs: language ? { language } : {},
        content: [{ type: 'text', text: '' }]
      });
      continue;
    }

    // Horizontal rule
    if (trimmedLine === '---') {
      flushParagraph();
      content.push({ type: 'horizontalRule' });
      continue;
    }

    // List items
    const bulletMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    const orderedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    
    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const listText = (bulletMatch || orderedMatch)![1];
      
      // Check if we need to create a new list or add to existing
      const lastItem = content[content.length - 1];
      const listType = bulletMatch ? 'bulletList' : 'orderedList';
      
      if (lastItem && lastItem.type === listType) {
        // Add to existing list
        lastItem.content!.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineText(listText)
          }]
        });
      } else {
        // Create new list
        content.push({
          type: listType,
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: parseInlineText(listText)
            }]
          }]
        });
      }
      continue;
    }

    // Regular paragraph text
    currentParagraph.push(line);
  }

  // Flush any remaining paragraph
  flushParagraph();

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }]
  };
}

/**
 * Parse inline text with markdown formatting
 */
function parseInlineText(text: string): JSONContent[] {
  // This is a simplified implementation
  // In a real implementation, you'd want to use a proper markdown parser
  
  const result: JSONContent[] = [];
  let currentText = text;

  // Handle bold text
  currentText = currentText.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    result.push({
      type: 'text',
      text: content,
      marks: [{ type: 'bold' }]
    });
    return '\u0000'; // Placeholder
  });

  // Handle italic text
  currentText = currentText.replace(/\*(.*?)\*/g, (match, content) => {
    result.push({
      type: 'text',
      text: content,
      marks: [{ type: 'italic' }]
    });
    return '\u0000'; // Placeholder
  });

  // Handle inline code
  currentText = currentText.replace(/`(.*?)`/g, (match, content) => {
    result.push({
      type: 'text',
      text: content,
      marks: [{ type: 'code' }]
    });
    return '\u0000'; // Placeholder
  });

  // Handle links
  currentText = currentText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, href) => {
    result.push({
      type: 'text',
      text: linkText,
      marks: [{ type: 'link', attrs: { href } }]
    });
    return '\u0000'; // Placeholder
  });

  // Split by placeholders and add remaining text
  const parts = currentText.split('\u0000');
  let resultIndex = 0;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      result.splice(resultIndex, 0, {
        type: 'text',
        text: parts[i]
      });
      resultIndex++;
    }
    if (i < parts.length - 1) {
      resultIndex++; // Skip the formatted text we already added
    }
  }

  return result.length > 0 ? result : [{ type: 'text', text }];
}

/**
 * Get plain text content from Tiptap JSON (for fallback)
 */
export function tiptapToPlainText(content: TiptapContentData | JSONContent): string {
  if (!content || !content.content) {
    return '';
  }

  const extractText = (node: JSONContent): string => {
    if (node.type === 'text') {
      return node.text || '';
    }
    
    if (node.content) {
      return node.content.map(extractText).join('');
    }
    
    return '';
  };

  return content.content.map(extractText).join('\n').trim();
}