"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Brain, 
  Bell, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Mail,
  Smartphone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AbuseDetectionConfig {
  enableAIAnalysis: boolean;
  spamThreshold: number;
  inappropriateThreshold: number;
  maxContentLength: number;
  enablePatternMatching: boolean;
}

interface NotificationConfig {
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  emailAddress?: string;
  notificationThreshold: 'all' | 'medium' | 'high';
  batchNotifications: boolean;
  batchIntervalMinutes: number;
  maxNotificationsPerHour: number;
}

interface AbuseDetectionStats {
  totalAnalyzed: number;
  blockedRequests: number;
  warningRequests: number;
  averageConfidence: number;
  topReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export function AbuseDetectionSettings() {
  const [abuseConfig, setAbuseConfig] = useState<AbuseDetectionConfig>({
    enableAIAnalysis: true,
    spamThreshold: 3,
    inappropriateThreshold: 2,
    maxContentLength: 10000,
    enablePatternMatching: true,
  });

  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>({
    enableEmailNotifications: false,
    enableInAppNotifications: true,
    notificationThreshold: 'medium',
    batchNotifications: true,
    batchIntervalMinutes: 15,
    maxNotificationsPerHour: 10,
  });

  const [stats, setStats] = useState<AbuseDetectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const { toast } = useToast();

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, these would be separate API endpoints
      const [abuseResponse, notificationResponse, statsResponse] = await Promise.allSettled([
        fetch('/api/admin/ai/abuse-detection/config'),
        fetch('/api/admin/ai/notifications/config'),
        fetch('/api/admin/ai/abuse-detection/stats'),
      ]);

      // Handle abuse detection config
      if (abuseResponse.status === 'fulfilled' && abuseResponse.value.ok) {
        const abuseData = await abuseResponse.value.json();
        if (abuseData.success) {
          setAbuseConfig(abuseData.data);
        }
      }

      // Handle notification config
      if (notificationResponse.status === 'fulfilled' && notificationResponse.value.ok) {
        const notificationData = await notificationResponse.value.json();
        if (notificationData.success) {
          setNotificationConfig(notificationData.data);
        }
      }

      // Handle stats
      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const statsData = await statsResponse.value.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch abuse detection configs:', error);
      toast({
        title: "Error",
        description: "Failed to load abuse detection settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfigs = async () => {
    try {
      setSaving(true);

      const [abuseResponse, notificationResponse] = await Promise.allSettled([
        fetch('/api/admin/ai/abuse-detection/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(abuseConfig),
        }),
        fetch('/api/admin/ai/notifications/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationConfig),
        }),
      ]);

      let hasError = false;

      if (abuseResponse.status === 'fulfilled' && !abuseResponse.value.ok) {
        hasError = true;
      }

      if (notificationResponse.status === 'fulfilled' && !notificationResponse.value.ok) {
        hasError = true;
      }

      if (hasError) {
        throw new Error('Failed to save some configurations');
      }

      toast({
        title: "Success",
        description: "Abuse detection settings saved successfully",
      });
    } catch (error) {
      console.error('Failed to save abuse detection configs:', error);
      toast({
        title: "Error",
        description: "Failed to save abuse detection settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testEmailNotification = async () => {
    try {
      setTestingEmail(true);

      const response = await fetch('/api/admin/ai/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          emailAddress: notificationConfig.emailAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send test email');
      }

      toast({
        title: "Test Email Sent",
        description: "Check your email inbox for the test notification",
      });
    } catch (error) {
      console.error('Failed to send test email:', error);
      toast({
        title: "Error",
        description: "Failed to send test email notification",
        variant: "destructive",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Abuse Detection & Notifications</h2>
          <p className="text-muted-foreground">
            Configure content analysis, spam detection, and security notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchConfigs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={saveConfigs} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyzed</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAnalyzed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Content requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.blockedRequests}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalAnalyzed > 0 ? 
                  `${((stats.blockedRequests / stats.totalAnalyzed) * 100).toFixed(1)}% blocked` : 
                  '0% blocked'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.warningRequests}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalAnalyzed > 0 ? 
                  `${((stats.warningRequests / stats.totalAnalyzed) * 100).toFixed(1)}% warned` : 
                  '0% warned'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.averageConfidence * 100)}%</div>
              <p className="text-xs text-muted-foreground">Detection accuracy</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Settings */}
      <Tabs defaultValue="detection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detection">Content Detection</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="analysis">Analysis Results</TabsTrigger>
        </TabsList>

        <TabsContent value="detection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Analysis Settings</CardTitle>
              <CardDescription>
                Configure how content is analyzed for spam and inappropriate material
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI-Powered Analysis</Label>
                  <p className="text-sm text-muted-foreground">
                    Use AI models for advanced content analysis
                  </p>
                </div>
                <Switch
                  checked={abuseConfig.enableAIAnalysis}
                  onCheckedChange={(checked) =>
                    setAbuseConfig({ ...abuseConfig, enableAIAnalysis: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pattern Matching</Label>
                  <p className="text-sm text-muted-foreground">
                    Use predefined patterns to detect spam and inappropriate content
                  </p>
                </div>
                <Switch
                  checked={abuseConfig.enablePatternMatching}
                  onCheckedChange={(checked) =>
                    setAbuseConfig({ ...abuseConfig, enablePatternMatching: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Spam Detection Threshold</Label>
                <div className="px-3">
                  <Slider
                    value={[abuseConfig.spamThreshold]}
                    onValueChange={([value]) =>
                      setAbuseConfig({ ...abuseConfig, spamThreshold: value })
                    }
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Lenient (1)</span>
                    <span>Current: {abuseConfig.spamThreshold}</span>
                    <span>Strict (10)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Inappropriate Content Threshold</Label>
                <div className="px-3">
                  <Slider
                    value={[abuseConfig.inappropriateThreshold]}
                    onValueChange={([value]) =>
                      setAbuseConfig({ ...abuseConfig, inappropriateThreshold: value })
                    }
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Lenient (1)</span>
                    <span>Current: {abuseConfig.inappropriateThreshold}</span>
                    <span>Strict (10)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxContentLength">Maximum Content Length</Label>
                <Input
                  id="maxContentLength"
                  type="number"
                  value={abuseConfig.maxContentLength}
                  onChange={(e) =>
                    setAbuseConfig({ ...abuseConfig, maxContentLength: parseInt(e.target.value) || 10000 })
                  }
                  min={1000}
                  max={100000}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum characters allowed in analyzed content
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how you receive security violation notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <div>
                    <Label>In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show notifications in the admin dashboard
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notificationConfig.enableInAppNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationConfig({ ...notificationConfig, enableInAppNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notifications via email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notificationConfig.enableEmailNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationConfig({ ...notificationConfig, enableEmailNotifications: checked })
                  }
                />
              </div>

              {notificationConfig.enableEmailNotifications && (
                <div className="space-y-2">
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="emailAddress"
                      type="email"
                      value={notificationConfig.emailAddress || ''}
                      onChange={(e) =>
                        setNotificationConfig({ ...notificationConfig, emailAddress: e.target.value })
                      }
                      placeholder="admin@example.com"
                    />
                    <Button
                      variant="outline"
                      onClick={testEmailNotification}
                      disabled={testingEmail || !notificationConfig.emailAddress}
                    >
                      {testingEmail ? 'Testing...' : 'Test'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notification Threshold</Label>
                <Select
                  value={notificationConfig.notificationThreshold}
                  onValueChange={(value: 'all' | 'medium' | 'high') =>
                    setNotificationConfig({ ...notificationConfig, notificationThreshold: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Violations</SelectItem>
                    <SelectItem value="medium">Medium & High Severity</SelectItem>
                    <SelectItem value="high">High Severity Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Batch Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Group multiple notifications together
                  </p>
                </div>
                <Switch
                  checked={notificationConfig.batchNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationConfig({ ...notificationConfig, batchNotifications: checked })
                  }
                />
              </div>

              {notificationConfig.batchNotifications && (
                <div className="space-y-2">
                  <Label htmlFor="batchInterval">Batch Interval (minutes)</Label>
                  <Input
                    id="batchInterval"
                    type="number"
                    value={notificationConfig.batchIntervalMinutes}
                    onChange={(e) =>
                      setNotificationConfig({ 
                        ...notificationConfig, 
                        batchIntervalMinutes: parseInt(e.target.value) || 15 
                      })
                    }
                    min={5}
                    max={120}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="maxNotifications">Max Notifications per Hour</Label>
                <Input
                  id="maxNotifications"
                  type="number"
                  value={notificationConfig.maxNotificationsPerHour}
                  onChange={(e) =>
                    setNotificationConfig({ 
                      ...notificationConfig, 
                      maxNotificationsPerHour: parseInt(e.target.value) || 10 
                    })
                  }
                  min={1}
                  max={100}
                />
                <p className="text-sm text-muted-foreground">
                  Prevent notification spam by limiting hourly notifications per IP
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  Recent content analysis statistics and patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Top Detection Reasons</h4>
                    <div className="space-y-2">
                      {stats.topReasons.map((reason, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{reason.reason}</span>
                          <Badge variant="outline">{reason.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Detection Rate:</span>
                        <span className="ml-2 font-medium">
                          {stats.totalAnalyzed > 0 ? 
                            `${(((stats.blockedRequests + stats.warningRequests) / stats.totalAnalyzed) * 100).toFixed(1)}%` : 
                            '0%'
                          }
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Block Rate:</span>
                        <span className="ml-2 font-medium">
                          {stats.totalAnalyzed > 0 ? 
                            `${((stats.blockedRequests / stats.totalAnalyzed) * 100).toFixed(1)}%` : 
                            '0%'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}