'use client';

/**
 * Granular Processing Control Interface
 * 
 * Provides fine-grained control over stage-based processing operations.
 * Allows admins to select which stages to execute and processing modes.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Zap, 
  Moon, 
  DollarSign, 
  Clock, 
  Info,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { StageBasedProcessingPanel } from './stage-based-processing-panel';

interface ProcessingScope {
  type: 'all' | 'project' | 'section';
  projectId?: string;
  sectionId?: string;
  projectTitle?: string;
  sectionTitle?: string;
}

interface GranularProcessingControlProps {
  onStartProcessing?: (scope: ProcessingScope, stages: any[]) => void;
  onClose?: () => void;
}

interface StageOption {
  stage: string;
  name: string;
  description: string;
  enabled: boolean;
  mode: 'immediate' | 'batch';
  options: {
    quality?: 'fast' | 'balanced' | 'high';
    batchSize?: number;
    retryAttempts?: number;
    timeout?: number;
  };
  dependencies: string[];
  estimatedTime: {
    immediate: string;
    batch: string;
  };
  costMultiplier: {
    immediate: number;
    batch: number;
  };
}

const DEFAULT_STAGE_OPTIONS: StageOption[] = [
  {
    stage: 'chunking',
    name: 'Content Chunking',
    description: 'Parse content structure and create hierarchical chunks (T0-T3)',
    enabled: true,
    mode: 'immediate',
    options: {
      quality: 'balanced',
      batchSize: 10,
      retryAttempts: 3,
      timeout: 30
    },
    dependencies: [],
    estimatedTime: {
      immediate: '~10 seconds',
      batch: '~5 minutes'
    },
    costMultiplier: {
      immediate: 0,
      batch: 0
    }
  },
  {
    stage: 'summaries',
    name: 'AI Summary Generation',
    description: 'Generate AI-powered summaries for T1 and T2 tiers using configurable prompts',
    enabled: true,
    mode: 'immediate',
    options: {
      quality: 'balanced',
      batchSize: 5,
      retryAttempts: 2,
      timeout: 60
    },
    dependencies: ['chunking'],
    estimatedTime: {
      immediate: '~30 seconds',
      batch: '~10 minutes'
    },
    costMultiplier: {
      immediate: 0.7,
      batch: 0.7
    }
  },
  {
    stage: 'embeddings',
    name: 'Vector Embeddings',
    description: 'Generate vector embeddings for semantic search capabilities',
    enabled: true,
    mode: 'immediate',
    options: {
      quality: 'balanced',
      batchSize: 20,
      retryAttempts: 3,
      timeout: 120
    },
    dependencies: ['chunking'],
    estimatedTime: {
      immediate: '~20 seconds',
      batch: '~24 hours'
    },
    costMultiplier: {
      immediate: 0.3,
      batch: 0.15 // 50% savings with batch API
    }
  },
  {
    stage: 'validation',
    name: 'Validation & Storage',
    description: 'Validate chunk structure, relationships, and store in database',
    enabled: true,
    mode: 'immediate',
    options: {
      quality: 'high',
      batchSize: 50,
      retryAttempts: 1,
      timeout: 15
    },
    dependencies: ['chunking'],
    estimatedTime: {
      immediate: '~5 seconds',
      batch: '~2 minutes'
    },
    costMultiplier: {
      immediate: 0,
      batch: 0
    }
  }
];

export function GranularProcessingControl({
  onStartProcessing,
  onClose
}: GranularProcessingControlProps) {
  const [scope, setScope] = useState<ProcessingScope>({ type: 'project' });
  const [stageOptions, setStageOptions] = useState<StageOption[]>(DEFAULT_STAGE_OPTIONS);
  const [showProcessingPanel, setShowProcessingPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('stages');

  // Update stage option
  const updateStageOption = (stage: string, updates: Partial<StageOption>) => {
    setStageOptions(prev => prev.map(s => 
      s.stage === stage ? { ...s, ...updates } : s
    ));
  };

  // Update stage sub-option
  const updateStageSubOption = (stage: string, optionKey: string, value: any) => {
    setStageOptions(prev => prev.map(s => 
      s.stage === stage 
        ? { ...s, options: { ...s.options, [optionKey]: value } }
        : s
    ));
  };

  // Validate dependencies
  const validateDependencies = (): string[] => {
    const errors: string[] = [];
    const enabledStages = stageOptions.filter(s => s.enabled).map(s => s.stage);

    for (const stage of stageOptions) {
      if (stage.enabled) {
        for (const dependency of stage.dependencies) {
          if (!enabledStages.includes(dependency)) {
            errors.push(`${stage.name} requires ${dependency} to be enabled`);
          }
        }
      }
    }

    return errors;
  };

  // Calculate total cost estimate
  const calculateTotalCost = (): number => {
    const baseCost = 0.01; // Base cost per project
    return stageOptions
      .filter(s => s.enabled)
      .reduce((total, stage) => {
        const multiplier = stage.costMultiplier[stage.mode];
        return total + (baseCost * multiplier);
      }, 0);
  };

  // Calculate total time estimate
  const calculateTotalTime = (): string => {
    const enabledStages = stageOptions.filter(s => s.enabled);
    const hasImmediateStages = enabledStages.some(s => s.mode === 'immediate');
    const hasBatchStages = enabledStages.some(s => s.mode === 'batch');

    if (hasBatchStages && hasImmediateStages) {
      return '~1-2 minutes + 24 hours (batch)';
    } else if (hasBatchStages) {
      return '~24 hours (batch processing)';
    } else {
      const totalSeconds = enabledStages.reduce((total, stage) => {
        const timeStr = stage.estimatedTime.immediate;
        const seconds = parseInt(timeStr.match(/\d+/)?.[0] || '0');
        return total + seconds;
      }, 0);
      return `~${totalSeconds} seconds`;
    }
  };

  // Start processing
  const handleStartProcessing = () => {
    const validationErrors = validateDependencies();
    if (validationErrors.length > 0) {
      alert(`Validation errors:\n${validationErrors.join('\n')}`);
      return;
    }

    setShowProcessingPanel(true);
  };

  // Render scope selection
  const renderScopeSelection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Processing Scope</CardTitle>
        <CardDescription>
          Select what content to process
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Scope Type</Label>
          <Select
            value={scope.type}
            onValueChange={(value: 'all' | 'project' | 'section') =>
              setScope({ ...scope, type: value })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="project">Single Project</SelectItem>
              <SelectItem value="section">Specific Section</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope.type === 'project' && (
          <div>
            <Label>Project ID</Label>
            <Input
              value={scope.projectId || ''}
              onChange={(e) => setScope({ ...scope, projectId: e.target.value })}
              placeholder="Enter project ID or slug"
              className="mt-1"
            />
          </div>
        )}

        {scope.type === 'section' && (
          <>
            <div>
              <Label>Project ID</Label>
              <Input
                value={scope.projectId || ''}
                onChange={(e) => setScope({ ...scope, projectId: e.target.value })}
                placeholder="Enter project ID or slug"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Section ID</Label>
              <Input
                value={scope.sectionId || ''}
                onChange={(e) => setScope({ ...scope, sectionId: e.target.value })}
                placeholder="Enter section ID"
                className="mt-1"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  // Render stage configuration
  const renderStageConfiguration = () => (
    <div className="space-y-4">
      {stageOptions.map((stage) => (
        <Card key={stage.stage}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={stage.enabled}
                  onCheckedChange={(checked) => 
                    updateStageOption(stage.stage, { enabled: !!checked })
                  }
                />
                <div>
                  <CardTitle className="text-base">{stage.name}</CardTitle>
                  <CardDescription>{stage.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {stage.estimatedTime[stage.mode]}
                </Badge>
                <Badge variant={stage.mode === 'batch' ? 'secondary' : 'default'}>
                  {stage.mode}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          {stage.enabled && (
            <CardContent className="space-y-4">
              {/* Processing Mode */}
              <div>
                <Label>Processing Mode</Label>
                <Select
                  value={stage.mode}
                  onValueChange={(value: 'immediate' | 'batch') =>
                    updateStageOption(stage.stage, { mode: value })
                  }
                >
                  <SelectTrigger className="mt-1">
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
                        <span>Batch Processing</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {stage.mode === 'batch' && stage.stage === 'embeddings' && (
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Batch mode offers 50% cost savings but takes up to 24 hours to complete.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Quality Setting */}
              <div>
                <Label>Quality Level</Label>
                <Select
                  value={stage.options.quality}
                  onValueChange={(value: 'fast' | 'balanced' | 'high') =>
                    updateStageSubOption(stage.stage, 'quality', value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast (lower accuracy)</SelectItem>
                    <SelectItem value="balanced">Balanced (recommended)</SelectItem>
                    <SelectItem value="high">High (slower, more accurate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Batch Size */}
              <div>
                <Label>Batch Size: {stage.options.batchSize}</Label>
                <Slider
                  value={[stage.options.batchSize || 10]}
                  onValueChange={([value]) => 
                    updateStageSubOption(stage.stage, 'batchSize', value)
                  }
                  min={1}
                  max={50}
                  step={1}
                  className="mt-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Number of items to process in each batch
                </div>
              </div>

              {/* Retry Attempts */}
              <div>
                <Label>Retry Attempts</Label>
                <Input
                  type="number"
                  value={stage.options.retryAttempts}
                  onChange={(e) => 
                    updateStageSubOption(stage.stage, 'retryAttempts', parseInt(e.target.value))
                  }
                  min={0}
                  max={5}
                  className="mt-1"
                />
              </div>

              {/* Dependencies */}
              {stage.dependencies.length > 0 && (
                <div>
                  <Label>Dependencies</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stage.dependencies.map(dep => (
                      <Badge key={dep} variant="outline" className="text-xs">
                        {dep}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );

  // Render cost and time estimates
  const renderEstimates = () => {
    const totalCost = calculateTotalCost();
    const totalTime = calculateTotalTime();
    const validationErrors = validateDependencies();

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Cost Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalCost.toFixed(4)}</div>
            <div className="text-sm text-muted-foreground">
              Based on selected stages and processing modes
            </div>
            
            <div className="mt-4 space-y-2">
              {stageOptions.filter(s => s.enabled).map(stage => (
                <div key={stage.stage} className="flex justify-between text-sm">
                  <span>{stage.name}</span>
                  <span className="font-mono">
                    ${(0.01 * stage.costMultiplier[stage.mode]).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTime}</div>
            <div className="text-sm text-muted-foreground">
              Estimated processing time
            </div>
          </CardContent>
        </Card>

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Validation Errors:</div>
              <ul className="list-disc list-inside mt-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validationErrors.length === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Configuration is valid and ready for processing.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  if (showProcessingPanel) {
    return (
      <StageBasedProcessingPanel
        scope={scope.type}
        projectId={scope.projectId}
        sectionId={scope.sectionId}
        projectTitle={scope.projectTitle}
        sectionTitle={scope.sectionTitle}
        onComplete={(result) => {
          onStartProcessing?.(scope, stageOptions);
          setShowProcessingPanel(false);
        }}
        onClose={() => setShowProcessingPanel(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {renderScopeSelection()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="estimates">Estimates</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Stages</CardTitle>
              <CardDescription>
                Configure which stages to execute and their processing modes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderStageConfiguration()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estimates" className="space-y-4">
          {renderEstimates()}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Options</CardTitle>
              <CardDescription>
                Fine-tune processing behavior and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Advanced options are configured per-stage in the Stages tab.
                  Use these settings to optimize performance and reliability.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleStartProcessing}
          disabled={
            !stageOptions.some(s => s.enabled) || 
            validateDependencies().length > 0 ||
            (scope.type === 'project' && !scope.projectId) ||
            (scope.type === 'section' && (!scope.projectId || !scope.sectionId))
          }
        >
          Start Processing
        </Button>
      </div>
    </div>
  );
}

export default GranularProcessingControl;