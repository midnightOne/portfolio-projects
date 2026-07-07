'use client';

/**
 * Semantic Regeneration Workflow Component
 * 
 * Provides comprehensive UI for semantic content regeneration:
 * - Cost estimation modal with detailed breakdown
 * - Batch mode selection with cost comparison
 * - Processing time estimates for both modes
 * - Confirmation dialog for expensive operations
 * - Real-time progress tracking with SSE
 * - Regeneration summary report
 * - Error handling and retry UI
 * - Budget check before starting
 * - Operation cancellation
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Zap, Moon } from 'lucide-react';

export interface RegenerationScope {
  type: 'all' | 'project' | 'section';
  projectId?: string;
  sectionId?: string;
  projectTitle?: string;
  sectionTitle?: string;
}

export interface RegenerationEstimate {
  scope: string;
  projectsAffected: number;
  sectionsAffected: number;
  chunksAffected: number;
  estimatedTokens: number;
  estimatedCost: number;
  breakdown: {
    embeddingCost: number;
    summarizationCost: number;
  };
  preservedSections: number;
  regeneratedSections: number;
}

export interface BatchModeOption {
  mode: 'immediate' | 'batch';
  cost: number;
  processingTime: string;
  savings?: number;
  savingsPercent?: number;
}

export interface RegenerationProgress {
  operationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: {
    sectionsProcessed: number;
    totalSections: number;
    chunksProcessed: number;
    tokensUsed: number;
    costAccumulated: number;
    percentComplete: number;
  };
  currentSection?: string;
  errors: Array<{
    sectionId: string;
    sectionTitle: string;
    error: string;
    retryable: boolean;
  }>;
  startedAt: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
}

interface SemanticRegenerationWorkflowProps {
  scope: RegenerationScope;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
}

export function SemanticRegenerationWorkflow({
  scope,
  onComplete,
  onCancel
}: SemanticRegenerationWorkflowProps) {
  // State management
  const [step, setStep] = useState<'estimate' | 'confirm' | 'progress' | 'complete'>('estimate');
  const [estimate, setEstimate] = useState<RegenerationEstimate | null>(null);
  const [batchMode, setBatchMode] = useState<'immediate' | 'batch'>('immediate');
  const [batchOptions, setBatchOptions] = useState<BatchModeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RegenerationProgress | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);

  // Fetch cost estimation on mount
  useEffect(() => {
    fetchEstimate();
  }, [scope]);

  // Fetch cost estimation
  const fetchEstimate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/semantic/regenerate/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: scope.type,
          projectId: scope.projectId,
          sectionId: scope.sectionId
        })
      });

      if (!response.ok) {
        // Try to parse error as JSON, fallback to text
        let errorMessage = 'Failed to fetch estimate';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Parse response as JSON
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Empty response from server');
      }
      
      const estimateData: RegenerationEstimate = JSON.parse(responseText);
      setEstimate(estimateData);

      // Calculate batch mode options
      const immediateCost = estimateData.estimatedCost;
      const batchCost = immediateCost * 0.5; // 50% savings
      const savings = immediateCost - batchCost;

      setBatchOptions([
        {
          mode: 'immediate',
          cost: immediateCost,
          processingTime: '~30 seconds',
          savings: 0,
          savingsPercent: 0
        },
        {
          mode: 'batch',
          cost: batchCost,
          processingTime: '~24 hours',
          savings,
          savingsPercent: 50
        }
      ]);

      // Check budget
      const budgetResponse = await fetch('/api/admin/semantic/budget');
      if (budgetResponse.ok) {
        const budgetData = await budgetResponse.json();
        if (budgetData.remainingFunds < immediateCost) {
          setBudgetWarning(
            `Insufficient budget. Required: $${immediateCost.toFixed(4)}, Available: $${budgetData.remainingFunds.toFixed(2)}`
          );
        } else if (budgetData.warningLevel === 'warning' || budgetData.warningLevel === 'critical') {
          setBudgetWarning(
            `Budget ${(budgetData.percentUsed * 100).toFixed(1)}% depleted. Consider allocating more funds.`
          );
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch estimate');
    } finally {
      setLoading(false);
    }
  };

  // Start regeneration
  const startRegeneration = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/semantic/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: scope.type,
          projectId: scope.projectId,
          sectionId: scope.sectionId,
          preserveManualEdits: true,
          batchMode: batchMode === 'batch'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start regeneration');
      }

      const result = await response.json();
      setOperationId(result.operationId);
      setStep('progress');

      // Start progress tracking
      trackProgress(result.operationId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start regeneration');
    } finally {
      setLoading(false);
    }
  };

  // Track progress with SSE
  const trackProgress = (opId: string) => {
    const eventSource = new EventSource(
      `/api/admin/semantic/regenerate/${opId}?sse=true`
    );

    eventSource.onmessage = (event) => {
      const progressData: RegenerationProgress = JSON.parse(event.data);
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
  };

  // Fallback polling
  const pollProgress = async (opId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/semantic/regenerate/${opId}`);
        if (response.ok) {
          const progressData: RegenerationProgress = await response.json();
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

  // Render estimation step
  const renderEstimateStep = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Calculating cost estimate...</span>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (!estimate) return null;

    const selectedOption = batchOptions.find(opt => opt.mode === batchMode);

    return (
      <div className="space-y-6">
        {/* Scope Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Regeneration Scope</CardTitle>
            <CardDescription>
              {scope.type === 'all' && 'Regenerate all projects'}
              {scope.type === 'project' && `Regenerate project: ${scope.projectTitle || scope.projectId}`}
              {scope.type === 'section' && `Regenerate section: ${scope.sectionTitle || scope.sectionId}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Projects Affected</div>
                <div className="text-2xl font-bold">{estimate.projectsAffected}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sections to Regenerate</div>
                <div className="text-2xl font-bold">{estimate.regeneratedSections}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sections Preserved</div>
                <div className="text-2xl font-bold text-green-600">{estimate.preservedSections}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Chunks Affected</div>
                <div className="text-2xl font-bold">{estimate.chunksAffected}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Embedding Generation</span>
              <span className="font-mono">${estimate.breakdown.embeddingCost.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">AI Summarization</span>
              <span className="font-mono">${estimate.breakdown.summarizationCost.toFixed(4)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center font-bold">
              <span>Total Estimated Cost</span>
              <span className="font-mono">${estimate.estimatedCost.toFixed(4)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Estimated tokens: {estimate.estimatedTokens.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Batch Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Mode</CardTitle>
            <CardDescription>
              Choose between immediate processing or scheduled batch processing with 50% cost savings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={batchMode} onValueChange={(value: 'immediate' | 'batch') => setBatchMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Immediate Processing</span>
                  </div>
                </SelectItem>
                <SelectItem value="batch">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    <span>Batch Processing (50% savings)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {selectedOption && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Cost</div>
                  <div className="font-mono font-bold">${selectedOption.cost.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Processing Time</div>
                  <div className="font-semibold">{selectedOption.processingTime}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Savings</div>
                  <div className="font-bold text-green-600">
                    {selectedOption.savings ? `$${selectedOption.savings.toFixed(4)} (${selectedOption.savingsPercent}%)` : '-'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Warning */}
        {budgetWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{budgetWarning}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={() => setStep('confirm')}
            disabled={!!budgetWarning && budgetWarning.includes('Insufficient')}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  };

  // Render confirmation step
  const renderConfirmStep = () => {
    if (!estimate) return null;

    const selectedOption = batchOptions.find(opt => opt.mode === batchMode);
    const isExpensive = estimate.estimatedCost > 1.0; // More than $1

    return (
      <div className="space-y-6">
        <Alert variant={isExpensive ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isExpensive 
              ? `This operation will cost $${selectedOption?.cost.toFixed(4)}. Please confirm you want to proceed.`
              : 'Please confirm you want to start the regeneration process.'
            }
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Confirmation Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Scope</span>
              <span className="font-semibold">{scope.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sections to Regenerate</span>
              <span className="font-semibold">{estimate.regeneratedSections}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Processing Mode</span>
              <Badge variant={batchMode === 'batch' ? 'secondary' : 'default'}>
                {batchMode === 'immediate' ? 'Immediate' : 'Batch (24h)'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Estimated Cost</span>
              <span className="font-mono font-bold">${selectedOption?.cost.toFixed(4)}</span>
            </div>
            {batchMode === 'batch' && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Savings</span>
                <span className="font-bold text-green-600">${selectedOption?.savings?.toFixed(4)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setStep('estimate')}>
            Back
          </Button>
          <Button onClick={startRegeneration} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Start
          </Button>
        </div>
      </div>
    );
  };

  // Render progress step
  const renderProgressStep = () => {
    if (!progress) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Starting regeneration...</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {progress.status === 'in_progress' && <Loader2 className="h-5 w-5 animate-spin" />}
              {progress.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {progress.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
              Regeneration Progress
            </CardTitle>
            <CardDescription>
              {progress.currentSection && `Processing: ${progress.currentSection}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{progress.progress.percentComplete.toFixed(1)}%</span>
              </div>
              <Progress value={progress.progress.percentComplete} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Sections Processed</div>
                <div className="text-lg font-semibold">
                  {progress.progress.sectionsProcessed} / {progress.progress.totalSections}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Chunks Processed</div>
                <div className="text-lg font-semibold">{progress.progress.chunksProcessed}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tokens Used</div>
                <div className="text-lg font-semibold">{progress.progress.tokensUsed.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost Accumulated</div>
                <div className="text-lg font-semibold font-mono">${progress.progress.costAccumulated.toFixed(4)}</div>
              </div>
            </div>

            {progress.estimatedTimeRemaining && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Estimated time remaining: {Math.ceil(progress.estimatedTimeRemaining / 1000)}s</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Errors */}
        {progress.errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {progress.errors.map((err, idx) => (
                  <Alert key={idx} variant="destructive">
                    <AlertDescription>
                      <div className="font-semibold">{err.sectionTitle}</div>
                      <div className="text-sm">{err.error}</div>
                      {err.retryable && (
                        <Badge variant="outline" className="mt-1">Retryable</Badge>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
              ? 'Regeneration completed successfully!'
              : 'Regeneration failed. Please review the errors below.'
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
                <div className="text-sm text-muted-foreground">Sections Processed</div>
                <div className="text-2xl font-bold">{progress.progress.sectionsProcessed}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Chunks Created</div>
                <div className="text-2xl font-bold">{progress.progress.chunksProcessed}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Tokens</div>
                <div className="text-2xl font-bold">{progress.progress.tokensUsed.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-2xl font-bold font-mono">${progress.progress.costAccumulated.toFixed(4)}</div>
              </div>
            </div>

            {duration > 0 && (
              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground">Processing Time</div>
                <div className="text-lg font-semibold">{duration.toFixed(1)}s</div>
              </div>
            )}
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
                    <div className="font-semibold">{err.sectionTitle}</div>
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
          }}>
            Done
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel?.()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Semantic Content Regeneration</DialogTitle>
          <DialogDescription>
            {step === 'estimate' && 'Review cost estimation and select processing mode'}
            {step === 'confirm' && 'Confirm regeneration operation'}
            {step === 'progress' && 'Regeneration in progress'}
            {step === 'complete' && 'Regeneration complete'}
          </DialogDescription>
        </DialogHeader>

        {step === 'estimate' && renderEstimateStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'progress' && renderProgressStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
