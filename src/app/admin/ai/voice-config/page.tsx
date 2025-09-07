'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Copy, 
  Star, 
  StarOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Mic,
  Bot
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { useToast } from '@/components/ui/toast';
import { OpenAIRealtimeConfigPanel } from '@/components/admin/voice-config/OpenAIRealtimeConfigPanel';
import { ElevenLabsConfigPanel } from '@/components/admin/voice-config/ElevenLabsConfigPanel';
import { VoiceConfigurationList } from '@/components/admin/voice-config/VoiceConfigurationList';
import { VoiceConfigImportExport } from '@/components/admin/voice-config/VoiceConfigImportExport';
import { VoiceProviderConfig } from '@/types/voice-config';

interface VoiceConfigRecord {
  id: string;
  provider: 'openai' | 'elevenlabs';
  name: string;
  isDefault: boolean;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

function VoiceConfigContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  
  // State management
  const [configurations, setConfigurations] = useState<VoiceConfigRecord[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'elevenlabs'>('openai');
  const [selectedConfig, setSelectedConfig] = useState<VoiceConfigRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any).role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    loadConfigurations();
  }, [session, status, router]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/ai/voice-config');
      
      if (!response.ok) {
        throw new Error('Failed to fetch voice configurations');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load voice configurations');
      }

      setConfigurations(result.data || []);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load voice configurations';
      setError(errorMessage);
      toast.error('Failed to load configurations', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedConfig(null);
    setIsCreating(true);
  };

  const handleEditConfig = (config: VoiceConfigRecord) => {
    setSelectedConfig(config);
    setSelectedProvider(config.provider);
    setIsCreating(false);
  };

  const handleSaveConfig = async (config: VoiceProviderConfig, configId?: string) => {
    try {
      setSaving(true);
      
      const method = configId ? 'PUT' : 'POST';
      const url = configId ? `/api/admin/ai/voice-config/${configId}` : '/api/admin/ai/voice-config';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
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
        configId ? 'Configuration updated' : 'Configuration created',
        `Voice AI configuration has been ${configId ? 'updated' : 'created'} successfully`
      );
      
      // Reload configurations and reset form
      await loadConfigurations();
      setSelectedConfig(null);
      setIsCreating(false);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error('Save failed', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/ai/voice-config/${configId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete configuration');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete configuration');
      }
      
      toast.success('Configuration deleted', 'Voice AI configuration has been deleted successfully');
      
      // Reload configurations
      await loadConfigurations();
      
      // Clear selection if deleted config was selected
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
        setIsCreating(false);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete configuration';
      toast.error('Delete failed', errorMessage);
    }
  };

  const handleSetDefault = async (configId: string, provider: 'openai' | 'elevenlabs') => {
    try {
      const response = await fetch(`/api/admin/ai/voice-config/${configId}/default`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to set default configuration');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to set default configuration');
      }
      
      toast.success('Default configuration set', `${provider} default configuration has been updated`);
      
      // Reload configurations
      await loadConfigurations();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default configuration';
      toast.error('Update failed', errorMessage);
    }
  };

  const handleCloneConfig = async (config: VoiceConfigRecord) => {
    try {
      const parsedConfig = JSON.parse(config.configJson);
      const clonedConfig = {
        ...parsedConfig,
        displayName: `${parsedConfig.displayName} (Copy)`,
        description: `Copy of ${parsedConfig.description}`
      };
      
      await handleSaveConfig(clonedConfig);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clone configuration';
      toast.error('Clone failed', errorMessage);
    }
  };

  const handleCancel = () => {
    setSelectedConfig(null);
    setIsCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading voice configurations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadConfigurations} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show configuration form if creating or editing
  if (isCreating || selectedConfig) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {isCreating ? 'Create New Configuration' : 'Edit Configuration'}
            </h2>
            <p className="text-muted-foreground">
              {isCreating 
                ? `Configure a new ${selectedProvider} voice AI provider`
                : `Editing ${selectedConfig?.name}`
              }
            </p>
          </div>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>

        {/* Provider Selection for New Configs */}
        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Select Provider</CardTitle>
              <CardDescription>
                Choose the voice AI provider to configure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as 'openai' | 'elevenlabs')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="openai" className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    OpenAI Realtime
                  </TabsTrigger>
                  <TabsTrigger value="elevenlabs" className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    ElevenLabs
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Configuration Panel */}
        {selectedProvider === 'openai' && (
          <OpenAIRealtimeConfigPanel
            initialConfig={selectedConfig ? JSON.parse(selectedConfig.configJson) : undefined}
            onSave={(config) => handleSaveConfig(config, selectedConfig?.id)}
            onCancel={handleCancel}
            saving={saving}
          />
        )}

        {selectedProvider === 'elevenlabs' && (
          <ElevenLabsConfigPanel
            initialConfig={selectedConfig ? JSON.parse(selectedConfig.configJson) : undefined}
            onSave={(config) => handleSaveConfig(config, selectedConfig?.id)}
            onCancel={handleCancel}
            saving={saving}
          />
        )}
      </div>
    );
  }

  // Show configuration list
  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voice AI Configuration</h2>
          <p className="text-muted-foreground">
            Manage voice AI provider configurations for real-time conversations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VoiceConfigImportExport 
            configurations={configurations}
            onImportComplete={loadConfigurations}
          />
          <Button onClick={handleCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Configuration
          </Button>
        </div>
      </div>

      {/* Configuration Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OpenAI Configurations</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configurations.filter(c => c.provider === 'openai').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {configurations.filter(c => c.provider === 'openai' && c.isDefault).length} default
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ElevenLabs Configurations</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configurations.filter(c => c.provider === 'elevenlabs').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {configurations.filter(c => c.provider === 'elevenlabs' && c.isDefault).length} default
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration List */}
      <VoiceConfigurationList
        configurations={configurations}
        onEdit={handleEditConfig}
        onDelete={handleDeleteConfig}
        onSetDefault={handleSetDefault}
        onClone={handleCloneConfig}
      />
    </div>
  );
}

export default function VoiceConfigPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="Voice AI Configuration"
        description="Configure voice AI providers for real-time conversations"
      >
        <VoiceConfigContent />
      </AdminPageLayout>
    </AdminLayout>
  );
}