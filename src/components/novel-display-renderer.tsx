'use client';

import React from 'react';
import { JSONContent } from '@tiptap/react';
import { MediaItem, DownloadableFile } from '@/lib/types/project';
import { processContent } from '@/lib/novel/content-processor';

export interface NovelContentData {
  type: 'doc';
  content: JSONContent[];
}

interface NovelDisplayRendererProps {
  content: NovelContentData | JSONContent | string | null | undefined;
  className?: string;
  
  // Portfolio-specific rendering (for future extension)
  mediaRenderer?: (mediaItems: MediaItem[]) => React.ReactNode;
  interactiveRenderer?: (url: string) => React.ReactNode;
  downloadRenderer?: (files: DownloadableFile[]) => React.ReactNode;
}

/**
 * Simple, reliable NovelDisplayRenderer for read-only content
 * Uses direct HTML rendering for maximum compatibility
 */
export function NovelDisplayRenderer({
  content,
  className = "",
  mediaRenderer,
  interactiveRenderer,
  downloadRenderer
}: NovelDisplayRendererProps) {
  // Process the content to ensure it's in the right format
  const processed = React.useMemo(() => {
    try {
      return processContent(content as any);
    } catch (error) {
      console.error('Error processing content:', error);
      return { json: { type: 'doc', content: [] }, text: '', isEmpty: true };
    }
  }, [content]);
  
  if (processed.isEmpty) {
    return (
      <div className={`novel-display-content max-w-none ${className}`}>
        <p className="text-gray-500 italic">No content available</p>
      </div>
    );
  }

  // Simple HTML renderer for display
  const renderContent = (node: JSONContent): React.ReactNode => {
    if (!node) return null;

    switch (node.type) {
      case 'doc':
        return (
          <div className={`novel-display-content max-w-none ${className}`}>
            {node.content?.map((child: any, index: number) => (
              <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
            ))}
          </div>
        );

      case 'paragraph':
        if (!node.content || node.content.length === 0) {
          return <p><br /></p>;
        }
        return (
          <p>
            {node.content?.map((child: any, index: number) => (
              <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
            ))}
          </p>
        );

      case 'text':
        let textElement = <span>{node.text}</span>;
        
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            switch (mark.type) {
              case 'bold':
                textElement = <strong>{textElement}</strong>;
                break;
              case 'italic':
                textElement = <em>{textElement}</em>;
                break;
              case 'strike':
                textElement = <s className="line-through">{textElement}</s>;
                break;
              case 'code':
                textElement = <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">{textElement}</code>;
                break;
              case 'link':
                textElement = (
                  <a 
                    href={mark.attrs?.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    {textElement}
                  </a>
                );
                break;
            }
          });
        }
        
        return textElement;

      case 'heading':
        const level = node.attrs?.level || 1;
        const headingClasses = {
          1: 'text-3xl font-bold mb-4 mt-6 first:mt-0 leading-tight',
          2: 'text-2xl font-semibold mb-3 mt-5 first:mt-0 leading-tight',
          3: 'text-xl font-semibold mb-2 mt-4 first:mt-0 leading-tight',
          4: 'text-lg font-medium mb-2 mt-3 first:mt-0 leading-normal',
          5: 'text-base font-medium mb-2 mt-3 first:mt-0 leading-normal',
          6: 'text-sm font-medium mb-2 mt-3 first:mt-0 leading-normal'
        };
        
        const headingClass = headingClasses[level as keyof typeof headingClasses] || headingClasses[1];
        const content = node.content?.map((child: any, index: number) => (
          <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
        ));
        
        switch (level) {
          case 1: return <h1 className={headingClass}>{content}</h1>;
          case 2: return <h2 className={headingClass}>{content}</h2>;
          case 3: return <h3 className={headingClass}>{content}</h3>;
          case 4: return <h4 className={headingClass}>{content}</h4>;
          case 5: return <h5 className={headingClass}>{content}</h5>;
          case 6: return <h6 className={headingClass}>{content}</h6>;
          default: return <h1 className={headingClass}>{content}</h1>;
        }

      case 'bulletList':
        return (
          <ul className="list-disc pl-6 mb-4 space-y-1">
            {node.content?.map((child: any, index: number) => (
              <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
            ))}
          </ul>
        );

      case 'orderedList':
        return (
          <ol className="list-decimal pl-6 mb-4 space-y-1">
            {node.content?.map((child: any, index: number) => (
              <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
            ))}
          </ol>
        );

      case 'listItem':
        return (
          <li>
            {node.content?.map((child: any, index: number) => (
              <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
            ))}
          </li>
        );

      case 'codeBlock':
        return (
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm">
            <code className="text-gray-800 dark:text-gray-200">
              {node.content?.map((child: any, index: number) => (
                <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
              ))}
            </code>
          </pre>
        );

      case 'blockquote':
        return (
          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4 text-gray-600 dark:text-gray-400">
            {node.content?.map((child: any, index: number) => (
              <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
            ))}
          </blockquote>
        );

      case 'hardBreak':
        return <br />;

      case 'horizontalRule':
        return <hr className="my-6 border-gray-300 dark:border-gray-600" />;

      default:
        console.warn(`Unknown node type: ${node.type}`, node);
        if (node.content) {
          return (
            <>
              {node.content.map((child: any, index: number) => (
                <React.Fragment key={index}>{renderContent(child)}</React.Fragment>
              ))}
            </>
          );
        }
        return null;
    }
  };

  return <>{renderContent(processed.json)}</>;
}