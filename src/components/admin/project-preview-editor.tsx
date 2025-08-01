'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SmartTagInput } from '@/components/admin/smart-tag-input';
import { ClickableMediaUpload } from '@/components/admin/clickable-media-upload';
import { InlineEditable } from '@/components/admin/inline-editable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Tag as TagIcon } from 'lucide-react';
import { TextSelection } from '@/lib/types/project';

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
}

export function ProjectPreviewEditor({
  project,
  onChange,
  onTextSelection,
  errors,
  className = ''
}: ProjectPreviewEditorProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleTextSelection = (
    field: string,
    element: HTMLTextAreaElement | HTMLInputElement
  ) => {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    
    if (start !== end && start !== null && end !== null) {
      const selectedText = element.value.substring(start, end);
      const contextLength = 100;
      const contextStart = Math.max(0, start - contextLength);
      const contextEnd = Math.min(element.value.length, end + contextLength);
      const context = element.value.substring(contextStart, contextEnd);
      
      onTextSelection({
        start,
        end,
        text: selectedText,
        context,
        field
      });
    } else {
      onTextSelection(undefined);
    }
  };

  const handleFieldChange = (field: keyof ProjectFormData, value: any) => {
    onChange({ [field]: value });
  };

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
            onTextSelection={(element) => handleTextSelection('title', element)}
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
            onTextSelection={(element) => handleTextSelection('briefOverview', element)}
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
              currentMedia={undefined} // TODO: Connect to actual media
              onMediaSelect={(media) => {
                // TODO: Handle media selection
                console.log('Media selected:', media);
              }}
              onMediaRemove={() => {
                // TODO: Handle media removal
                console.log('Media removed');
              }}
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
              existingTags={[]} // TODO: Load existing tags from API
              placeholder="Add tags (comma or semicolon separated)..."
              error={errors.tags}
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
            onTextSelection={(element) => handleTextSelection('description', element)}
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
            onTextSelection={(element) => handleTextSelection('articleContent', element)}
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