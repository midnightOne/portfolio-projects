'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProjectPreviewEditor } from '@/components/admin/project-preview-editor';
import { AIAssistantPanel } from '@/components/admin/ai-assistant-panel';
import { FloatingSaveBar } from '@/components/admin/floating-save-bar';
import { InlineEditable } from '@/components/admin/inline-editable';
import { SmartTagInput, Tag } from '@/components/admin/smart-tag-input';
import { ClickableMediaUpload } from '@/components/admin/clickable-media-upload';
import { ArrowLeft, Loader2, Calendar, Tag as TagIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProjectWithRelations, TextSelection } from '@/lib/types/project';

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

interface UnifiedProjectEditorProps {
  projectId?: string;
  mode: 'create' | 'edit';
}

export function UnifiedProjectEditor({ projectId, mode }: UnifiedProjectEditorProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [saveBarVisible, setSaveBarVisible] = useState(true);
  const [existingTags, setExistingTags] = useState<Tag[]>([]);

  // Form state
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    description: '',
    briefOverview: '',
    tags: [],
    status: 'DRAFT',
    visibility: 'PRIVATE',
    workDate: new Date().toISOString().split('T')[0],
    articleContent: ''
  });

  const isEditing = mode === 'edit' && !!projectId;

  // Load project data for editing and fetch existing tags
  useEffect(() => {
    if (isEditing) {
      fetchProject();
    }
    fetchExistingTags();
  }, [isEditing, projectId]);

  // Track unsaved changes
  useEffect(() => {
    if (project && isEditing) {
      const hasChanges = 
        formData.title !== project.title ||
        formData.description !== project.description ||
        formData.briefOverview !== project.briefOverview ||
        formData.articleContent !== (project.articleContent?.content || '') ||
        JSON.stringify(formData.tags.sort()) !== JSON.stringify(project.tags.map(t => t.name).sort()) ||
        formData.status !== (project.status as string) ||
        formData.visibility !== (project.visibility as string);
      
      setHasUnsavedChanges(hasChanges);
    } else if (!isEditing) {
      // For new projects, consider any content as unsaved changes
      const hasContent = !!(
        formData.title.trim() ||
        formData.description.trim() ||
        formData.briefOverview.trim() ||
        formData.articleContent.trim() ||
        formData.tags.length > 0
      );
      
      setHasUnsavedChanges(hasContent);
    }
  }, [formData, project, isEditing]);

  const fetchProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      console.log('Fetching project:', projectId);
      const response = await fetch(`/api/admin/projects/${projectId}`);
      
      console.log('Fetch response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
      }

      const projectData = await response.json();
      console.log('Fetched project data:', {
        id: projectData.id,
        title: projectData.title,
        thumbnailImageId: projectData.thumbnailImageId,
        hasThumbnailImage: !!projectData.thumbnailImage,
        thumbnailImageUrl: projectData.thumbnailImage?.url
      });
      setProject(projectData);
      
      // Update form data
      setFormData({
        title: projectData.title || '',
        description: projectData.description || '',
        briefOverview: projectData.briefOverview || '',
        tags: projectData.tags?.map((t: any) => t.name) || [],
        status: projectData.status || 'DRAFT',
        visibility: projectData.visibility || 'PRIVATE',
        workDate: projectData.workDate ? new Date(projectData.workDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        articleContent: projectData.articleContent?.content || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setExistingTags(result.data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch existing tags:', err);
      // Don't show error to user, just continue without autocomplete
    }
  };

  const handleThumbnailSelect = async (media: any) => {
    try {
      setError(null);
      console.log('Selecting thumbnail:', media);
      
      // Optimistically update the local state first
      if (project) {
        setProject({
          ...project,
          thumbnailImage: media,
          thumbnailImageId: media.id
        });
      }
      
      // Update the project with the new thumbnail
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thumbnailImageId: media.id
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        await fetchProject();
        throw new Error('Failed to update thumbnail');
      }

      // Refresh project data to ensure consistency
      await fetchProject();
      
      console.log('Thumbnail updated successfully');
    } catch (err) {
      console.error('Thumbnail selection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update thumbnail');
    }
  };

  const handleThumbnailRemove = async () => {
    try {
      setError(null);
      console.log('Removing thumbnail');
      
      // Optimistically update the local state first
      if (project) {
        setProject({
          ...project,
          thumbnailImage: null,
          thumbnailImageId: undefined
        });
      }
      
      // Remove the thumbnail from the project
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thumbnailImageId: undefined
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        await fetchProject();
        throw new Error('Failed to remove thumbnail');
      }

      // Refresh project data to ensure consistency
      await fetchProject();
      
      console.log('Thumbnail removed successfully');
    } catch (err) {
      console.error('Thumbnail removal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove thumbnail');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const url = isEditing ? `/api/admin/projects/${projectId}` : '/api/admin/projects';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save project');
      }

      const result = await response.json();
      setLastSaveTime(new Date());
      setHasUnsavedChanges(false);
      
      // For new projects, redirect to edit mode
      if (!isEditing && result.project?.id) {
        router.push(`/admin/projects/editor/${result.project.id}`);
      } else if (isEditing) {
        // Refresh project data
        await fetchProject();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleFormDataChange = (updates: Partial<ProjectFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleTextSelection = (selection: TextSelection | undefined) => {
    setSelectedText(selection);
  };

  const handleContentUpdate = (updates: Partial<ProjectWithRelations>) => {
    // Update form data with AI suggestions
    const formUpdates: Partial<ProjectFormData> = {};
    
    if (updates.title) formUpdates.title = updates.title;
    if (updates.description) formUpdates.description = updates.description;
    if (updates.briefOverview) formUpdates.briefOverview = updates.briefOverview;
    if (updates.articleContent?.content) formUpdates.articleContent = updates.articleContent.content;
    if (updates.tags) formUpdates.tags = updates.tags.map(t => t.name);

    if (Object.keys(formUpdates).length > 0) {
      handleFormDataChange(formUpdates);
    }

    // Update project state for AI context
    if (project) {
      setProject(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  // Create mock project for AI context when creating new projects
  const getProjectForAI = (): ProjectWithRelations => {
    if (project) return { ...project, ...formDataToProject(formData) };
    
    return {
      id: 'new-project',
      title: formData.title,
      slug: formData.title.toLowerCase().replace(/\s+/g, '-'),
      description: formData.description,
      briefOverview: formData.briefOverview,
      workDate: formData.workDate ? new Date(formData.workDate) : null,
      status: formData.status as 'DRAFT' | 'PUBLISHED',
      visibility: formData.visibility as 'PUBLIC' | 'PRIVATE',
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      thumbnailImageId: undefined,
      metadataImageId: undefined,
      tags: formData.tags.map((tag, index) => ({
        id: `tag-${index}`,
        name: tag,
        color: null,
        createdAt: new Date()
      })),
      thumbnailImage: null,
      metadataImage: null,
      mediaItems: [],
      articleContent: {
        id: 'article-new',
        projectId: 'new-project',
        content: formData.articleContent,
        createdAt: new Date(),
        updatedAt: new Date(),
        embeddedMedia: []
      },
      interactiveExamples: [],
      externalLinks: [],
      downloadableFiles: [],
      carousels: [],
      analytics: []
    };
  };

  const formDataToProject = (data: ProjectFormData): Partial<ProjectWithRelations> => ({
    title: data.title,
    description: data.description,
    briefOverview: data.briefOverview,
    status: data.status as 'DRAFT' | 'PUBLISHED',
    visibility: data.visibility as 'PUBLIC' | 'PRIVATE',
    workDate: data.workDate ? new Date(data.workDate) : null,
    tags: data.tags.map((tag, index) => ({
      id: `tag-${index}`,
      name: tag,
      color: null,
      createdAt: new Date()
    })),
    articleContent: {
      id: project?.articleContent?.id || 'article-new',
      projectId: project?.id || 'new-project',
      content: data.articleContent,
      createdAt: project?.articleContent?.createdAt || new Date(),
      updatedAt: new Date(),
      embeddedMedia: project?.articleContent?.embeddedMedia || []
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  if (error && isEditing && !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/admin/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content Container - Centered with proper spacing */}
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4" style={{ maxWidth: '96rem' }}>
        {/* Save Bar - Positioned in allocated space */}
        <div className="mb-3 flex justify-center">
          <div className="w-full">
            <FloatingSaveBar
              visible={saveBarVisible}
              onToggleVisibility={() => setSaveBarVisible(!saveBarVisible)}
              saving={saving}
              hasUnsavedChanges={hasUnsavedChanges}
              lastSaveTime={lastSaveTime}
              onSave={handleSave}
              onBack={() => router.push('/admin/projects')}
              visibility={formData.visibility}
              onVisibilityChange={(visibility) => handleFormDataChange({ visibility })}
              error={error}
            />
          </div>
        </div>

        <div className="flex gap-3 min-h-[calc(100vh-7rem)]">
          {/* Project Edit View - 60% with project-like layout */}
          <div className="flex-1" style={{ flexBasis: '60%' }}>
            <Card className="h-full overflow-hidden">
              <div className="flex h-full">
                {/* Left Sidebar - Metadata (similar to project modal) */}
                <div className="w-1/3 border-r bg-muted/30 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {/* Project Title */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Project Title *
                        </label>
                        <InlineEditable
                          value={formData.title}
                          onChange={(value) => handleFormDataChange({ title: value })}
                          placeholder="Enter your project title..."
                          className="text-xl font-bold"
                          onTextSelection={handleTextSelection}
                          fieldName="title"
                          required
                          maxLength={255}
                          showCharacterCount
                        />
                      </div>

                      {/* Project Image Upload */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Project Image
                        </label>
                        <ClickableMediaUpload
                          currentMedia={project?.thumbnailImage || undefined}
                          projectId={projectId}
                          onMediaSelect={handleThumbnailSelect}
                          onMediaRemove={handleThumbnailRemove}
                          onError={(error) => setError(error)}
                          aspectRatio="16:9"
                          placeholder={
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                              <div className="w-12 h-12 bg-gray-200 rounded-lg mb-2" />
                              <p className="text-sm">Click to select image</p>
                              <p className="text-xs">or drag and drop to upload</p>
                            </div>
                          }
                        />
                      </div>

                      {/* Brief Overview */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Brief Overview
                        </label>
                        <InlineEditable
                          value={formData.briefOverview}
                          onChange={(value) => handleFormDataChange({ briefOverview: value })}
                          placeholder="A short description that appears on project cards..."
                          multiline
                          rows={3}
                          maxLength={200}
                          className="text-sm text-gray-600"
                          onTextSelection={handleTextSelection}
                          fieldName="briefOverview"
                          showCharacterCount
                        />
                        <p className="text-xs text-gray-500">
                          This appears on project cards and in search results
                        </p>
                      </div>

                      {/* Tags */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <TagIcon className="h-4 w-4" />
                          Tags
                        </label>
                        <SmartTagInput
                          value={formData.tags}
                          onChange={(tags) => handleFormDataChange({ tags })}
                          existingTags={existingTags}
                          placeholder="Add tags (comma or semicolon separated)..."
                          onTagCreate={(tagName) => {
                            console.log('New tag created:', tagName);
                          }}
                          onDuplicateAttempt={(tagName) => {
                            console.log('Duplicate tag attempted:', tagName);
                          }}
                          maxTags={10}
                          showSuggestions={true}
                          animateDuplicates={true}
                        />
                      </div>

                      {/* Work Date */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Work Date
                        </label>
                        <Input
                          type="date"
                          value={formData.workDate}
                          onChange={(e) => handleFormDataChange({ workDate: e.target.value })}
                          className="w-full"
                        />
                      </div>

                      {/* Project Description */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Project Description
                        </label>
                        <InlineEditable
                          value={formData.description}
                          onChange={(value) => handleFormDataChange({ description: value })}
                          placeholder="Describe your project in detail..."
                          multiline
                          rows={4}
                          className="text-sm text-gray-700"
                          onTextSelection={handleTextSelection}
                          fieldName="description"
                          maxLength={2000}
                          showCharacterCount
                        />
                        <p className="text-xs text-gray-500">
                          This appears in the project modal description section
                        </p>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Right Content Area - Article Content */}
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Article Content</h2>
                        <p className="text-sm text-gray-600">
                          Write the detailed project article with technical details and insights
                        </p>
                      </div>

                      <InlineEditable
                        value={formData.articleContent}
                        onChange={(value) => handleFormDataChange({ articleContent: value })}
                        placeholder="Write your project article here. This is where you can go into technical details, explain your process, share insights, and tell the story of your project..."
                        multiline
                        rows={20}
                        className="text-sm text-gray-700 font-mono min-h-[500px]"
                        onTextSelection={handleTextSelection}
                        fieldName="articleContent"
                        showCharacterCount
                      />
                      <p className="text-xs text-gray-500">
                        Select text and use the AI assistant for writing help and improvements
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* AI Assistant Panel - 35% */}
          <div className="flex-shrink-0" style={{ flexBasis: '35%' }}>
            <Card className="h-full">
              <AIAssistantPanel
                project={getProjectForAI()}
                selectedText={selectedText}
                onApplyChanges={handleContentUpdate}
                onTextSelection={handleTextSelection}
                isEnabled={true}
                height={600}
                className="h-full"
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}