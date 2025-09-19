/**
 * Project Indexing Status Component
 * Shows indexing status and allows manual reindexing for admin users
 * Demonstrates integration with the ProjectIndexer service
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProjectIndexing } from '@/lib/hooks/use-project-indexing';

interface ProjectIndexingStatusProps {
  projectId: string;
  projectTitle: string;
  className?: string;
}

export function ProjectIndexingStatus({
  projectId,
  projectTitle,
  className = ''
}: ProjectIndexingStatusProps) {
  const [indexingStatus, setIndexingStatus] = useState<'idle' | 'indexing' | 'success' | 'error'>('idle');
  const [lastIndexed, setLastIndexed] = useState<Date | null>(null);
  const [indexStats, setIndexStats] = useState<{
    sectionsCount: number;
    mediaCount: number;
    keywords: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { manualIndexProject, getCacheStats } = useProjectIndexing({
    onIndexComplete: (id, success) => {
      if (id === projectId) {
        setIndexingStatus(success ? 'success' : 'error');
        if (success) {
          setLastIndexed(new Date());
          fetchIndexStats();
        }
      }
    },
    onIndexError: (id, err) => {
      if (id === projectId) {
        setError(err.message);
        setIndexingStatus('error');
      }
    }
  });

  // Fetch current index statistics
  const fetchIndexStats = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/index?includeSections=true&includeMedia=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIndexStats({
            sectionsCount: data.data.metadata?.sectionsCount || 0,
            mediaCount: data.data.metadata?.mediaItemsCount || 0,
            keywords: data.data.keywords || []
          });
          setLastIndexed(new Date(data.data.lastUpdated));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch index stats:', err);
    }
  };

  // Load initial stats
  useEffect(() => {
    fetchIndexStats();
  }, [projectId]);

  const handleManualIndex = async () => {
    setIndexingStatus('indexing');
    setError(null);
    
    const success = await manualIndexProject(projectId);
    if (!success) {
      setIndexingStatus('error');
    }
  };

  const getStatusBadge = () => {
    switch (indexingStatus) {
      case 'indexing':
        return <Badge variant="secondary">Indexing...</Badge>;
      case 'success':
        return <Badge variant="default">Indexed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">AI Indexing Status</CardTitle>
            <CardDescription>
              Project: {projectTitle}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Last Indexed:</span>
            <div className="text-muted-foreground">{formatDate(lastIndexed)}</div>
          </div>
          
          {indexStats && (
            <>
              <div>
                <span className="font-medium">Content Sections:</span>
                <div className="text-muted-foreground">{indexStats.sectionsCount}</div>
              </div>
              
              <div>
                <span className="font-medium">Media Items:</span>
                <div className="text-muted-foreground">{indexStats.mediaCount}</div>
              </div>
              
              <div>
                <span className="font-medium">Keywords:</span>
                <div className="text-muted-foreground">{indexStats.keywords.length}</div>
              </div>
            </>
          )}
        </div>

        {indexStats && indexStats.keywords.length > 0 && (
          <div>
            <span className="font-medium text-sm">Top Keywords:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {indexStats.keywords.slice(0, 8).map((keyword, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {keyword}
                </Badge>
              ))}
              {indexStats.keywords.length > 8 && (
                <Badge variant="outline" className="text-xs">
                  +{indexStats.keywords.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleManualIndex}
            disabled={indexingStatus === 'indexing'}
            size="sm"
          >
            {indexingStatus === 'indexing' ? 'Indexing...' : 'Reindex Project'}
          </Button>
          
          <Button
            onClick={fetchIndexStats}
            variant="outline"
            size="sm"
          >
            Refresh Status
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>
            AI indexing creates searchable summaries and extracts keywords from your project content.
            This helps the AI assistant provide better responses about your work.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Batch Indexing Component for multiple projects
 */
interface BatchIndexingProps {
  projectIds: string[];
  onComplete?: (results: any) => void;
  className?: string;
}

export function BatchIndexing({ projectIds, onComplete, className = '' }: BatchIndexingProps) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [results, setResults] = useState<any>(null);

  const handleBatchIndex = async () => {
    setIsIndexing(true);
    setProgress({ completed: 0, total: projectIds.length });
    setResults(null);

    try {
      const response = await fetch('/api/projects/index/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectIds,
          forceReindex: true,
          includeSections: true,
          includeMedia: true
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
        setProgress({ completed: data.data.statistics.successfulIndexes, total: projectIds.length });
        onComplete?.(data.data);
      } else {
        throw new Error(data.error?.message || 'Batch indexing failed');
      }
    } catch (error) {
      console.error('Batch indexing error:', error);
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Batch Project Indexing</CardTitle>
        <CardDescription>
          Index {projectIds.length} projects for AI context
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isIndexing && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{progress.completed} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {results && !results.error && (
          <Alert>
            <AlertDescription>
              Successfully indexed {results.statistics.successfulIndexes} projects.
              {results.statistics.failedIndexes > 0 && (
                <span className="text-red-600">
                  {' '}({results.statistics.failedIndexes} failed)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {results?.error && (
          <Alert variant="destructive">
            <AlertDescription>{results.error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleBatchIndex}
          disabled={isIndexing || projectIds.length === 0}
          className="w-full"
        >
          {isIndexing ? 'Indexing Projects...' : `Index ${projectIds.length} Projects`}
        </Button>
      </CardContent>
    </Card>
  );
}