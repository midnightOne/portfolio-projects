"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Ban, 
  CheckCircle, 
  Plus,
  RefreshCw,
  Calendar,
  Activity,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BlacklistEntry {
  id: string;
  ipAddress: string;
  reason: string;
  violationCount: number;
  firstViolationAt: string;
  lastViolationAt: string;
  blockedAt: string;
  canReinstate: boolean;
  reinstatedAt?: string;
  reinstatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface SecurityAnalytics {
  totalBlacklisted: number;
  recentViolations: number;
  violationsByReason: Record<string, number>;
  topViolatingIPs: Array<{
    ipAddress: string;
    violations: number;
    lastViolation: string;
  }>;
}

export function SecurityManager() {
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);
  const [analytics, setAnalytics] = useState<SecurityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [reinstateDialogOpen, setReinstateDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<BlacklistEntry | null>(null);
  const [formData, setFormData] = useState({
    ipAddress: '',
    reason: '',
    violationCount: '1',
  });
  const [reinstateReason, setReinstateReason] = useState('');
  const { toast } = useToast();

  const fetchBlacklistEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ai/blacklist');
      if (!response.ok) {
        throw new Error('Failed to fetch blacklist entries');
      }
      const data = await response.json();
      setBlacklistEntries(data.data.entries);
    } catch (error) {
      console.error('Failed to fetch blacklist entries:', error);
      toast({
        title: "Error",
        description: "Failed to load blacklist entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await fetch('/api/admin/ai/rate-limit/analytics?days=7');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const data = await response.json();
      setAnalytics(data.data.security);
    } catch (error) {
      console.error('Failed to fetch security analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load security analytics",
        variant: "destructive",
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const addToBlacklist = async () => {
    try {
      const payload = {
        ipAddress: formData.ipAddress,
        reason: formData.reason,
        violationCount: parseInt(formData.violationCount),
      };

      const response = await fetch('/api/admin/ai/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to add IP to blacklist');
      }

      toast({
        title: "Success",
        description: "IP address added to blacklist",
      });

      setAddDialogOpen(false);
      resetForm();
      fetchBlacklistEntries();
      fetchAnalytics();
    } catch (error: any) {
      console.error('Failed to add IP to blacklist:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add IP to blacklist",
        variant: "destructive",
      });
    }
  };

  const reinstateIP = async () => {
    if (!selectedEntry) return;

    try {
      const response = await fetch(`/api/admin/ai/blacklist/${encodeURIComponent(selectedEntry.ipAddress)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reinstate',
          reason: reinstateReason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to reinstate IP');
      }

      toast({
        title: "Success",
        description: "IP address reinstated successfully",
      });

      setReinstateDialogOpen(false);
      setSelectedEntry(null);
      setReinstateReason('');
      fetchBlacklistEntries();
      fetchAnalytics();
    } catch (error: any) {
      console.error('Failed to reinstate IP:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reinstate IP",
        variant: "destructive",
      });
    }
  };

  const removeFromBlacklist = async (entry: BlacklistEntry) => {
    if (!confirm(`Are you sure you want to permanently remove ${entry.ipAddress} from the blacklist?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ai/blacklist/${encodeURIComponent(entry.ipAddress)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove IP from blacklist');
      }

      toast({
        title: "Success",
        description: "IP address removed from blacklist",
      });

      fetchBlacklistEntries();
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to remove IP from blacklist:', error);
      toast({
        title: "Error",
        description: "Failed to remove IP from blacklist",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      ipAddress: '',
      reason: '',
      violationCount: '1',
    });
  };

  const openReinstateDialog = (entry: BlacklistEntry) => {
    setSelectedEntry(entry);
    setReinstateDialogOpen(true);
  };

  useEffect(() => {
    fetchBlacklistEntries();
    fetchAnalytics();
  }, []);

  const getViolationBadgeVariant = (count: number) => {
    if (count >= 5) return 'destructive';
    if (count >= 3) return 'default';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage IP blacklists, security violations, and access control
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { fetchBlacklistEntries(); fetchAnalytics(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add to Blacklist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add IP to Blacklist</DialogTitle>
                <DialogDescription>
                  Manually add an IP address to the security blacklist
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ipAddress">IP Address *</Label>
                  <Input
                    id="ipAddress"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g., Spam, suspicious activity, abuse"
                  />
                </div>
                <div>
                  <Label htmlFor="violationCount">Violation Count</Label>
                  <Input
                    id="violationCount"
                    type="number"
                    min="1"
                    value={formData.violationCount}
                    onChange={(e) => setFormData({ ...formData, violationCount: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={addToBlacklist} 
                  disabled={!formData.ipAddress || !formData.reason}
                  variant="destructive"
                >
                  Add to Blacklist
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Cards */}
      {!analyticsLoading && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Blacklisted</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalBlacklisted}</div>
              <p className="text-xs text-muted-foreground">Active blocks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Violations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.recentViolations}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Violation Type</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(analytics.violationsByReason)[0] || 'None'}
              </div>
              <p className="text-xs text-muted-foreground">
                {Object.values(analytics.violationsByReason)[0] || 0} occurrences
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Violator</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono">
                {analytics.topViolatingIPs[0]?.ipAddress || 'None'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.topViolatingIPs[0]?.violations || 0} violations
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="blacklist" className="space-y-4">
        <TabsList>
          <TabsTrigger value="blacklist">IP Blacklist</TabsTrigger>
          <TabsTrigger value="violations">Violation Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="blacklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blacklisted IP Addresses</CardTitle>
              <CardDescription>
                Manage blocked IP addresses and their violation history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : blacklistEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No IP addresses are currently blacklisted</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Violations</TableHead>
                      <TableHead>First Violation</TableHead>
                      <TableHead>Last Violation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blacklistEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {entry.ipAddress}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="text-sm truncate" title={entry.reason}>
                              {entry.reason}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getViolationBadgeVariant(entry.violationCount)}>
                            {entry.violationCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(entry.firstViolationAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.firstViolationAt).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(entry.lastViolationAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.lastViolationAt).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.reinstatedAt ? (
                            <Badge variant="secondary">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Reinstated
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <Ban className="h-3 w-3 mr-1" />
                              Blocked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {!entry.reinstatedAt && entry.canReinstate && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReinstateDialog(entry)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Reinstate
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromBlacklist(entry)}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Violations by Type</CardTitle>
                  <CardDescription>Security violations categorized by reason</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.violationsByReason).map(([reason, count]) => (
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
                  <CardDescription>IP addresses with the most violations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.topViolatingIPs.map((ip, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {ip.ipAddress}
                        </code>
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
          )}
        </TabsContent>
      </Tabs>

      {/* Reinstate Dialog */}
      <Dialog open={reinstateDialogOpen} onOpenChange={setReinstateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinstate IP Address</DialogTitle>
            <DialogDescription>
              Reinstate access for IP: {selectedEntry?.ipAddress}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reinstateReason">Reason for Reinstatement</Label>
              <Textarea
                id="reinstateReason"
                value={reinstateReason}
                onChange={(e) => setReinstateReason(e.target.value)}
                placeholder="e.g., False positive, user verified, appeal approved"
              />
            </div>
            {selectedEntry && (
              <div className="bg-muted p-3 rounded-lg">
                <h4 className="font-medium mb-2">Current Violation Details</h4>
                <p className="text-sm text-muted-foreground mb-1">
                  <strong>Reason:</strong> {selectedEntry.reason}
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  <strong>Violations:</strong> {selectedEntry.violationCount}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Last Violation:</strong> {new Date(selectedEntry.lastViolationAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReinstateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={reinstateIP} disabled={!reinstateReason.trim()}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Reinstate IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}