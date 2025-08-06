'use client';

import { JSONContent } from '@tiptap/react';
import { MediaItem, DownloadableFile } from '@/lib/types/project';
import { NovelContent } from './admin/novel-editor-with-ai';

interface NovelDisplayRendererProps {
  content: NovelContent | string;
  className?: string;
  
  // Portfolio-specific rendering
  mediaRenderer?: (mediaItems: MediaItem[]) => React.ReactNode;
  interactiveRenderer?: (url: string) => React.ReactNode;
  downloadRenderer?: (files: DownloadableFile[]) => React.ReactNode;
}

export function NovelDisplayRenderer({
  content,
  className = "",
  mediaRenderer,
  interactiveRenderer,
  downloadRenderer
}: NovelDisplayRendererProps) {
  // Convert string content to JSON if needed
  const jsonContent: JSONContent = typeof content === 'string' 
    ? {
        type: 'doc',
        content: content ? [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: content }]
          }
        ] : []
      }
    : content;

  // Render JSON content to HTML
  const renderContent = (node: JSONContent): React.ReactNode => {
    if (!node) return null;

    switch (node.type) {
      case 'doc':
        return (
          <div className={`novel-display-content max-w-none ${className}`}>
            {node.content?.map((child: any, index: number) => (
              <div key={index}>{renderContent(child)}</div>
            ))}
          </div>
        );

      case 'paragraph':
        return (
          <p>
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderContent(child)}</span>
            ))}
          </p>
        );

      case 'text':
        let textElement = <span>{node.text}</span>;
        
        // Apply text marks
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
                textElement = <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{textElement}</code>;
                break;
              case 'link':
                textElement = (
                  <a 
                    href={mark.attrs?.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
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
        const headingClass = `font-bold ${level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : level === 3 ? 'text-xl' : 'text-lg'} mb-4`;
        const content = node.content?.map((child: any, index: number) => (
          <span key={index}>{renderContent(child)}</span>
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
          <ul className="list-disc pl-6 mb-4">
            {node.content?.map((child: any, index: number) => (
              <li key={index}>{renderContent(child)}</li>
            ))}
          </ul>
        );

      case 'orderedList':
        return (
          <ol className="list-decimal pl-6 mb-4">
            {node.content?.map((child: any, index: number) => (
              <li key={index}>{renderContent(child)}</li>
            ))}
          </ol>
        );

      case 'listItem':
        return (
          <>
            {node.content?.map((child: any, index: number) => (
              <div key={index}>{renderContent(child)}</div>
            ))}
          </>
        );

      case 'codeBlock':
        return (
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
            <code>
              {node.content?.map((child: any, index: number) => (
                <span key={index}>{renderContent(child)}</span>
              ))}
            </code>
          </pre>
        );

      case 'blockquote':
        return (
          <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-4">
            {node.content?.map((child: any, index: number) => (
              <div key={index}>{renderContent(child)}</div>
            ))}
          </blockquote>
        );

      case 'image':
        return (
          <img 
            src={node.attrs?.src} 
            alt={node.attrs?.alt || ''} 
            className="max-w-full h-auto rounded-lg mb-4"
          />
        );

      case 'hardBreak':
        return <br />;

      case 'horizontalRule':
        return <hr className="my-4 border-gray-300" />;

      // Portfolio-specific node types
      case 'imageCarousel':
        const images = node.attrs?.images || [];
        if (images.length === 0) return null;
        
        return (
          <div className="my-6">
            {/* Simple carousel implementation for display */}
            <div className="grid grid-cols-1 gap-4">
              {images.map((image: any, index: number) => (
                <div key={index} className="text-center">
                  <img 
                    src={image.src} 
                    alt={image.alt || `Image ${index + 1}`}
                    className="max-w-full h-auto rounded-lg mx-auto"
                  />
                  {image.caption && (
                    <p className="text-sm text-gray-600 italic mt-2">{image.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'interactiveEmbed':
        const { url, type, title, width = '100%', height = '400px' } = node.attrs || {};
        if (!url) return null;
        
        return (
          <div className="my-6">
            {title && <h4 className="text-lg font-semibold mb-2">{title}</h4>}
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                src={url}
                title={title || 'Interactive Content'}
                width={width}
                height={height}
                className="w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
              {type === 'webxr' && (
                <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                  WebXR
                </div>
              )}
            </div>
          </div>
        );

      case 'downloadButton':
        const { files, label = 'Download' } = node.attrs || {};
        if (!files || files.length === 0) return null;
        
        return (
          <div className="my-6 text-center">
            <button 
              onClick={() => {
                // Handle download - this would be implemented by the parent
                if (files[0]) {
                  window.open(files[0].url, '_blank');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {label}
            </button>
          </div>
        );

      case 'projectReference':
        const { projectId, projectTitle, displayText } = node.attrs || {};
        if (!projectId) return null;
        
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            {displayText || projectTitle || `Project ${projectId}`}
          </span>
        );

      default:
        // Handle unknown node types gracefully
        return (
          <div>
            {node.content?.map((child: any, index: number) => (
              <div key={index}>{renderContent(child)}</div>
            ))}
          </div>
        );
    }
  };

  return <>{renderContent(jsonContent)}</>;
}