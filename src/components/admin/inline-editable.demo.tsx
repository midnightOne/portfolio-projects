'use client';

import { useState } from 'react';
import { InlineEditable } from './inline-editable';
import { ProjectDisplay } from './project-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TextSelection, ProjectWithRelations } from '@/lib/types/project';

/**
 * Demo component showcasing the enhanced InlineEditable component
 * and ProjectDisplay component for edit/view mode consistency
 */
export function InlineEditableDemo() {
  const [title, setTitle] = useState('My Awesome Project');
  const [description, setDescription] = useState('This is a detailed description of my project that showcases various technologies and approaches.');
  const [briefOverview, setBriefOverview] = useState('A brief overview that appears on project cards');
  const [articleContent, setArticleContent] = useState('This is the main article content where I can write detailed technical information about the project...');
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mock project data for ProjectDisplay demo
  const mockProject: ProjectWithRelations = {
    id: 'demo-project',
    title,
    slug: 'demo-project',
    description,
    briefOverview,
    workDate: new Date(),
    status: 'DRAFT',
    visibility: 'PRIVATE',
    viewCount: 42,
    createdAt: new Date(),
    updatedAt: new Date(),
    thumbnailImageId: undefined,
    metadataImageId: undefined,
    tags: [
      { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
      { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
      { id: '3', name: 'Next.js', color: '#000000', createdAt: new Date() }
    ],
    thumbnailImage: null,
    metadataImage: null,
    mediaItems: [],
    articleContent: {
      id: 'article-1',
      projectId: 'demo-project',
      content: articleContent,
      contentType: 'text',
      createdAt: new Date(),
      updatedAt: new Date(),
      embeddedMedia: []
    },
    interactiveExamples: [],
    externalLinks: [
      { id: '1', projectId: 'demo-project', label: 'GitHub', url: 'https://github.com', icon: 'github', description: null, order: 0, createdAt: new Date() },
      { id: '2', projectId: 'demo-project', label: 'Live Demo', url: 'https://example.com', icon: 'external-link', description: null, order: 1, createdAt: new Date() }
    ],
    downloadableFiles: [
      { 
        id: '1', 
        projectId: 'demo-project', 
        filename: 'demo-app.zip', 
        originalName: 'demo-app.zip', 
        fileType: 'ZIP', 
        fileSize: BigInt(1024000), 
        downloadUrl: 'https://example.com/download', 
        description: 'Source code', 
        uploadDate: new Date() 
      }
    ],
    carousels: [],
    analytics: [],
    _count: {
      mediaItems: 0,
      downloadableFiles: 1,
      externalLinks: 2,
      analytics: 5
    }
  };

  const handleTextSelection = (selection: TextSelection | undefined) => {
    setSelectedText(selection);
    console.log('Text selected:', selection);
  };

  const validateTitle = (value: string) => {
    if (value.length < 3) return 'Title must be at least 3 characters';
    if (value.length > 100) return 'Title must be less than 100 characters';
    return null;
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Enhanced Inline Editing Demo</h1>
        <p className="text-gray-600">
          Showcasing the enhanced InlineEditable component with AI integration support
        </p>
      </div>

      {/* Basic InlineEditable Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Basic InlineEditable Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simple text input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Title (with validation)</label>
            <InlineEditable
              value={title}
              onChange={setTitle}
              placeholder="Enter project title..."
              className="text-2xl font-bold"
              required
              maxLength={100}
              showCharacterCount
              customValidator={validateTitle}
              fieldName="title"
              onTextSelection={handleTextSelection}
            />
          </div>

          {/* Multiline text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Brief Overview (multiline)</label>
            <InlineEditable
              value={briefOverview}
              onChange={setBriefOverview}
              placeholder="Enter a brief overview..."
              multiline
              rows={3}
              maxLength={200}
              showCharacterCount
              fieldName="briefOverview"
              onTextSelection={handleTextSelection}
            />
          </div>

          {/* Auto-save example */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (with auto-save)</label>
            <InlineEditable
              value={description}
              onChange={setDescription}
              placeholder="Enter project description..."
              multiline
              rows={4}
              autoSave
              autoSaveDelay={2000}
              onAutoSave={(value) => {
                console.log('Auto-saved:', value);
                // Simulate API call
              }}
              fieldName="description"
              onTextSelection={handleTextSelection}
            />
          </div>

          {/* Inline display mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Inline Display Mode</label>
            <div className="flex items-center gap-2">
              <span>Project:</span>
              <InlineEditable
                value={title}
                onChange={setTitle}
                displayMode="inline"
                className="font-semibold"
                fieldName="inline-title"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Text Selection Demo */}
      {selectedText && (
        <Card>
          <CardHeader>
            <CardTitle>Text Selection (AI Integration)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Selected Text:</h4>
              <p className="text-sm mb-2">
                <strong>Field:</strong> {selectedText.field}
              </p>
              <p className="text-sm mb-2">
                <strong>Selection:</strong> "{selectedText.text}"
              </p>
              <p className="text-sm mb-2">
                <strong>Position:</strong> {selectedText.start} - {selectedText.end}
              </p>
              <p className="text-sm">
                <strong>Context:</strong> "{selectedText.context}"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ProjectDisplay Demo */}
      <Card>
        <CardHeader>
          <CardTitle>ProjectDisplay Component - Edit Mode</CardTitle>
          <p className="text-sm text-gray-600">
            Shared component ensuring consistency between edit and view modes
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-96 border rounded-lg overflow-hidden">
            <ProjectDisplay
              project={mockProject}
              mode="edit"
              onTextSelection={handleTextSelection}
              errors={errors}
              
              titleRenderer={
                <InlineEditable
                  value={title}
                  onChange={setTitle}
                  placeholder="Enter project title..."
                  className="text-xl lg:text-2xl font-bold leading-tight"
                  required
                  fieldName="title"
                  onTextSelection={handleTextSelection}
                />
              }
              
              briefOverviewRenderer={
                <InlineEditable
                  value={briefOverview}
                  onChange={setBriefOverview}
                  placeholder="Enter brief overview..."
                  multiline
                  rows={3}
                  maxLength={200}
                  className="text-sm text-muted-foreground leading-relaxed"
                  fieldName="briefOverview"
                  onTextSelection={handleTextSelection}
                />
              }
              
              descriptionRenderer={
                <InlineEditable
                  value={description}
                  onChange={setDescription}
                  placeholder="Enter project description..."
                  multiline
                  rows={6}
                  className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap"
                  fieldName="description"
                  onTextSelection={handleTextSelection}
                />
              }
              
              articleContentRenderer={
                <InlineEditable
                  value={articleContent}
                  onChange={setArticleContent}
                  placeholder="Write your detailed project article..."
                  multiline
                  rows={10}
                  className="text-sm lg:text-base leading-relaxed font-mono"
                  fieldName="articleContent"
                  onTextSelection={handleTextSelection}
                />
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* View Mode Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>ProjectDisplay Component - View Mode</CardTitle>
          <p className="text-sm text-gray-600">
            Same component in view mode for consistency
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-96 border rounded-lg overflow-hidden">
            <ProjectDisplay
              project={mockProject}
              mode="view"
              showViewCount={true}
              showDownloads={true}
              showExternalLinks={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">InlineEditable Enhancements:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Enhanced text selection for AI integration</li>
                <li>• Comprehensive validation (required, length, custom)</li>
                <li>• Auto-save functionality with configurable delay</li>
                <li>• Character count display</li>
                <li>• Inline and block display modes</li>
                <li>• Better error handling and display</li>
                <li>• Accessibility improvements</li>
                <li>• Field identification for context</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">ProjectDisplay Features:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Consistent edit/view mode layouts</li>
                <li>• Matches public project modal styling</li>
                <li>• Custom renderers for edit mode</li>
                <li>• Responsive two-column design</li>
                <li>• Proper typography and spacing</li>
                <li>• Seamless mode switching</li>
                <li>• Accessibility support</li>
                <li>• Reusable and modular</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}