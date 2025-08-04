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
import { AIStatusIndicator } from '@/components/admin/ai-status-indicator';
import { useToast } from '@/components/ui/toast';
import { StatusBadge, ConnectionStatus, ConfigurationStatus } from '@/components/ui/status-badge';
import { HelpText, DocumentationLink, HelpSection } from '@/components/ui/help-text';
import { AsyncOperationIndicator, ButtonLoadingState } from '@/components/ui/loading-indicator';

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
  const toast = useToast();
  
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
      
      toast.success('Configuration loaded', 'AI settings loaded successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load AI configuration';
      toast.error('Failed to load configuration', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (provider: 'openai' | 'anthropic') => {
    setTestingProvider(provider);
    
    try {
      toast.info('Testing connection', `Testing ${provider} connection...`);
      
      const response = await fetch('/api/admin/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      
      const result = await response.json();
      
      // Update connection status regardless of success/failure
      setConnectionStatus(prev => new Map(prev.set(provider, result)));
      
      if (result.success) {
        toast.success(
          'Connection successful', 
          `${provider} connected with ${result.data?.modelCount || 0} models available`
        );
      } else {
        toast.error(
          'Connection failed', 
          result.data?.message || `Failed to connect to ${provider}`
        );
      }
      
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
      
      toast.error(
        'Network error', 
        `Failed to test ${provider} connection - check your network`
      );
    } finally {
      setTestingProvider(null);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    
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
      
      toast.success(
        'Configuration saved', 
        'AI settings have been updated successfully'
      );
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error('Save failed', errorMessage);
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

      {/* AI Status Overview */}
      <AIStatusIndicator variant="detailed" showActions={true} />



      {/* Environment Status Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>
            API keys are read from environment variables for security
          </CardDescription>
          <HelpText variant="card">
            <HelpSection
              title="Environment Setup"
              links={[
                { label: 'OpenAI API Keys', href: 'https://platform.openai.com/api-keys' },
                { label: 'Anthropic API Keys', href: 'https://console.anthropic.com/settings/keys' },
                { label: 'Environment Variables Guide', href: '/docs/environment-setup' }
              ]}
            >
              Set your API keys as environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY) 
              in your deployment environment. Never commit API keys to your repository.
            </HelpSection>
          </HelpText>
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
                  <ConfigurationStatus 
                    isConfigured={environmentStatus.openai.configured}
                    label={environmentStatus.openai.configured ? 'Configured' : 'Not Set'}
                  />
                  {connectionStatus.get('openai') && (
                    <ConnectionStatus
                      isConnected={connectionStatus.get('openai')?.success || false}
                      label={connectionStatus.get('openai')?.success ? 'Connected' : 'Failed'}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection('openai')}
                    disabled={!environmentStatus.openai.configured || testingProvider === 'openai'}
                  >
                    <ButtonLoadingState
                      isLoading={testingProvider === 'openai'}
                      loadingText="Testing..."
                    >
                      Test
                    </ButtonLoadingState>
                  </Button>
                </div>
              </div>
              
              {/* Connection test status for OpenAI */}
              <AsyncOperationIndicator
                isLoading={testingProvider === 'openai'}
                operation="Testing OpenAI connection"
                success={connectionStatus.get('openai')?.success}
                error={connectionStatus.get('openai') && !connectionStatus.get('openai')?.success 
                  ? connectionStatus.get('openai')?.data?.message 
                  : undefined}
                className="ml-3"
              />
              
              {/* Detailed error guidance for OpenAI */}
              {connectionStatus.get('openai') && !connectionStatus.get('openai')?.success && (
                <div className="ml-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                  {connectionStatus.get('openai')?.data?.error?.guidance && (
                    <div className="space-y-2">
                      <div className="font-medium text-red-900">
                        {connectionStatus.get('openai')?.data?.error?.guidance?.message}
                      </div>
                      <div className="text-red-700">
                        {connectionStatus.get('openai')?.data?.error?.guidance?.action}
                      </div>
                      {connectionStatus.get('openai')?.data?.error?.guidance?.documentation && (
                        <DocumentationLink 
                          href={connectionStatus.get('openai')?.data?.error?.guidance?.documentation || ''}
                          className="text-red-600"
                        >
                          View documentation
                        </DocumentationLink>
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
                  <ConfigurationStatus 
                    isConfigured={environmentStatus.anthropic.configured}
                    label={environmentStatus.anthropic.configured ? 'Configured' : 'Not Set'}
                  />
                  {connectionStatus.get('anthropic') && (
                    <ConnectionStatus
                      isConnected={connectionStatus.get('anthropic')?.success || false}
                      label={connectionStatus.get('anthropic')?.success ? 'Connected' : 'Failed'}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection('anthropic')}
                    disabled={!environmentStatus.anthropic.configured || testingProvider === 'anthropic'}
                  >
                    <ButtonLoadingState
                      isLoading={testingProvider === 'anthropic'}
                      loadingText="Testing..."
                    >
                      Test
                    </ButtonLoadingState>
                  </Button>
                </div>
              </div>
              
              {/* Connection test status for Anthropic */}
              <AsyncOperationIndicator
                isLoading={testingProvider === 'anthropic'}
                operation="Testing Anthropic connection"
                success={connectionStatus.get('anthropic')?.success}
                error={connectionStatus.get('anthropic') && !connectionStatus.get('anthropic')?.success 
                  ? connectionStatus.get('anthropic')?.data?.message 
                  : undefined}
                className="ml-3"
              />
              
              {/* Detailed error guidance for Anthropic */}
              {connectionStatus.get('anthropic') && !connectionStatus.get('anthropic')?.success && (
                <div className="ml-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                  {connectionStatus.get('anthropic')?.data?.error?.guidance && (
                    <div className="space-y-2">
                      <div className="font-medium text-red-900">
                        {connectionStatus.get('anthropic')?.data?.error?.guidance?.message}
                      </div>
                      <div className="text-red-700">
                        {connectionStatus.get('anthropic')?.data?.error?.guidance?.action}
                      </div>
                      {connectionStatus.get('anthropic')?.data?.error?.guidance?.documentation && (
                        <DocumentationLink 
                          href={connectionStatus.get('anthropic')?.data?.error?.guidance?.documentation || ''}
                          className="text-red-600"
                        >
                          View documentation
                        </DocumentationLink>
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
          <HelpText variant="expandable">
            <HelpSection
              title="Model Configuration"
              links={[
                { label: 'OpenAI Models', href: 'https://platform.openai.com/docs/models' },
                { label: 'Anthropic Models', href: 'https://docs.anthropic.com/claude/docs/models-overview' }
              ]}
            >
              Enter comma-separated model IDs for each provider. Models will be validated 
              when you save the configuration. Unknown models will show warnings but can 
              still be saved for future compatibility.
            </HelpSection>
          </HelpText>
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
            <HelpText>
              Comma-separated list of OpenAI model IDs. Popular models: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
            </HelpText>
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
            <HelpText>
              Comma-separated list of Anthropic model IDs. Popular models: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022
            </HelpText>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Configure AI behavior and default parameters
          </CardDescription>
          <HelpText variant="expandable">
            <HelpSection
              title="AI Parameters"
              links={[
                { label: 'Temperature Guide', href: 'https://platform.openai.com/docs/api-reference/chat/create#chat/create-temperature' },
                { label: 'Token Limits', href: 'https://platform.openai.com/docs/models' }
              ]}
            >
              <div className="space-y-2">
                <div><strong>Temperature:</strong> Controls randomness (0 = deterministic, 1 = creative)</div>
                <div><strong>Max Tokens:</strong> Maximum response length (varies by model)</div>
                <div><strong>System Prompt:</strong> Instructions that guide AI behavior</div>
              </div>
            </HelpSection>
          </HelpText>
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
          <ButtonLoadingState
            isLoading={saving}
            loadingText="Saving Configuration..."
          >
            Save Configuration
          </ButtonLoadingState>
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