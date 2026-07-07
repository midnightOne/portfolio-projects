'use client';

/**
 * Project Semantic Manager
 * 
 * Provides comprehensive semantic content management for individual projects:
 * - Individual stage processing buttons (chunking, summaries, embeddings)
 * - Full processing loop
 * - Job queue monitoring with progress tracking
 * - Cancel/pause operations
 * - Real-time updates via SSE
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Package,
  Activity,
  Database,
  FileText,
  Hash,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SemanticTreeView } from './semantic-tree-view';
import { ProcessingProgress, ProcessingStage, StageConfig } from '@/lib/content/StageBasedProcessingService';

interface ProjectSemanticManagerProps {
  projectId: string;
}

interface JobQueueItem {
  operationId: string;
  type: 'full' | 'chunking' | 'summaries' | 'embeddings' | 'validation';
  status: 'queued' | 'in_progress' | 'paused' | 'completed' | 'failed';
  progress: ProcessingProgress | null;
  startedAt: Date;
  estimatedDuration: string;
  stages: ProcessingStage[];
}

interface ProjectInfo {
  id: string;
  title: string;
  slug: string;
  hasSemanticContent: boolean;
  lastProcessed?: Date;
  chunkCount: number;
  tierDistribution: Record<number, number>;
}

export function ProjectSemanticManager({ projectId }: ProjectSemanticManagerProps) {
  // State management
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingVectors, setVerifyingVectors] = useState(false);
  const [vectorVerificationResult, setVectorVerificationResult] = useState<{
    totalChunks: number;
    chunksWithVectors: number;
    chunksWithoutVectors: number;
    percentageWithVectors: number;
  } | null>(null);

  // Fetch project information
  useEffect(() => {
    fetchProjectInfo();
    fetchJobQueue();
    
    // Auto-refresh job queue every 2 seconds for better responsiveness
    const interval = setInterval(fetchJobQueue, 2000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Auto-remove completed jobs after 30 seconds (disabled to prevent flashing)
  // Users can manually remove jobs using the trash button
  // useEffect(() => {
  //   const completedJobs = jobQueue.filter(job => 
  //     job.status === 'completed' || job.status === 'failed'
  //   );
  //   
  //   completedJobs.forEach(job => {
  //     if (job.progress?.completedAt) {
  //       const completedTime = new Date(job.progress.completedAt).getTime();
  //       const now = Date.now();
  //       const timeSinceCompletion = now - completedTime;
  //       
  //       // Auto-remove after 30 seconds
  //       if (timeSinceCompletion > 30000) {
  //         setTimeout(() => removeJob(job.operationId), 1000);
  //       }
  //     }
  //   });
  // }, [jobQueue]);

  const fetchProjectInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/semantic/projects/${projectId}/info`);
      if (!response.ok) throw new Error('Failed to fetch project info');
      
      const data = await response.json();
      setProjectInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project info');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobQueue = async () => {
    try {
      const response = await fetch(`/api/admin/semantic/processing/queue?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setJobQueue(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch job queue:', err);
    }
  };

  const verifyVectors = async () => {
    setVerifyingVectors(true);
    setVectorVerificationResult(null);
    
    try {
      const response = await fetch(`/api/admin/semantic/projects/${projectId}/verify-vectors`);
      if (!response.ok) {
        throw new Error(`Failed to verify vectors: ${response.statusText}`);
      }
      
      const data = await response.json();
      setVectorVerificationResult({
        totalChunks: data.totalChunks,
        chunksWithVectors: data.chunksWithVectors,
        chunksWithoutVectors: data.chunksWithoutVectors,
        percentageWithVectors: data.percentageWithVectors
      });
    } catch (err) {
      console.error('Failed to verify vectors:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setVerifyingVectors(false);
    }
  };

  // Start processing operations
  const startProcessing = async (type: 'full' | 'chunking' | 'summaries' | 'embeddings' | 'validation') => {
    try {
      const stageConfigs = getStageConfigsForType(type);
      
      const response = await fetch('/api/admin/semantic/processing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'project',
          projectId,
          stages: stageConfigs
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start processing');
      }

      const result = await response.json();
      
      // Add to job queue
      const newJob: JobQueueItem = {
        operationId: result.operationId,
        type,
        status: 'queued',
        progress: null,
        startedAt: new Date(),
        estimatedDuration: getEstimatedDuration(type),
        stages: stageConfigs.map(s => s.stage)
      };

      setJobQueue(prev => [...prev, newJob]);
      
      // Start monitoring this job
      monitorJob(result.operationId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
  };

  // Get stage configurations for different processing types
  const getStageConfigsForType = (type: string): StageConfig[] => {
    const baseConfigs: StageConfig[] = [
      { stage: 'chunking', enabled: false, mode: 'immediate' },
      { stage: 'summaries', enabled: false, mode: 'immediate' },
      { stage: 'embeddings', enabled: false, mode: 'immediate' },
      { stage: 'validation', enabled: false, mode: 'immediate' }
    ];

    switch (type) {
      case 'full':
        return baseConfigs.map(c => ({ ...c, enabled: true }));
      case 'chunking':
        return baseConfigs.map(c => ({ 
          ...c, 
          enabled: c.stage === 'chunking' || c.stage === 'validation' // Validation saves chunks to DB
        }));
      case 'summaries':
        return baseConfigs.map(c => ({ 
          ...c, 
          enabled: c.stage === 'summaries' || c.stage === 'validation' 
        }));
      case 'embeddings':
        return baseConfigs.map(c => ({ 
          ...c, 
          enabled: c.stage === 'embeddings' || c.stage === 'validation',
          mode: 'immediate' // Use immediate mode for embeddings (batch not fully implemented yet)
        }));
      case 'validation':
        return baseConfigs.map(c => ({ 
          ...c, 
          enabled: c.stage === 'validation' 
        }));
      default:
        return baseConfigs;
    }
  };

  // Get estimated duration for processing type
  const getEstimatedDuration = (type: string): string => {
    switch (type) {
      case 'full': return '~2-3 minutes';
      case 'chunking': return '~2-5 seconds';
      case 'summaries': return '~30 seconds';
      case 'embeddings': return '~10-20 seconds';
      case 'validation': return '~5 seconds';
      default: return '~1 minute';
    }
  };

  // Monitor job progress
  const monitorJob = useCallback((operationId: string) => {
    console.log(`Starting SSE monitoring for job: ${operationId}`);
    const eventSource = new EventSource(
      `/api/admin/semantic/processing/${operationId}?sse=true`
    );

    eventSource.onmessage = (event) => {
      try {
        const progressData: ProcessingProgress = JSON.parse(event.data);
        console.log(`Progress update for ${operationId}:`, progressData.status, `${progressData.overallProgress}%`);
        
        // Update job in queue
        setJobQueue(prev => prev.map(job => 
          job.operationId === operationId 
            ? { 
                ...job, 
                status: progressData.status as any,
                progress: progressData 
              }
            : job
        ));

        if (progressData.status === 'completed' || progressData.status === 'failed') {
          console.log(`Job ${operationId} ${progressData.status}`);
          eventSource.close();
          // Refresh project info after completion
          if (progressData.status === 'completed') {
            setTimeout(fetchProjectInfo, 2000);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error for job', operationId, error);
      eventSource.close();
      // Fallback to polling
      console.log('Falling back to polling for job:', operationId);
      pollJobProgress(operationId);
    };

    return () => eventSource.close();
  }, []);

  // Fallback polling for progress
  const pollJobProgress = useCallback((operationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/semantic/processing/${operationId}`);
        if (response.ok) {
          const progressData: ProcessingProgress = await response.json();
          setJobQueue(prev => prev.map(job => 
            job.operationId === operationId 
              ? { 
                  ...job, 
                  status: progressData.status as any,
                  progress: progressData 
                }
              : job
          ));

          if (progressData.status === 'completed' || progressData.status === 'failed') {
            clearInterval(pollInterval);
            if (progressData.status === 'completed') {
              setTimeout(fetchProjectInfo, 2000);
            }
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 2000);

    // Clean up after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  }, []);

  // Control job operations
  const controlJob = async (operationId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`/api/admin/semantic/processing/${operationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} job`);
      }

      // Update job status locally
      setJobQueue(prev => prev.map(job => 
        job.operationId === operationId 
          ? { 
              ...job, 
              status: action === 'cancel' ? 'failed' : action === 'pause' ? 'paused' : 'in_progress'
            }
          : job
      ));

    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`);
    }
  };

  // Remove completed/failed jobs from queue
  const removeJob = (operationId: string) => {
    setJobQueue(prev => prev.filter(job => job.operationId !== operationId));
  };

  // Cleanup all semantic content for the project
  const cleanupSemanticContent = async () => {
    if (!confirm(
      'Are you sure you want to delete ALL semantic content for this project?\n\n' +
      'This will permanently remove:\n' +
      '• All chunks (T0, T1, T2, T3)\n' +
      '• All embeddings\n' +
      '• All summaries\n' +
      '• Processing history\n\n' +
      'This action cannot be undone!'
    )) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/semantic/projects/${projectId}/cleanup`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cleanup semantic content');
      }

      const result = await response.json();
      console.log('Cleanup result:', result);

      // Refresh project info to show updated state
      await fetchProjectInfo();

      // Show success message
      alert(
        `Semantic content cleaned up successfully!\n\n` +
        `Deleted:\n` +
        `• ${result.deletedChunks} chunks\n` +
        `• ${result.deletedEntities} content entities\n` +
        `• ${result.deletedAIIndexes} AI indexes\n` +
        `• ${result.deletedOperations} operations\n\n` +
        `You can now generate fresh semantic content.`
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup semantic content');
    } finally {
      setLoading(false);
    }
  };

  // Get status badge for job
  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Queued
        </Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>;
      case 'paused':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Pause className="h-3 w-3" />
          Paused
        </Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get processing type icon
  const getProcessingTypeIcon = (type: string) => {
    switch (type) {
      case 'full': return <Activity className="h-4 w-4" />;
      case 'chunking': return <Package className="h-4 w-4" />;
      case 'summaries': return <FileText className="h-4 w-4" />;
      case 'embeddings': return <Hash className="h-4 w-4" />;
      case 'validation': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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

  if (!projectInfo) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Project not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {projectInfo.title}
          </CardTitle>
          <CardDescription>
            Project ID: {projectInfo.id} • Slug: {projectInfo.slug}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Chunks</div>
              <div className="text-2xl font-bold">{projectInfo.chunkCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Has Content</div>
              <div className="text-2xl font-bold">
                {projectInfo.hasSemanticContent ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Processed</div>
              <div className="text-sm">
                {projectInfo.lastProcessed 
                  ? formatDistanceToNow(new Date(projectInfo.lastProcessed), { addSuffix: true })
                  : 'Never'
                }
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tier Distribution</div>
              <div className="flex gap-1">
                {Object.entries(projectInfo.tierDistribution).map(([tier, count]) => (
                  <Badge key={tier} variant="outline" className="text-xs">
                    T{tier}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          {/* Vector Verification */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Database Vectors</div>
              <div className="text-xs text-muted-foreground">Verify actual embedding vectors in database</div>
            </div>
            <Button
              onClick={verifyVectors}
              variant="outline"
              size="sm"
              disabled={verifyingVectors}
            >
              {verifyingVectors ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Verify Vectors
                </>
              )}
            </Button>
          </div>
          
          {vectorVerificationResult && (
            <Alert className={vectorVerificationResult.percentageWithVectors === 100 ? "border-green-500" : "border-yellow-500"}>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-medium">
                    <span>Vector Status:</span>
                    <Badge variant={vectorVerificationResult.percentageWithVectors === 100 ? "default" : "outline"}>
                      {vectorVerificationResult.chunksWithVectors} / {vectorVerificationResult.totalChunks} ({vectorVerificationResult.percentageWithVectors}%)
                    </Badge>
                  </div>
                  {vectorVerificationResult.chunksWithoutVectors > 0 && (
                    <div className="text-sm text-muted-foreground">
                      ⚠️ {vectorVerificationResult.chunksWithoutVectors} chunk(s) missing embeddings
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Processing Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Controls</CardTitle>
          <CardDescription>
            Start individual processing stages or run the full processing loop
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Individual Stage Buttons */}
          <div>
            <div className="text-sm font-medium mb-2">Individual Stages</div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => startProcessing('chunking')}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Package className="h-4 w-4" />
                Generate Chunks
              </Button>
              <Button
                onClick={() => startProcessing('summaries')}
                className="flex items-center gap-2"
                variant="outline"
              >
                <FileText className="h-4 w-4" />
                Generate Summaries
              </Button>
              <Button
                onClick={() => startProcessing('embeddings')}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Hash className="h-4 w-4" />
                Generate Embeddings
              </Button>
              <Button
                onClick={() => startProcessing('validation')}
                className="flex items-center gap-2"
                variant="outline"
              >
                <CheckCircle2 className="h-4 w-4" />
                Validate & Store
              </Button>
            </div>
          </div>

          <Separator />

          {/* Full Processing */}
          <div>
            <div className="text-sm font-medium mb-2">Complete Processing</div>
            <Button
              onClick={() => startProcessing('full')}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Full Processing Loop
            </Button>
          </div>

          <Separator />

          {/* Cleanup Section */}
          <div>
            <div className="text-sm font-medium mb-2 text-red-600">Danger Zone</div>
            <div className="text-xs text-muted-foreground mb-2">
              Permanently delete all semantic content to start fresh
            </div>
            <Button
              onClick={cleanupSemanticContent}
              variant="destructive"
              className="flex items-center gap-2"
              disabled={loading}
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Cleaning up...' : 'Delete All Semantic Content'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Queue */}
      {jobQueue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Processing Queue ({jobQueue.length})
            </CardTitle>
            <CardDescription>
              Current and queued processing operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobQueue.map((job) => (
                <div key={job.operationId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getProcessingTypeIcon(job.type)}
                      <span className="font-medium capitalize">{job.type} Processing</span>
                      {getJobStatusBadge(job.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'in_progress' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => controlJob(job.operationId, 'pause')}
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => controlJob(job.operationId, 'cancel')}
                          >
                            <Square className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {job.status === 'paused' && (
                        <Button
                          size="sm"
                          onClick={() => controlJob(job.operationId, 'resume')}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      {(job.status === 'completed' || job.status === 'failed') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeJob(job.operationId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-2">
                    Started: {formatDistanceToNow(job.startedAt, { addSuffix: true })} • 
                    Estimated: {job.estimatedDuration} • 
                    Stages: {job.stages.join(', ')}
                  </div>

                  {job.progress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Overall Progress</span>
                        <span>{job.progress.overallProgress.toFixed(1)}%</span>
                      </div>
                      <Progress value={job.progress.overallProgress} />
                      
                      {job.progress.currentStage && (
                        <div className="text-sm text-muted-foreground">
                          Current stage: {job.progress.currentStage}
                        </div>
                      )}

                      {/* Show detailed progress for current stage */}
                      {job.progress.currentStage && job.progress.stageProgress[job.progress.currentStage] && (
                        <div className="text-xs text-muted-foreground">
                          {job.progress.stageProgress[job.progress.currentStage].itemsProcessed} / {job.progress.stageProgress[job.progress.currentStage].totalItems} items processed
                        </div>
                      )}

                      {/* Show cost and tokens if available */}
                      {(job.progress.costAccumulated > 0 || job.progress.tokensUsed > 0) && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          {job.progress.costAccumulated > 0 && (
                            <span>Cost: ${job.progress.costAccumulated.toFixed(4)}</span>
                          )}
                          {job.progress.tokensUsed > 0 && (
                            <span>Tokens: {job.progress.tokensUsed.toLocaleString()}</span>
                          )}
                        </div>
                      )}

                      {job.progress.errors.length > 0 && (
                        <div className="text-sm text-red-600">
                          {job.progress.errors.length} error(s) occurred
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tree">Semantic Tree</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Overview</CardTitle>
              <CardDescription>
                Summary of semantic content processing for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Use the processing controls above to generate or regenerate semantic content.
                Monitor progress in the job queue section.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tree" className="space-y-4">
          <SemanticTreeView projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectSemanticManager;