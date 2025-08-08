'use client';

import React, { useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Edit, 
  Trash2, 
  ExternalLink,
  AlertTriangle,
  Eye,
  Folder,
  Link as LinkIcon
} from 'lucide-react';

interface ProjectReferenceNodeViewProps {
  node: {
    attrs: {
      projectId: string;
      projectSlug: string;
      title: string;
      description: string;
      thumbnailUrl: string;
      style: 'card' | 'inline' | 'minimal';
      isValid: boolean;
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  selected: boolean;
}

export function ProjectReferenceNodeView({ 
  node, 
  updateAttributes, 
  deleteNode,
  selected 
}: ProjectReferenceNodeViewProps) {
  const { 
    projectId, 
    projectSlug, 
    title, 
    description, 
    thumbnailUrl, 
    style, 
    isValid 
  } = node.attrs;
  
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = useCallback(() => {
    // TODO: Open project selection modal
    setIsEditing(true);
    console.log('Edit project reference - open project selection modal');
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this project reference?')) {
      deleteNode();
    }
  }, [deleteNode]);

  const handleViewProject = useCallback(() => {
    // Navigate to project (in edit mode, this might open in a new tab)
    const projectUrl = projectSlug ? `/projects/${projectSlug}` : `/projects/${projectId}`;
    window.open(projectUrl, '_blank', 'noopener,noreferrer');
  }, [projectId, projectSlug]);

  const handleNavigateToProject = useCallback(() => {
    // Navigate to project in the same tab (for public view)
    const projectUrl = projectSlug ? `/projects/${projectSlug}` : `/projects/${projectId}`;
    window.location.href = projectUrl;
  }, [projectId, projectSlug]);

  // Invalid project reference
  if (!isValid || !projectId) {
    return (
      <NodeViewWrapper className="project-reference-node">
        <Card className={`border-2 border-dashed border-red-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-8 w-8 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-600">Invalid Project Reference</p>
              <p className="text-sm text-red-500">
                {projectId ? `Project "${projectId}" not found` : 'No project selected'}
              </p>
            </div>
            <div className="flex gap-1">
              <Button onClick={handleEdit} size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Fix
              </Button>
              <Button onClick={handleDelete} size="sm" variant="outline">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </NodeViewWrapper>
    );
  }

  // Minimal style - just a link
  if (style === 'minimal') {
    return (
      <NodeViewWrapper className="project-reference-node inline">
        <span className={`inline-flex items-center gap-1 ${selected ? 'ring-2 ring-blue-500 rounded' : ''}`}>
          <button
            onClick={handleNavigateToProject}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            <LinkIcon className="h-3 w-3" />
            {title || `Project ${projectId}`}
          </button>
          
          {/* Edit controls (visible when selected) */}
          {selected && (
            <span className="inline-flex gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-6 w-6 p-0"
                title="Edit project reference"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-6 w-6 p-0"
                title="Delete project reference"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </span>
          )}
        </span>
      </NodeViewWrapper>
    );
  }

  // Inline style - compact horizontal layout
  if (style === 'inline') {
    return (
      <NodeViewWrapper className="project-reference-node">
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <CardContent className="flex items-center gap-3 py-3">
            {thumbnailUrl && (
              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                <img
                  src={thumbnailUrl}
                  alt={title || 'Project thumbnail'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0" onClick={handleNavigateToProject}>
              <h4 className="font-medium text-sm truncate">
                {title || `Project ${projectId}`}
              </h4>
              {description && (
                <p className="text-xs text-gray-600 truncate mt-1">
                  {description}
                </p>
              )}
            </div>

            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewProject}
                title="View project"
              >
                <Eye className="h-3 w-3" />
              </Button>
              {selected && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    title="Edit project reference"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    title="Delete project reference"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </NodeViewWrapper>
    );
  }

  // Card style - full card layout (default)
  return (
    <NodeViewWrapper className="project-reference-node">
      <Card className={`cursor-pointer hover:shadow-lg transition-shadow ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        {thumbnailUrl && (
          <div className="aspect-video bg-gray-100 overflow-hidden">
            <img
              src={thumbnailUrl}
              alt={title || 'Project thumbnail'}
              className="w-full h-full object-cover"
              onClick={handleNavigateToProject}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.parentElement!.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0" onClick={handleNavigateToProject}>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Folder className="h-4 w-4 text-blue-500" />
                <span className="truncate">{title || `Project ${projectId}`}</span>
              </CardTitle>
              {description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
            
            <div className="flex gap-1 ml-4 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewProject}
                title="View project"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              {selected && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    title="Edit project reference"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    title="Delete project reference"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Project Reference</span>
            <span className="flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              {projectSlug || projectId}
            </span>
          </div>
        </CardContent>
      </Card>
    </NodeViewWrapper>
  );
}