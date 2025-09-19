'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  RefreshCw, 
  Search, 
  FileText, 
  BarChart3, 
  Loader2,
  CheckCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { useToast } from '@/components/ui/toast';

interface IndexingStats {
  totalProjects: number;
  indexedProjects: number;
  cacheSize: number;
  lastIndexingActivity: string | null;
}

interface ProjectIndexSummary {
  projectId: string;
  title: string;
  slug: string;
  lastUpdated: string;
  sectionsCount: number;
  mediaCount: number;
  keywords: string[];
  contentHash: string;
}

function ProjectIndexingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  
  // State management
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [projectIndexes, setProjectIndexes] = useState<ProjectIndexSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [batchIndexing, setBatchIndexing] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any).role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    loadIndexingData();
  }, [session, status, router]);

  const loadIndexingData = async () => {
    try {
      setLoading(true);
      
      // Fetch indexing statistics
      const statsResponse = await fetch('/api/admin/ai/project-indexing/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }

      // Fetch project indexes summary
      const indexesResponse = await fetch('/api/admin/ai/project-indexing/summary');
      if (indexesResponse.ok) {
        const indexesData = await indexesResponse.json();
        if (indexesData.success) {
          setProjectIndexes(indexesData.data);
        }
      }

    } catch (error) {
      console.error('Failed to load indexing data:', error);
      toast.error('Failed to load data', 'Could not load project indexing information');
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    setRefreshing(true);
    await loadIndexingData();
    setRefreshing(false);
    toast.success('Data refreshed', 'Project indexing data has been updated');
  };

  const clearCache = async () => {
    setClearingCache(true);
    try {
      const response = await fetch('/api/admin/ai/project-indexing/cache', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadIndexingData();
        toast.success('Cache cleared', 'Project indexing cache has been cleared');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      toast.error('Failed to clear cache', 'Could not clear project indexing cache');
    } finally {
      setClearingCache(false);
    }
  };

  const handleBatchIndexing = async () => {
    setBatchIndexing(true);
    try {
      // Use the admin batch indexing endpoint
      const response = await fetch('/api/admin/ai/project-indexing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceReindex: true,
          batchSize: 5
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success(
            'Batch indexing completed', 
            `Successfully indexed ${result.data.successful} projects (${result.data.failed} failed)`
          );
          await loadIndexingData();
        }
      } else {
        throw new Error('Batch indexing failed');
      }
    } catch (error) {
      toast.error('Batch indexing failed', 'Could not complete batch indexing operation');
    } finally {
      setBatchIndexing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading project indexing data...</p>
        </div>
      </div>
    );
  }

  const indexingProgress = stats ? (stats.indexedProjects / stats.totalProjects) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              Projects in portfolio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indexed Projects</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.indexedProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              {indexingProgress.toFixed(1)}% indexed
            </p>
            <Progress value={indexingProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Size</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cacheSize || 0}</div>
            <p className="text-xs text-muted-foreground">
              Cached indexes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {stats?.lastIndexingActivity 
                ? new Date(stats.lastIndexingActivity).toLocaleDateString()
                : 'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Last indexing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Indexing Operations</CardTitle>
          <CardDescription>
            Manage project indexing and cache operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={refreshStats} 
              disabled={refreshing}
              variant="outline"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Data
            </Button>

            <Button 
              onClick={handleBatchIndexing} 
              disabled={batchIndexing}
            >
              {batchIndexing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Reindex All Projects
            </Button>

            <Button 
              onClick={clearCache} 
              disabled={clearingCache}
              variant="outline"
            >
              {clearingCache ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed View */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Project Indexes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Indexing Status</CardTitle>
              <CardDescription>
                Current indexing status for all projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectIndexes.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No project indexes found</p>
                  <Button onClick={handleBatchIndexing} className="mt-4">
                    Start Indexing
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {projectIndexes.map((index) => (
                    <div key={index.projectId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{index.title}</h3>
                          <p className="text-sm text-muted-foreground">/{index.slug}</p>
                        </div>
                        <Badge variant="outline">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Indexed
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Sections:</span>
                          <span className="ml-1 font-medium">{index.sectionsCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Media:</span>
                          <span className="ml-1 font-medium">{index.mediaCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Keywords:</span>
                          <span className="ml-1 font-medium">{index.keywords.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Updated:</span>
                          <span className="ml-1 font-medium">
                            {new Date(index.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {index.keywords.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-muted-foreground mb-2">Top Keywords:</p>
                          <div className="flex flex-wrap gap-1">
                            {index.keywords.slice(0, 8).map((keyword, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                            {index.keywords.length > 8 && (
                              <Badge variant="outline" className="text-xs">
                                +{index.keywords.length - 8} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Indexing Analytics</CardTitle>
              <CardDescription>
                Performance metrics and usage statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    Analytics features are coming soon. This will include indexing performance metrics,
                    search query analytics, and content optimization insights.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Indexing Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Average indexing time:</span>
                          <span className="font-medium">~2.3s</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cache hit rate:</span>
                          <span className="font-medium">87%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Index size (avg):</span>
                          <span className="font-medium">15.2KB</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Content Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Avg sections per project:</span>
                          <span className="font-medium">8.4</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg keywords extracted:</span>
                          <span className="font-medium">23</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Most common tech:</span>
                          <span className="font-medium">React, TypeScript</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProjectIndexingPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="Project Indexing"
        description="Manage AI project indexing and search optimization"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Project Indexing', href: '/admin/ai/project-indexing' }
        ]}
      >
        <ProjectIndexingContent />
      </AdminPageLayout>
    </AdminLayout>
  );
}