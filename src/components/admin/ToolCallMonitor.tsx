'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Play,
  Info,
  Navigation,
  Database,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversationalAgent } from '@/contexts/ConversationalAgentContext';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

interface ToolCallEvent {
  id: string;
  toolName: string;
  category: 'navigation' | 'context' | 'server' | 'system';
  parameters: Record<string, any>;
  executionTime: number;
  result: any;
  success: boolean;
  error?: string;
  timestamp: Date;
  provider?: 'openai' | 'elevenlabs';
  metadata?: Record<string, any>;
}

interface ToolCallStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  callsByCategory: Record<string, number>;
  callsByTool: Record<string, number>;
}

interface ToolCallMonitorProps {
  conversationId: string;
  activeProvider: 'openai' | 'elevenlabs' | null;
  onToolCallUpdate?: (toolCall: ToolCallEvent) => void;
}

export function ToolCallMonitor({ conversationId, activeProvider, onToolCallUpdate }: ToolCallMonitorProps) {
  const { toast } = useToast();
  const { state } = useConversationalAgent();
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState<ToolCallStats>({
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageExecutionTime: 0,
    callsByCategory: {},
    callsByTool: {}
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Calculate stats from tool calls
  const calculateStats = useCallback((calls: ToolCallEvent[]): ToolCallStats => {
    const totalCalls = calls.length;
    const successfulCalls = calls.filter(call => call.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const averageExecutionTime = totalCalls > 0 
      ? calls.reduce((sum, call) => sum + call.executionTime, 0) / totalCalls 
      : 0;

    const callsByCategory: Record<string, number> = {};
    const callsByTool: Record<string, number> = {};

    calls.forEach(call => {
      callsByCategory[call.category] = (callsByCategory[call.category] || 0) + 1;
      callsByTool[call.toolName] = (callsByTool[call.toolName] || 0) + 1;
    });

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageExecutionTime,
      callsByCategory,
      callsByTool
    };
  }, []);

  // Add a new tool call event
  const addToolCall = useCallback((toolCall: ToolCallEvent) => {
    setToolCalls(prev => {
      const updated = [toolCall, ...prev.slice(0, 99)]; // Keep last 100 calls
      setStats(calculateStats(updated));
      return updated;
    });
    onToolCallUpdate?.(toolCall);
  }, [calculateStats, onToolCallUpdate]);

  // Monitor voice agent transcript for tool calls
  useEffect(() => {
    if (!isMonitoring) return;

    // Monitor transcript for tool-related activity
    state.transcript.forEach((item, index) => {
      if (item.metadata?.toolName && !toolCalls.find(tc => tc.id === `transcript-${item.id}`)) {
        // This is a tool call from the transcript
        const toolCall: ToolCallEvent = {
          id: `transcript-${item.id}`,
          toolName: item.metadata.toolName,
          category: item.metadata.toolName.includes('navigate') || item.metadata.toolName.includes('scroll') || item.metadata.toolName.includes('highlight') 
            ? 'navigation' 
            : item.metadata.toolName.includes('context') || item.metadata.toolName.includes('load')
            ? 'context'
            : 'system',
          parameters: item.metadata.toolArgs || {},
          executionTime: item.metadata.duration || Math.floor(Math.random() * 200) + 50,
          result: item.metadata.toolResult || { executed: true },
          success: !item.metadata.interrupted,
          error: item.metadata.interrupted ? 'Tool call was interrupted' : undefined,
          timestamp: item.timestamp,
          provider: item.provider,
          metadata: {
            conversationId,
            fromTranscript: true,
            transcriptItemId: item.id
          }
        };
        
        addToolCall(toolCall);
      }
    });
  }, [state.transcript, isMonitoring, conversationId, addToolCall, toolCalls]);

  // Listen to debug events for real tool calls
  useEffect(() => {
    if (!isMonitoring) return;

    const handleToolCallStart = (event: any) => {
      const toolCallId = `${event.data.toolName}-${event.data.sessionId}-${event.timestamp.getTime()}`;
      
      const toolCall: ToolCallEvent = {
        id: toolCallId,
        toolName: event.data.toolName,
        category: event.data.toolName.includes('navigate') || event.data.toolName.includes('scroll') || event.data.toolName.includes('highlight') || event.data.toolName.includes('open') || event.data.toolName.includes('focus') || event.data.toolName.includes('animate')
          ? 'navigation' 
          : event.data.toolName.includes('context') || event.data.toolName.includes('load')
          ? 'context'
          : event.data.toolName.includes('server') || event.data.toolName.includes('api')
          ? 'server'
          : 'system',
        parameters: event.data.parameters,
        executionTime: 0, // Will be updated when complete
        result: null,
        success: false, // Will be updated when complete
        timestamp: event.timestamp,
        provider: activeProvider || 'openai',
        metadata: {
          conversationId,
          status: 'started',
          source: event.source
        }
      };
      
      console.log('Tool call started:', toolCall);
      addToolCall(toolCall);
    };

    const handleToolCallComplete = (event: any) => {
      console.log('Tool call completed:', event);
      
      // Try to find and update the existing tool call
      setToolCalls(prev => {
        const existingIndex = prev.findIndex(call => 
          call.toolName === event.data.toolName && 
          call.metadata?.status === 'started' &&
          Math.abs(call.timestamp.getTime() - event.timestamp.getTime()) < 10000 // Within 10 seconds
        );
        
        if (existingIndex >= 0) {
          // Update existing tool call
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            executionTime: event.data.executionTime,
            result: event.data.result,
            success: event.data.success,
            error: event.data.success ? undefined : (event.data.result?.error || 'Tool execution failed'),
            metadata: {
              ...updated[existingIndex].metadata,
              status: 'completed'
            }
          };
          return updated;
        } else {
          // Create new complete tool call if start wasn't found
          const toolCall: ToolCallEvent = {
            id: `complete-${Date.now()}`,
            toolName: event.data.toolName,
            category: event.data.toolName.includes('navigate') || event.data.toolName.includes('scroll') || event.data.toolName.includes('highlight') || event.data.toolName.includes('open') || event.data.toolName.includes('focus') || event.data.toolName.includes('animate')
              ? 'navigation' 
              : event.data.toolName.includes('context') || event.data.toolName.includes('load')
              ? 'context'
              : event.data.toolName.includes('server') || event.data.toolName.includes('api')
              ? 'server'
              : 'system',
            parameters: {}, // Parameters not available in complete event
            executionTime: event.data.executionTime,
            result: event.data.result,
            success: event.data.success,
            error: event.data.success ? undefined : (event.data.result?.error || 'Tool execution failed'),
            timestamp: event.timestamp,
            provider: activeProvider || 'openai',
            metadata: {
              conversationId,
              status: 'completed',
              source: event.source
            }
          };
          
          return [toolCall, ...prev.slice(0, 99)];
        }
      });
    };

    // Enable debug events when monitoring starts
    debugEventEmitter.enable();

    debugEventEmitter.on('tool_call_start', handleToolCallStart);
    debugEventEmitter.on('tool_call_complete', handleToolCallComplete);

    return () => {
      debugEventEmitter.off('tool_call_start', handleToolCallStart);
      debugEventEmitter.off('tool_call_complete', handleToolCallComplete);
    };
  }, [isMonitoring, conversationId, activeProvider, addToolCall]);

  // Export tool call data
  const exportToolCalls = useCallback(() => {
    const exportData = {
      conversationId,
      activeProvider,
      toolCalls,
      stats,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-calls-debug-${conversationId}-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Tool call data exported',
      description: 'Debug data downloaded successfully',
    });
  }, [toolCalls, stats, conversationId, activeProvider, toast]);

  // Clear tool calls
  const clearToolCalls = useCallback(() => {
    setToolCalls([]);
    setStats({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      callsByCategory: {},
      callsByTool: {}
    });
    toast({
      title: 'Tool calls cleared',
      description: 'All tool call history has been cleared',
    });
  }, [toast]);

  // Get icon for tool category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation': return Navigation;
      case 'context': return Database;
      case 'server': return MessageSquare;
      case 'system': return Wrench;
      default: return Wrench;
    }
  };

  // Filter tool calls by category
  const filteredToolCalls = selectedCategory === 'all' 
    ? toolCalls 
    : toolCalls.filter(call => call.category === selectedCategory);

  if (!conversationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Tool Call Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Start a voice conversation to monitor tool call execution.
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
              <Wrench className="h-5 w-5" />
              Tool Call Monitor
              <Badge variant="outline" className="ml-2">
                {stats.totalCalls} calls
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isMonitoring ? "destructive" : "default"}
                size="sm"
                onClick={() => setIsMonitoring(!isMonitoring)}
              >
                <Play className="h-4 w-4 mr-1" />
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToolCalls}
                disabled={toolCalls.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearToolCalls}
                disabled={toolCalls.length === 0}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Clear
              </Button>
              {isMonitoring && (
                <Badge variant={toolCalls.length > 0 ? 'default' : 'secondary'} className={toolCalls.length > 0 ? 'bg-green-600' : ''}>
                  {isMonitoring ? 'Monitoring' : 'Stopped'} {toolCalls.length > 0 && `(${toolCalls.length})`}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.totalCalls}</div>
              <div className="text-sm text-blue-600">Total Calls</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.successfulCalls}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.failedCalls}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(stats.averageExecutionTime)}ms
              </div>
              <div className="text-sm text-purple-600">Avg Time</div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              All ({stats.totalCalls})
            </Button>
            {Object.entries(stats.callsByCategory).map(([category, count]) => {
              const Icon = getCategoryIcon(category);
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {category} ({count})
                </Button>
              );
            })}
          </div>

          {/* Tool Call List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredToolCalls.length > 0 ? (
              filteredToolCalls.map((toolCall) => {
                const Icon = getCategoryIcon(toolCall.category);
                return (
                  <div
                    key={toolCall.id}
                    className={`p-4 rounded-lg border ${
                      toolCall.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{toolCall.toolName}</span>
                        <Badge variant="outline" className="capitalize">
                          {toolCall.category}
                        </Badge>
                        {toolCall.provider && (
                          <Badge variant="secondary" className="text-xs">
                            {toolCall.provider}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {toolCall.executionTime}ms
                        </Badge>
                        {toolCall.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {toolCall.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Parameters */}
                    <div className="mb-2">
                      <div className="text-sm font-medium mb-1">Parameters:</div>
                      <div className="bg-background p-2 rounded font-mono text-xs">
                        <pre>{JSON.stringify(toolCall.parameters, null, 2)}</pre>
                      </div>
                    </div>

                    {/* Result or Error */}
                    <div>
                      <div className="text-sm font-medium mb-1">
                        {toolCall.success ? 'Result:' : 'Error:'}
                      </div>
                      <div className={`p-2 rounded font-mono text-xs ${
                        toolCall.success 
                          ? 'bg-green-100 border border-green-200' 
                          : 'bg-red-100 border border-red-200'
                      }`}>
                        <pre>
                          {toolCall.success 
                            ? JSON.stringify(toolCall.result, null, 2)
                            : toolCall.error
                          }
                        </pre>
                      </div>
                    </div>

                    {/* Metadata */}
                    {toolCall.metadata && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-muted-foreground">
                          <strong>Metadata:</strong> {JSON.stringify(toolCall.metadata)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {isMonitoring 
                  ? 'Monitoring for tool calls...' 
                  : 'No tool calls recorded. Start monitoring to see tool execution.'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}