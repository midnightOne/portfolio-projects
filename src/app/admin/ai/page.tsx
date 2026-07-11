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
import { AlertCircle, ExternalLink, Loader2, Database, MessageSquare, SlidersHorizontal, BarChart3, FileText } from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { AIStatusIndicator } from '@/components/admin/ai-status-indicator';
import { ModelAliasPanel } from '@/components/admin/ModelAliasPanel';
import { ModelPricingPanel } from '@/components/admin/ModelPricingPanel';
import { EmbeddingModelPanel } from '@/components/admin/EmbeddingModelPanel';
import { DefaultVoiceProviderPanel } from '@/components/admin/DefaultVoiceProviderPanel';
import { MemoryLayerPanel } from '@/components/admin/MemoryLayerPanel';
import { useToast } from '@/components/ui/toast';
import { ConnectionStatus, ConfigurationStatus } from '@/components/ui/status-badge';
import { HelpText, HelpSection } from '@/components/ui/help-text';
import { ButtonLoadingState } from '@/components/ui/loading-indicator';

type ChatProvider = 'openai' | 'anthropic' | 'google';

const CHAT_PROVIDERS: Array<{ id: ChatProvider; label: string; envVar: string; modelPlaceholder: string }> = [
  { id: 'openai', label: 'OpenAI', envVar: 'OPENAI_API_KEY', modelPlaceholder: 'gpt-4o, gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', modelPlaceholder: 'claude-haiku-4-5-20251001' },
  { id: 'google', label: 'Google', envVar: 'GOOGLE_API_KEY / GEMINI_API_KEY', modelPlaceholder: 'gemini-2.5-flash' },
];

interface ProviderEnvStatus {
  configured: boolean;
  keyPreview: string;
  environmentVariable: string;
}

interface EnvironmentStatus {
  openai: ProviderEnvStatus;
  anthropic: ProviderEnvStatus;
  google: ProviderEnvStatus;
  summary: {
    hasAnyProvider: boolean;
    configuredProviders: string[];
    isFullyConfigured: boolean;
    totalConfigured: number;
    totalAvailable: number;
  };
  warnings: string[];
  setupInstructions: Partial<Record<ChatProvider, {
    message: string;
    documentation: string;
    example: string;
  } | null>>;
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

type ModelConfig = Record<ChatProvider, string>;

interface GeneralSettings {
  defaultProvider: ChatProvider;
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
  const [modelConfig, setModelConfig] = useState<ModelConfig>({ openai: '', anthropic: '', google: '' });
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
      setModelConfig({ openai: '', anthropic: '', google: '', ...configData.data.modelConfig });
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

  const testConnection = async (provider: ChatProvider) => {
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

      {/* Model alias registry (D4) */}
      <ModelAliasPanel />

      {/* Embedding model switch + reindex consent (owner, 2026-07-09) */}
      <EmbeddingModelPanel />

      {/* Site-default voice provider served to visitors */}
      <DefaultVoiceProviderPanel />

      {/* Conversation-memory layer switch + graph-less tool set (M2, Req 19.7) */}
      <MemoryLayerPanel />

      {/* Model pricing table (D38) */}
      <ModelPricingPanel />

      {/* Quick Navigation to AI Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Assistant Features</CardTitle>
          <CardDescription>
            Manage all AI-related features and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => router.push('/admin/ai/content-sources')}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span className="font-medium">Content Sources</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Manage AI context sources and content types
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => router.push('/admin/ai/project-indexing')}
            >
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <span className="font-medium">Project Indexing</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Monitor and manage project indexing for AI context
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">Conversations</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Review AI conversations and analytics (Coming Soon)
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => router.push('/admin/ai/context-config')}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                <span className="font-medium">Context Config</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Configure AI context and response behavior
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <span className="font-medium">Analytics</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                AI usage analytics and performance metrics (Coming Soon)
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Security</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Rate limiting, abuse detection, and security (Coming Soon)
              </p>
            </Button>
          </div>
        </CardContent>
      </Card>



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
                  { label: 'Google AI Studio Keys', href: 'https://aistudio.google.com/apikey' },
                  { label: 'Environment Variables Guide', href: '/docs/environment-setup' }
                ]}
              >
                Set OPENAI_API_KEY, ANTHROPIC_API_KEY, and GOOGLE_API_KEY (or GEMINI_API_KEY) environment variables. Never commit API keys to your repository.
              </HelpSection>
            </HelpText>
          </CardHeader>
          <CardContent className="space-y-3">
            {environmentStatus && (
              <>
                {CHAT_PROVIDERS.map(({ id, label, envVar }) => (
                  <div key={id} className="flex items-center justify-between p-2 border rounded" data-testid={`env-status-${id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {environmentStatus[id].configured
                          ? `${environmentStatus[id].keyPreview}`
                          : `${envVar} not set`
                        }
                      </div>
                      {environmentStatus.setupInstructions[id] && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <a
                            href={environmentStatus.setupInstructions[id]!.documentation}
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
                        isConfigured={environmentStatus[id].configured}
                        label={environmentStatus[id].configured ? 'Set' : 'Missing'}
                      />
                      {connectionStatus.get(id) && (
                        <ConnectionStatus
                          isConnected={connectionStatus.get(id)?.success || false}
                          label={connectionStatus.get(id)?.success ? 'OK' : 'Failed'}
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(id)}
                        disabled={!environmentStatus[id].configured || testingProvider === id}
                        className="text-xs px-2 py-1"
                      >
                        <ButtonLoadingState
                          isLoading={testingProvider === id}
                          loadingText="..."
                        >
                          Test
                        </ButtonLoadingState>
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Error Messages - Compact */}
                {CHAT_PROVIDERS.filter(({ id }) => connectionStatus.get(id) && !connectionStatus.get(id)?.success).map(({ id, label }) => (
                  <div key={`${id}-error`} className="text-xs text-red-600 bg-red-50 p-2 rounded border">
                    {label}: {connectionStatus.get(id)?.data?.message}
                  </div>
                ))}
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
            {CHAT_PROVIDERS.map(({ id, label, modelPlaceholder }) => (
              <div key={id} className="space-y-1">
                <Label htmlFor={`${id}-models`} className="text-sm">{label} Models</Label>
                <Input
                  id={`${id}-models`}
                  placeholder={modelPlaceholder}
                  value={modelConfig[id]}
                  onChange={(e) => setModelConfig(prev => ({ ...prev, [id]: e.target.value }))}
                  disabled={!environmentStatus?.[id].configured}
                  className="text-sm"
                />
              </div>
            ))}
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
                onValueChange={(value: ChatProvider) =>
                  setGeneralSettings(prev => ({ ...prev, defaultProvider: value }))
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAT_PROVIDERS.map(({ id, label }) => (
                    <SelectItem key={id} value={id} disabled={!environmentStatus?.[id].configured}>
                      {label} {!environmentStatus?.[id].configured && '(Not set)'}
                    </SelectItem>
                  ))}
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