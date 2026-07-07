"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Zap,
  Clock,
  Loader2,
  Info,
  Package,
  FileText,
  ChevronDown,
  Sparkles
} from "lucide-react";
import { HelpText } from "@/components/ui/help-text";

interface ChunkingSettings {
  id: string;
  name: string;
  isDefault: boolean;
  
  // Chunking strategy
  respectHeadingBoundaries: boolean;
  targetChunkSize: number;
  maxSectionSize: number;
  minSectionSize: number;
  sectionBoundaryOverlap: number;
  splitStrategy: 'paragraph' | 'sentence' | 'token';
  
  // Embedding
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large';
  
  // Summary generation
  t1MaxLength: number;
  t2MaxLength: number;
  
  // Change detection
  sectionChangePercent: number;
  minorChangeThreshold: number;
  
  // Behavior
  defaultBehavior: 'auto' | 'manual' | 'prompt';
  draftModeSkipIndexing: boolean;
  
  // Batch mode
  batchModeEnabled: boolean;
  batchModeMinChunks: number;
  batchModeAutoSchedule: boolean;
  batchModeDefaultForRegeneration: boolean;
  batchModeDefaultForBulkOps: boolean;
  batchModeDefaultForInitialIndexing: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

interface CostImpact {
  embeddingCostChange: number;
  summarizationCostChange: number;
  totalCostChange: number;
  affectedProjects: number;
  regenerationRequired: boolean;
  estimatedRegenerationCost: number;
}

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

export function ChunkingConfig() {
  const [config, setConfig] = useState<ChunkingSettings | null>(null);
  const [originalConfig, setOriginalConfig] = useState<ChunkingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [costImpact, setCostImpact] = useState<CostImpact | null>(null);
  const [calculatingCost, setCalculatingCost] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Summary AI config state
  const [summaryConfigs, setSummaryConfigs] = useState<SummaryConfig[]>([]);
  const [selectedSummaryConfig, setSelectedSummaryConfig] = useState<SummaryConfig | null>(null);
  const [summaryPromptsOpen, setSummaryPromptsOpen] = useState(false);

  useEffect(() => {
    loadConfig();
    loadSummaryConfigs();
  }, []);

  useEffect(() => {
    if (config && originalConfig) {
      const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
      setHasChanges(changed);
      
      if (changed) {
        calculateCostImpact();
      } else {
        setCostImpact(null);
      }
    }
  }, [config, originalConfig]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/semantic/config?default=true');
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
        setOriginalConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaryConfigs = async () => {
    try {
      const response = await fetch('/api/admin/semantic/summary-config', {
        method: 'POST',
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const configs = data.configs || [];
      setSummaryConfigs(configs);
      
      // Select default config
      const defaultConfig = configs.find((c: SummaryConfig) => c.isDefault) || configs[0];
      setSelectedSummaryConfig(defaultConfig);
    } catch (error) {
      console.error('Failed to load summary configs:', error);
    }
  };

  const calculateCostImpact = async () => {
    if (!config || !originalConfig) return;
    
    try {
      setCalculatingCost(true);
      const response = await fetch('/api/admin/semantic/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate-cost-impact',
          currentConfigName: originalConfig.name,
          updates: config
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCostImpact(data.costImpact);
      }
    } catch (error) {
      console.error('Failed to calculate cost impact:', error);
    } finally {
      setCalculatingCost(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/admin/semantic/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      if (data.success) {
        setOriginalConfig(data.config);
        setConfig(data.config);
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Reset all settings to factory defaults? This cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch('/api/admin/semantic/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Default',
          isDefault: true
        })
      });
      
      const data = await response.json();
      if (data.success) {
        await loadConfig();
      }
    } catch (error) {
      console.error('Failed to reset config:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (updates: Partial<ChunkingSettings>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load configuration. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Chunking Configuration</h2>
          <p className="text-muted-foreground">
            Configure semantic content decomposition and embedding generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={saving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={saveConfig}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Cost Impact Warning */}
      {costImpact && costImpact.regenerationRequired && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Regeneration Required</p>
              <p>
                These changes will require regenerating semantic indexes for {costImpact.affectedProjects} project(s).
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span>Estimated cost: ${costImpact.estimatedRegenerationCost.toFixed(4)}</span>
                {costImpact.totalCostChange !== 0 && (
                  <span className={costImpact.totalCostChange > 0 ? 'text-red-500' : 'text-green-500'}>
                    {costImpact.totalCostChange > 0 ? '+' : ''}
                    ${Math.abs(costImpact.totalCostChange).toFixed(4)} per regeneration
                  </span>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="chunking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chunking">
            <Package className="h-4 w-4 mr-2" />
            Chunking
          </TabsTrigger>
          <TabsTrigger value="summary">
            <FileText className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="embedding">
            <Zap className="h-4 w-4 mr-2" />
            Embedding
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Clock className="h-4 w-4 mr-2" />
            Batch Mode
          </TabsTrigger>
          <TabsTrigger value="behavior">
            <Settings className="h-4 w-4 mr-2" />
            Behavior
          </TabsTrigger>
        </TabsList>

        {/* Chunking Settings */}
        <TabsContent value="chunking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chunk Size Configuration</CardTitle>
              <CardDescription>
                Configure how content is split into semantic chunks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Target Chunk Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Target Chunk Size (tokens)</Label>
                  <span className="text-sm font-mono">{config.targetChunkSize}</span>
                </div>
                <Slider
                  value={[config.targetChunkSize]}
                  onValueChange={([value]) => updateConfig({ targetChunkSize: value })}
                  min={100}
                  max={1000}
                  step={50}
                />
                <HelpText>
                  Ideal number of tokens per T3 chunk. Smaller chunks = more precise search, larger chunks = more context.
                </HelpText>
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-semibold mb-1">Example at {config.targetChunkSize} tokens:</p>
                  <p className="text-muted-foreground">
                    {config.targetChunkSize < 200 && "Very short chunks - good for precise keyword matching"}
                    {config.targetChunkSize >= 200 && config.targetChunkSize < 400 && "Balanced chunks - good for most use cases"}
                    {config.targetChunkSize >= 400 && "Large chunks - good for maintaining context"}
                  </p>
                </div>
              </div>

              {/* Max Section Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Max Section Size (tokens)</Label>
                  <span className="text-sm font-mono">{config.maxSectionSize}</span>
                </div>
                <Slider
                  value={[config.maxSectionSize]}
                  onValueChange={([value]) => updateConfig({ maxSectionSize: value })}
                  min={200}
                  max={2000}
                  step={100}
                />
                <HelpText>
                  Maximum tokens before splitting a section into multiple chunks.
                </HelpText>
              </div>

              {/* Min Section Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Min Section Size (tokens)</Label>
                  <span className="text-sm font-mono">{config.minSectionSize}</span>
                </div>
                <Slider
                  value={[config.minSectionSize]}
                  onValueChange={([value]) => updateConfig({ minSectionSize: value })}
                  min={10}
                  max={200}
                  step={10}
                />
                <HelpText>
                  Minimum tokens to avoid creating tiny chunks. Smaller sections will be merged with parent.
                </HelpText>
              </div>

              {/* Section Boundary Overlap */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Section Boundary Overlap (tokens)</Label>
                  <span className="text-sm font-mono">{config.sectionBoundaryOverlap}</span>
                </div>
                <Slider
                  value={[config.sectionBoundaryOverlap]}
                  onValueChange={([value]) => updateConfig({ sectionBoundaryOverlap: value })}
                  min={0}
                  max={100}
                  step={5}
                />
                <HelpText>
                  Overlap between chunks within the same section for context continuity.
                </HelpText>
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-semibold mb-1">Trade-off:</p>
                  <p className="text-muted-foreground">
                    More overlap = better context continuity but larger index size and higher costs.
                    {config.sectionBoundaryOverlap === 0 && " No overlap = minimal redundancy."}
                    {config.sectionBoundaryOverlap > 0 && config.sectionBoundaryOverlap <= 25 && " Low overlap = good balance."}
                    {config.sectionBoundaryOverlap > 25 && " High overlap = maximum context preservation."}
                  </p>
                </div>
              </div>

              {/* Split Strategy */}
              <div className="space-y-2">
                <Label>Split Strategy</Label>
                <Select
                  value={config.splitStrategy}
                  onValueChange={(value: any) => updateConfig({ splitStrategy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paragraph">Paragraph (Recommended)</SelectItem>
                    <SelectItem value="sentence">Sentence</SelectItem>
                    <SelectItem value="token">Token</SelectItem>
                  </SelectContent>
                </Select>
                <HelpText>
                  How to split large sections. Paragraph splitting preserves natural boundaries.
                </HelpText>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Settings */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary Generation</CardTitle>
              <CardDescription>
                Configure AI-generated summary lengths and auto-population thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* T1 Max Length */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>T1 Project Summary Max Length (tokens)</Label>
                  <span className="text-sm font-mono">{config.t1MaxLength}</span>
                </div>
                <Slider
                  value={[config.t1MaxLength]}
                  onValueChange={([value]) => updateConfig({ t1MaxLength: value })}
                  min={50}
                  max={500}
                  step={25}
                />
                <HelpText>
                  Maximum tokens for project-level summaries (T1).
                </HelpText>
              </div>

              {/* T2 Max Length */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>T2 Section Summary Max Length (tokens)</Label>
                  <span className="text-sm font-mono">{config.t2MaxLength}</span>
                </div>
                <Slider
                  value={[config.t2MaxLength]}
                  onValueChange={([value]) => updateConfig({ t2MaxLength: value })}
                  min={50}
                  max={300}
                  step={25}
                />
                <HelpText>
                  Maximum tokens for section-level summaries (T2). Also used as the auto-population threshold during chunking - if a section's raw content fits within this limit, it will be used directly instead of generating an AI summary.
                </HelpText>
              </div>
            </CardContent>
          </Card>

          {/* AI Configuration */}
          {selectedSummaryConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" />
                  AI Model & Prompts
                </CardTitle>
                <CardDescription className="text-xs">
                  Used during batch summary generation (read-only presets)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Config Selector */}
                <div className="space-y-2">
                  <Label className="text-xs">Preset</Label>
                  <Select 
                    value={selectedSummaryConfig.id} 
                    onValueChange={(id) => {
                      const config = summaryConfigs.find(c => c.id === id);
                      if (config) setSelectedSummaryConfig(config);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {summaryConfigs.map((cfg) => (
                        <SelectItem key={cfg.id} value={cfg.id} className="text-xs">
                          {cfg.name}
                          {cfg.isDefault && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Compact Model/Temp Display */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">Model</p>
                    <p className="font-mono">{selectedSummaryConfig.model}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Temperature</p>
                    <p className="font-mono">{selectedSummaryConfig.temperature}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Quality</p>
                    <div className="flex gap-1">
                      {selectedSummaryConfig.preventHallucination && (
                        <span title="Anti-Hallucination"><CheckCircle className="h-3 w-3 text-green-600" /></span>
                      )}
                      {selectedSummaryConfig.preserveKeywords && (
                        <span title="Preserve Keywords"><CheckCircle className="h-3 w-3 text-blue-600" /></span>
                      )}
                      {selectedSummaryConfig.requireFactualAccuracy && (
                        <span title="Factual Accuracy"><CheckCircle className="h-3 w-3 text-purple-600" /></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* System Prompts - Collapsible */}
                <Collapsible open={summaryPromptsOpen} onOpenChange={setSummaryPromptsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium hover:underline">
                    <ChevronDown className={`h-3 w-3 transition-transform ${summaryPromptsOpen ? 'rotate-180' : ''}`} />
                    System Prompts (T1 / T2)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">T1 (Project Summary)</Label>
                      <Textarea
                        value={selectedSummaryConfig.t1SystemPrompt}
                        readOnly
                        rows={6}
                        className="font-mono text-[10px] bg-muted resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">T2 (Section Summary)</Label>
                      <Textarea
                        value={selectedSummaryConfig.t2SystemPrompt}
                        readOnly
                        rows={6}
                        className="font-mono text-[10px] bg-muted resize-none"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      For custom prompts, use manual generation in the Semantic Tree View
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Embedding Settings */}
        <TabsContent value="embedding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Embedding Model Selection</CardTitle>
              <CardDescription>
                Choose the embedding model for vector search
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Embedding Model</Label>
                <Select
                  value={config.embeddingModel}
                  onValueChange={(value: any) => updateConfig({ embeddingModel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-embedding-3-small">
                      text-embedding-3-small (Recommended)
                    </SelectItem>
                    <SelectItem value="text-embedding-3-large">
                      text-embedding-3-large (Higher Quality)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card className={config.embeddingModel === 'text-embedding-3-small' ? 'border-primary' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">text-embedding-3-small</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cost per 1M tokens:</span>
                      <span className="font-mono">$0.02</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="font-mono">1536</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quality:</span>
                      <Badge variant="secondary">Good</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className={config.embeddingModel === 'text-embedding-3-large' ? 'border-primary' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">text-embedding-3-large</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cost per 1M tokens:</span>
                      <span className="font-mono">$0.13</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="font-mono">3072</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quality:</span>
                      <Badge variant="default">Excellent</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Changing the embedding model requires regenerating all embeddings.
                  {costImpact && costImpact.embeddingCostChange !== 0 && (
                    <span className="block mt-2 font-semibold">
                      Cost impact: {costImpact.embeddingCostChange > 0 ? '+' : ''}
                      ${Math.abs(costImpact.embeddingCostChange).toFixed(4)} per regeneration
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Mode Settings */}
        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Mode Configuration</CardTitle>
              <CardDescription>
                Configure batch processing for 50% cost savings on embeddings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Batch Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Batch Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Use OpenAI Batch API for 50% cost savings (24-hour processing)
                  </p>
                </div>
                <Switch
                  checked={config.batchModeEnabled}
                  onCheckedChange={(checked) => updateConfig({ batchModeEnabled: checked })}
                />
              </div>

              {config.batchModeEnabled && (
                <>
                  {/* Minimum Chunks Threshold */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Minimum Chunks for Batch Mode</Label>
                      <span className="text-sm font-mono">{config.batchModeMinChunks}</span>
                    </div>
                    <Slider
                      value={[config.batchModeMinChunks]}
                      onValueChange={([value]) => updateConfig({ batchModeMinChunks: value })}
                      min={10}
                      max={500}
                      step={10}
                    />
                    <HelpText>
                      Minimum number of chunks to use batch mode. Smaller operations use standard API.
                    </HelpText>
                  </div>

                  {/* Auto-schedule Overnight */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-schedule Overnight</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically schedule batch jobs for overnight processing
                      </p>
                    </div>
                    <Switch
                      checked={config.batchModeAutoSchedule}
                      onCheckedChange={(checked) => updateConfig({ batchModeAutoSchedule: checked })}
                    />
                  </div>

                  {/* Default Batch Mode for Operations */}
                  <div className="space-y-4">
                    <Label>Default Batch Mode for Operations</Label>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Regeneration</p>
                        <p className="text-sm text-muted-foreground">
                          Use batch mode by default for regeneration operations
                        </p>
                      </div>
                      <Switch
                        checked={config.batchModeDefaultForRegeneration}
                        onCheckedChange={(checked) => updateConfig({ batchModeDefaultForRegeneration: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Bulk Operations</p>
                        <p className="text-sm text-muted-foreground">
                          Use batch mode by default for bulk operations
                        </p>
                      </div>
                      <Switch
                        checked={config.batchModeDefaultForBulkOps}
                        onCheckedChange={(checked) => updateConfig({ batchModeDefaultForBulkOps: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Initial Indexing</p>
                        <p className="text-sm text-muted-foreground">
                          Use batch mode by default for initial project indexing
                        </p>
                      </div>
                      <Switch
                        checked={config.batchModeDefaultForInitialIndexing}
                        onCheckedChange={(checked) => updateConfig({ batchModeDefaultForInitialIndexing: checked })}
                      />
                    </div>
                  </div>

                  {/* Cost Savings Info */}
                  <Alert>
                    <DollarSign className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-1">Batch Mode Savings</p>
                      <p className="text-sm">
                        Batch API costs $0.01 per 1M tokens vs $0.02 for standard API (50% savings).
                        Processing time: up to 24 hours vs 30 seconds for standard API.
                      </p>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behavior Settings */}
        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Detection</CardTitle>
              <CardDescription>
                Configure automatic change detection thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section Change Percent */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Section Change Threshold (%)</Label>
                  <span className="text-sm font-mono">{(config.sectionChangePercent * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.sectionChangePercent * 100]}
                  onValueChange={([value]) => updateConfig({ sectionChangePercent: value / 100 })}
                  min={5}
                  max={50}
                  step={5}
                />
                <HelpText>
                  Percentage of sections changed to trigger full regeneration.
                </HelpText>
              </div>

              {/* Minor Change Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Minor Change Threshold (sections)</Label>
                  <span className="text-sm font-mono">{config.minorChangeThreshold}</span>
                </div>
                <Slider
                  value={[config.minorChangeThreshold]}
                  onValueChange={([value]) => updateConfig({ minorChangeThreshold: value })}
                  min={1}
                  max={10}
                  step={1}
                />
                <HelpText>
                  Maximum sections changed to classify as "minor" change.
                </HelpText>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Behavior</CardTitle>
              <CardDescription>
                Configure automatic indexing behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Behavior */}
              <div className="space-y-2">
                <Label>Default Regeneration Behavior</Label>
                <Select
                  value={config.defaultBehavior}
                  onValueChange={(value: any) => updateConfig({ defaultBehavior: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Regenerate automatically)</SelectItem>
                    <SelectItem value="prompt">Prompt (Ask before regenerating)</SelectItem>
                    <SelectItem value="manual">Manual (Never auto-regenerate)</SelectItem>
                  </SelectContent>
                </Select>
                <HelpText>
                  How to handle regeneration when content changes are detected.
                </HelpText>
              </div>

              {/* Draft Mode Skip Indexing */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Skip Indexing in Draft Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't generate semantic indexes for draft projects
                  </p>
                </div>
                <Switch
                  checked={config.draftModeSkipIndexing}
                  onCheckedChange={(checked) => updateConfig({ draftModeSkipIndexing: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cost Impact Calculator */}
      {calculatingCost && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Calculating cost impact...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
