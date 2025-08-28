'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  FileText, 
  Image, 
  Info,
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { useToast } from '@/components/ui/toast';

interface ContextConfig {
  maxTokens: number;
  contextDepth: 'shallow' | 'medium' | 'deep';
  includeProjects: boolean;
  includeMedia: boolean;
  includeAbout: boolean;
  includeResume: boolean;
  projectWeight: number;
  mediaWeight: number;
  aboutWeight: number;
  resumeWeight: number;
  responseStyle: 'technical' | 'casual' | 'professional';
  navigationBehavior: 'aggressive' | 'moderate' | 'minimal';
}

function ContextConfigContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  
  // State management
  const [config, setConfig] = useState<ContextConfig>({
    maxTokens: 4000,
    contextDepth: 'medium',
    includeProjects: true,
    includeMedia: true,
    includeAbout: true,
    includeResume: false,
    projectWeight: 0.7,
    mediaWeight: 0.3,
    aboutWeight: 0.5,
    resumeWeight: 0.4,
    responseStyle: 'professional',
    navigationBehavior: 'moderate'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any).role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    loadConfiguration();
  }, [session, status, router]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      
      // This would load from the context manager API
      // For now, we'll use default values
      toast.success('Configuration loaded', 'Context configuration loaded successfully');
      
    } catch (error) {
      toast.error('Failed to load configuration', 'Could not load context configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      // This would save to the context manager API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast.success('Configuration saved', 'Context configuration has been updated');
    } catch (error) {
      toast.error('Failed to save configuration', 'Could not save context configuration');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setConfig({
      maxTokens: 4000,
      contextDepth: 'medium',
      includeProjects: true,
      includeMedia: true,
      includeAbout: true,
      includeResume: false,
      projectWeight: 0.7,
      mediaWeight: 0.3,
      aboutWeight: 0.5,
      resumeWeight: 0.4,
      responseStyle: 'professional',
      navigationBehavior: 'moderate'
    });
    toast.success('Reset to defaults', 'Configuration has been reset to default values');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading context configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This feature is coming soon. Context configuration will allow you to control how the AI 
          assistant builds context from your portfolio content and how it responds to user queries.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">Content Sources</TabsTrigger>
          <TabsTrigger value="behavior">Response Behavior</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Content Inclusion</CardTitle>
                <CardDescription>
                  Choose which content types to include in AI context
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Projects</Label>
                    <p className="text-sm text-muted-foreground">
                      Include project content and descriptions
                    </p>
                  </div>
                  <Switch
                    checked={config.includeProjects}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, includeProjects: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Media Context</Label>
                    <p className="text-sm text-muted-foreground">
                      Include media descriptions and alt text
                    </p>
                  </div>
                  <Switch
                    checked={config.includeMedia}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, includeMedia: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">About Section</Label>
                    <p className="text-sm text-muted-foreground">
                      Include personal information and bio
                    </p>
                  </div>
                  <Switch
                    checked={config.includeAbout}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, includeAbout: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Resume/CV</Label>
                    <p className="text-sm text-muted-foreground">
                      Include professional experience and skills
                    </p>
                  </div>
                  <Switch
                    checked={config.includeResume}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, includeResume: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Content Weights</CardTitle>
                <CardDescription>
                  Adjust the importance of different content types
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Projects ({config.projectWeight.toFixed(1)})</Label>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Slider
                    value={[config.projectWeight]}
                    onValueChange={([value]: number[]) => 
                      setConfig(prev => ({ ...prev, projectWeight: value }))
                    }
                    max={1}
                    min={0}
                    step={0.1}
                    disabled={!config.includeProjects}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Media ({config.mediaWeight.toFixed(1)})</Label>
                    <Image className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Slider
                    value={[config.mediaWeight]}
                    onValueChange={([value]: number[]) => 
                      setConfig(prev => ({ ...prev, mediaWeight: value }))
                    }
                    max={1}
                    min={0}
                    step={0.1}
                    disabled={!config.includeMedia}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>About ({config.aboutWeight.toFixed(1)})</Label>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Slider
                    value={[config.aboutWeight]}
                    onValueChange={([value]: number[]) => 
                      setConfig(prev => ({ ...prev, aboutWeight: value }))
                    }
                    max={1}
                    min={0}
                    step={0.1}
                    disabled={!config.includeAbout}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Resume ({config.resumeWeight.toFixed(1)})</Label>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Slider
                    value={[config.resumeWeight]}
                    onValueChange={([value]: number[]) => 
                      setConfig(prev => ({ ...prev, resumeWeight: value }))
                    }
                    max={1}
                    min={0}
                    step={0.1}
                    disabled={!config.includeResume}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Response Configuration</CardTitle>
              <CardDescription>
                Control how the AI assistant responds to queries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Max Context Tokens ({config.maxTokens})</Label>
                <Slider
                  value={[config.maxTokens]}
                  onValueChange={([value]: number[]) => 
                    setConfig(prev => ({ ...prev, maxTokens: value }))
                  }
                  max={8000}
                  min={1000}
                  step={500}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum tokens to use for context. Higher values provide more context but cost more.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Context Depth</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['shallow', 'medium', 'deep'] as const).map((depth) => (
                    <Button
                      key={depth}
                      variant={config.contextDepth === depth ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, contextDepth: depth }))}
                      className="capitalize"
                    >
                      {depth}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  How much detail to include from each content source.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Response Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['technical', 'casual', 'professional'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={config.responseStyle === style ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, responseStyle: style }))}
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  The tone and style of AI responses.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Navigation Behavior</CardTitle>
              <CardDescription>
                Control when and how the AI suggests portfolio navigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Navigation Aggressiveness</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['minimal', 'moderate', 'aggressive'] as const).map((behavior) => (
                    <Button
                      key={behavior}
                      variant={config.navigationBehavior === behavior ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, navigationBehavior: behavior }))}
                      className="capitalize"
                    >
                      {behavior}
                    </Button>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Minimal:</strong> Only suggest navigation when directly asked</p>
                  <p><strong>Moderate:</strong> Suggest relevant projects when appropriate</p>
                  <p><strong>Aggressive:</strong> Actively guide users through portfolio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={resetToDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <Button onClick={saveConfiguration} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

export default function ContextConfigPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="Context Configuration"
        description="Configure AI context building and response behavior"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Context Config', href: '/admin/ai/context-config' }
        ]}
      >
        <ContextConfigContent />
      </AdminPageLayout>
    </AdminLayout>
  );
}