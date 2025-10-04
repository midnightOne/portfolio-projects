'use client';

/**
 * Semantic Regeneration Trigger Component
 * 
 * Provides quick action buttons to trigger regeneration workflows
 * from various admin interfaces (dashboard, project view, tree view).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RefreshCw, Zap, FileText, FolderOpen } from 'lucide-react';
import { SemanticRegenerationWorkflow, RegenerationScope } from './semantic-regeneration-workflow';

interface SemanticRegenerationTriggerProps {
  variant?: 'button' | 'dropdown';
  projectId?: string;
  projectTitle?: string;
  sectionId?: string;
  sectionTitle?: string;
  onComplete?: (result: any) => void;
}

export function SemanticRegenerationTrigger({
  variant = 'button',
  projectId,
  projectTitle,
  sectionId,
  sectionTitle,
  onComplete
}: SemanticRegenerationTriggerProps) {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [scope, setScope] = useState<RegenerationScope | null>(null);

  const handleTrigger = (scopeType: 'all' | 'project' | 'section') => {
    const newScope: RegenerationScope = {
      type: scopeType,
      projectId,
      projectTitle,
      sectionId,
      sectionTitle
    };
    setScope(newScope);
    setShowWorkflow(true);
  };

  const handleComplete = (result: any) => {
    setShowWorkflow(false);
    setScope(null);
    onComplete?.(result);
  };

  const handleCancel = () => {
    setShowWorkflow(false);
    setScope(null);
  };

  if (variant === 'button') {
    // Simple button for single scope
    const buttonScope = sectionId ? 'section' : projectId ? 'project' : 'all';
    const buttonLabel = sectionId 
      ? 'Regenerate Section' 
      : projectId 
      ? 'Regenerate Project' 
      : 'Regenerate All';

    return (
      <>
        <Button
          onClick={() => handleTrigger(buttonScope)}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>

        {showWorkflow && scope && (
          <SemanticRegenerationWorkflow
            scope={scope}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        )}
      </>
    );
  }

  // Dropdown menu for multiple scope options
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Regeneration Scope</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {sectionId && (
            <DropdownMenuItem onClick={() => handleTrigger('section')}>
              <FileText className="h-4 w-4 mr-2" />
              This Section Only
            </DropdownMenuItem>
          )}
          
          {projectId && (
            <DropdownMenuItem onClick={() => handleTrigger('project')}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Entire Project
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={() => handleTrigger('all')}>
            <Zap className="h-4 w-4 mr-2" />
            All Projects
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showWorkflow && scope && (
        <SemanticRegenerationWorkflow
          scope={scope}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
