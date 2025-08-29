/**
 * Conversations Management Component
 * 
 * Main interface for managing AI conversations with search, filtering,
 * replay, export, and analytics capabilities.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Play, 
  BarChart3, 
  RefreshCw,
  Calendar,
  MessageSquare,
  Zap,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useAdminConversationHistory } from '@/hooks/use-conversation-history';
import { ConversationReplay } from './conversation-replay';
import { type ConversationRecord, type ConversationSearchOptions } from '@/lib/services/ai/conversation-history-manager';

interface ConversationFilters {
  dateRange: {
    start: string;
    end: string;
  };
  transportMode: string;
  modelUsed: string;
  hasErrors: string;
  reflinkId: string;
  contentSearch: string;
  minTokens: string;
  maxTokens: string;
}

export function ConversationsManagement() {
  const toast = useToast();
  
  const {
    conversations,
    totalConversations,
    hasMore,
    isLoading,
    isSearching,
    error,
    searchConversations,
    loadMoreConversations,
    refreshConversations,
    clearSearch,
    loadConversation,
    deleteConversation,
    exportConversations,
    getStats,
    cleanupOldConversations,
    currentSearchOptions,
    clearError
  } = useAdminConversationHistory();

  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedConversation, setSelectedConversation] = useState<ConversationRecord | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [filters, setFilters] = useState<ConversationFilters>({
    dateRange: {
      start: '',
      end: ''
    },
    transportMode: '',
    modelUsed: '',
    hasErrors: '',
    reflinkId: '',
    contentSearch: '',
    minTokens: '',
    maxTokens: ''
  });

  // Load stats on mount and tab change
  useEffect(() => {
    if (activeTab === 'analytics') {
      loadStats();
    }
  }, [activeTab]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const statsData = await getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load statistics', 'Please try again later');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSearch = async () => {
    const searchOptions: ConversationSearchOptions = {
      limit: 20,
      offset: 0,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    };

    // Apply filters
    if (filters.dateRange.start && filters.dateRange.end) {
      searchOptions.dateRange = {
        start: new Date(filters.dateRange.start),
        end: new Date(filters.dateRange.end)
      };
    }

    if (filters.transportMode) {
      searchOptions.transportMode = filters.transportMode as 'text' | 'voice' | 'hybrid';
    }

    if (filters.modelUsed) {
      searchOptions.modelUsed = filters.modelUsed;
    }

    if (filters.hasErrors) {
      searchOptions.hasErrors = filters.hasErrors === 'true';
    }

    if (filters.reflinkId) {
      searchOptions.reflinkId = filters.reflinkId;
    }

    if (filters.contentSearch) {
      searchOptions.contentSearch = filters.contentSearch;
    }

    if (filters.minTokens) {
      searchOptions.minTokens = parseInt(filters.minTokens);
    }

    if (filters.maxTokens) {
      searchOptions.maxTokens = parseInt(filters.maxTokens);
    }

    await searchConversations(searchOptions);
  };

  const handleClearFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      transportMode: '',
      modelUsed: '',
      hasErrors: '',
      reflinkId: '',
      contentSearch: '',
      minTokens: '',
      maxTokens: ''
    });
    clearSearch();
  };

  const handleViewConversation = async (conversation: ConversationRecord) => {
    try {
      const fullConversation = await loadConversation(conversation.id);
      if (fullConversation) {
        setSelectedConversation(fullConversation);
        setShowReplay(true);
      }
    } catch (error) {
      toast.error('Failed to load conversation', 'Please try again');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteConversation(conversationId);
      toast.success('Conversation deleted', 'The conversation has been permanently deleted');
    } catch (error) {
      toast.error('Failed to delete conversation', 'Please try again');
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'txt') => {
    try {
      await exportConversations({
        format,
        includeMetadata: true,
        includeDebugData: true,
        includeVoiceData: true
      });
      toast.success('Export started', `Conversations are being exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed', 'Please try again');
    }
  };

  const handleCleanup = async () => {
    const days = prompt('Delete conversations older than how many days?', '30');
    if (!days || isNaN(parseInt(days))) return;

    if (!confirm(`Are you sure you want to delete all conversations older than ${days} days? This action cannot be undone.`)) {
      return;
    }

    try {
      const deletedCount = await cleanupOldConversations(parseInt(days));
      toast.success('Cleanup completed', `Deleted ${deletedCount} old conversations`);
      refreshConversations();
    } catch (error) {
      toast.error('Cleanup failed', 'Please try again');
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'voice': return 'bg-green-100 text-green-800';
      case 'hybrid': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (showReplay && selectedConversation) {
    return (
      <ConversationReplay
        conversation={selectedConversation}
        onClose={() => {
          setShowReplay(false);
          setSelectedConversation(null);
        }}
      />
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
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Search & Filter</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Filters
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshConversations}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Search */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search conversation content..."
                    value={filters.contentSearch}
                    onChange={(e) => setFilters(prev => ({ ...prev, contentSearch: e.target.value }))}
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  <Search className="h-4 w-4 mr-1" />
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear
                </Button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Date Range</label>
                    <div className="space-y-2">
                      <Input
                        type="date"
                        value={filters.dateRange.start}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: { ...prev.dateRange, start: e.target.value }
                        }))}
                      />
                      <Input
                        type="date"
                        value={filters.dateRange.end}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: { ...prev.dateRange, end: e.target.value }
                        }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Transport Mode</label>
                    <Select value={filters.transportMode} onValueChange={(value) => 
                      setFilters(prev => ({ ...prev, transportMode: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="All modes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All modes</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="voice">Voice</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Has Errors</label>
                    <Select value={filters.hasErrors} onValueChange={(value) => 
                      setFilters(prev => ({ ...prev, hasErrors: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="All conversations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All conversations</SelectItem>
                        <SelectItem value="true">With errors</SelectItem>
                        <SelectItem value="false">Without errors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Reflink ID</label>
                    <Input
                      placeholder="Enter reflink ID..."
                      value={filters.reflinkId}
                      onChange={(e) => setFilters(prev => ({ ...prev, reflinkId: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Min Tokens</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filters.minTokens}
                      onChange={(e) => setFilters(prev => ({ ...prev, minTokens: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Max Tokens</label>
                    <Input
                      type="number"
                      placeholder="Unlimited"
                      value={filters.maxTokens}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxTokens: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {totalConversations > 0 ? (
                <>
                  Showing {conversations.length} of {totalConversations} conversations
                  {currentSearchOptions && ' (filtered)'}
                </>
              ) : (
                'No conversations found'
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                disabled={conversations.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={conversations.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCleanup}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Cleanup
              </Button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <Card key={conversation.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {conversation.sessionId.slice(-8)}
                        </Badge>
                        {conversation.reflinkId && (
                          <Badge variant="secondary" className="text-xs">
                            Reflink
                          </Badge>
                        )}
                        <Badge className={`${getModeColor(conversation.metadata.conversationMode || 'text')} text-xs`}>
                          {conversation.metadata.conversationMode || 'text'}
                        </Badge>
                        {conversation.metadata.errorCount && conversation.metadata.errorCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {conversation.metadata.errorCount} errors
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Started:</span>
                          <div>{formatTimestamp(conversation.startedAt)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Messages:</span>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {conversation.messageCount}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tokens:</span>
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {conversation.totalTokens.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost:</span>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${conversation.totalCost.toFixed(4)}
                          </div>
                        </div>
                      </div>

                      {/* Preview of first user message */}
                      {conversation.messages.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">First message:</span>
                          <span className="ml-2">
                            {conversation.messages.find(m => m.role === 'user')?.content.slice(0, 100) || 'No user messages'}
                            {(conversation.messages.find(m => m.role === 'user')?.content.length || 0) > 100 && '...'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewConversation(conversation)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewConversation(conversation)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Replay
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteConversation(conversation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={loadMoreConversations}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}

            {conversations.length === 0 && !isLoading && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                    <p>No conversations found</p>
                    <p className="text-xs mt-1">
                      Try adjusting your search filters or check back later
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats ? '...' : stats?.totalConversations?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  All time
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats ? '...' : stats?.totalMessages?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3 inline mr-1" />
                  Avg {stats?.averageMessagesPerConversation?.toFixed(1) || '0'} per conversation
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats ? '...' : stats?.totalTokensUsed?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-muted-foreground">
                  <Zap className="h-3 w-3 inline mr-1" />
                  Avg {stats?.averageTokensPerMessage?.toFixed(0) || '0'} per message
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${loadingStats ? '...' : stats?.totalCost?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  Avg ${stats?.averageCostPerConversation?.toFixed(4) || '0.0000'} per conversation
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transport Mode Breakdown */}
          {stats?.transportModeBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle>Transport Mode Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.transportModeBreakdown).map(([mode, count]) => (
                    <div key={mode} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getModeColor(mode)}>
                          {mode}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">
                        {String(count)} messages
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Model Usage Breakdown */}
          {stats?.modelUsageBreakdown && Object.keys(stats.modelUsageBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Model Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.modelUsageBreakdown).map(([model, count]) => (
                    <div key={model} className="flex items-center justify-between">
                      <div className="text-sm font-medium">{model}</div>
                      <div className="text-sm text-muted-foreground">
                        {String(count)} messages
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Rate */}
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Error Rate</span>
                  <Badge variant={stats?.errorRate > 5 ? "destructive" : "secondary"}>
                    {stats?.errorRate?.toFixed(1) || '0'}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Response Time</span>
                  <span className="text-sm font-medium">
                    {stats?.averageResponseTime?.toFixed(0) || '0'}ms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Management Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Data Retention</h3>
                <p className="text-sm text-muted-foreground">
                  Configure how long conversation data is retained in the system.
                </p>
                <Button variant="outline" onClick={handleCleanup}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Cleanup Old Conversations
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-medium">Export Options</h3>
                <p className="text-sm text-muted-foreground">
                  Export conversation data in various formats for analysis or backup.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleExport('json')}>
                    <Download className="h-4 w-4 mr-1" />
                    Export as JSON
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('csv')}>
                    <Download className="h-4 w-4 mr-1" />
                    Export as CSV
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('txt')}>
                    <Download className="h-4 w-4 mr-1" />
                    Export as Text
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