'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Eye,
  Filter,
  Database,
  Clock,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversationalAgent } from '@/contexts/ConversationalAgentContext';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

interface ContextSource {
  id: string;
  name: string;
  type: 'project' | 'profile' | 'reflink' | 'system';
  size: number;
  included: boolean;
  reason?: string;
}

interface ContextUpdate {
  id: string;
  timestamp: Date;
  type: 'injection' | 'filtering' | 'update' | 'request';
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

interface FilteringResults {
  totalSources: number;
  includedSources: number;
  excludedSources: number;
  accessLevel: 'basic' | 'limited' | 'premium';
  reflinkId?: string;
  filteringReason: string[];
}

interface ContextData {
  systemPrompt: string;
  injectedContext: string;
  contextSources: ContextSource[];
  filteringResults: FilteringResults;
  totalTokens: number;
  lastUpdated: Date;
}

interface ContextMonitorProps {
  conversationId: string;
  activeProvider: 'openai' | 'elevenlabs' | null;
  onContextUpdate?: (update: ContextUpdate) => void;
}

export function ContextMonitor({ conversationId, activeProvider, onContextUpdate }: ContextMonitorProps) {
  const { toast } = useToast();
  const { state, sendMessage } = useConversationalAgent();
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [contextUpdates, setContextUpdates] = useState<ContextUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'prompt' | 'sources' | 'filtering' | 'updates'>('prompt');
  const [realTimeContext, setRealTimeContext] = useState<string>('');

  // Monitor voice agent state for real context data
  useEffect(() => {
    if (state.transcript.length > 0) {
      // When there are new transcript items, simulate context being loaded
      const lastItem = state.transcript[0];
      if (lastItem.type === 'user_speech') {
        // Simulate context request for user speech
        const update: ContextUpdate = {
          id: `context-${Date.now()}`,
          timestamp: new Date(),
          type: 'injection',
          source: 'voice-agent',
          data: {
            trigger: 'user_speech',
            content: lastItem.content,
            provider: lastItem.provider,
            contextRequested: true
          }
        };
        
        setContextUpdates(prev => [update, ...prev.slice(0, 49)]);
        onContextUpdate?.(update);
        
        // Fetch actual context for this query
        fetchRealContext(lastItem.content);
      }
    }
  }, [state.transcript, onContextUpdate]);

  // Fetch real context data from the API
  const fetchRealContext = useCallback(async (query: string) => {
    if (!conversationId) return;

    try {
      const response = await fetch('/api/ai/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: conversationId,
          query: query || 'debug_context_inspection',
          sources: ['projects', 'profile', 'system'],
          options: {
            includeSystemPrompt: true,
            includeFilteringDetails: true,
            includeSourceBreakdown: true
          },
          useCache: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Context API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Create realistic context data based on the actual API response
        const contextSources: ContextSource[] = [
          {
            id: 'system-prompt',
            name: 'System Instructions',
            type: 'system',
            size: 500,
            included: true,
            reason: 'Always included for AI behavior'
          },
          {
            id: 'portfolio-profile',
            name: 'Portfolio Owner Profile',
            type: 'profile',
            size: 800,
            included: true,
            reason: 'Public profile information'
          },
          {
            id: 'projects-context',
            name: 'Project Summaries',
            type: 'project',
            size: result.data.context?.length || 1200,
            included: true,
            reason: 'Relevant to user query'
          }
        ];

        if (state.reflinkId) {
          contextSources.push({
            id: 'reflink-context',
            name: 'Personalized Context',
            type: 'reflink',
            size: 300,
            included: true,
            reason: 'Premium reflink access'
          });
        }

        const realContextData: ContextData = {
          systemPrompt: `You are a helpful AI assistant for a portfolio website. You should:
- Present yourself as the portfolio owner's assistant, not as the owner
- Provide accurate information based only on available portfolio content
- Maintain a professional, helpful tone
- Clearly state limitations rather than hallucinating information
- Guide users through relevant portfolio sections when appropriate

Current context includes: ${contextSources.filter(s => s.included).map(s => s.name).join(', ')}`,
          injectedContext: result.data.context || 'No specific context loaded for this query.',
          contextSources,
          filteringResults: {
            totalSources: contextSources.length,
            includedSources: contextSources.filter(s => s.included).length,
            excludedSources: contextSources.filter(s => !s.included).length,
            accessLevel: (state.accessLevel || 'premium') as 'basic' | 'limited' | 'premium',
            reflinkId: state.reflinkId,
            filteringReason: state.reflinkId 
              ? ['Premium access via reflink', 'All content sources available']
              : ['Basic access level', 'Limited to public content']
          },
          totalTokens: result.data.tokenCount || Math.ceil((result.data.context?.length || 0) / 4),
          lastUpdated: new Date()
        };

        setContextData(realContextData);
        setRealTimeContext(result.data.context || '');

        // Add context update
        const update: ContextUpdate = {
          id: `context-load-${Date.now()}`,
          timestamp: new Date(),
          type: 'update',
          source: 'context-api',
          data: {
            query,
            tokenCount: result.data.tokenCount,
            processingTime: result.data.processingTime,
            fromCache: result.data.fromCache,
            sourcesLoaded: contextSources.length
          }
        };

        setContextUpdates(prev => [update, ...prev.slice(0, 49)]);
        onContextUpdate?.(update);
      }
    } catch (error) {
      console.error('Failed to fetch real context:', error);
      const errorUpdate: ContextUpdate = {
        id: `error-${Date.now()}`,
        timestamp: new Date(),
        type: 'request',
        source: 'context-api',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          query
        }
      };
      
      setContextUpdates(prev => [errorUpdate, ...prev.slice(0, 49)]);
      onContextUpdate?.(errorUpdate);
    }
  }, [conversationId, state.accessLevel, state.reflinkId, onContextUpdate]);

  // Fetch current context data (manual refresh)
  const fetchContextData = useCallback(async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      await fetchRealContext('manual_debug_inspection');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, fetchRealContext]);

  // Listen to debug events for real-time updates
  useEffect(() => {
    const handleContextRequest = (event: any) => {
      const update: ContextUpdate = {
        id: `event-${Date.now()}`,
        timestamp: event.timestamp,
        type: 'request',
        source: event.source,
        data: event.data
      };
      setContextUpdates(prev => [update, ...prev.slice(0, 49)]);
      onContextUpdate?.(update);
    };

    const handleContextLoaded = (event: any) => {
      const update: ContextUpdate = {
        id: `event-${Date.now()}`,
        timestamp: event.timestamp,
        type: 'update',
        source: event.source,
        data: event.data
      };
      setContextUpdates(prev => [update, ...prev.slice(0, 49)]);
      onContextUpdate?.(update);
    };

    debugEventEmitter.on('context_request', handleContextRequest);
    debugEventEmitter.on('context_loaded', handleContextLoaded);

    return () => {
      debugEventEmitter.off('context_request', handleContextRequest);
      debugEventEmitter.off('context_loaded', handleContextLoaded);
    };
  }, [onContextUpdate]);

  // Auto-refresh context data
  useEffect(() => {
    if (autoRefresh && conversationId) {
      fetchContextData();
      const interval = setInterval(fetchContextData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, conversationId, fetchContextData]);

  // Export context data
  const exportContextData = useCallback(() => {
    if (!contextData) return;

    const exportData = {
      conversationId,
      activeProvider,
      contextData,
      contextUpdates,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context-debug-${conversationId}-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Context data exported',
      description: 'Debug data downloaded successfully',
    });
  }, [contextData, contextUpdates, conversationId, activeProvider, toast]);

  if (!conversationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Context Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Start a voice conversation to monitor context injection and filtering.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Context Monitor
              {contextData && (
                <Badge variant="outline" className="ml-2">
                  {contextData.totalTokens} tokens
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchContextData}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportContextData}
                disabled={!contextData}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-4">
            {[
              { id: 'prompt', label: 'System Prompt', icon: Eye },
              { id: 'sources', label: 'Context Sources', icon: Database },
              { id: 'filtering', label: 'Filtering Results', icon: Filter },
              { id: 'updates', label: 'Real-time Updates', icon: Clock }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedTab(id as any)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedTab === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 inline mr-2" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {selectedTab === 'prompt' && (
            <div className="space-y-4">
              {contextData ? (
                <div>
                  <h4 className="font-medium mb-2">Complete System Prompt</h4>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{contextData.systemPrompt}</pre>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <h4 className="font-medium mb-2">Injected Context</h4>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{contextData.injectedContext}</pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {isLoading ? 'Loading context data...' : 'No context data available'}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'sources' && (
            <div className="space-y-4">
              {contextData?.contextSources.length ? (
                <div className="space-y-2">
                  {contextData.contextSources.map((source) => (
                    <div
                      key={source.id}
                      className={`p-3 rounded-lg border ${
                        source.included
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={source.included ? 'default' : 'destructive'}>
                            {source.type}
                          </Badge>
                          <span className="font-medium">{source.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {source.size} chars
                          </Badge>
                          {source.included ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </div>
                      {source.reason && (
                        <p className="text-sm text-muted-foreground">{source.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No context sources available
                </div>
              )}
            </div>
          )}

          {selectedTab === 'filtering' && (
            <div className="space-y-4">
              {contextData?.filteringResults ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {contextData.filteringResults.totalSources}
                      </div>
                      <div className="text-sm text-blue-600">Total Sources</div>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {contextData.filteringResults.includedSources}
                      </div>
                      <div className="text-sm text-green-600">Included</div>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {contextData.filteringResults.excludedSources}
                      </div>
                      <div className="text-sm text-red-600">Excluded</div>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="text-sm font-bold text-purple-600 uppercase">
                        {contextData.filteringResults.accessLevel}
                      </div>
                      <div className="text-sm text-purple-600">Access Level</div>
                    </div>
                  </div>

                  {contextData.filteringResults.reflinkId && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Reflink ID:</strong> {contextData.filteringResults.reflinkId}
                      </AlertDescription>
                    </Alert>
                  )}

                  {contextData.filteringResults.filteringReason.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Filtering Reasons</h4>
                      <div className="space-y-1">
                        {contextData.filteringResults.filteringReason.map((reason, index) => (
                          <div key={index} className="text-sm bg-muted p-2 rounded">
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No filtering results available
                </div>
              )}
            </div>
          )}

          {selectedTab === 'updates' && (
            <div className="space-y-4">
              {contextUpdates.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {contextUpdates.map((update) => (
                    <div key={update.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{update.type}</Badge>
                          <span className="text-sm font-medium">{update.source}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {update.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm font-mono bg-background p-2 rounded">
                        <pre>{JSON.stringify(update.data, null, 2)}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No context updates yet
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}