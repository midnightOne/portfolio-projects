'use client';

import React, { useState, useCallback, useRef } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Edit, 
  Trash2, 
  ExternalLink, 
  AlertTriangle,
  Maximize,
  Monitor,
  Globe
} from 'lucide-react';

interface InteractiveEmbedNodeViewProps {
  node: {
    attrs: {
      url: string;
      title: string;
      description: string;
      type: 'iframe' | 'webxr' | 'canvas';
      width: number;
      height: number;
      allowFullscreen: boolean;
      sandbox: string;
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  selected: boolean;
}

export function InteractiveEmbedNodeView({ 
  node, 
  updateAttributes, 
  deleteNode,
  selected 
}: InteractiveEmbedNodeViewProps) {
  const { 
    url, 
    title, 
    description, 
    type, 
    width, 
    height, 
    allowFullscreen, 
    sandbox 
  } = node.attrs;
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleEdit = useCallback(() => {
    // TODO: Open edit dialog for interactive embed
    setIsEditing(true);
    console.log('Edit interactive embed');
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this interactive embed?')) {
      deleteNode();
    }
  }, [deleteNode]);

  const openInNewTab = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const toggleFullscreen = useCallback(() => {
    if (iframeRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        iframeRef.current.requestFullscreen();
      }
    }
  }, []);

  // Validate URL
  const isValidUrl = useCallback((urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }, []);

  if (!url || !isValidUrl(url)) {
    return (
      <NodeViewWrapper className="interactive-embed-node">
        <Card className={`border-2 border-dashed border-red-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-500 mb-4">Invalid or missing URL</p>
            <div className="flex gap-2">
              <Button onClick={handleEdit} size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit URL
              </Button>
              <Button onClick={handleDelete} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </NodeViewWrapper>
    );
  }

  const getTypeIcon = () => {
    switch (type) {
      case 'webxr':
        return <Globe className="h-4 w-4" />;
      case 'canvas':
        return <Monitor className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  return (
    <NodeViewWrapper className="interactive-embed-node">
      <Card className={`overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        {(title || description) && (
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {title && (
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getTypeIcon()}
                    {title}
                  </CardTitle>
                )}
                {description && (
                  <p className="text-sm text-gray-600 mt-1">{description}</p>
                )}
              </div>
              <div className="flex gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openInNewTab}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                {allowFullscreen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    title="Toggle fullscreen"
                  >
                    <Maximize className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  title="Edit embed"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  title="Delete embed"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
        )}
        
        <CardContent className="p-0">
          <div className="relative group">
            {/* Loading State */}
            {isLoading && (
              <div 
                className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10"
                style={{ height: `${height}px` }}
              >
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading interactive content...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {hasError && (
              <div 
                className="bg-red-50 border border-red-200 flex items-center justify-center"
                style={{ height: `${height}px` }}
              >
                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600 mb-2">Failed to load content</p>
                  <Button onClick={() => window.location.reload()} size="sm" variant="outline">
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Interactive Content */}
            {type === 'iframe' && (
              <iframe
                ref={iframeRef}
                src={url}
                title={title || 'Interactive Content'}
                width={width}
                height={height}
                className="w-full border-0"
                style={{ height: `${height}px` }}
                sandbox={sandbox}
                allowFullScreen={allowFullscreen}
                onLoad={handleLoad}
                onError={handleError}
                loading="lazy"
              />
            )}

            {type === 'webxr' && (
              <div 
                className="bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center border"
                style={{ height: `${height}px` }}
              >
                <div className="text-center">
                  <Globe className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-purple-700 mb-2">WebXR Experience</p>
                  <p className="text-sm text-purple-600 mb-4">
                    This content requires WebXR support
                  </p>
                  <Button onClick={openInNewTab} className="bg-purple-600 hover:bg-purple-700">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Launch Experience
                  </Button>
                </div>
              </div>
            )}

            {type === 'canvas' && (
              <div 
                className="bg-gray-900 flex items-center justify-center border"
                style={{ height: `${height}px` }}
              >
                <div className="text-center">
                  <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-white mb-2">Canvas Application</p>
                  <p className="text-sm text-gray-300 mb-4">
                    Interactive canvas content
                  </p>
                  <Button onClick={openInNewTab} variant="secondary">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Application
                  </Button>
                </div>
              </div>
            )}

            {/* Hover Controls */}
            {!title && !description && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openInNewTab}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                {allowFullscreen && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleFullscreen}
                    title="Toggle fullscreen"
                  >
                    <Maximize className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleEdit}
                  title="Edit embed"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDelete}
                  title="Delete embed"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* URL Display */}
          <div className="px-3 py-2 bg-gray-50 border-t">
            <p className="text-xs text-gray-500 truncate" title={url}>
              {url}
            </p>
          </div>
        </CardContent>
      </Card>
    </NodeViewWrapper>
  );
}