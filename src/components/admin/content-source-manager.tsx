/**
 * Content Source Manager Component
 * Admin interface for managing AI content sources with enable/disable toggles
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { 
  Settings, 
  Database, 
  FileText, 
  User, 
  Briefcase, 
  Code, 
  Star,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

interface ContentSource {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  summary: string;
  lastUpdated: Date;
  priority: number;
  config: Record<string, any>;
  schema?: ContentSourceSchema;
  provider: {
    id: string;
    name: string;
    description: string;
    version: string;
  };
  metadata?: {
    lastUpdated: Date;
    itemCount: number;
    size: number;
    tags: string[];
    summary: string;
  };
  isAvailable?: boolean;
}

interface ContentSourceSchema {
  configFields: ConfigField[];
  searchFilters: SearchFilter[];
  outputFormat: OutputFormat;
}

interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: { value: any; label: string }[];
}

interface SearchFilter {
  key: string;
  type: 'text' | 'date' | 'number' | 'select';
  label: string;
  description?: string;
}

interface OutputFormat {
  fields: string[];
  supportedFormats: ('text' | 'json' | 'markdown')[];
}

const getSourceIcon = (type: string) => {
  switch (type) {
    case 'project': return Database;
    case 'about': return User;
    case 'resume': return FileText;
    case 'experience': return Briefcase;
    case 'skills': return Code;
    default: return Settings;
  }
};

const getSourceColor = (type: string) => {
  switch (type) {
    case 'project': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'about': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'resume': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'experience': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'skills': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

export function ContentSourceManager() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  // Load content sources
  const loadSources = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/ai/content-sources');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to load content sources');
      }

      const data = await response.json();
      setSources(data.data?.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Toggle source enabled/disabled
  const toggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/ai/content-sources/${sourceId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to toggle source');
      }

      // Update local state
      setSources(prev => prev.map(source => 
        source.id === sourceId ? { ...source, enabled } : source
      ));

      setSuccess(`Content source ${enabled ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Update source priority
  const updatePriority = async (sourceId: string, priority: number) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/ai/content-sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update priority');
      }

      // Update local state
      setSources(prev => prev.map(source => 
        source.id === sourceId ? { ...source, priority } : source
      ));

      setSuccess('Priority updated successfully');
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Refresh sources
  const refreshSources = async () => {
    await loadSources();
    setSuccess('Content sources refreshed');
    setTimeout(() => setSuccess(null), 3000);
  };

  useEffect(() => {
    loadSources();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingIndicator />
        <span className="ml-2">Loading content sources...</span>
      </div>
    );
  }

  const enabledCount = sources.filter(s => s.enabled).length;
  const totalCount = sources.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Source Management</h2>
          <p className="text-muted-foreground">
            Configure which content sources are available for AI context building
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {enabledCount} of {totalCount} enabled
          </Badge>
          <Button onClick={refreshSources} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Available content providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{enabledCount}</div>
            <p className="text-xs text-muted-foreground">
              Active in AI context
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.reduce((sum, s) => sum + (s.metadata?.itemCount || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Items across all sources
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Sources List */}
      <div className="space-y-4">
        {sources.map((source) => {
          const Icon = getSourceIcon(source.type);
          const isExpanded = expandedSource === source.id;

          return (
            <Card key={source.id} className={`transition-all ${source.enabled ? 'border-green-200 dark:border-green-800' : 'border-gray-200 dark:border-gray-800'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getSourceColor(source.type)}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{source.provider.name}</CardTitle>
                      <CardDescription>{source.provider.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={source.isAvailable ? 'default' : 'secondary'}>
                      {source.isAvailable ? 'Available' : 'Unavailable'}
                    </Badge>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={(enabled) => toggleSource(source.id, enabled)}
                      disabled={saving || !source.isAvailable}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Priority</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={source.priority}
                          onChange={(e) => {
                            const priority = parseInt(e.target.value) || 0;
                            setSources(prev => prev.map(s => 
                              s.id === source.id ? { ...s, priority } : s
                            ));
                          }}
                          onBlur={(e) => {
                            const priority = parseInt(e.target.value) || 0;
                            if (priority !== source.priority) {
                              updatePriority(source.id, priority);
                            }
                          }}
                          className="w-20"
                        />
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.floor(source.priority / 20) 
                                  ? 'text-yellow-400 fill-current' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher priority sources are weighted more heavily
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Type</Label>
                      <div className="mt-1">
                        <Badge className={getSourceColor(source.type)}>
                          {source.type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  {source.metadata && (
                    <div>
                      <Label className="text-sm font-medium">Content Statistics</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Items:</span>
                          <span className="ml-1 font-medium">{source.metadata.itemCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Size:</span>
                          <span className="ml-1 font-medium">
                            {(source.metadata.size / 1024).toFixed(1)}KB
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tags:</span>
                          <span className="ml-1 font-medium">{source.metadata.tags.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Updated:</span>
                          <span className="ml-1 font-medium">
                            {new Date(source.metadata.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div>
                    <Label className="text-sm font-medium">Summary</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {source.summary}
                    </p>
                  </div>

                  {/* Advanced Configuration */}
                  {source.schema && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        {isExpanded ? 'Hide' : 'Show'} Advanced Settings
                      </Button>

                      {isExpanded && (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                          <h4 className="font-medium mb-3">Advanced Configuration</h4>
                          
                          {source.schema.configFields.length > 0 ? (
                            <div className="space-y-3">
                              {source.schema.configFields.map((field) => (
                                <div key={field.key}>
                                  <Label className="text-sm">{field.label}</Label>
                                  {field.description && (
                                    <p className="text-xs text-muted-foreground">{field.description}</p>
                                  )}
                                  {/* Add field inputs based on type */}
                                  <div className="mt-1">
                                    <Input
                                      placeholder={`Configure ${field.label.toLowerCase()}`}
                                      disabled
                                      className="bg-muted"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Info className="h-4 w-4" />
                              No advanced configuration options available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sources.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Content Sources Found</h3>
            <p className="text-muted-foreground mb-4">
              Content sources will be automatically discovered when available.
            </p>
            <Button onClick={refreshSources} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Sources
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}