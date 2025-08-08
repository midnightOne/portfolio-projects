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
  TiptapAdapter,
  TextChange 
} from './text-selection-manager';
import { tiptapToMarkdown, markdownToTiptap } from '@/lib/tiptap-markdown-converter';
import { SmartTagInput, Tag } from './smart-tag-input';
import { ClickableMediaUpload } from './clickable-media-upload';
import { FloatingSaveBar } from './floating-save-bar';
import { TiptapEditorWithAI, TiptapContentData } from '../tiptap/tiptap-editor-with-ai';

interface ProjectFormData {
  title: string;
  description: string;
  briefOverview: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  visibility: 'PUBLIC' | 'PRIVATE';
  workDate: string;
  articleContent: string;
  articleContentJson?: TiptapContentData;
  contentType: 'text' | 'json';
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
  const [refsReady, setRefsReady] = useState(false);

  // Refs for text areas
  const titleRef = useRef<HTMLInputElement>(null);
  const briefOverviewRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const tiptapEditorRef = useRef<any>(null); // Tiptap editor instance

  // Form state
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    description: '',
    briefOverview: '',
    tags: [],
    status: 'DRAFT',
    visibility: 'PRIVATE',
    workDate: new Date().toISOString().split('T')[0],
    articleContent: '',
    contentType: 'json' // Default to JSON for new projects
  });

  const isEditing = mode === 'edit' && !!projectId;

  // Create adapters dynamically when needed
  const getTitleAdapter = () => {
    if (refsReady && titleRef.current) {
      return new TextareaAdapter(titleRef.current as any, (content) => {
        setFormData(prev => ({ ...prev, title: content }));
      });
    }
    return null;
  };

  const getBriefOverviewAdapter = () => {
    if (refsReady && briefOverviewRef.current) {
      return new TextareaAdapter(briefOverviewRef.current, (content) => {
        setFormData(prev => ({ ...prev, briefOverview: content }));
      });
    }
    return null;
  };

  const getDescriptionAdapter = () => {
    if (refsReady && descriptionRef.current) {
      return new TextareaAdapter(descriptionRef.current, (content) => {
        setFormData(prev => ({ ...prev, description: content }));
      });
    }
    return null;
  };

  const getTiptapAdapter = () => {
    if (tiptapEditorRef.current) {
      return new TiptapAdapter(tiptapEditorRef.current, (content) => {
        // Update both plain text and JSON content to keep them in sync
        setFormData(prev => ({ 
          ...prev, 
          articleContent: content,
          // The JSON content will be updated by the TiptapEditorWithAI component's onChange
        }));
      });
    }
    return null;
  };

  // Get current adapter based on active field
  const getCurrentAdapter = () => {
    switch (activeField) {
      case 'title': return getTitleAdapter();
      case 'briefOverview': return getBriefOverviewAdapter();
      case 'description': return getDescriptionAdapter();
      case 'articleContent': return getTiptapAdapter();
      default: return null;
    }
  };

  // Check if refs are ready and trigger re-render
  useEffect(() => {
    const checkRefs = () => {
      const allRefsReady = titleRef.current && briefOverviewRef.current && 
                          descriptionRef.current;
      if (allRefsReady && !refsReady) {
        setRefsReady(true);
      }
    };

    // Check immediately and also set up a small interval to catch ref updates
    checkRefs();
    const interval = setInterval(checkRefs, 50);

    return () => clearInterval(interval);
  }, [refsReady]);

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
        JSON.stringify(formData.articleContentJson) !== JSON.stringify(project.articleContent?.jsonContent) ||
        formData.contentType !== (project.articleContent?.contentType || 'json') ||
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
        articleContent: projectData.articleContent?.content || '',
        articleContentJson: projectData.articleContent?.jsonContent || undefined,
        contentType: projectData.articleContent?.contentType || 'json'
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
    // For Tiptap editor, we need to convert selected content to Markdown for better AI understanding
    if (selection && fieldName === 'articleContent' && tiptapEditorRef.current) {
      try {
        // Get the selected content as JSON from Tiptap
        const { from, to } = tiptapEditorRef.current.state.selection;
        const selectedDoc = tiptapEditorRef.current.state.doc.slice(from, to);
        
        // Convert the selected JSON to Markdown
        const selectedJson = selectedDoc.toJSON();
        const markdownText = tiptapToMarkdown({ type: 'doc', content: selectedJson.content || [] });
        
        // Update the selection with Markdown text for AI processing
        const enhancedSelection: TextSelection = {
          ...selection,
          text: markdownText || selection.text, // Fallback to original text if conversion fails
        };
        
        setSelectedText(enhancedSelection);
      } catch (error) {
        console.warn('Failed to convert selected Tiptap content to Markdown:', error);
        setSelectedText(selection);
      }
    } else {
      setSelectedText(selection || undefined);
    }
    
    setActiveField(fieldName);
  };

  const handleApplyAIChanges = (result: AIQuickActionResult) => {
    console.log('handleApplyAIChanges called with:', result);
    console.log('Current activeField:', activeField);
    
    if (!result.changes) {
      console.log('Early return: no changes');
      return;
    }

    // Handle content changes based on active field
    if (activeField === 'articleContent' && tiptapEditorRef.current) {
      console.log('Applying AI changes to Tiptap editor');
      
      // Apply full content replacement
      if (result.changes.fullContent) {
        console.log('Applying full content to Tiptap:', result.changes.fullContent);
        try {
          // Convert Markdown response to Tiptap JSON format
          const tiptapContent = markdownToTiptap(result.changes.fullContent);
          tiptapEditorRef.current.commands.setContent(tiptapContent);
        } catch (error) {
          console.warn('Failed to convert Markdown to Tiptap, using plain text fallback:', error);
          // Fallback to plain text conversion
          const paragraphs = result.changes.fullContent.split('\n').filter(p => p.trim()).map(paragraph => ({
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph }]
          }));
          
          const newContent = {
            type: 'doc',
            content: paragraphs.length > 0 ? paragraphs : [
              { type: 'paragraph', content: [] }
            ]
          };
          
          tiptapEditorRef.current.commands.setContent(newContent);
        }
      }

      // Apply partial text replacement
      if (result.changes.partialUpdate) {
        const { start, end, newText } = result.changes.partialUpdate;
        console.log('Applying partial update to Tiptap:', { start, end, newText });
        
        try {
          // For partial updates, we can try to parse the new text as Markdown
          // and insert it as formatted content
          const tiptapContent = markdownToTiptap(newText);
          
          // If the markdown conversion resulted in multiple nodes, insert them
          if (tiptapContent.content.length > 1) {
            // Replace the selection with the new content
            tiptapEditorRef.current.chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .deleteSelection()
              .run();
            
            // Insert each node
            tiptapContent.content.forEach(node => {
              tiptapEditorRef.current.commands.insertContent(node);
            });
          } else if (tiptapContent.content.length === 1) {
            // Single node - insert its content
            const node = tiptapContent.content[0];
            tiptapEditorRef.current.chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .insertContent(node)
              .run();
          } else {
            // Fallback to plain text
            tiptapEditorRef.current.chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .insertContent(newText)
              .run();
          }
        } catch (error) {
          console.warn('Failed to convert partial Markdown to Tiptap, using plain text:', error);
          // Fallback to plain text insertion
          tiptapEditorRef.current.chain()
            .focus()
            .setTextSelection({ from: start, to: end })
            .insertContent(newText)
            .run();
        }
      }
    } else {
      // Handle other fields using the adapter approach
      const adapter = getCurrentAdapter();
      console.log('Current adapter:', adapter);
      
      if (adapter) {
        // Apply full content replacement
        if (result.changes.fullContent) {
          console.log('Applying full content via adapter:', result.changes.fullContent);
          adapter.setFullContent(result.changes.fullContent);
        }

        // Apply partial text replacement
        if (result.changes.partialUpdate) {
          const { start, end, newText } = result.changes.partialUpdate;
          console.log('Applying partial update via adapter:', { start, end, newText });
          adapter.applyChange({ start, end, newText });
        }
      }
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
    console.log('handleApplyPromptChanges called with:', result);
    console.log('Current activeField:', activeField);
    
    if (!result.changes) {
      console.log('Early return: no changes');
      return;
    }

    // Handle content changes based on active field
    if (activeField === 'articleContent' && tiptapEditorRef.current) {
      console.log('Applying AI prompt changes to Tiptap editor');
      
      // Apply full content replacement
      if (result.changes.fullContent) {
        console.log('Applying full content to Tiptap:', result.changes.fullContent);
        try {
          // Convert Markdown response to Tiptap JSON format
          const tiptapContent = markdownToTiptap(result.changes.fullContent);
          tiptapEditorRef.current.commands.setContent(tiptapContent);
        } catch (error) {
          console.warn('Failed to convert Markdown to Tiptap, using plain text fallback:', error);
          // Fallback to plain text conversion
          const paragraphs = result.changes.fullContent.split('\n').filter(p => p.trim()).map(paragraph => ({
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph }]
          }));
          
          const newContent = {
            type: 'doc',
            content: paragraphs.length > 0 ? paragraphs : [
              { type: 'paragraph', content: [] }
            ]
          };
          
          tiptapEditorRef.current.commands.setContent(newContent);
        }
      }

      // Apply partial text replacement
      if (result.changes.partialUpdate) {
        const { start, end, newText } = result.changes.partialUpdate;
        console.log('Applying partial update to Tiptap:', { start, end, newText });
        
        try {
          // For partial updates, we can try to parse the new text as Markdown
          // and insert it as formatted content
          const tiptapContent = markdownToTiptap(newText);
          
          // If the markdown conversion resulted in multiple nodes, insert them
          if (tiptapContent.content.length > 1) {
            // Replace the selection with the new content
            tiptapEditorRef.current.chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .deleteSelection()
              .run();
            
            // Insert each node
            tiptapContent.content.forEach(node => {
              tiptapEditorRef.current.commands.insertContent(node);
            });
          } else if (tiptapContent.content.length === 1) {
            // Single node - insert its content
            const node = tiptapContent.content[0];
            tiptapEditorRef.current.chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .insertContent(node)
              .run();
          } else {
            // Fallback to plain text
            tiptapEditorRef.current.chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .insertContent(newText)
              .run();
          }
        } catch (error) {
          console.warn('Failed to convert partial Markdown to Tiptap, using plain text:', error);
          // Fallback to plain text insertion
          tiptapEditorRef.current.chain()
            .focus()
            .setTextSelection({ from: start, to: end })
            .insertContent(newText)
            .run();
        }
      }
    } else {
      // Handle other fields using the adapter approach
      const adapter = getCurrentAdapter();
      console.log('Current adapter:', adapter);
      
      if (adapter) {
        // Apply full content replacement
        if (result.changes.fullContent) {
          console.log('Applying full content via adapter:', result.changes.fullContent);
          adapter.setFullContent(result.changes.fullContent);
        }

        // Apply partial text replacement
        if (result.changes.partialUpdate) {
          const { start, end, newText } = result.changes.partialUpdate;
          console.log('Applying partial update via adapter:', { start, end, newText });
          adapter.applyChange({ start, end, newText });
        }
      }
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
    }
  };

  // Create project context for AI
  const getProjectContext = (): ProjectContext => {
    // Convert Tiptap JSON content to Markdown for better AI understanding
    let articleContentForAI = formData.articleContent;
    if (formData.contentType === 'json' && formData.articleContentJson) {
      try {
        articleContentForAI = tiptapToMarkdown(formData.articleContentJson);
      } catch (error) {
        console.warn('Failed to convert Tiptap content to Markdown, using plain text:', error);
        articleContentForAI = formData.articleContent;
      }
    }

    return {
      title: formData.title,
      description: formData.description,
      existingTags: formData.tags,
      fullContent: `${formData.title}\n\n${formData.briefOverview}\n\n${formData.description}\n\n${articleContentForAI}`
    };
  };

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
                        {getTitleAdapter() ? (
                          <TextSelectionManager
                            adapter={getTitleAdapter()!}
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
                        {getBriefOverviewAdapter() ? (
                          <TextSelectionManager
                            adapter={getBriefOverviewAdapter()!}
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
                        {getDescriptionAdapter() ? (
                          <TextSelectionManager
                            adapter={getDescriptionAdapter()!}
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
                  <div className="flex-1 overflow-hidden p-4">
                    {getTiptapAdapter() ? (
                      <TextSelectionManager
                        adapter={getTiptapAdapter()!}
                        onSelectionChange={(selection) => handleTextSelection(selection, 'articleContent')}
                      >
                        <TiptapEditorWithAI
                          content={
                            formData.contentType === 'json' 
                              ? (formData.articleContentJson || formData.articleContent)
                              : formData.articleContent
                          }
                          onChange={(content) => {
                            handleFormDataChange({ 
                              articleContentJson: content,
                              contentType: 'json'
                            });
                          }}
                          onEditorReady={(editor) => {
                            tiptapEditorRef.current = editor;
                          }}
                          projectContext={getProjectContext()}
                          onSelectionChange={(selection) => handleTextSelection(selection, 'articleContent')}
                          placeholder="Start writing your project article with rich formatting. Use / to insert special content blocks like image carousels, interactive embeds, and download buttons."
                          showAIPanel={false} // AI panel is handled separately
                          className="h-full"
                        />
                      </TextSelectionManager>
                    ) : (
                      <TiptapEditorWithAI
                        content={
                          formData.contentType === 'json' 
                            ? (formData.articleContentJson || formData.articleContent)
                            : formData.articleContent
                        }
                        onChange={(content) => {
                          handleFormDataChange({ 
                            articleContentJson: content,
                            contentType: 'json'
                          });
                        }}
                        onEditorReady={(editor) => {
                          tiptapEditorRef.current = editor;
                        }}
                        projectContext={getProjectContext()}
                        onSelectionChange={(selection) => handleTextSelection(selection, 'articleContent')}
                        placeholder="Start writing your project article with rich formatting. Use / to insert special content blocks like image carousels, interactive embeds, and download buttons."
                        showAIPanel={false} // AI panel is handled separately
                        className="h-full"
                      />
                    )}
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