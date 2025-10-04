'use client';

/**
 * Stage-Based Processing Panel
 * 
 * Persistent progress panel integrated into the semantic dashboard.
 * Replaces modal-based progress tracking with non-blocking UI.
 * 
 * Features:
 * - Persistent progress tracking (no modal blocking)
 * - Stage-level progress visualization
 * - Real-time updates via Server-Sent Events
 * - Granular control (pause, resume, cancel)
 * - Checkpoint system with resume capability
 * - Background processing without UI blocking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Settings,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { ProcessingProgress, ProcessingStage, StageConfig } from '@/lib/content/StageBasedProcessingService';

interface StageBasedProcessingPanelProps {
  scope: 'all' | 'project' | 'section';
  projectId?: string;
  sectionId?: string;
  projectTitle?: string;
  sectionTitle?: string;
  onComplete?: (result: any) => void;
  onClose?: () => void;
}

interface StageConfigUI extends StageConfig {
  name: string;
  description: string;
  estimatedTime: string;
  costMultiplier: number;
}

const STAGE_CONFIGS: StageConfigUI[] = [
  {
    stage: 'chunking',
    name: 'Content Chunking',
    description: 'Parse content and create hierarchical chunks (T0-T3)',
    estimatedTime: '~10s',
    costMultiplier: 0,
    enabled: true,
    mode: 'immediate'
  },
  {
    stage: 'summaries',
    name: 'AI Summaries',
    description: 'Generate AI summaries for T1 and T2 tiers',
    estimatedTime: '~30s',
    costMultiplier: 0.7,
    enabled: true,
    mode: 'immediate'
  },
  {
    stage: 'embeddings',
    name: 'Vector Embeddings',
    description: 'Generate embeddings for semantic search',
    estimatedTime: '~20s',
    costMultiplier: 0.3,
    enabled: true,
    mode: 'immediate'
  },
  {
    stage: 'validation',
    name: 'Validation & Storage',
    description: 'Validate structure and store in database',
    estimatedTime: '~5s',
    costMultiplier: 0,
    enabled: true,
    mode: 'immediate'
  }
];

export function StageBasedProcessingPanel({
  scope,
  projectId,
  sectionId,
  projectTitle,
  sectionTitle,
  onComplete,
  onClose
}: StageBasedProcessingPanelProps) {
  // State management
  const [step, setStep] = useState<'config' | 'processing' | 'complete'>('config');
  const [stageConfigs, setStageConfigs] = useState<StageConfigUI[]>(STAGE_CONFIGS);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<ProcessingStage>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Start processing
  const startProcessing = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/semantic/processing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          projectId,
          sectionId,
          stages: stageConfigs.filter(s => s.enabled).map(s => ({
            stage: s.stage,
            enabled: s.enabled,
            mode: s.mode,
            options: s.options
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start processing');
      }

      const result = await response.json();
      setOperationId(result.operationId);
      setStep('processing');

      // Start progress tracking
      trackProgress(result.operationId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    } finally {
      setLoading(false);
    }
  };

  // Track progress with SSE
  const trackProgress = useCallback((opId: string) => {
    const eventSource = new EventSource(
      `/api/admin/semantic/processing/${opId}?sse=true`
    );

    eventSource.onmessage = (event) => {
      const progressData: ProcessingProgress = JSON.parse(event.data);
      setProgress(progressData);

      if (progressData.status === 'completed' || progressData.status === 'failed') {
        eventSource.close();
        setStep('complete');
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Fallback to polling
      pollProgress(opId);
    };

    return () => eventSource.close();
  }, []);

  // Fallback polling
  const pollProgress = async (opId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/semantic/processing/${opId}`);
        if (response.ok) {
          const progressData: ProcessingProgress = await response.json();
          setProgress(progressData);

          if (progressData.status === 'completed' || progressData.status === 'failed') {
            clearInterval(interval);
            setStep('complete');
          }
        }
      } catch (err) {
        console.error('Error polling progress:', err);
      }
    }, 2000);
  };

  // Control operations
  const controlOperation = async (action: 'pause' | 'resume' | 'cancel', resumeFromStage?: ProcessingStage) => {
    if (!operationId) return;

    try {
      const response = await fetch(`/api/admin/semantic/processing/${operationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resumeFromStage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} processing`);
      }

      // Update local state based on action
      if (action === 'cancel') {
        setStep('complete');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} processing`);
    }
  };

  // Update stage configuration
  const updateStageConfig = (stage: ProcessingStage, updates: Partial<StageConfigUI>) => {
    setStageConfigs(prev => prev.map(s => 
      s.stage === stage ? { ...s, ...updates } : s
    ));
  };

  // Toggle stage expansion
  const toggleStageExpansion = (stage: ProcessingStage) => {
    setExpandedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stage)) {
        newSet.delete(stage);
      } else {
        newSet.add(stage);
      }
      return newSet;
    });
  };

  // Render configuration step
  const renderConfigStep = () => (
    <div className="space-y-6">
      {/* Scope Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Scope</CardTitle>
          <CardDescription>
            {scope === 'all' && 'Process all projects'}
            {scope === 'project' && `Process project: ${projectTitle || projectId}`}
            {scope === 'section' && `Process section: ${sectionTitle || sectionId}`}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stage Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Processing Stages
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </CardTitle>
          <CardDescription>
            Select which stages to execute and their processing modes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stageConfigs.map((stageConfig) => (
            <div key={stageConfig.stage} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={stageConfig.enabled}
                    onCheckedChange={(checked) => 
                      updateStageConfig(stageConfig.stage, { enabled: !!checked })
                    }
                  />
                  <div>
                    <div className="font-semibold">{stageConfig.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {stageConfig.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{stageConfig.estimatedTime}</Badge>
                  {showAdvanced && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStageExpansion(stageConfig.stage)}
                    >
                      {expandedStages.has(stageConfig.stage) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Advanced Options */}
              {showAdvanced && expandedStages.has(stageConfig.stage) && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div>
                    <label className="text-sm font-medium">Processing Mode</label>
                    <Select
                      value={stageConfig.mode}
                      onValueChange={(value: 'immediate' | 'batch') =>
                        updateStageConfig(stageConfig.stage, { mode: value })
                      }
                      disabled={!stageConfig.enabled}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">
                          Immediate (faster, standard cost)
                        </SelectItem>
                        <SelectItem value="batch">
                          Batch (24h delay, 50% cost savings)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {stageConfig.stage === 'embeddings' && stageConfig.mode === 'batch' && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Batch mode processes embeddings overnight with 50% cost savings.
                        Results will be available within 24 hours.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cost Estimate */}
      <Card>
        <CardHeader>
          <CardTitle>Estimated Cost</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${calculateEstimatedCost().toFixed(4)}
          </div>
          <div className="text-sm text-muted-foreground">
            Based on selected stages and processing modes
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={startProcessing} disabled={loading || !stageConfigs.some(s => s.enabled)}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Start Processing
        </Button>
      </div>
    </div>
  );

  // Render processing step
  const renderProcessingStep = () => {
    if (!progress) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Starting processing...</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {progress.status === 'in_progress' && <Loader2 className="h-5 w-5 animate-spin" />}
                {progress.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                {progress.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
                {progress.status === 'paused' && <Pause className="h-5 w-5 text-yellow-600" />}
                Processing Progress
              </div>
              <Badge variant={
                progress.status === 'completed' ? 'default' :
                progress.status === 'failed' ? 'destructive' :
                progress.status === 'paused' ? 'secondary' : 'outline'
              }>
                {progress.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {progress.currentStage && `Current stage: ${progress.currentStage}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{progress.overallProgress.toFixed(1)}%</span>
              </div>
              <Progress value={progress.overallProgress} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Items Processed</div>
                <div className="text-lg font-semibold">
                  {progress.totalItemsProcessed} / {progress.totalItems}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost Accumulated</div>
                <div className="text-lg font-semibold font-mono">
                  ${progress.costAccumulated.toFixed(4)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Stage Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(progress.stageProgress).map(([stage, stageProgress]) => (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-medium capitalize">{stage}</div>
                    <Badge variant={
                      stageProgress.status === 'completed' ? 'default' :
                      stageProgress.status === 'failed' ? 'destructive' :
                      stageProgress.status === 'in_progress' ? 'outline' :
                      stageProgress.status === 'skipped' ? 'secondary' : 'outline'
                    }>
                      {stageProgress.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stageProgress.itemsProcessed} / {stageProgress.totalItems}
                  </div>
                </div>
                <Progress value={stageProgress.progress} />
                
                {stageProgress.errors.length > 0 && (
                  <div className="text-sm text-red-600">
                    {stageProgress.errors.length} error(s)
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Control Buttons */}
        <div className="flex justify-end gap-2">
          {progress.status === 'in_progress' && (
            <>
              <Button
                variant="outline"
                onClick={() => controlOperation('pause')}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button
                variant="destructive"
                onClick={() => controlOperation('cancel')}
              >
                <Square className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
          
          {progress.status === 'paused' && progress.canResume && (
            <Button onClick={() => controlOperation('resume')}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}

          {(progress.status === 'failed' || progress.status === 'paused') && progress.nextStage && (
            <Button
              variant="outline"
              onClick={() => controlOperation('resume', progress.nextStage)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Resume from {progress.nextStage}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Render complete step
  const renderCompleteStep = () => {
    if (!progress) return null;

    const success = progress.status === 'completed';
    const duration = progress.completedAt && progress.startedAt
      ? (new Date(progress.completedAt).getTime() - new Date(progress.startedAt).getTime()) / 1000
      : 0;

    return (
      <div className="space-y-6">
        <Alert variant={success ? "default" : "destructive"}>
          {success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>
            {success 
              ? 'Processing completed successfully!'
              : 'Processing failed. Check the stage details for errors.'
            }
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Summary Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Items Processed</div>
                <div className="text-2xl font-bold">{progress.totalItemsProcessed}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-2xl font-bold font-mono">${progress.costAccumulated.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tokens Used</div>
                <div className="text-2xl font-bold">{progress.tokensUsed.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Processing Time</div>
                <div className="text-2xl font-bold">{duration.toFixed(1)}s</div>
              </div>
            </div>

            {/* Stage Summary */}
            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-2">Stages Completed</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(progress.stageProgress).map(([stage, stageProgress]) => (
                  <Badge
                    key={stage}
                    variant={
                      stageProgress.status === 'completed' ? 'default' :
                      stageProgress.status === 'failed' ? 'destructive' :
                      stageProgress.status === 'skipped' ? 'secondary' : 'outline'
                    }
                  >
                    {stage}: {stageProgress.status}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {progress.errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Errors ({progress.errors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {progress.errors.map((err, idx) => (
                  <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                    <div className="font-semibold">{err.stage}: {err.itemTitle}</div>
                    <div className="text-red-700">{err.error}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={() => {
            onComplete?.(progress);
            onClose?.();
          }}>
            Done
          </Button>
        </div>
      </div>
    );
  };

  // Calculate estimated cost
  const calculateEstimatedCost = () => {
    const enabledStages = stageConfigs.filter(s => s.enabled);
    const baseCost = 0.01; // Base cost estimate
    
    return enabledStages.reduce((total, stage) => {
      const stageCost = baseCost * stage.costMultiplier;
      const modeCost = stage.mode === 'batch' ? stageCost * 0.5 : stageCost;
      return total + modeCost;
    }, 0);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Stage-Based Processing</CardTitle>
        <CardDescription>
          Process content with granular control over individual stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'config' && renderConfigStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'complete' && renderCompleteStep()}
      </CardContent>
    </Card>
  );
}

export default StageBasedProcessingPanel;