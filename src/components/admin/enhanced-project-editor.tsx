'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Calendar, Tag as TagIcon, Save, Bot } from 'lucide-react';
import { ProjectWithRelations } from '@/lib/types/project';
import { 
  AIQuickActions, 
  TextSelection, 
  ProjectContext, 
  AIQuickActionResult 
} from './ai-quick-actions';
import { 
  AIPromptInterface,
  AIPromptResult 
} from './ai-prompt-interface';
import { 
  TextSelectionManager, 
  TextareaAdapter, 
  TextChange 
} from './text-selection-manager';
import { SmartTagInput, Tag } from './smart-tag-input';
import { ClickableMediaUpload } from './clickable-media-upload';
import { FloatingSaveBar } from './floating-save-bar';

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

interface EnhancedProjectEditorProps {
  projectId?: string;
  mode: 'create' | 'edit';
}

export function EnhancedProjectEditor({ projectId, mode }: EnhancedProjectEditorProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [existingTags, setExistingTags] = useState<Tag[]>([]);
  const [activeField, setActiveField] = useState<string>('');
  const [aiMode, setAiMode] = useState<'quick-actions' | 'prompt-interface'>('prompt-interface');

  // Refs for text areas
  const titleRef = useRef<HTMLInputElement>(null);
  const briefOverviewRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const articleContentRef = useRef<HTMLTextAreaElement>(null);

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

  // Create adapters for different text fields
  const titleAdapter = useMemo(() => {
    if (titleRef.current) {
      return new TextareaAdapter(titleRef.current as any, (content) => {
        setFormData(prev => ({ ...prev, title: content }));
      });
    }
    return null;
  }, [titleRef.current]);

  const briefOverviewAdapter = useMemo(() => {
    if (briefOverviewRef.current) {
      return new TextareaAdapter(briefOverviewRef.current, (content) => {
        setFormData(prev => ({ ...prev, briefOverview: content }));
      });
    }
    return null;
  }, [briefOverviewRef.current]);

  const descriptionAdapter = useMemo(() => {
    if (descriptionRef.current) {
      return new TextareaAdapter(descriptionRef.current, (content) => {
        setFormData(prev => ({ ...prev, description: content }));
      });
    }
    return null;
  }, [descriptionRef.current]);

  const articleContentAdapter = useMemo(() => {
    if (articleContentRef.current) {
      return new TextareaAdapter(articleContentRef.current, (content) => {
        setFormData(prev => ({ ...prev, articleContent: content }));
      });
    }
    return null;
  }, [articleContentRef.current]);

  // Get current adapter based on active field
  const getCurrentAdapter = () => {
    switch (activeField) {
      case 'title': return titleAdapter;
      case 'briefOverview': return briefOverviewAdapter;
      case 'description': return descriptionAdapter;
      case 'articleContent': return articleContentAdapter;
      default: return null;
    }
  };

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
      const response = await fetch(`/api/admin/projects/${projectId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
      }

      const projectData = await response.json();
      setProject(projectData);
      
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
      
      if (!isEditing && result.project?.id) {
        router.push(`/admin/projects/editor/${result.project.id}`);
      } else if (isEditing) {
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

  const handleTextSelection = (selection: TextSelection | null, fieldName: string) => {
    setSelectedText(selection || undefined);
    setActiveField(fieldName);
  };

  const handleApplyAIChanges = (result: AIQuickActionResult) => {
    const adapter = getCurrentAdapter();
    if (!adapter) return;

    // Apply full content replacement
    if (result.changes.fullContent) {
      adapter.setFullContent(result.changes.fullContent);
    }

    // Apply partial text replacement
    if (result.changes.partialUpdate) {
      const { start, end, newText } = result.changes.partialUpdate;
      adapter.applyChange({ start, end, newText });
    }

    // Apply tag suggestions
    if (result.changes.suggestedTags) {
      const { add, remove } = result.changes.suggestedTags;
      let newTags = [...formData.tags];
      
      // Remove suggested tags
      newTags = newTags.filter(tag => !remove.includes(tag));
      
      // Add new tags (avoid duplicates)
      add.forEach(tag => {
        if (!newTags.includes(tag)) {
          newTags.push(tag);
        }
      });
      
      handleFormDataChange({ tags: newTags });
    }

    // Apply other metadata changes
    if (result.changes.suggestedTitle) {
      handleFormDataChange({ title: result.changes.suggestedTitle });
    }
    if (result.changes.suggestedDescription) {
      handleFormDataChange({ description: result.changes.suggestedDescription });
    }
  };

  const handleApplyPromptChanges = (result: AIPromptResult) => {
    const adapter = getCurrentAdapter();
    if (!adapter) return;

    // Apply full content replacement
    if (result.changes.fullContent) {
      adapter.setFullContent(result.changes.fullContent);
    }

    // Apply partial text replacement
    if (result.changes.partialUpdate) {
      const { start, end, newText } = result.changes.partialUpdate;
      adapter.applyChange({ start, end, newText });
    }

    // Apply tag suggestions
    if (result.changes.suggestedTags) {
      const { add, remove } = result.changes.suggestedTags;
      let newTags = [...formData.tags];
      
      // Remove suggested tags
      newTags = newTags.filter(tag => !remove.includes(tag));
      
      // Add new tags (avoid duplicates)
      add.forEach(tag => {
        if (!newTags.includes(tag)) {
          newTags.push(tag);
        }
      });
      
      handleFormDataChange({ tags: newTags });
    }

    // Apply other metadata changes
    if (result.changes.suggestedTitle) {
      handleFormDataChange({ title: result.changes.suggestedTitle });
    }
    if (result.changes.suggestedDescription) {
      handleFormDataChange({ description: result.changes.suggestedDescription });
    }
  };

  const handleContentChange = (content: string) => {
    // Update the appropriate field based on active field
    switch (activeField) {
      case 'title':
        handleFormDataChange({ title: content });
        break;
      case 'briefOverview':
        handleFormDataChange({ briefOverview: content });
        break;
      case 'description':
        handleFormDataChange({ description: content });
        break;
      case 'articleContent':
        handleFormDataChange({ articleContent: content });
        break;
    }
  };

  // Create project context for AI
  const getProjectContext = (): ProjectContext => ({
    title: formData.title,
    description: formData.description,
    existingTags: formData.tags,
    fullContent: `${formData.title}\n\n${formData.briefOverview}\n\n${formData.description}\n\n${formData.articleContent}`
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
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4" style={{ maxWidth: '96rem' }}>
        {/* Save Bar */}
        <div className="mb-3 flex justify-center">
          <div className="w-full">
            <FloatingSaveBar
              visible={true}
              onToggleVisibility={() => {}}
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
          {/* Project Editor - 65% */}
          <div className="flex-1" style={{ flexBasis: '65%' }}>
            <Card className="h-full overflow-hidden">
              <div className="flex h-full">
                {/* Left Sidebar - Metadata */}
                <div className="w-1/3 border-r bg-muted/30 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {/* Project Title */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Project Title *
                        </label>
                        {titleAdapter ? (
                          <TextSelectionManager
                            adapter={titleAdapter}
                            onSelectionChange={(selection) => handleTextSelection(selection, 'title')}
                          >
                            <Input
                              ref={titleRef}
                              value={formData.title}
                              onChange={(e) => handleFormDataChange({ title: e.target.value })}
                              placeholder="Enter your project title..."
                              className="text-xl font-bold"
                              maxLength={255}
                            />
                          </TextSelectionManager>
                        ) : (
                          <Input
                            ref={titleRef}
                            value={formData.title}
                            onChange={(e) => handleFormDataChange({ title: e.target.value })}
                            placeholder="Enter your project title..."
                            className="text-xl font-bold"
                            maxLength={255}
                          />
                        )}
                      </div>

                      {/* Project Image Upload */}
                      {isEditing && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">
                            Project Image
                          </label>
                          <ClickableMediaUpload
                            currentMedia={project?.thumbnailImage || undefined}
                            projectId={projectId}
                            onMediaSelect={async (media) => {
                              // Handle thumbnail selection
                              console.log('Thumbnail selected:', media);
                            }}
                            onMediaRemove={async () => {
                              // Handle thumbnail removal
                              console.log('Thumbnail removed');
                            }}
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
                      )}

                      {/* Brief Overview */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Brief Overview
                        </label>
                        {briefOverviewAdapter ? (
                          <TextSelectionManager
                            adapter={briefOverviewAdapter}
                            onSelectionChange={(selection) => handleTextSelection(selection, 'briefOverview')}
                          >
                            <Textarea
                              ref={briefOverviewRef}
                              value={formData.briefOverview}
                              onChange={(e) => handleFormDataChange({ briefOverview: e.target.value })}
                              placeholder="A short description that appears on project cards..."
                              rows={3}
                              maxLength={200}
                              className="text-sm text-gray-600"
                            />
                          </TextSelectionManager>
                        ) : (
                          <Textarea
                            ref={briefOverviewRef}
                            value={formData.briefOverview}
                            onChange={(e) => handleFormDataChange({ briefOverview: e.target.value })}
                            placeholder="A short description that appears on project cards..."
                            rows={3}
                            maxLength={200}
                            className="text-sm text-gray-600"
                          />
                        )}
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
                        {descriptionAdapter ? (
                          <TextSelectionManager
                            adapter={descriptionAdapter}
                            onSelectionChange={(selection) => handleTextSelection(selection, 'description')}
                          >
                            <Textarea
                              ref={descriptionRef}
                              value={formData.description}
                              onChange={(e) => handleFormDataChange({ description: e.target.value })}
                              placeholder="Describe your project in detail..."
                              rows={4}
                              className="text-sm text-gray-700"
                              maxLength={2000}
                            />
                          </TextSelectionManager>
                        ) : (
                          <Textarea
                            ref={descriptionRef}
                            value={formData.description}
                            onChange={(e) => handleFormDataChange({ description: e.target.value })}
                            placeholder="Describe your project in detail..."
                            rows={4}
                            className="text-sm text-gray-700"
                            maxLength={2000}
                          />
                        )}
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

                      {articleContentAdapter ? (
                        <TextSelectionManager
                          adapter={articleContentAdapter}
                          onSelectionChange={(selection) => handleTextSelection(selection, 'articleContent')}
                        >
                          <Textarea
                            ref={articleContentRef}
                            value={formData.articleContent}
                            onChange={(e) => handleFormDataChange({ articleContent: e.target.value })}
                            placeholder="Write your project article here. This is where you can go into technical details, explain your process, share insights, and tell the story of your project..."
                            rows={20}
                            className="text-sm text-gray-700 font-mono min-h-[500px]"
                          />
                        </TextSelectionManager>
                      ) : (
                        <Textarea
                          ref={articleContentRef}
                          value={formData.articleContent}
                          onChange={(e) => handleFormDataChange({ articleContent: e.target.value })}
                          placeholder="Write your project article here. This is where you can go into technical details, explain your process, share insights, and tell the story of your project..."
                          rows={20}
                          className="text-sm text-gray-700 font-mono min-h-[500px]"
                        />
                      )}
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
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Select text in any field and use AI to improve your content
                  </p>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={aiMode === 'quick-actions' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setAiMode('quick-actions')}
                      className="h-7 px-2 text-xs"
                    >
                      Quick Actions
                    </Button>
                    <Button
                      variant={aiMode === 'prompt-interface' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setAiMode('prompt-interface')}
                      className="h-7 px-2 text-xs"
                    >
                      Custom Prompt
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="h-full">
                  {aiMode === 'quick-actions' ? (
                    <AIQuickActions
                      selectedText={selectedText}
                      projectContext={getProjectContext()}
                      onApplyChanges={handleApplyAIChanges}
                      className="h-full"
                    />
                  ) : (
                    <AIPromptInterface
                      selectedText={selectedText}
                      projectContext={getProjectContext()}
                      onApplyChanges={handleApplyPromptChanges}
                      onContentChange={handleContentChange}
                      className="h-full"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}