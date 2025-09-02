/**
 * Simplified Conversation Management Admin Interface
 * 
 * Provides comprehensive conversation management, analytics, and debugging
 * capabilities for administrators using the simplified conversation system.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  BarChart3, 
  Download, 
  Trash2, 
  Search, 
  RefreshCw,
  Clock,
  DollarSign,
  Users,
  Zap,
  AlertTriangle,
  Play
} from 'lucide-react';

interface ConversationAnalytics {
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalCost: number;
  averageMessagesPerConversation: number;
  averageResponseTime: number;
  errorRate: number;
  modeBreakdown: {
    text: number;
    voice: number;
    hybrid: number;
  };
  modelUsage: Record<string, number>;
  reflinkUsage: Record<string, number>;
  timeRangeStats: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

interface ConversationSummary {
  id: string;
  sessionId: string;
  reflinkId?: string;
  startedAt: string;
  lastMessageAt?: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
}

export default function ConversationManagement() {
  const [analytics, setAnalytics] = useState<ConversationAnalytics | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: '',
    end: ''
  });

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (selectedDateRange.start && selectedDateRange.end) {
        params.append('startDate', selectedDateRange.start);
        params.append('endDate', selectedDateRange.end);
      }

      const response = await fetch(`/api/ai/conversation/analytics?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.data);
      } else {
        console.error('Failed to load analytics:', data.error);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load conversations list
  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ai/conversation/history?action=search&limit=50');
      const data = await response.json();
      
      if (data.success) {
        setConversations(data.data.conversations || []);
      } else {
        console.error('Failed to load conversations:', data.error);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export conversations
  const exportConversations = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (selectedDateRange.start && selectedDateRange.end) {
        params.append('startDate', selectedDateRange.start);
        params.append('endDate', selectedDateRange.end);
      }

      const response = await fetch(`/api/ai/conversation/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversations-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Export failed');
      }
    } catch (error) {
      console.error('Error exporting conversations:', error);
    }
  };

  // Cleanup old conversations
  const cleanupOldConversations = async (days: number) => {
    if (!confirm(`Are you sure you want to delete conversations older than ${days} days?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ai/conversation/cleanup?action=cleanup&olderThanDays=${days}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully deleted ${data.data.deletedCount} conversations`);
        loadAnalytics();
        loadConversations();
      } else {
        console.error('Cleanup failed:', data.error);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Delete single conversation
  const deleteConversation = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/ai/conversation/cleanup?action=single&sessionId=${sessionId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        loadConversations();
        loadAnalytics();
      } else {
        console.error('Delete failed:', data.error);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // View conversation replay
  const viewReplay = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/ai/conversation/replay?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Open replay in new window or modal
        const replayWindow = window.open('', '_blank', 'width=1200,height=800');
        if (replayWindow) {
          replayWindow.document.write(`
            <html>
              <head>
                <title>Conversation Replay - ${sessionId}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                  .user { background-color: #f0f8ff; }
                  .assistant { background-color: #f8f8f8; }
                  .debug { background-color: #fff8dc; margin-top: 10px; font-size: 12px; }
                  pre { white-space: pre-wrap; word-wrap: break-word; }
                </style>
              </head>
              <body>
                <h1>Conversation Replay</h1>
                <h2>Session: ${sessionId}</h2>
                <div>
                  <strong>Started:</strong> ${new Date(data.data.conversation.startedAt).toLocaleString()}<br>
                  <strong>Messages:</strong> ${data.data.conversation.messageCount}<br>
                  <strong>Tokens:</strong> ${data.data.conversation.totalTokens}<br>
                  <strong>Cost:</strong> $${data.data.conversation.totalCost.toFixed(4)}
                </div>
                <hr>
                ${data.data.timeline.map((step: any) => `
                  <div class="step ${step.message.role}">
                    <h3>Step ${step.step} - ${step.type} (${step.message.role})</h3>
                    <p><strong>Time:</strong> ${new Date(step.timestamp).toLocaleString()}</p>
                    <p><strong>Content:</strong></p>
                    <div>${step.message.content}</div>
                    ${step.debugInfo ? `
                      <div class="debug">
                        <h4>Debug Info:</h4>
                        <p><strong>Processing Time:</strong> ${step.debugInfo.performanceMetrics.totalProcessingTime}ms</p>
                        ${step.debugInfo.error ? `<p><strong>Error:</strong> ${step.debugInfo.error}</p>` : ''}
                        <details>
                          <summary>System Prompt</summary>
                          <pre>${step.debugInfo.systemPrompt}</pre>
                        </details>
                        <details>
                          <summary>Context</summary>
                          <pre>${step.debugInfo.contextString}</pre>
                        </details>
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Error loading replay:', error);
    }
  };

  useEffect(() => {
    loadAnalytics();
    loadConversations();
  }, [selectedDateRange]);

  const filteredConversations = conversations.filter(conv =>
    conv.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conv.reflinkId && conv.reflinkId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conversation Management</h1>
        <Button onClick={() => { loadAnalytics(); loadConversations(); }} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="export">Export & Cleanup</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          {/* Date Range Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Date Range Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Input
                  type="date"
                  value={selectedDateRange.start}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, start: e.target.value }))}
                  placeholder="Start Date"
                />
                <Input
                  type="date"
                  value={selectedDateRange.end}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, end: e.target.value }))}
                  placeholder="End Date"
                />
                <Button 
                  onClick={() => setSelectedDateRange({ start: '', end: '' })}
                  variant="outline"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Overview */}
          {analytics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <MessageSquare className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Conversations</p>
                        <p className="text-2xl font-bold">{analytics.totalConversations}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Messages</p>
                        <p className="text-2xl font-bold">{analytics.totalMessages}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Zap className="h-8 w-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Tokens</p>
                        <p className="text-2xl font-bold">{analytics.totalTokensUsed.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-red-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Cost</p>
                        <p className="text-2xl font-bold">${analytics.totalCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Mode Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Text</span>
                        <Badge variant="secondary">{analytics.modeBreakdown.text}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Voice</span>
                        <Badge variant="secondary">{analytics.modeBreakdown.voice}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Hybrid</span>
                        <Badge variant="secondary">{analytics.modeBreakdown.hybrid}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Avg Messages/Conversation</span>
                        <Badge variant="outline">{analytics.averageMessagesPerConversation.toFixed(1)}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Response Time</span>
                        <Badge variant="outline">{analytics.averageResponseTime.toFixed(0)}ms</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Error Rate</span>
                        <Badge variant={analytics.errorRate > 5 ? "destructive" : "outline"}>
                          {analytics.errorRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Time Range Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{analytics.timeRangeStats.last24Hours}</p>
                      <p className="text-sm text-gray-600">Last 24 Hours</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{analytics.timeRangeStats.last7Days}</p>
                      <p className="text-sm text-gray-600">Last 7 Days</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{analytics.timeRangeStats.last30Days}</p>
                      <p className="text-sm text-gray-600">Last 30 Days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Search by session ID or reflink..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredConversations.map((conv) => (
                  <div key={conv.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{conv.sessionId}</span>
                        {conv.reflinkId && (
                          <Badge variant="secondary">{conv.reflinkId}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Started: {new Date(conv.startedAt).toLocaleString()} • 
                        Messages: {conv.messageCount} • 
                        Tokens: {conv.totalTokens} • 
                        Cost: ${conv.totalCost.toFixed(4)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewReplay(conv.sessionId)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteConversation(conv.sessionId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Export conversation data for analysis or backup purposes.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => exportConversations('json')}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                  <Button onClick={() => exportConversations('csv')}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cleanup Old Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Remove old conversations to free up database space.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={() => cleanupOldConversations(30)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete 30+ Days
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => cleanupOldConversations(90)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete 90+ Days
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => cleanupOldConversations(365)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete 1+ Year
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}