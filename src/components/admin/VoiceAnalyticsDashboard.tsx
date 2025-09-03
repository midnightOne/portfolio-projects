'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Mic,
  Volume2,
  Activity,
  Users,
  Zap,
  AlertCircle,
  RefreshCw,
  Download,
  Calendar,
  Filter
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface VoiceAnalytics {
  overview: {
    totalSessions: number;
    totalMinutes: number;
    totalCost: number;
    averageSessionDuration: number;
    successRate: number;
    activeUsers: number;
  };
  providerBreakdown: {
    openai: {
      sessions: number;
      minutes: number;
      cost: number;
      averageLatency: number;
      errorRate: number;
    };
    elevenlabs: {
      sessions: number;
      minutes: number;
      cost: number;
      averageLatency: number;
      errorRate: number;
    };
  };
  timeSeriesData: Array<{
    date: string;
    sessions: number;
    minutes: number;
    cost: number;
    openaiSessions: number;
    elevenlabsSessions: number;
  }>;
  performanceMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    connectionSuccessRate: number;
    audioQualityScore: number;
    interruptionRate: number;
  };
  costBreakdown: {
    openaiCosts: {
      inputTokens: number;
      outputTokens: number;
      audioMinutes: number;
      totalCost: number;
    };
    elevenlabsCosts: {
      conversationMinutes: number;
      characterCount: number;
      totalCost: number;
    };
  };
  topErrors: Array<{
    error: string;
    count: number;
    provider: string;
    lastOccurrence: string;
  }>;
  usagePatterns: {
    peakHours: Array<{ hour: number; sessions: number }>;
    dailyDistribution: Array<{ day: string; sessions: number }>;
    averageSessionLength: number;
    mostActiveReflinks: Array<{ reflinkId: string; sessions: number; cost: number }>;
  };
}

export function VoiceAnalyticsDashboard() {
  const toast = useToast();
  const [analytics, setAnalytics] = useState<VoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [selectedProvider, setSelectedProvider] = useState<'all' | 'openai' | 'elevenlabs'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadAnalytics();
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(loadAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeRange, selectedProvider]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        timeRange,
        provider: selectedProvider === 'all' ? '' : selectedProvider
      });

      const response = await fetch(`/api/admin/ai/voice-analytics?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalytics(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(errorMessage);
      toast.error('Analytics load failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      const params = new URLSearchParams({
        timeRange,
        provider: selectedProvider === 'all' ? '' : selectedProvider,
        format: 'csv'
      });

      const response = await fetch(`/api/admin/ai/voice-analytics/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Export completed', 'Analytics data exported successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export failed', errorMessage);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading voice analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setError(null)}>
              Clear
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Voice Session Analytics
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button onClick={exportAnalytics} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={loadAnalytics} disabled={loading} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <Select value={timeRange} onValueChange={(value: '24h' | '7d' | '30d' | '90d') => setTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Select value={selectedProvider} onValueChange={(value: 'all' | 'openai' | 'elevenlabs') => setSelectedProvider(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="openai">OpenAI Realtime</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {analytics && (
        <>
          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Total Sessions</span>
                </div>
                <div className="text-2xl font-bold">{analytics.overview.totalSessions.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Total Minutes</span>
                </div>
                <div className="text-2xl font-bold">{formatDuration(analytics.overview.totalMinutes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Total Cost</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(analytics.overview.totalCost)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">Avg Duration</span>
                </div>
                <div className="text-2xl font-bold">{formatDuration(analytics.overview.averageSessionDuration)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Success Rate</span>
                </div>
                <div className="text-2xl font-bold">{formatPercentage(analytics.overview.successRate)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">Active Users</span>
                </div>
                <div className="text-2xl font-bold">{analytics.overview.activeUsers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Provider Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  OpenAI Realtime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Sessions</div>
                      <div className="text-xl font-bold">{analytics.providerBreakdown.openai.sessions.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Minutes</div>
                      <div className="text-xl font-bold">{formatDuration(analytics.providerBreakdown.openai.minutes)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cost</div>
                      <div className="text-xl font-bold">{formatCurrency(analytics.providerBreakdown.openai.cost)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Latency</div>
                      <div className="text-xl font-bold">{Math.round(analytics.providerBreakdown.openai.averageLatency)}ms</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Error Rate</span>
                      <Badge variant={analytics.providerBreakdown.openai.errorRate > 0.05 ? "destructive" : "secondary"}>
                        {formatPercentage(analytics.providerBreakdown.openai.errorRate)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  ElevenLabs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Sessions</div>
                      <div className="text-xl font-bold">{analytics.providerBreakdown.elevenlabs.sessions.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Minutes</div>
                      <div className="text-xl font-bold">{formatDuration(analytics.providerBreakdown.elevenlabs.minutes)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cost</div>
                      <div className="text-xl font-bold">{formatCurrency(analytics.providerBreakdown.elevenlabs.cost)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Latency</div>
                      <div className="text-xl font-bold">{Math.round(analytics.providerBreakdown.elevenlabs.averageLatency)}ms</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Error Rate</span>
                      <Badge variant={analytics.providerBreakdown.elevenlabs.errorRate > 0.05 ? "destructive" : "secondary"}>
                        {formatPercentage(analytics.providerBreakdown.elevenlabs.errorRate)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Avg Response Time</div>
                  <div className="text-lg font-bold">{Math.round(analytics.performanceMetrics.averageResponseTime)}ms</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">P95 Response Time</div>
                  <div className="text-lg font-bold">{Math.round(analytics.performanceMetrics.p95ResponseTime)}ms</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">P99 Response Time</div>
                  <div className="text-lg font-bold">{Math.round(analytics.performanceMetrics.p99ResponseTime)}ms</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Connection Success</div>
                  <div className="text-lg font-bold">{formatPercentage(analytics.performanceMetrics.connectionSuccessRate)}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Audio Quality</div>
                  <div className="text-lg font-bold">{analytics.performanceMetrics.audioQualityScore.toFixed(1)}/10</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Interruption Rate</div>
                  <div className="text-lg font-bold">{formatPercentage(analytics.performanceMetrics.interruptionRate)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>OpenAI Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Input Tokens</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.openaiCosts.inputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output Tokens</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.openaiCosts.outputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Minutes</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.openaiCosts.audioMinutes)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.openaiCosts.totalCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ElevenLabs Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Conversation Minutes</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.elevenlabsCosts.conversationMinutes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Character Count</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.elevenlabsCosts.characterCount)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(analytics.costBreakdown.elevenlabsCosts.totalCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Errors */}
          {analytics.topErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Top Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topErrors.map((error, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{error.error}</div>
                        <div className="text-xs text-muted-foreground">
                          Last occurred: {new Date(error.lastOccurrence).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{error.provider}</Badge>
                        <Badge variant="destructive">{error.count}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Patterns */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Peak Hours</h4>
                  <div className="space-y-2">
                    {analytics.usagePatterns.peakHours.slice(0, 5).map((hour, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{hour.hour}:00</span>
                        <span>{hour.sessions} sessions</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Most Active Reflinks</h4>
                  <div className="space-y-2">
                    {analytics.usagePatterns.mostActiveReflinks.slice(0, 5).map((reflink, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="font-mono">{reflink.reflinkId.slice(-8)}</span>
                        <div className="flex gap-2">
                          <span>{reflink.sessions} sessions</span>
                          <span>{formatCurrency(reflink.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}