"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Shield, 
  Users, 
  AlertTriangle, 
  TrendingUp,
  RefreshCw,
  Activity,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RateLimitAnalytics {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  rateLimiting: {
    totalRequests: number;
    blockedRequests: number;
    uniqueUsers: number;
    blockRate: number;
    averageRequestsPerUser: number;
    topEndpoints: Array<{
      endpoint: string;
      requests: number;
    }>;
    requestsByTier: Record<string, number>;
    requestsByHour: Array<{
      hour: string;
      requests: number;
      blocked: number;
    }>;
  };
  security: {
    totalBlacklisted: number;
    recentViolations: number;
    violationsByReason: Record<string, number>;
    topViolatingIPs: Array<{
      ipAddress: string;
      violations: number;
      lastViolation: string;
    }>;
  };
  summary: {
    totalRequests: number;
    blockedRequests: number;
    uniqueUsers: number;
    blacklistedIPs: number;
    blockRate: number;
  };
}

export function RateLimitingDashboard() {
  const [analytics, setAnalytics] = useState<RateLimitAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/ai/rate-limit/analytics?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const data = await response.json();
      setAnalytics(data.data);
    } catch (error) {
      console.error('Failed to fetch rate limiting analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load rate limiting analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const performCleanup = async () => {
    try {
      const response = await fetch('/api/admin/ai/rate-limit/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup' }),
      });

      if (!response.ok) {
        throw new Error('Cleanup failed');
      }

      toast({
        title: "Success",
        description: "Rate limiting cleanup completed successfully",
      });

      // Refresh analytics after cleanup
      fetchAnalytics();
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast({
        title: "Error",
        description: "Failed to perform cleanup",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="days-select" className="text-sm font-medium">
              Time Period:
            </label>
            <select
              id="days-select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={performCleanup} variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.uniqueUsers} unique users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.blockedRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.blockRate.toFixed(1)}% block rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blacklisted IPs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.blacklistedIPs}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.security.recentViolations} recent violations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Requests/User</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.rateLimiting.averageRequestsPerUser.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per user in {days} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Request Analytics</TabsTrigger>
          <TabsTrigger value="security">Security Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Top Endpoints</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Requests by Tier</CardTitle>
                <CardDescription>Distribution of requests across rate limit tiers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.rateLimiting.requestsByTier).map(([tier, count]) => (
                    <div key={tier} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={tier === 'PREMIUM' ? 'default' : 'secondary'}>
                          {tier}
                        </Badge>
                      </div>
                      <span className="font-medium">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Timeline</CardTitle>
                <CardDescription>Requests over time (last {days} days)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.rateLimiting.requestsByHour.slice(-24).map((hour, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {new Date(hour.hour).toLocaleDateString()} {new Date(hour.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>{hour.requests}</span>
                        {hour.blocked > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {hour.blocked} blocked
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Violations by Reason</CardTitle>
                <CardDescription>Security violations categorized by type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.security.violationsByReason).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between">
                      <span className="capitalize">{reason.replace('_', ' ')}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Violating IPs</CardTitle>
                <CardDescription>IPs with the most security violations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.security.topViolatingIPs.map((ip, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {ip.ipAddress}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{ip.violations} violations</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ip.lastViolation).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Requested Endpoints</CardTitle>
              <CardDescription>API endpoints with the highest request volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.rateLimiting.topEndpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {endpoint.endpoint}
                    </code>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{endpoint.requests.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">requests</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}