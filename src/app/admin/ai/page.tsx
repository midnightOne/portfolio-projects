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
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Brain, ExternalLink, Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout';

interface EnvironmentStatus {
  openai: {
    configured: boolean;
    keyPreview: string;
    environmentVariable: string;
  };
  anthropic: {
    configured: boolean;
    keyPreview: string;
    environmentVariable: string;
  };
  summary: {
    hasAnyProvider: boolean;
    configuredProviders: string[];
    isFullyConfigured: boolean;
    totalConfigured: number;
    totalAvailable: number;
  };
  warnings: string[];
  setupInstructions: {
    openai?: {
      message: string;
      documentation: string;
      example: string;
    };
    anthropic?: {
      message: string;
      documentation: string;
      example: string;
    };
  };
}

interface ConnectionTestResult {
  success: boolean;
  data?: {
    provider: string;
    connected: boolean;
    message: string;
    availableModels?: string[];
    modelCount?: number;
    error?: {
      code: string;
      details: string;
      actionable: boolean;
      guidance?: {
        message: string;
        action: string;
        documentation?: string;
      };
    };
    testedAt: string;
  };
}

interface ModelConfig {
  openai: string;
  anthropic: string;
}

interface GeneralSettings {
  defaultProvider: 'openai' | 'anthropic';
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

function AISettingsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State management
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({ openai: '', anthropic: '' });
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    defaultProvider: 'openai',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 4000
  });
  const [connectionStatus, setConnectionStatus] = useState<Map<string, ConnectionTestResult>>(new Map());
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setError(null);
      
      // Fetch environment status and model configuration in parallel
      const [envResponse, configResponse] = await Promise.all([
        fetch('/api/admin/ai/environment-status'),
        fetch('/api/admin/ai/model-config')
      ]);

      if (!envResponse.ok) {
        throw new Error('Failed to fetch environment status');
      }
      
      if (!configResponse.ok) {
        throw new Error('Failed to fetch model configuration');
      }

      const envData = await envResponse.json();
      const configData = await configResponse.json();

      if (!envData.success) {
        throw new Error(envData.error?.message || 'Failed to load environment status');
      }
      
      if (!configData.success) {
        throw new Error(configData.error?.message || 'Failed to load model configuration');
      }

      // Update state with fetched data
      setEnvironmentStatus(envData.data);
      setModelConfig(configData.data.modelConfig || { openai: '', anthropic: '' });
      setGeneralSettings(configData.data.generalSettings || {
        defaultProvider: 'openai',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 4000
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (provider: 'openai' | 'anthropic') => {
    setTestingProvider(provider);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      
      const result = await response.json();
      
      // Update connection status regardless of success/failure
      setConnectionStatus(prev => new Map(prev.set(provider, result)));
      
    } catch (err) {
      // Handle network errors
      const errorResult: ConnectionTestResult = {
        success: false,
        data: {
          provider,
          connected: false,
          message: 'Network error - check your connection',
          testedAt: new Date().toISOString()
        }
      };
      setConnectionStatus(prev => new Map(prev.set(provider, errorResult)));
    } finally {
      setTestingProvider(null);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/admin/ai/model-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelConfig,
          generalSettings
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save configuration');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save configuration');
      }
      
      setSuccess('Configuration saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading AI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          AI Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure AI providers and models for content assistance
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

      {/* Environment Status Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>
            API keys are read from environment variables for security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {environmentStatus && (
            <>
              {/* OpenAI Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">OpenAI</div>
                  <div className="text-sm text-muted-foreground">
                    {environmentStatus.openai.configured 
                      ? `Configured: ${environmentStatus.openai.keyPreview}`
                      : 'Not configured - set OPENAI_API_KEY environment variable'
                    }
                  </div>
                  {environmentStatus.setupInstructions.openai && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <a 
                        href={environmentStatus.setupInstructions.openai.documentation} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline flex items-center gap-1"
                      >
                        Get API key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {connectionStatus.get('openai') && (
                    <Badge variant={connectionStatus.get('openai')?.success ? 'default' : 'destructive'}>
                      {connectionStatus.get('openai')?.success ? '✅ Connected' : '❌ Failed'}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection('openai')}
                    disabled={!environmentStatus.openai.configured || testingProvider === 'openai'}
                  >
                    {testingProvider === 'openai' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Testing...
                      </>
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Connection test result for OpenAI */}
              {connectionStatus.get('openai') && !connectionStatus.get('openai')?.success && (
                <div className="ml-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <p className="text-red-800">
                    {connectionStatus.get('openai')?.data?.message}
                  </p>
                  {connectionStatus.get('openai')?.data?.error?.guidance && (
                    <div className="mt-1">
                      <p className="font-medium text-red-900">
                        {connectionStatus.get('openai')?.data?.error?.guidance?.message}
                      </p>
                      <p className="text-red-700">
                        {connectionStatus.get('openai')?.data?.error?.guidance?.action}
                      </p>
                      {connectionStatus.get('openai')?.data?.error?.guidance?.documentation && (
                        <a 
                          href={connectionStatus.get('openai')?.data?.error?.guidance?.documentation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-600 underline flex items-center gap-1 mt-1"
                        >
                          View documentation <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Anthropic Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Anthropic</div>
                  <div className="text-sm text-muted-foreground">
                    {environmentStatus.anthropic.configured 
                      ? `Configured: ${environmentStatus.anthropic.keyPreview}`
                      : 'Not configured - set ANTHROPIC_API_KEY environment variable'
                    }
                  </div>
                  {environmentStatus.setupInstructions.anthropic && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <a 
                        href={environmentStatus.setupInstructions.anthropic.documentation} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline flex items-center gap-1"
                      >
                        Get API key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {connectionStatus.get('anthropic') && (
                    <Badge variant={connectionStatus.get('anthropic')?.success ? 'default' : 'destructive'}>
                      {connectionStatus.get('anthropic')?.success ? '✅ Connected' : '❌ Failed'}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection('anthropic')}
                    disabled={!environmentStatus.anthropic.configured || testingProvider === 'anthropic'}
                  >
                    {testingProvider === 'anthropic' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Testing...
                      </>
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Connection test result for Anthropic */}
              {connectionStatus.get('anthropic') && !connectionStatus.get('anthropic')?.success && (
                <div className="ml-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <p className="text-red-800">
                    {connectionStatus.get('anthropic')?.data?.message}
                  </p>
                  {connectionStatus.get('anthropic')?.data?.error?.guidance && (
                    <div className="mt-1">
                      <p className="font-medium text-red-900">
                        {connectionStatus.get('anthropic')?.data?.error?.guidance?.message}
                      </p>
                      <p className="text-red-700">
                        {connectionStatus.get('anthropic')?.data?.error?.guidance?.action}
                      </p>
                      {connectionStatus.get('anthropic')?.data?.error?.guidance?.documentation && (
                        <a 
                          href={connectionStatus.get('anthropic')?.data?.error?.guidance?.documentation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-600 underline flex items-center gap-1 mt-1"
                        >
                          View documentation <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Model Configuration Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>
            Configure which models are available for each provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-models">OpenAI Models</Label>
            <Input
              id="openai-models"
              placeholder="gpt-4o, gpt-4o-mini, gpt-3.5-turbo"
              value={modelConfig.openai}
              onChange={(e) => setModelConfig(prev => ({ ...prev, openai: e.target.value }))}
              disabled={!environmentStatus?.openai.configured}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of OpenAI model IDs
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="anthropic-models">Anthropic Models</Label>
            <Input
              id="anthropic-models"
              placeholder="claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022"
              value={modelConfig.anthropic}
              onChange={(e) => setModelConfig(prev => ({ ...prev, anthropic: e.target.value }))}
              disabled={!environmentStatus?.anthropic.configured}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of Anthropic model IDs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-provider">Default Provider</Label>
            <Select
              value={generalSettings.defaultProvider}
              onValueChange={(value: 'openai' | 'anthropic') => 
                setGeneralSettings(prev => ({ ...prev, defaultProvider: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai" disabled={!environmentStatus?.openai.configured}>
                  OpenAI {!environmentStatus?.openai.configured && '(Not configured)'}
                </SelectItem>
                <SelectItem value="anthropic" disabled={!environmentStatus?.anthropic.configured}>
                  Anthropic {!environmentStatus?.anthropic.configured && '(Not configured)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="system-prompt">System Prompt</Label>
            <Textarea
              id="system-prompt"
              placeholder="You are an expert content editor..."
              value={generalSettings.systemPrompt}
              onChange={(e) => setGeneralSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature ({generalSettings.temperature})</Label>
              <input
                id="temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={generalSettings.temperature}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min="100"
                max="8000"
                value={generalSettings.maxTokens}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveConfiguration} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AISettingsPage() {
  return (
    <AdminLayout currentTab="ai-settings">
      <AISettingsContent />
    </AdminLayout>
  );
}