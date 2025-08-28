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
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
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
      {/* AI Status Overview */}
      <AIStatusIndicator variant="detailed" showActions={true} />



      {/* Individual Panels Layout */}
      <div className="flex flex-wrap gap-4">
        {/* Environment Configuration - Medium Width */}
        <Card className="flex-1 min-w-[500px] max-w-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Environment Configuration</CardTitle>
            <CardDescription className="text-sm">
              API keys from environment variables
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
                Set OPENAI_API_KEY and ANTHROPIC_API_KEY environment variables. Never commit API keys to your repository.
              </HelpSection>
            </HelpText>
          </CardHeader>
          <CardContent className="space-y-3">
            {environmentStatus && (
              <>
                {/* OpenAI Status - Compact */}
                <div className="flex items-center justify-between p-2 border rounded">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">OpenAI</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {environmentStatus.openai.configured 
                        ? `${environmentStatus.openai.keyPreview}`
                        : 'OPENAI_API_KEY not set'
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
                          Get key <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <ConfigurationStatus 
                      isConfigured={environmentStatus.openai.configured}
                      label={environmentStatus.openai.configured ? 'Set' : 'Missing'}
                    />
                    {connectionStatus.get('openai') && (
                      <ConnectionStatus
                        isConnected={connectionStatus.get('openai')?.success || false}
                        label={connectionStatus.get('openai')?.success ? 'OK' : 'Failed'}
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection('openai')}
                      disabled={!environmentStatus.openai.configured || testingProvider === 'openai'}
                      className="text-xs px-2 py-1"
                    >
                      <ButtonLoadingState
                        isLoading={testingProvider === 'openai'}
                        loadingText="..."
                      >
                        Test
                      </ButtonLoadingState>
                    </Button>
                  </div>
                </div>
                
                {/* Anthropic Status - Compact */}
                <div className="flex items-center justify-between p-2 border rounded">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">Anthropic</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {environmentStatus.anthropic.configured 
                        ? `${environmentStatus.anthropic.keyPreview}`
                        : 'ANTHROPIC_API_KEY not set'
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
                          Get key <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <ConfigurationStatus 
                      isConfigured={environmentStatus.anthropic.configured}
                      label={environmentStatus.anthropic.configured ? 'Set' : 'Missing'}
                    />
                    {connectionStatus.get('anthropic') && (
                      <ConnectionStatus
                        isConnected={connectionStatus.get('anthropic')?.success || false}
                        label={connectionStatus.get('anthropic')?.success ? 'OK' : 'Failed'}
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection('anthropic')}
                      disabled={!environmentStatus.anthropic.configured || testingProvider === 'anthropic'}
                      className="text-xs px-2 py-1"
                    >
                      <ButtonLoadingState
                        isLoading={testingProvider === 'anthropic'}
                        loadingText="..."
                      >
                        Test
                      </ButtonLoadingState>
                    </Button>
                  </div>
                </div>
                
                {/* Error Messages - Compact */}
                {connectionStatus.get('openai') && !connectionStatus.get('openai')?.success && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded border">
                    OpenAI: {connectionStatus.get('openai')?.data?.message}
                  </div>
                )}
                
                {connectionStatus.get('anthropic') && !connectionStatus.get('anthropic')?.success && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded border">
                    Anthropic: {connectionStatus.get('anthropic')?.data?.message}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Model Configuration - Compact Width */}
        <Card className="w-80">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Model Configuration</CardTitle>
            <CardDescription className="text-sm">
              Available models
            </CardDescription>
            <HelpText variant="expandable">
              <HelpSection
                title="Model Configuration"
                links={[
                  { label: 'OpenAI Models', href: 'https://platform.openai.com/docs/models' },
                  { label: 'Anthropic Models', href: 'https://docs.anthropic.com/claude/docs/models-overview' }
                ]}
              >
                Comma-separated model IDs. Models validated on save.
              </HelpSection>
            </HelpText>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="openai-models" className="text-sm">OpenAI Models</Label>
              <Input
                id="openai-models"
                placeholder="gpt-4o, gpt-4o-mini"
                value={modelConfig.openai}
                onChange={(e) => setModelConfig(prev => ({ ...prev, openai: e.target.value }))}
                disabled={!environmentStatus?.openai.configured}
                className="text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="anthropic-models" className="text-sm">Anthropic Models</Label>
              <Input
                id="anthropic-models"
                placeholder="claude-3-5-sonnet-20241022"
                value={modelConfig.anthropic}
                onChange={(e) => setModelConfig(prev => ({ ...prev, anthropic: e.target.value }))}
                disabled={!environmentStatus?.anthropic.configured}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* General Settings - Compact Width */}
        <Card className="w-80">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">General Settings</CardTitle>
            <CardDescription className="text-sm">
              AI behavior parameters
            </CardDescription>
            <HelpText variant="expandable">
              <HelpSection
                title="AI Parameters"
                links={[
                  { label: 'Temperature Guide', href: 'https://platform.openai.com/docs/api-reference/chat/create#chat/create-temperature' },
                  { label: 'Token Limits', href: 'https://platform.openai.com/docs/models' }
                ]}
              >
                Temperature: randomness (0-1), Max Tokens: response length, System Prompt: AI instructions
              </HelpSection>
            </HelpText>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="default-provider" className="text-sm">Default Provider</Label>
              <Select
                value={generalSettings.defaultProvider}
                onValueChange={(value: 'openai' | 'anthropic') => 
                  setGeneralSettings(prev => ({ ...prev, defaultProvider: value }))
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai" disabled={!environmentStatus?.openai.configured}>
                    OpenAI {!environmentStatus?.openai.configured && '(Not set)'}
                  </SelectItem>
                  <SelectItem value="anthropic" disabled={!environmentStatus?.anthropic.configured}>
                    Anthropic {!environmentStatus?.anthropic.configured && '(Not set)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="temperature" className="text-sm">Temperature ({generalSettings.temperature})</Label>
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
            
            <div className="space-y-1">
              <Label htmlFor="max-tokens" className="text-sm">Max Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min="100"
                max="8000"
                value={generalSettings.maxTokens}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="system-prompt" className="text-sm">System Prompt</Label>
              <Textarea
                id="system-prompt"
                placeholder="You are an expert content editor..."
                value={generalSettings.systemPrompt}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                rows={2}
                className="text-sm"
              />
            </div>

            <Button onClick={saveConfiguration} disabled={saving} className="w-full" size="sm">
              <ButtonLoadingState
                isLoading={saving}
                loadingText="Saving..."
              >
                Save Configuration
              </ButtonLoadingState>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AISettingsPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="AI Settings"
        description="Configure AI providers and models for content assistance"
      >
        <AISettingsContent />
      </AdminPageLayout>
    </AdminLayout>
  );
}