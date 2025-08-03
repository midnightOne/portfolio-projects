'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic';
  available: boolean;
}

interface ModelsByProvider {
  [key: string]: {
    provider: string;
    configured: boolean;
    connected: boolean;
    error?: string;
    availableModels: string[];
    configuredModels: string[];
  };
}

interface AvailableModelsResponse {
  success: boolean;
  data?: {
    byProvider: ModelsByProvider;
    unified: ModelOption[];
    summary: {
      totalProviders: number;
      configuredProviders: number;
      connectedProviders: number;
      totalAvailableModels: number;
      totalConfiguredModels: number;
      availableForUse: number;
    };
    retrievedAt: string;
  };
  error?: {
    message: string;
    code: string;
    details: string;
  };
}

interface UnifiedModelSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
}

export function UnifiedModelSelector({
  value,
  onValueChange,
  placeholder = "Select a model...",
  disabled = false,
  className,
  showRefreshButton = false,
  onRefresh
}: UnifiedModelSelectorProps) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [providerStatus, setProviderStatus] = useState<ModelsByProvider>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/ai/available-models');
      const data: AvailableModelsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load available models');
      }

      if (!data.data) {
        throw new Error('No data received from API');
      }

      // Filter out models from providers without valid API keys
      const availableModels = data.data.unified.filter(model => model.available);
      
      setModels(availableModels);
      setProviderStatus(data.data.byProvider);
      
      // Call onRefresh callback if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  // Group models by provider for display
  const groupedModels = models.reduce((groups, model) => {
    if (!groups[model.provider]) {
      groups[model.provider] = [];
    }
    groups[model.provider].push(model);
    return groups;
  }, {} as Record<string, ModelOption[]>);

  // Get provider display name
  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  // Get provider status badge
  const getProviderStatusBadge = (provider: string) => {
    const status = providerStatus[provider];
    if (!status) return null;

    if (!status.configured) {
      return <Badge variant="secondary" className="ml-2 text-xs">Not configured</Badge>;
    }

    if (!status.connected) {
      return <Badge variant="destructive" className="ml-2 text-xs">Connection failed</Badge>;
    }

    return <Badge variant="default" className="ml-2 text-xs">Connected</Badge>;
  };

  // Get model count for provider
  const getModelCount = (provider: string) => {
    const status = providerStatus[provider];
    if (!status) return 0;
    return status.configuredModels.length;
  };

  // Check if provider has any available models
  const hasAvailableModels = (provider: string) => {
    return groupedModels[provider]?.some(model => model.available) || false;
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading models...</span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>Error loading models</span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  if (models.length === 0) {
    // Check if we have any configured providers
    const hasConfiguredProviders = Object.values(providerStatus).some(status => status.configured);
    const hasConnectedProviders = Object.values(providerStatus).some(status => status.connected);
    
    let message = "No models available";
    if (!hasConfiguredProviders) {
      message = "No AI providers configured - check environment variables";
    } else if (!hasConnectedProviders) {
      message = "No providers connected - check API keys and connection";
    } else {
      message = "No models configured - add models in AI settings";
    }

    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{message}</span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  const handleRefresh = () => {
    loadAvailableModels();
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
        {/* Group models by provider */}
        {Object.entries(groupedModels)
          .sort(([a], [b]) => {
            // OpenAI first, then Anthropic, then alphabetical
            if (a === 'openai') return -1;
            if (b === 'openai') return 1;
            if (a === 'anthropic' && b !== 'openai') return -1;
            if (b === 'anthropic' && a !== 'openai') return 1;
            return a.localeCompare(b);
          })
          .map(([provider, providerModels], index) => (
            <div key={provider}>
              {/* Provider header with enhanced visual separation */}
              <div className={`px-3 py-2 text-sm font-medium bg-muted/50 border-b flex items-center justify-between ${
                index > 0 ? 'border-t' : ''
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{getProviderDisplayName(provider)}</span>
                  <span className="text-xs text-muted-foreground">
                    ({getModelCount(provider)} model{getModelCount(provider) !== 1 ? 's' : ''})
                  </span>
                </div>
                {getProviderStatusBadge(provider)}
              </div>
              
              {/* Models for this provider */}
              {providerModels.length > 0 ? (
                providerModels
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((model) => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      disabled={!model.available}
                      className={`pl-6 ${!model.available ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={!model.available ? 'text-muted-foreground' : ''}>
                          {model.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {model.available ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))
              ) : (
                <div className="px-6 py-2 text-sm text-muted-foreground italic">
                  No models configured for this provider
                </div>
              )}
              
              {/* Show provider error if exists */}
              {providerStatus[provider]?.error && !providerStatus[provider]?.connected && (
                <div className="px-6 py-2 text-xs text-red-600 bg-red-50 border-b">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>Connection issue: {providerStatus[provider]?.error}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </SelectContent>
      </Select>
      
      {showRefreshButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}