"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
} from "lucide-react";

interface SummaryConfig {
  id: string;
  name: string;
  model: string;
  temperature: number;
  t1SystemPrompt: string;
  t2SystemPrompt: string;
  t1MaxLength: number;
  t2MaxLength: number;
  preventHallucination: boolean;
  preserveKeywords: boolean;
  requireFactualAccuracy: boolean;
  isDefault: boolean;
}

export function SummaryConfig() {
  const [configs, setConfigs] = useState<SummaryConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState('default-balanced');
  const [selectedConfig, setSelectedConfig] = useState<SummaryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (configs.length > 0) {
      const config = configs.find(c => c.id === selectedConfigId) || configs[0];
      setSelectedConfig(config);
    }
  }, [selectedConfigId, configs]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/semantic/summary-config', {
        method: 'POST', // POST to get list of configs
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configurations');
      }

      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (error) {
      console.error('Error fetching summary configs:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load configurations'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading configurations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedConfig) {
    return (
      <Card>
        <CardContent className="py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No configurations available</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Summary Generation Configuration
            </CardTitle>
            <CardDescription>
              Configure AI models and system prompts for T1 (project) and T2 (section) summary generation
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Message */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Config Selector */}
        <div className="space-y-2">
          <Label htmlFor="config-select">Configuration Preset</Label>
          <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
            <SelectTrigger id="config-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {configs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                  {config.isDefault && <Badge variant="outline" className="ml-2">Default</Badge>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Config Details */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">Model</p>
            <p className="text-sm text-gray-600">{selectedConfig.model}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Temperature</p>
            <p className="text-sm text-gray-600">{selectedConfig.temperature}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">T1 Max Length</p>
            <p className="text-sm text-gray-600">{selectedConfig.t1MaxLength} words</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">T2 Max Length</p>
            <p className="text-sm text-gray-600">{selectedConfig.t2MaxLength} words</p>
          </div>
        </div>

        {/* Prompts */}
        <Tabs defaultValue="t1" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="t1">T1 System Prompt (Project)</TabsTrigger>
            <TabsTrigger value="t2">T2 System Prompt (Section)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="t1" className="space-y-2">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-800">
                  T1 prompts generate project-level summaries from all T3 chunks (50-100 words)
                </p>
              </div>
            </div>
            <Textarea
              value={selectedConfig.t1SystemPrompt}
              readOnly
              rows={12}
              className="font-mono text-xs bg-white"
            />
            <p className="text-xs text-gray-500">
              This is a read-only view. System prompts are configured in code for consistency.
              For custom prompts, use the "Custom System Prompt" option when generating summaries manually.
            </p>
          </TabsContent>

          <TabsContent value="t2" className="space-y-2">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-green-600 mt-0.5" />
                <p className="text-xs text-green-800">
                  T2 prompts generate section summaries from section T3 chunks (100-200 words)
                </p>
              </div>
            </div>
            <Textarea
              value={selectedConfig.t2SystemPrompt}
              readOnly
              rows={12}
              className="font-mono text-xs bg-white"
            />
            <p className="text-xs text-gray-500">
              This is a read-only view. System prompts are configured in code for consistency.
              For custom prompts, use the "Custom System Prompt" option when generating summaries manually.
            </p>
          </TabsContent>
        </Tabs>

        {/* Quality Controls */}
        <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h3 className="text-sm font-semibold text-purple-900">Quality Controls</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {selectedConfig.preventHallucination ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs">Anti-Hallucination</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedConfig.preserveKeywords ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs">Preserve Keywords</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedConfig.requireFactualAccuracy ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs">Factual Accuracy</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Note:</strong> This configuration is used automatically during batch processing (chunking → summaries stages).
            For manual summary generation, you can override the model and prompt per-chunk in the Semantic Tree View.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

