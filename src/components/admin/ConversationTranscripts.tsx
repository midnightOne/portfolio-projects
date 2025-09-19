'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Search,
  Download,
  Trash2,
  RefreshCw,
  Calendar,
  Filter,
  Eye,
  BarChart3,
  MessageSquare,
  Clock,
  User,
  Bot,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { 
  transcriptService, 
  ConversationTranscript, 
  TranscriptFilter,
  TranscriptExportOptions 
} from '@/services/TranscriptService';

export function ConversationTranscripts() {
  const toast = useToast();
  const [transcripts, setTranscripts] = useState<ConversationTranscript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<ConversationTranscript | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  
  // Filters
  const [filter, setFilter] = useState<TranscriptFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'all' | 'openai' | 'elevenlabs'>('all');
  
  // Export options
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    loadTranscripts();
    loadAnalytics();
  }, []);

  const loadTranscripts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const currentFilter: TranscriptFilter = {
        ...filter,
        provider: selectedProvider === 'all' ? undefined : selectedProvider,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      };

      const result = await transcriptService.getTranscripts(currentFilter);
      
      if (result.success && result.data) {
        setTranscripts(result.data);
      } else {
        throw new Error(result.error || 'Failed to load transcripts');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transcripts';
      setError(errorMessage);
      toast.error('Load failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const result = await transcriptService.getAnalytics();
      if (result.success && result.data) {
        setAnalytics(result.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadTranscripts();
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await transcriptService.searchTranscripts(searchQuery, filter);
      
      if (result.success && result.data) {
        // Convert search results back to transcript format
        const searchTranscripts = result.data.map(item => item.transcript);
        setTranscripts(searchTranscripts);
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      toast.error('Search failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const exportOptions: TranscriptExportOptions = {
        format: exportFormat,
        includeMetadata,
        includeAnalytics,
        timeFormat: 'iso'
      };

      const result = await transcriptService.exportTranscripts(filter, exportOptions);
      
      if (result.success && result.data && result.filename) {
        // Create download
        const blob = new Blob([result.data], { 
          type: exportFormat === 'json' ? 'application/json' : 
                exportFormat === 'csv' ? 'text/csv' : 'text/plain'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Export completed', `Transcripts exported as ${result.filename}`);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export failed', errorMessage);
    }
  };

  const handleDeleteTranscript = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this transcript? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await transcriptService.deleteTranscript(sessionId);
      
      if (result.success) {
        setTranscripts(prev => prev.filter(t => t.sessionId !== sessionId));
        toast.success('Transcript deleted', 'Conversation transcript has been deleted');
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      toast.error('Delete failed', errorMessage);
    }
  };

  const toggleTranscriptExpansion = (sessionId: string) => {
    setExpandedTranscripts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'user_speech': return <User className="h-4 w-4 text-blue-600" />;
      case 'ai_response': return <Bot className="h-4 w-4 text-green-600" />;
      case 'tool_call': return <Settings className="h-4 w-4 text-purple-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case 'user_speech': return <Badge className="bg-blue-100 text-blue-800">User</Badge>;
      case 'ai_response': return <Badge className="bg-green-100 text-green-800">AI</Badge>;
      case 'tool_call': return <Badge className="bg-purple-100 text-purple-800">Tool</Badge>;
      default: return <Badge variant="outline">System</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
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
              <MessageSquare className="h-5 w-5" />
              Conversation Transcripts
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowAnalytics(!showAnalytics)}
                variant="outline"
                size="sm"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
              <Button
                onClick={loadTranscripts}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcripts..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Provider</label>
                  <Select 
                    value={selectedProvider} 
                    onValueChange={(value: 'all' | 'openai' | 'elevenlabs') => setSelectedProvider(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      <SelectItem value="openai">OpenAI Realtime</SelectItem>
                      <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Date From</label>
                  <Input
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Date To</label>
                  <Input
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={loadTranscripts} disabled={loading}>
                  Apply Filters
                </Button>
                <Button 
                  onClick={() => {
                    setSelectedProvider('all');
                    setDateFrom('');
                    setDateTo('');
                    setSearchQuery('');
                    setFilter({});
                    loadTranscripts();
                  }}
                  variant="outline"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* Export Options */}
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Export Format:</label>
              <Select value={exportFormat} onValueChange={(value: 'json' | 'csv' | 'txt') => setExportFormat(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="txt">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                />
                Include Metadata
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeAnalytics}
                  onChange={(e) => setIncludeAnalytics(e.target.checked)}
                />
                Include Analytics
              </label>
            </div>
            
            <Button onClick={handleExport} className="ml-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Panel */}
      {showAnalytics && analytics && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">{analytics.totalSessions}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">{analytics.totalMessages}</div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">{Math.round(analytics.averageSessionDuration / 1000)}s</div>
                <div className="text-sm text-muted-foreground">Avg Session Duration</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">{Math.round(analytics.responseTimeStats.average)}ms</div>
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcripts List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading transcripts...
            </CardContent>
          </Card>
        ) : transcripts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No transcripts found matching your search.' : 'No conversation transcripts available.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          transcripts.map((transcript) => (
            <Card key={transcript.sessionId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => toggleTranscriptExpansion(transcript.sessionId)}
                      variant="ghost"
                      size="sm"
                    >
                      {expandedTranscripts.has(transcript.sessionId) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <div className="font-medium">
                        Session {transcript.sessionId.slice(-8)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimestamp(transcript.session.startTime)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {transcript.session.provider}
                    </Badge>
                    <Badge variant="secondary">
                      {transcript.analytics.userMessageCount + transcript.analytics.aiMessageCount} messages
                    </Badge>
                    <Button
                      onClick={() => handleDeleteTranscript(transcript.sessionId)}
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {expandedTranscripts.has(transcript.sessionId) && (
                <CardContent>
                  {/* Session Info */}
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Duration</div>
                        <div className="text-muted-foreground">
                          {transcript.session.totalDuration 
                            ? `${Math.round(transcript.session.totalDuration / 1000)}s`
                            : 'N/A'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Avg Response Time</div>
                        <div className="text-muted-foreground">
                          {Math.round(transcript.analytics.averageResponseTime)}ms
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Tool Calls</div>
                        <div className="text-muted-foreground">
                          {transcript.analytics.toolCallCount}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Interruptions</div>
                        <div className="text-muted-foreground">
                          {transcript.analytics.interruptionCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {transcript.items.map((item, index) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getMessageTypeIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getMessageTypeBadge(item.type)}
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(item.timestamp)}
                            </span>
                            {item.metadata?.confidence && (
                              <Badge variant="outline" className="text-xs">
                                {Math.round(item.metadata.confidence * 100)}% confidence
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm bg-muted/30 p-2 rounded">
                            {item.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}