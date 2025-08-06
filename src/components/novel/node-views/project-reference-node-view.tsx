'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { ExternalLink, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectReferenceNodeViewProps {
  node: {
    attrs: {
      projectId: string;
      projectTitle?: string;
      projectSlug?: string;
      displayText?: string;
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
}

export function ProjectReferenceNodeView({ 
  node, 
  updateAttributes, 
  deleteNode 
}: ProjectReferenceNodeViewProps) {
  const { projectId, projectTitle, projectSlug, displayText } = node.attrs;

  if (!projectId) {
    return (
      <NodeViewWrapper className="project-reference-node inline">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-sm">
          <Folder className="h-3 w-3" />
          [Invalid Project Reference]
        </span>
      </NodeViewWrapper>
    );
  }

  const handleClick = () => {
    // Navigate to the project (this would be handled by the parent application)
    const projectUrl = projectSlug ? `/projects/${projectSlug}` : `/projects/${projectId}`;
    window.open(projectUrl, '_blank');
  };

  const linkText = displayText || projectTitle || `Project ${projectId}`;

  return (
    <NodeViewWrapper className="project-reference-node inline">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-800 rounded text-sm transition-colors cursor-pointer border-0 font-medium"
        title={projectTitle ? `View project: ${projectTitle}` : 'View project'}
      >
        <Folder className="h-3 w-3" />
        {linkText}
        <ExternalLink className="h-3 w-3" />
      </button>
    </NodeViewWrapper>
  );
}