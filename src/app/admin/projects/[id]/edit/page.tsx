'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AIChatSidebar } from '@/components/admin/ai-chat-sidebar';
import { ArrowLeft, Save, Bot, Loader2 } from 'lucide-react';
import { ProjectWithRelations, TextSelection } from '@/lib/types/project';

interface ProjectEditPageProps {
  params: { id: string };
}

export default function ProjectEditPage({ params }: ProjectEditPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    briefOverview: '',
    articleContent: ''
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any).role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    fetchProject();
  }, [session, status, router, params.id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/projects/${params.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }

      const projectData = await response.json();
      setProject(projectData);
      
      // Update form data
      setFormData({
        title: projectData.title || '',
        description: projectData.description || '',
        briefOverview: projectData.briefOverview || '',
        articleContent: projectData.articleContent?.content || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/projects/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save project');
      }

      const updatedProject = await response.json();
      setProject(updatedProject);
      
      // Show success message (you could add a toast here)
      console.log('Project saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleContentUpdate = (updates: Partial<ProjectWithRelations>) => {
    // Update form data with AI suggestions
    setFormData(prev => ({
      ...prev,
      title: updates.title || prev.title,
      description: updates.description || prev.description,
      briefOverview: updates.briefOverview || prev.briefOverview,
      articleContent: updates.articleContent?.content || prev.articleContent
    }));

    // Update project state
    if (project) {
      setProject(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleTextSelection = (textareaRef: HTMLTextAreaElement) => {
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    
    if (start !== end) {
      const selectedText = textareaRef.value.substring(start, end);
      const contextLength = 100;
      const contextStart = Math.max(0, start - contextLength);
      const contextEnd = Math.min(textareaRef.value.length, end + contextLength);
      const context = textareaRef.value.substring(contextStart, contextEnd);
      
      setSelectedText({
        start,
        end,
        text: selectedText,
        context
      });
      setAiChatOpen(true);
    } else {
      setSelectedText(undefined);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/admin/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="mb-4">Project not found</p>
          <Button onClick={() => router.push('/admin/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/projects')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Project</h1>
            <p className="text-muted-foreground">
              Make changes to your project content
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAiChatOpen(true)}
            className="flex items-center gap-2"
          >
            <Bot className="h-4 w-4" />
            AI Assistant
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update the basic project details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter project title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter project description"
                rows={3}
                onMouseUp={(e) => handleTextSelection(e.target as HTMLTextAreaElement)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-overview">Brief Overview</Label>
              <Textarea
                id="brief-overview"
                value={formData.briefOverview}
                onChange={(e) => setFormData(prev => ({ ...prev, briefOverview: e.target.value }))}
                placeholder="Enter brief project overview"
                rows={2}
                onMouseUp={(e) => handleTextSelection(e.target as HTMLTextAreaElement)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Article Content</CardTitle>
            <CardDescription>
              Write the detailed project article. Select text and use the AI assistant for help.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="article-content">Content</Label>
              <Textarea
                id="article-content"
                value={formData.articleContent}
                onChange={(e) => setFormData(prev => ({ ...prev, articleContent: e.target.value }))}
                placeholder="Write your project article here..."
                rows={20}
                className="font-mono text-sm"
                onMouseUp={(e) => handleTextSelection(e.target as HTMLTextAreaElement)}
              />
              <p className="text-xs text-muted-foreground">
                Select text and click the AI Assistant to get help with editing and improvements.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        project={project}
        isOpen={aiChatOpen}
        onToggle={() => setAiChatOpen(!aiChatOpen)}
        onContentUpdate={handleContentUpdate}
        selectedText={selectedText}
      />
    </div>
  );
}