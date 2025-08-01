'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { SmartTagInput, Tag } from '@/components/admin/smart-tag-input';
import { ClickableMediaUpload } from '@/components/admin/clickable-media-upload';
import { InlineEditable } from '@/components/admin/inline-editable';
import { ProjectDisplay } from '@/components/admin/project-display';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Tag as TagIcon } from 'lucide-react';
import { TextSelection, ProjectWithRelations, MediaItem } from '@/lib/types/project';

interface ProjectFormData {
  title: string;
  description: string;
  briefOverview: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  visibility: 'PUBLIC' | 'PRIVATE';
  workDate: string;
  articleContent: string;
}

interface ProjectPreviewEditorProps {
  project: ProjectFormData;
  onChange: (updates: Partial<ProjectFormData>) => void;
  onTextSelection: (selection: TextSelection | undefined) => void;
  errors: Record<string, string>;
  className?: string;
  // Additional props for enhanced functionality
  existingTags?: Tag[];
  currentMedia?: MediaItem;
  onMediaSelect?: (media: MediaItem) => void;
  onMediaRemove?: () => void;
  projectId?: string;
  // Auto-save functionality
  autoSave?: boolean;
  onAutoSave?: (field: string, value: string) => void;
}

export function ProjectPreviewEditor({
  project,
  onChange,
  onTextSelection,
  errors,
  className = '',
  existingTags = [],
  currentMedia,
  onMediaSelect,
  onMediaRemove,
  projectId,
  autoSave = false,
  onAutoSave
}: ProjectPreviewEditorProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleFieldChange = (field: keyof ProjectFormData, value: any) => {
    onChange({ [field]: value });
  };

  const handleAutoSave = (field: string, value: string) => {
    if (onAutoSave) {
      onAutoSave(field, value);
    }
  };

  // This component is now just a wrapper - the actual layout is handled in unified-project-editor
  // This maintains backward compatibility while allowing the enhanced inline editing
  return (
    <div className={`space-y-6 overflow-y-auto ${className}`}>
      {/* Project Header Section */}
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Project Title *
          </label>
          <InlineEditable
            value={project.title}
            onChange={(value) => handleFieldChange('title', value)}
            placeholder="Enter your project title..."
            className="text-2xl font-bold"
            error={errors.title}
            onTextSelection={onTextSelection}
            fieldName="title"
            required
            maxLength={255}
            showCharacterCount
            autoSave={autoSave}
            onAutoSave={(value) => handleAutoSave('title', value)}
          />
        </div>

        {/* Brief Overview */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Brief Overview
          </label>
          <InlineEditable
            value={project.briefOverview}
            onChange={(value) => handleFieldChange('briefOverview', value)}
            placeholder="A short description that appears on project cards..."
            multiline
            maxLength={200}
            className="text-gray-600"
            error={errors.briefOverview}
            onTextSelection={onTextSelection}
            fieldName="briefOverview"
            showCharacterCount
            autoSave={autoSave}
            onAutoSave={(value) => handleAutoSave('briefOverview', value)}
          />
          <p className="text-xs text-gray-500">
            This appears on project cards and in search results
          </p>
        </div>
      </div>

      {/* Metadata Section */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Project Details</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Media Upload Area */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Project Image
            </label>
            <ClickableMediaUpload
              currentMedia={currentMedia}
              projectId={projectId}
              onMediaSelect={onMediaSelect || (() => {})}
              onMediaRemove={onMediaRemove || (() => {})}
              aspectRatio="16:9"
              placeholder={
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg mb-2" />
                  <p className="text-sm">Click to upload image</p>
                  <p className="text-xs">or drag and drop</p>
                </div>
              }
              className="border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <TagIcon className="h-4 w-4" />
              Tags
            </label>
            <SmartTagInput
              value={project.tags}
              onChange={(tags) => handleFieldChange('tags', tags)}
              existingTags={existingTags}
              placeholder="Add tags (comma or semicolon separated)..."
              error={errors.tags}
              maxTags={10}
              showSuggestions={true}
              animateDuplicates={true}
              onTagCreate={(tagName) => {
                console.log('New tag created:', tagName);
              }}
              onDuplicateAttempt={(tagName) => {
                console.log('Duplicate tag attempted:', tagName);
              }}
            />
            {project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Work Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Work Date
            </label>
            <Input
              type="date"
              value={project.workDate}
              onChange={(e) => handleFieldChange('workDate', e.target.value)}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Description Section */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Project Description</h3>
          <p className="text-sm text-gray-600">
            Detailed description that appears in the project modal
          </p>
        </CardHeader>
        <CardContent>
          <InlineEditable
            value={project.description}
            onChange={(value) => handleFieldChange('description', value)}
            placeholder="Describe your project in detail. What was it about? What technologies did you use? What challenges did you face?"
            multiline
            rows={6}
            className="text-gray-700"
            error={errors.description}
            onTextSelection={onTextSelection}
            fieldName="description"
            maxLength={2000}
            showCharacterCount
            autoSave={autoSave}
            onAutoSave={(value) => handleAutoSave('description', value)}
          />
        </CardContent>
      </Card>

      {/* Article Content Section */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Article Content</h3>
          <p className="text-sm text-gray-600">
            The main article content with technical details, process, and insights
          </p>
        </CardHeader>
        <CardContent>
          <InlineEditable
            value={project.articleContent}
            onChange={(value) => handleFieldChange('articleContent', value)}
            placeholder="Write the detailed article content here. This is where you can go into technical details, explain your process, share insights, and tell the story of your project..."
            multiline
            rows={15}
            className="text-gray-700 font-mono text-sm"
            error={errors.articleContent}
            onTextSelection={onTextSelection}
            fieldName="articleContent"
            showCharacterCount
            autoSave={autoSave}
            onAutoSave={(value) => handleAutoSave('articleContent', value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Select text and use the AI assistant for writing help and improvements
          </p>
        </CardContent>
      </Card>

      {/* Preview Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Preview Mode:</strong> This layout resembles how visitors will see your project. 
          Click on any field to edit inline, or select text to get AI assistance.
        </p>
      </div>
    </div>
  );
}