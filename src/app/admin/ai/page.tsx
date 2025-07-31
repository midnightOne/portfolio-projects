'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Settings, Brain, Key, Sliders } from 'lucide-react';
import { AISettings, AIProvider } from '@/lib/types/project';

export default function AISettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    anthropicApiKey: '',
    openaiApiKey: '',
    systemPrompt: '',
    preferredProvider: 'anthropic' as 'anthropic' | 'openai',
    preferredModel: '',
    temperature: 0.7,
    maxTokens: 4000,
    dailyCostLimit: 10.0,
    monthlyTokenLimit: 100000,
    conversationHistory: true,
    autoSaveInterval: 60,
    maxVersionsPerProject: 20,
    autoDeleteOldVersions: true,
    versionRetentionDays: 30
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any).role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    fetchData();
  }, [session, status, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch settings and providers in parallel
      const [settingsRes, providersRes] = await Promise.all([
        fetch('/api/admin/ai/settings'),
        fetch('/api/admin/ai/providers')
      ]);

      if (!settingsRes.ok || !providersRes.ok) {
        throw new Error('Failed to fetch AI configuration');
      }

      const settingsData = await settingsRes.json();
      const providersData = await providersRes.json();

      setSettings(settingsData);
      setProviders(providersData);
      
      // Update form data
      setFormData({
        anthropicApiKey: settingsData.anthropicApiKey || '',
        openaiApiKey: settingsData.openaiApiKey || '',
        systemPrompt: settingsData.systemPrompt || '',
        preferredProvider: settingsData.preferredProvider || 'anthropic',
        preferredModel: settingsData.preferredModel || '',
        temperature: settingsData.temperature || 0.7,
        maxTokens: settingsData.maxTokens || 4000,
        dailyCostLimit: settingsData.dailyCostLimit || 10.0,
        monthlyTokenLimit: settingsData.monthlyTokenLimit || 100000,
        conversationHistory: settingsData.conversationHistory ?? true,
        autoSaveInterval: settingsData.autoSaveInterval || 60,
        maxVersionsPerProject: settingsData.maxVersionsPerProject || 20,
        autoDeleteOldVersions: settingsData.autoDeleteOldVersions ?? true,
        versionRetentionDays: settingsData.versionRetentionDays || 30
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      setSuccess('AI settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getAvailableModels = () => {
    const provider = providers.find(p => p.name === formData.preferredProvider);
    return provider?.models || [];
  };

  const isProviderConfigured = (providerName: 'anthropic' | 'openai') => {
    if (providerName === 'anthropic') {
      return formData.anthropicApiKey && formData.anthropicApiKey !== '';
    }
    return formData.openaiApiKey && formData.openaiApiKey !== '';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Brain className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading AI settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          AI Assistant Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure AI providers and settings for content editing assistance
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800">{success}</span>
        </div>
      )}

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Models
          </TabsTrigger>
          <TabsTrigger value="behavior" className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="versioning" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Versioning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Configure your AI provider API keys. Keys are encrypted before storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="anthropic-key" className="flex items-center gap-2">
                  Anthropic API Key
                  {isProviderConfigured('anthropic') && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  )}
                </Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={formData.anthropicApiKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, anthropicApiKey: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline">Anthropic Console</a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-key" className="flex items-center gap-2">
                  OpenAI API Key
                  {isProviderConfigured('openai') && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  )}
                </Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={formData.openaiApiKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Platform</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>
                Choose your preferred AI provider and model for content editing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Preferred Provider</Label>
                <Select
                  value={formData.preferredProvider}
                  onValueChange={(value: 'anthropic' | 'openai') => 
                    setFormData(prev => ({ ...prev, preferredProvider: value, preferredModel: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic" disabled={!isProviderConfigured('anthropic')}>
                      Anthropic Claude {!isProviderConfigured('anthropic') && '(API key required)'}
                    </SelectItem>
                    <SelectItem value="openai" disabled={!isProviderConfigured('openai')}>
                      OpenAI GPT {!isProviderConfigured('openai') && '(API key required)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                  value={formData.preferredModel}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, preferredModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels().map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{model.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            ${model.costPer1kTokens}/1k tokens
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.preferredModel && (
                <div className="p-3 bg-muted rounded-lg">
                  {(() => {
                    const model = getAvailableModels().find(m => m.id === formData.preferredModel);
                    return model ? (
                      <div className="space-y-1 text-sm">
                        <p><strong>Max Tokens:</strong> {model.maxTokens.toLocaleString()}</p>
                        <p><strong>Cost:</strong> ${model.costPer1kTokens}/1k tokens</p>
                        <p><strong>Capabilities:</strong> {model.capabilities.join(', ')}</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Behavior</CardTitle>
              <CardDescription>
                Configure how the AI assistant behaves and responds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  placeholder="You are an expert content editor for portfolio projects..."
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This prompt defines the AI's personality and behavior. Be specific about your writing style and preferences.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature ({formData.temperature})</Label>
                  <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="100"
                    max="8000"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum response length
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-limit">Daily Cost Limit ($)</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    min="1"
                    max="100"
                    step="0.50"
                    value={formData.dailyCostLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, dailyCostLimit: parseFloat(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly-tokens">Monthly Token Limit</Label>
                  <Input
                    id="monthly-tokens"
                    type="number"
                    min="10000"
                    max="1000000"
                    step="10000"
                    value={formData.monthlyTokenLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthlyTokenLimit: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versioning" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Versioning</CardTitle>
              <CardDescription>
                Configure automatic saving and version management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auto-save">Auto-save Interval (seconds)</Label>
                <Select
                  value={formData.autoSaveInterval.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, autoSaveInterval: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Disabled</SelectItem>
                    <SelectItem value="30">Every 30 seconds</SelectItem>
                    <SelectItem value="60">Every 1 minute</SelectItem>
                    <SelectItem value="120">Every 2 minutes</SelectItem>
                    <SelectItem value="300">Every 5 minutes</SelectItem>
                    <SelectItem value="600">Every 10 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-versions">Max Versions per Project</Label>
                  <Input
                    id="max-versions"
                    type="number"
                    min="5"
                    max="100"
                    value={formData.maxVersionsPerProject}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxVersionsPerProject: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-days">Version Retention (days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    min="7"
                    max="365"
                    value={formData.versionRetentionDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, versionRetentionDays: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="auto-delete"
                  type="checkbox"
                  checked={formData.autoDeleteOldVersions}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoDeleteOldVersions: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="auto-delete">Automatically delete old versions</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="conversation-history"
                  type="checkbox"
                  checked={formData.conversationHistory}
                  onChange={(e) => setFormData(prev => ({ ...prev, conversationHistory: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="conversation-history">Keep conversation history</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 pt-6">
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}