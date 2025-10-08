"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  RefreshCw,
  Trash2,
  Download,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Package,
  Zap,
  Activity,
  Filter,
  ArrowUpDown,
  Settings,
  Wrench
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SemanticRegenerationTrigger } from "./semantic-regeneration-trigger";
import { StageBasedProcessingPanel } from "./stage-based-processing-panel";
import { GranularProcessingControl } from "./granular-processing-control";

interface DashboardMetrics {
  vectorIndexHealth: {
    totalProjects: number;
    indexedProjects: number;
    totalChunks: number;
    totalEmbeddings: number;
    averageQueryTime: number;
    indexSize: string;
  };
  budgetStatus: {
    allocated: number;
    remaining: number;
    percentUsed: number;
    warningLevel: 'ok' | 'warning' | 'critical' | 'depleted';
  };
  projectStatus: Array<{
    projectId: string;
    title: string;
    chunkCount: number;
    tierDistribution: Record<number, number>;
    lastRegenerated: Date;
    totalCost: number;
    healthStatus: 'healthy' | 'outdated' | 'incomplete' | 'error';
  }>;
  costAnalytics: {
    totalSpent: number;
    breakdown: {
      embedding: { cost: number; operations: number; tokens: number };
      summarization: { cost: number; operations: number; tokens: number };
      regeneration: { cost: number; operations: number; tokens: number };
      total: { cost: number; operations: number; tokens: number };
    };
  };
  batchJobStatus: Array<{
    id: string;
    projectId: string | null;
    status: 'in_progress' | 'completed' | 'failed';
    startedAt: Date;
    completedAt: Date | null;
    chunksProcessed: number;
    cost: number;
    estimatedSavings: number;
    progress: number;
  }>;
}

type SortField = 'title' | 'chunkCount' | 'lastRegenerated' | 'totalCost' | 'healthStatus';
type SortOrder = 'asc' | 'desc';
type HealthFilter = 'all' | 'healthy' | 'outdated' | 'incomplete' | 'error';

export function SemanticDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('lastRegenerated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [showStageBasedProcessing, setShowStageBasedProcessing] = useState(false);
  const [showGranularControl, setShowGranularControl] = useState(false);
  
  // Index maintenance state
  const [rebuildingIndex, setRebuildingIndex] = useState(false);
  const [indexStats, setIndexStats] = useState<any>(null);
  const [lastIndexCheck, setLastIndexCheck] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardMetrics(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardMetrics = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const response = await fetch('/api/admin/semantic/dashboard');
      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getBudgetStatusColor = (level: string) => {
    switch (level) {
      case 'ok': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-orange-600';
      case 'depleted': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getBudgetStatusBadge = (level: string) => {
    switch (level) {
      case 'ok': return <Badge variant="default" className="bg-green-600">OK</Badge>;
      case 'warning': return <Badge variant="default" className="bg-yellow-600">Warning</Badge>;
      case 'critical': return <Badge variant="default" className="bg-orange-600">Critical</Badge>;
      case 'depleted': return <Badge variant="destructive">Depleted</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Index maintenance functions
  const fetchIndexStats = async () => {
    try {
      const response = await fetch('/api/admin/semantic/force-reindex');
      if (!response.ok) throw new Error('Failed to fetch index stats');
      
      const data = await response.json();
      setIndexStats(data);
      setLastIndexCheck(new Date());
    } catch (error) {
      console.error('Error fetching index stats:', error);
    }
  };

  const forceRebuildIndex = async () => {
    if (rebuildingIndex) return;
    
    try {
      setRebuildingIndex(true);
      console.log('🔧 Starting force HNSW index rebuild...');
      
      const response = await fetch('/api/admin/semantic/force-reindex', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rebuild index');
      }
      
      const result = await response.json();
      console.log('✅ HNSW index rebuild completed:', result);
      
      // Refresh index stats and dashboard metrics
      await Promise.all([
        fetchIndexStats(),
        fetchDashboardMetrics(true)
      ]);
      
      // Show success message (you could add a toast here)
      alert(`Index rebuilt successfully in ${(result.details.totalTime / 1000).toFixed(1)} seconds!`);
      
    } catch (error) {
      console.error('❌ Force index rebuild failed:', error);
      alert(`Index rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRebuildingIndex(false);
    }
  };

  // Fetch index stats on component mount
  useEffect(() => {
    fetchIndexStats();
  }, []);

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Healthy
        </Badge>;
      case 'outdated':
        return <Badge variant="default" className="bg-yellow-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Outdated
        </Badge>;
      case 'incomplete':
        return <Badge variant="default" className="bg-orange-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Incomplete
        </Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getBatchStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          In Progress
        </Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const sortProjects = (projects: DashboardMetrics['projectStatus']) => {
    const filtered = healthFilter === 'all' 
      ? projects 
      : projects.filter(p => p.healthStatus === healthFilter);

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'chunkCount':
          comparison = a.chunkCount - b.chunkCount;
          break;
        case 'lastRegenerated':
          comparison = new Date(a.lastRegenerated).getTime() - new Date(b.lastRegenerated).getTime();
          break;
        case 'totalCost':
          comparison = a.totalCost - b.totalCost;
          break;
        case 'healthStatus':
          const statusOrder = { healthy: 0, outdated: 1, incomplete: 2, error: 3 };
          comparison = statusOrder[a.healthStatus] - statusOrder[b.healthStatus];
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load dashboard metrics. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const sortedProjects = sortProjects(metrics.projectStatus);

  return (
    <div className="space-y-6">
      {/* Budget Status Alert */}
      {metrics.budgetStatus.warningLevel !== 'ok' && (
        <Alert variant={metrics.budgetStatus.warningLevel === 'depleted' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {metrics.budgetStatus.warningLevel === 'depleted' ? (
              <>Budget depleted! Allocate more funds to continue AI operations.</>
            ) : metrics.budgetStatus.warningLevel === 'critical' ? (
              <>Budget critically low ({metrics.budgetStatus.percentUsed.toFixed(1)}% used). Consider allocating more funds.</>
            ) : (
              <>Budget warning: {metrics.budgetStatus.percentUsed.toFixed(1)}% of allocated funds used.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Vector Index Health Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.vectorIndexHealth.totalChunks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.vectorIndexHealth.totalEmbeddings.toLocaleString()} with embeddings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indexed Projects</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.vectorIndexHealth.indexedProjects} / {metrics.vectorIndexHealth.totalProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              {((metrics.vectorIndexHealth.indexedProjects / metrics.vectorIndexHealth.totalProjects) * 100).toFixed(0)}% coverage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Query Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.vectorIndexHealth.averageQueryTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Index size: {metrics.vectorIndexHealth.indexSize}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Status</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getBudgetStatusColor(metrics.budgetStatus.warningLevel)}`}>
              ${metrics.budgetStatus.remaining.toFixed(2)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={metrics.budgetStatus.percentUsed} className="flex-1" />
              {getBudgetStatusBadge(metrics.budgetStatus.warningLevel)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Index Maintenance */}
      {indexStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              HNSW Index Maintenance
            </CardTitle>
            <CardDescription>
              Manage vector index performance and statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Index Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Index Size</div>
                <div className="text-lg font-semibold">{indexStats.stats?.indexSize || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Last Analyzed</div>
                <div className="text-lg font-semibold">
                  {indexStats.stats?.lastAnalyzed 
                    ? formatDistanceToNow(new Date(indexStats.stats.lastAnalyzed), { addSuffix: true })
                    : 'Never'
                  }
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Changes Since Analysis</div>
                <div className="text-lg font-semibold">{indexStats.stats?.changesSinceAnalyze || 0}</div>
              </div>
            </div>

            {/* Recommendations */}
            {indexStats.recommendations && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Maintenance Recommendations</div>
                <div className="space-y-1">
                  {indexStats.recommendations.recommendations.map((rec: string, index: number) => (
                    <div 
                      key={index} 
                      className={`text-xs p-2 rounded ${
                        indexStats.recommendations.urgency === 'high' ? 'bg-red-50 text-red-800' :
                        indexStats.recommendations.urgency === 'medium' ? 'bg-yellow-50 text-yellow-800' :
                        'bg-green-50 text-green-800'
                      }`}
                    >
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Force Rebuild Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-1">
                <div className="text-sm font-medium">Force Index Rebuild</div>
                <div className="text-xs text-muted-foreground">
                  Immediately rebuild HNSW index for optimal O(log n) performance.
                  <br />
                  ⚠️ This may take several minutes but won't block searches.
                </div>
              </div>
              
              <Button
                onClick={forceRebuildIndex}
                disabled={rebuildingIndex || !indexStats.canForceReindex}
                variant={rebuildingIndex ? "secondary" : "destructive"}
                size="sm"
                className="ml-4"
              >
                {rebuildingIndex ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rebuilding...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Force Rebuild
                  </>
                )}
              </Button>
            </div>

            {/* Last Check Info */}
            {lastIndexCheck && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                Stats last checked: {formatDistanceToNow(lastIndexCheck, { addSuffix: true })}
                <Button
                  onClick={fetchIndexStats}
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-6 px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Cost Analytics
          </CardTitle>
          <CardDescription>
            Breakdown of AI operation costs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Embeddings</div>
              <div className="text-2xl font-bold">${metrics.costAnalytics.breakdown.embedding.cost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">
                {metrics.costAnalytics.breakdown.embedding.operations} operations
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Summarization</div>
              <div className="text-2xl font-bold">${metrics.costAnalytics.breakdown.summarization.cost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">
                {metrics.costAnalytics.breakdown.summarization.operations} operations
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Regeneration</div>
              <div className="text-2xl font-bold">${metrics.costAnalytics.breakdown.regeneration.cost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">
                {metrics.costAnalytics.breakdown.regeneration.operations} operations
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Spent</div>
              <div className="text-2xl font-bold text-blue-600">${metrics.costAnalytics.totalSpent.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                {metrics.costAnalytics.breakdown.total.operations} total operations
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Job Status */}
      {metrics.batchJobStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Batch Operations
            </CardTitle>
            <CardDescription>
              Recent batch embedding operations with cost savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Savings</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.batchJobStatus.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{getBatchStatusBadge(job.status)}</TableCell>
                    <TableCell className="font-medium">
                      {job.projectId ? (
                        metrics.projectStatus.find(p => p.projectId === job.projectId)?.title || 'Unknown'
                      ) : (
                        'All Projects'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>{job.chunksProcessed}</TableCell>
                    <TableCell>${job.cost.toFixed(4)}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      ${job.estimatedSavings.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {job.status === 'in_progress' ? (
                        <div className="flex items-center gap-2">
                          <Progress value={job.progress} className="w-16" />
                          <span className="text-xs">{job.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {job.completedAt ? formatDistanceToNow(new Date(job.completedAt), { addSuffix: true }) : '-'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common semantic content management tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button 
            onClick={() => setShowStageBasedProcessing(true)}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Stage-Based Processing
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowGranularControl(true)}
            className="flex items-center gap-2"
          >
            <Package className="h-4 w-4" />
            Granular Control
          </Button>
          <SemanticRegenerationTrigger 
            variant="dropdown"
            onComplete={() => fetchDashboardMetrics()}
          />
          <Button 
            variant="outline"
            onClick={() => router.push('/admin/semantic/cleanup')}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Cleanup Orphaned Chunks
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/admin/semantic/export')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Indexes
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/admin/semantic/budget')}
            className="flex items-center gap-2"
          >
            <DollarSign className="h-4 w-4" />
            Manage Budget
          </Button>
          <Button 
            variant="outline"
            onClick={() => fetchDashboardMetrics()}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Project List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Semantic Status</CardTitle>
              <CardDescription>
                Semantic index health for all projects
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={healthFilter} onValueChange={(value) => setHealthFilter(value as HealthFilter)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="outdated">Outdated</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleSort('title')}
                    className="flex items-center gap-1"
                  >
                    Project
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleSort('chunkCount')}
                    className="flex items-center gap-1"
                  >
                    Chunks
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Tier Distribution</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleSort('lastRegenerated')}
                    className="flex items-center gap-1"
                  >
                    Last Updated
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleSort('totalCost')}
                    className="flex items-center gap-1"
                  >
                    Cost
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleSort('healthStatus')}
                    className="flex items-center gap-1"
                  >
                    Status
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                sortedProjects.map((project) => (
                  <TableRow key={project.projectId}>
                    <TableCell className="font-medium">{project.title}</TableCell>
                    <TableCell>{project.chunkCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {Object.entries(project.tierDistribution).map(([tier, count]) => (
                          <Badge key={tier} variant="outline" className="text-xs">
                            T{tier}: {count}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(project.lastRegenerated), { addSuffix: true })}
                    </TableCell>
                    <TableCell>${project.totalCost.toFixed(4)}</TableCell>
                    <TableCell>{getHealthStatusBadge(project.healthStatus)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/semantic/projects/${project.projectId}`)}
                        >
                          View Tree
                        </Button>
                        <SemanticRegenerationTrigger
                          variant="button"
                          projectId={project.projectId}
                          projectTitle={project.title}
                          onComplete={() => fetchDashboardMetrics()}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stage-Based Processing Panel */}
      {showStageBasedProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <StageBasedProcessingPanel
              scope="all"
              onComplete={(result) => {
                console.log('Stage-based processing completed:', result);
                fetchDashboardMetrics();
                setShowStageBasedProcessing(false);
              }}
              onClose={() => setShowStageBasedProcessing(false)}
            />
          </div>
        </div>
      )}

      {/* Granular Processing Control Panel */}
      {showGranularControl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6">
            <GranularProcessingControl
              onStartProcessing={(scope, stages) => {
                console.log('Granular processing started:', { scope, stages });
                fetchDashboardMetrics();
                setShowGranularControl(false);
              }}
              onClose={() => setShowGranularControl(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
