'use client';

import React from 'react';
import { JSONContent } from '@tiptap/react';

export interface TiptapContentData {
  type: 'doc';
  content: JSONContent[];
}

interface TiptapDisplayRendererProps {
  content: TiptapContentData | string | null | undefined;
  className?: string;
  
  // Portfolio-specific rendering (for future extensions)
  mediaRenderer?: (mediaItems: any[]) => React.ReactNode;
  interactiveRenderer?: (url: string) => React.ReactNode;
  downloadRenderer?: (files: any[]) => React.ReactNode;
}

export function TiptapDisplayRenderer({
  content,
  className = '',
  mediaRenderer,
  interactiveRenderer,
  downloadRenderer
}: TiptapDisplayRendererProps) {
  // Convert content to proper format
  const getProcessedContent = (): TiptapContentData => {
    if (!content) {
      return { type: 'doc', content: [] };
    }
    
    if (typeof content === 'string') {
      // Convert plain text to Tiptap JSON
      const paragraphs = content.split('\n').filter(p => p.trim()).map(paragraph => ({
        type: 'paragraph',
        content: [{ type: 'text', text: paragraph }]
      }));
      
      return {
        type: 'doc',
        content: paragraphs.length > 0 ? paragraphs : []
      };
    }
    
    return content;
  };

  // Render a single node
  const renderNode = (node: JSONContent, index: number): React.ReactNode => {
    if (!node.type) return null;

    switch (node.type) {
      case 'doc':
        return (
          <div key={index} className="tiptap-display-content">
            {node.content?.map((child, childIndex) => renderNode(child, childIndex))}
          </div>
        );

      case 'paragraph':
        return (
          <p key={index} className="mb-4 last:mb-0">
            {node.content?.map((child, childIndex) => renderNode(child, childIndex)) || ''}
          </p>
        );

      case 'heading':
        const level = node.attrs?.level || 1;
        const HeadingTag = `h${Math.min(level, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        const headingClasses = {
          1: 'text-3xl font-bold mb-6 mt-8 first:mt-0',
          2: 'text-2xl font-semibold mb-4 mt-6 first:mt-0',
          3: 'text-xl font-semibold mb-3 mt-5 first:mt-0',
          4: 'text-lg font-medium mb-3 mt-4 first:mt-0',
          5: 'text-base font-medium mb-2 mt-3 first:mt-0',
          6: 'text-sm font-medium mb-2 mt-3 first:mt-0',
        };
        
        return React.createElement(
          HeadingTag,
          { key: index, className: headingClasses[level as keyof typeof headingClasses] },
          node.content?.map((child, childIndex) => renderNode(child, childIndex))
        );

      case 'bulletList':
        return (
          <ul key={index} className="list-disc list-outside ml-6 mb-4 space-y-1">
            {node.content?.map((child, childIndex) => renderNode(child, childIndex))}
          </ul>
        );

      case 'orderedList':
        return (
          <ol key={index} className="list-decimal list-outside ml-6 mb-4 space-y-1">
            {node.content?.map((child, childIndex) => renderNode(child, childIndex))}
          </ol>
        );

      case 'listItem':
        return (
          <li key={index} className="mb-1">
            {node.content?.map((child, childIndex) => renderNode(child, childIndex))}
          </li>
        );

      case 'blockquote':
        return (
          <blockquote key={index} className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-4">
            {node.content?.map((child, childIndex) => renderNode(child, childIndex))}
          </blockquote>
        );

      case 'codeBlock':
        return (
          <pre key={index} className="bg-gray-100 rounded-lg p-4 mb-4 overflow-x-auto">
            <code className="text-sm font-mono">
              {node.content?.map((child, childIndex) => renderNode(child, childIndex))}
            </code>
          </pre>
        );

      case 'hardBreak':
        return <br key={index} />;

      case 'horizontalRule':
        return <hr key={index} className="my-8 border-gray-300" />;

      case 'image':
        return (
          <img
            key={index}
            src={node.attrs?.src}
            alt={node.attrs?.alt || ''}
            title={node.attrs?.title}
            className="max-w-full h-auto rounded-lg mb-4"
          />
        );

      case 'text':
        let textContent: React.ReactNode = node.text || '';
        
        // Apply text marks
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'bold':
                textContent = <strong key={`bold-${index}`}>{textContent}</strong>;
                break;
              case 'italic':
                textContent = <em key={`italic-${index}`}>{textContent}</em>;
                break;
              case 'code':
                textContent = (
                  <code key={`code-${index}`} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
                    {textContent}
                  </code>
                );
                break;
              case 'link':
                textContent = (
                  <a
                    key={`link-${index}`}
                    href={mark.attrs?.href}
                    target={mark.attrs?.target}
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {textContent}
                  </a>
                );
                break;
              case 'strike':
                textContent = <s key={`strike-${index}`}>{textContent}</s>;
                break;
              case 'underline':
                textContent = <u key={`underline-${index}`}>{textContent}</u>;
                break;
            }
          }
        }
        
        return textContent;

      // Future: Portfolio-specific extensions
      case 'imageCarousel':
        if (mediaRenderer && node.attrs?.images) {
          return (
            <div key={index} className="mb-6">
              {mediaRenderer(node.attrs.images)}
            </div>
          );
        }
        return null;

      case 'interactiveEmbed':
        if (interactiveRenderer && node.attrs?.url) {
          return (
            <div key={index} className="mb-6">
              {interactiveRenderer(node.attrs.url)}
            </div>
          );
        }
        return null;

      case 'downloadButton':
        if (downloadRenderer && node.attrs?.files) {
          return (
            <div key={index} className="mb-4">
              {downloadRenderer(node.attrs.files)}
            </div>
          );
        }
        return null;

      default:
        // Fallback for unknown node types
        console.warn(`Unknown node type: ${node.type}`);
        return (
          <div key={index} className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <span className="text-yellow-700">Unknown content type: {node.type}</span>
            {node.content && (
              <div className="mt-1">
                {node.content.map((child, childIndex) => renderNode(child, childIndex))}
              </div>
            )}
          </div>
        );
    }
  };

  const processedContent = getProcessedContent();

  if (!processedContent.content || processedContent.content.length === 0) {
    return (
      <div className={`text-gray-500 italic ${className}`}>
        No content available
      </div>
    );
  }

  return (
    <div className={`tiptap-display-renderer ${className}`}>
      {processedContent.content.map((node, index) => renderNode(node, index))}
    </div>
  );
}

// CSS styles for the display renderer
export const tiptapDisplayStyles = `
.tiptap-display-renderer {
  line-height: 1.6;
  color: inherit;
}

.tiptap-display-renderer p {
  margin-bottom: 1rem;
  line-height: 1.6;
}

.tiptap-display-renderer p:last-child {
  margin-bottom: 0;
}

.tiptap-display-renderer h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  margin-top: 2rem;
  line-height: 1.2;
}

.tiptap-display-renderer h1:first-child {
  margin-top: 0;
}

.tiptap-display-renderer h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 1.5rem;
  line-height: 1.3;
}

.tiptap-display-renderer h2:first-child {
  margin-top: 0;
}

.tiptap-display-renderer h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  margin-top: 1.25rem;
  line-height: 1.4;
}

.tiptap-display-renderer h3:first-child {
  margin-top: 0;
}

.tiptap-display-renderer ul,
.tiptap-display-renderer ol {
  margin-bottom: 1rem;
  margin-left: 1.5rem;
  list-style-position: outside;
}

.tiptap-display-renderer ul {
  list-style-type: disc;
}

.tiptap-display-renderer ol {
  list-style-type: decimal;
}

.tiptap-display-renderer li {
  margin-bottom: 0.25rem;
  line-height: 1.6;
  padding-left: 0.25rem;
}

.tiptap-display-renderer blockquote {
  border-left: 4px solid #d1d5db;
  padding-left: 1rem;
  font-style: italic;
  margin-bottom: 1rem;
  color: #6b7280;
}

.tiptap-display-renderer code {
  background-color: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #374151;
}

.tiptap-display-renderer pre {
  background-color: #f3f4f6;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin-bottom: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.tiptap-display-renderer pre code {
  background: none;
  padding: 0;
  color: inherit;
}

.tiptap-display-renderer a {
  color: #3b82f6;
  text-decoration: underline;
}

.tiptap-display-renderer a:hover {
  color: #1d4ed8;
}

.tiptap-display-renderer hr {
  margin: 2rem 0;
  border: none;
  border-top: 1px solid #d1d5db;
}

/* Dark mode support */
.dark .tiptap-display-renderer blockquote {
  border-left-color: #4b5563;
  color: #9ca3af;
}

.dark .tiptap-display-renderer code {
  background-color: #374151;
  color: #f3f4f6;
}

.dark .tiptap-display-renderer pre {
  background-color: #374151;
}

.dark .tiptap-display-renderer a {
  color: #60a5fa;
}

.dark .tiptap-display-renderer a:hover {
  color: #3b82f6;
}

.dark .tiptap-display-renderer hr {
  border-top-color: #4b5563;
}

/* Responsive design */
@media (max-width: 768px) {
  .tiptap-display-renderer {
    font-size: 0.9rem;
    line-height: 1.7;
  }
  
  .tiptap-display-renderer h1 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    margin-top: 1.5rem;
  }
  
  .tiptap-display-renderer h2 {
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
    margin-top: 1.25rem;
  }
  
  .tiptap-display-renderer h3 {
    font-size: 1.125rem;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }
}
`;