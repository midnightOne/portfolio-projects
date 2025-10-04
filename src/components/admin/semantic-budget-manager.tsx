"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Settings,
  PieChart,
  Calendar,
  Filter,
  RefreshCw,
  Plus
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface BudgetStatus {
  id: string;
  allocatedFunds: number;
  remainingFunds: number;
  totalSpent: number;
  embeddingCosts: number;
  summarizationCosts: number;
  percentUsed: number;
  warningLevel: 'ok' | 'warning' | 'critical' | 'depleted';
  warningThreshold: number;
  criticalThreshold: number;
  isActive: boolean;
  lastAllocatedAt: Date | null;
  depletedAt: Date | null;
}

interface SpendingOperation {
  id: string;
  projectId: string | null;
  operationType: 'embedding' | 'summarization' | 'regeneration';
  tokensUsed: number;
  cost: number;
  model: string;
  chunksProcessed: number;
  tiersAffected: number[];
  success: boolean;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
}

interface BudgetAnalytics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalTokensUsed: number;
  averageCostPerOperation: number;
  costByOperationType: Record<string, number>;
  costByProject: Record<string, number>;
  costTrends: Array<{
    date: string;
    cost: number;
    operations: number;
  }>;
  projections: {
    estimatedDaysRemaining: number;
    estimatedOperationsRemaining: number;
    averageDailyCost: number;
  };
}

interface CostBreakdown {
  embedding: { cost: number; operations: number; tokens: number };
  summarization: { cost: number; operations: number; tokens: number };
  regeneration: { cost: number; operations: number; tokens: number };
  total: { cost: number; operations: number; tokens: number };
}

type OperationTypeFilter = 'all' | 'embedding' | 'summarization' | 'regeneration';
type SuccessFilter = 'all' | 'success' | 'failed';

export function SemanticBudgetManager() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [analytics, setAnalytics] = useState<BudgetAnalytics | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [operations, setOperations] = useState<SpendingOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [operationTypeFilter, setOperationTypeFilter] = useState<OperationTypeFilter>('all');
  const [successFilter, setSuccessFilter] = useState<SuccessFilter>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  // Allocation dialog
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocating, setAllocating] = useState(false);
  
  // Threshold dialog
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [warningThreshold, setWarningThreshold] = useState('');
  const [criticalThreshold, setCriticalThreshold] = useState('');
  const [updatingThresholds, setUpdatingThresholds] = useState(false);

  useEffect(() => {
    fetchBudgetData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchBudgetData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [dateRange, operationTypeFilter, successFilter]);

  const fetchBudgetData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      // Fetch budget status
      const budgetResponse = await fetch('/api/admin/semantic/budget');
      if (!budgetResponse.ok) throw new Error('Failed to fetch budget');
      const budgetData = await budgetResponse.json();
      setBudget(budgetData.budget);

      // Fetch analytics
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      const analyticsResponse = await fetch(`/api/admin/semantic/budget/analytics?days=${days}`);
      if (!analyticsResponse.ok) throw new Error('Failed to fetch analytics');
      const analyticsData = await analyticsResponse.json();
      setAnalytics(analyticsData.analytics);

      // Fetch cost breakdown
      const breakdownResponse = await fetch('/api/admin/semantic/budget/breakdown');
      if (!breakdownResponse.ok) throw new Error('Failed to fetch breakdown');
      const breakdownData = await breakdownResponse.json();
      setCostBreakdown(breakdownData.breakdown);

      // Fetch operations
      const params = new URLSearchParams();
      if (operationTypeFilter !== 'all') params.append('operationType', operationTypeFilter);
      if (successFilter !== 'all') params.append('success', successFilter === 'success' ? 'true' : 'false');
      if (dateRange !== 'all') {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('startDate', startDate.toISOString());
      }

      const operationsResponse = await fetch(`/api/admin/semantic/budget/operations?${params}`);
      if (!operationsResponse.ok) throw new Error('Failed to fetch operations');
      const operationsData = await operationsResponse.json();
      setOperations(operationsData.operations);

    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAllocateFunds = async () => {
    const amount = parseFloat(allocationAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount');
      return;
    }

    try {
      setAllocating(true);
      const response = await fetch('/api/admin/semantic/budget/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });

      if (!response.ok) throw new Error('Failed to allocate funds');

      const data = await response.json();
      setBudget(data.budget);
      setAllocationDialogOpen(false);
      setAllocationAmount('');
      
      // Refresh all data
      await fetchBudgetData();
    } catch (error) {
      console.error('Error allocating funds:', error);
      alert('Failed to allocate funds. Please try again.');
    } finally {
      setAllocating(false);
    }
  };

  const handleUpdateThresholds = async () => {
    const warning = parseFloat(warningThreshold);
    const critical = parseFloat(criticalThreshold);

    if (isNaN(warning) || isNaN(critical) || warning < 0 || warning > 1 || critical < 0 || critical > 1) {
      alert('Please enter valid thresholds between 0 and 1');
      return;
    }

    if (warning >= critical) {
      alert('Warning threshold must be less than critical threshold');
      return;
    }

    try {
      setUpdatingThresholds(true);
      const response = await fetch('/api/admin/semantic/budget/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warningThreshold: warning, criticalThreshold: critical })
      });

      if (!response.ok) throw new Error('Failed to update thresholds');

      const data = await response.json();
      setBudget(data.budget);
      setThresholdDialogOpen(false);
      
      // Refresh all data
      await fetchBudgetData();
    } catch (error) {
      console.error('Error updating thresholds:', error);
      alert('Failed to update thresholds. Please try again.');
    } finally {
      setUpdatingThresholds(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (operationTypeFilter !== 'all') params.append('operationType', operationTypeFilter);
      if (successFilter !== 'all') params.append('success', successFilter === 'success' ? 'true' : 'false');
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('startDate', startDate.toISOString());
      }

      const response = await fetch(`/api/admin/semantic/budget/export?${params}`);
      if (!response.ok) throw new Error('Failed to export data');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `semantic-budget-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data. Please try again.');
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

  const getOperationTypeBadge = (type: string) => {
    switch (type) {
      case 'embedding':
        return <Badge variant="outline" className="bg-blue-50">Embedding</Badge>;
      case 'summarization':
        return <Badge variant="outline" className="bg-purple-50">Summarization</Badge>;
      case 'regeneration':
        return <Badge variant="outline" className="bg-green-50">Regeneration</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!budget || !analytics || !costBreakdown) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load budget data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Status Alert */}
      {budget.warningLevel !== 'ok' && (
        <Alert variant={budget.warningLevel === 'depleted' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {budget.warningLevel === 'depleted' ? (
                <>Budget depleted! Allocate more funds to continue AI operations.</>
              ) : budget.warningLevel === 'critical' ? (
                <>Budget critically low ({budget.percentUsed.toFixed(1)}% used). Consider allocating more funds.</>
              ) : (
                <>Budget warning: {budget.percentUsed.toFixed(1)}% of allocated funds used.</>
              )}
            </span>
            <Button 
              size="sm" 
              onClick={() => setAllocationDialogOpen(true)}
              variant={budget.warningLevel === 'depleted' ? 'default' : 'outline'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Allocate Funds
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Budget Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocated Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${budget.allocatedFunds.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {budget.lastAllocatedAt 
                ? `Last allocated ${formatDistanceToNow(new Date(budget.lastAllocatedAt), { addSuffix: true })}`
                : 'No allocations yet'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Funds</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getBudgetStatusColor(budget.warningLevel)}`}>
              ${budget.remainingFunds.toFixed(2)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={budget.percentUsed} className="flex-1" />
              {getBudgetStatusBadge(budget.warningLevel)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${budget.totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {budget.percentUsed.toFixed(1)}% of allocated budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Cost</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.projections.averageDailyCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              ~{analytics.projections.estimatedDaysRemaining} days remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Management</CardTitle>
          <CardDescription>
            Allocate funds and configure warning thresholds
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Allocate Funds
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Allocate Budget</DialogTitle>
                <DialogDescription>
                  Add funds to your semantic content management budget
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10.00"
                    value={allocationAmount}
                    onChange={(e) => setAllocationAmount(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Current budget: ${budget.allocatedFunds.toFixed(2)}<br />
                  Remaining: ${budget.remainingFunds.toFixed(2)}<br />
                  {allocationAmount && !isNaN(parseFloat(allocationAmount)) && (
                    <>New total: ${(budget.allocatedFunds + parseFloat(allocationAmount)).toFixed(2)}</>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAllocationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAllocateFunds} disabled={allocating}>
                  {allocating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Allocating...
                    </>
                  ) : (
                    'Allocate'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configure Thresholds
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Warning Thresholds</DialogTitle>
                <DialogDescription>
                  Configure when to receive budget warnings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="warning">Warning Threshold (0-1)</Label>
                  <Input
                    id="warning"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder={budget.warningThreshold.toString()}
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Current: {(budget.warningThreshold * 100).toFixed(0)}% - Alert when budget usage exceeds this
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="critical">Critical Threshold (0-1)</Label>
                  <Input
                    id="critical"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder={budget.criticalThreshold.toString()}
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Current: {(budget.criticalThreshold * 100).toFixed(0)}% - Critical alert when budget usage exceeds this
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setThresholdDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateThresholds} disabled={updatingThresholds}>
                  {updatingThresholds ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline"
            onClick={() => fetchBudgetData()}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Cost Breakdown
          </CardTitle>
          <CardDescription>
            Spending by operation type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Embeddings</div>
              <div className="text-2xl font-bold">${costBreakdown.embedding.cost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">
                {costBreakdown.embedding.operations} ops • {costBreakdown.embedding.tokens.toLocaleString()} tokens
              </div>
              <div className="mt-2">
                <Progress 
                  value={(costBreakdown.embedding.cost / costBreakdown.total.cost) * 100} 
                  className="h-2"
                />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Summarization</div>
              <div className="text-2xl font-bold">${costBreakdown.summarization.cost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">
                {costBreakdown.summarization.operations} ops • {costBreakdown.summarization.tokens.toLocaleString()} tokens
              </div>
              <div className="mt-2">
                <Progress 
                  value={(costBreakdown.summarization.cost / costBreakdown.total.cost) * 100} 
                  className="h-2"
                />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Regeneration</div>
              <div className="text-2xl font-bold">${costBreakdown.regeneration.cost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">
                {costBreakdown.regeneration.operations} ops • {costBreakdown.regeneration.tokens.toLocaleString()} tokens
              </div>
              <div className="mt-2">
                <Progress 
                  value={(costBreakdown.regeneration.cost / costBreakdown.total.cost) * 100} 
                  className="h-2"
                />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total</div>
              <div className="text-2xl font-bold text-blue-600">${costBreakdown.total.cost.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                {costBreakdown.total.operations} ops • {costBreakdown.total.tokens.toLocaleString()} tokens
              </div>
              <div className="mt-2">
                <Badge variant="outline">
                  ${analytics.averageCostPerOperation.toFixed(4)} avg/op
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Budget Analytics
          </CardTitle>
          <CardDescription>
            Spending trends and projections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Operations</div>
              <div className="text-2xl font-bold">{analytics.totalOperations}</div>
              <div className="text-xs text-muted-foreground">
                <span className="text-green-600">{analytics.successfulOperations} successful</span>
                {analytics.failedOperations > 0 && (
                  <> • <span className="text-red-600">{analytics.failedOperations} failed</span></>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Estimated Days Remaining</div>
              <div className="text-2xl font-bold">
                {analytics.projections.estimatedDaysRemaining === 999 
                  ? '∞' 
                  : analytics.projections.estimatedDaysRemaining
                }
              </div>
              <div className="text-xs text-muted-foreground">
                At current spending rate
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Estimated Operations Remaining</div>
              <div className="text-2xl font-bold">
                {analytics.projections.estimatedOperationsRemaining === 999 
                  ? '∞' 
                  : analytics.projections.estimatedOperationsRemaining
                }
              </div>
              <div className="text-xs text-muted-foreground">
                Based on average cost
              </div>
            </div>
          </div>

          {/* Cost Trends Chart (Simple Bar Visualization) */}
          {analytics.costTrends.length > 0 && (
            <div className="mt-6">
              <div className="text-sm font-medium mb-2">Daily Cost Trends</div>
              <div className="space-y-2">
                {analytics.costTrends.slice(-7).map((trend) => (
                  <div key={trend.date} className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground w-20">
                      {format(new Date(trend.date), 'MMM dd')}
                    </div>
                    <div className="flex-1">
                      <Progress 
                        value={(trend.cost / Math.max(...analytics.costTrends.map(t => t.cost))) * 100} 
                        className="h-4"
                      />
                    </div>
                    <div className="text-xs font-medium w-16 text-right">
                      ${trend.cost.toFixed(4)}
                    </div>
                    <div className="text-xs text-muted-foreground w-12 text-right">
                      {trend.operations} ops
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spending History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Spending History</CardTitle>
              <CardDescription>
                Detailed operation history with filtering
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as any)}>
                <SelectTrigger className="w-32">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={operationTypeFilter} onValueChange={(value) => setOperationTypeFilter(value as any)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="embedding">Embedding</SelectItem>
                  <SelectItem value="summarization">Summarization</SelectItem>
                  <SelectItem value="regeneration">Regeneration</SelectItem>
                </SelectContent>
              </Select>

              <Select value={successFilter} onValueChange={(value) => setSuccessFilter(value as any)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportCSV}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No operations found
                  </TableCell>
                </TableRow>
              ) : (
                operations.slice(0, 50).map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="text-sm">
                      {format(new Date(op.startedAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>{getOperationTypeBadge(op.operationType)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {op.model}
                    </TableCell>
                    <TableCell className="text-sm">
                      {op.tokensUsed.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${op.cost.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {op.chunksProcessed}
                    </TableCell>
                    <TableCell>
                      {op.success ? (
                        <Badge variant="default" className="bg-green-600 flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {op.duration ? `${op.duration}ms` : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {operations.length > 50 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing 50 of {operations.length} operations
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
