'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, Copy, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useUnifiedConversation } from '@/hooks/use-unified-conversation';

interface DebugData {
  sessionId: string;
  timestamp: string;
  input: {
    content: string;
    mode: string;
    metadata?: any;
  };
  systemPrompt: string;
  contextString: string;
  aiRequest: {
    model: string;
    temperature: number;
    messages: any[];
  };
  aiResponse?: {
    content: string;
    tokensUsed?: number;
    cost?: number;
  };
  error?: string;
}

function AIDebugContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  
  // Debug panel state
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['request-info']));
  const [recentSessions, setRecentSessions] = useState<Array<{sessionId: string, timestamp: string, lastInput: string}>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Conversation tester state
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<'text' | 'voice' | 'hybrid'>('text');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, provider: string}>>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      router.push('/admin/login');
      return;
    }
  }, [session, status, router]);

  // Load available models and recent sessions
  useEffect(() => {
    const loadModels = async () => {
      if (!session) return;
      
      try {
        const response = await fetch('/api/admin/ai/available-models');
        const data = await response.json();
        
        if (data.success && data.data.unified) {
          setAvailableModels(data.data.unified);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };

    const loadRecentSessions = async () => {
      if (!session) return;
      
      try {
        const response = await fetch('/api/admin/ai/conversation/debug?action=recent-sessions');
        const data = await response.json();
        
        if (data.success) {
          setRecentSessions(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load recent sessions:', error);
      }
    };

    loadModels();
    loadRecentSessions();
  }, [session]);

  // Unified conversation hook
  const {
    messages,
    isProcessing,
    currentMode,
    currentModel,
    sessionId,
    isConnected,
    transportState,
    activeTransport,
    error: conversationError,
    sendMessage,
    switchMode,
    switchTransport,
    switchModel,
    clearHistory,
    clearError
  } = useUnifiedConversation({
    initialMode: 'text',
    autoConnect: true,
    defaultTransport: 'http',
    defaultModel: selectedModel
  });

  // Update selected session when conversation tester session changes
  useEffect(() => {
    if (sessionId && sessionId !== selectedSessionId) {
      setSelectedSessionId(sessionId);
    }
  }, [sessionId, selectedSessionId]);

  const loadDebugData = async (targetSessionId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the provided session ID, selected session ID, or conversation tester session ID
      const useSessionId = targetSessionId || selectedSessionId || sessionId;
      const url = useSessionId 
        ? `/api/admin/ai/conversation/debug?sessionId=${encodeURIComponent(useSessionId)}`
        : '/api/admin/ai/conversation/debug';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setDebugData(data.data);
        if (data.data) {
          toast.success('Debug data loaded', `Debug data for session ${useSessionId ? useSessionId.slice(-8) : 'latest'} retrieved successfully`);
        } else {
          toast.info('No debug data', `No debug data available for session ${useSessionId ? useSessionId.slice(-8) : 'latest'}`);
        }
      } else {
        throw new Error(data.error?.message || 'Failed to load debug data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load debug data';
      setError(errorMessage);
      toast.error('Failed to load debug data', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSessions = async () => {
    try {
      const response = await fetch('/api/admin/ai/conversation/debug?action=recent-sessions');
      const data = await response.json();
      
      if (data.success) {
        setRecentSessions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard', `${label} copied successfully`);
    } catch (error) {
      toast.error('Copy failed', 'Failed to copy to clipboard');
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp: string | Date) => {
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

  // Conversation handlers
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      await sendMessage(inputText, selectedMode, selectedModel);
      setInputText('');
      // Auto-load debug data after sending message (wait a bit for processing)
      setTimeout(() => {
        loadDebugData();
        loadRecentSessions();
      }, 1500);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleModeSwitch = async (mode: 'text' | 'voice' | 'hybrid') => {
    try {
      await switchMode(mode);
      setSelectedMode(mode);
    } catch (error) {
      console.error('Failed to switch mode:', error);
    }
  };

  const handleTransportSwitch = async (transport: 'http' | 'websocket' | 'webrtc') => {
    try {
      await switchTransport(transport);
    } catch (error) {
      console.error('Failed to switch transport:', error);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Side - Conversation Tester */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Conversation Tester</h2>
        </div>

        {/* Connection Status */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm">Connection Status</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Session:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {sessionId ? sessionId.slice(-8) : 'None'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Connected:</span>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Transport:</span>
              <Badge variant="secondary">{activeTransport || 'None'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Mode:</span>
              <Badge className={getModeColor(currentMode)}>{currentMode}</Badge>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {(error || conversationError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error || conversationError?.message}</span>
              <Button variant="outline" size="sm" onClick={() => {
                setError(null);
                clearError();
              }}>
                Clear
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <div className="space-y-4">
          {/* Mode Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Mode</label>
            <div className="flex gap-2">
              {(['text', 'voice', 'hybrid'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={selectedMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeSwitch(mode)}
                  disabled={isProcessing}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Model</label>
            <Select 
              value={selectedModel} 
              onValueChange={(value) => {
                setSelectedModel(value);
                switchModel(value);
              }}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {model.provider}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="gpt-4o" disabled>
                    Loading models...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Transport Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Transport</label>
            <div className="flex gap-2">
              {(['http', 'websocket', 'webrtc'] as const).map((transport) => (
                <Button
                  key={transport}
                  variant={activeTransport === transport ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTransportSwitch(transport)}
                  disabled={isProcessing}
                >
                  {transport.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Send Message</label>
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              disabled={isProcessing || !isConnected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isProcessing || !isConnected || !inputText.trim()}
            >
              {isProcessing ? 'Processing...' : 'Send'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearHistory}
              disabled={isProcessing || messages.length === 0}
            >
              Clear History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDebugData()}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh Current
            </Button>
          </div>
        </div>

        {/* Test Suggestions */}
        <div>
          <label className="text-sm font-medium mb-2 block">Quick Tests</label>
          <div className="grid grid-cols-1 gap-2">
            {[
              'Tell me about your projects',
              'What technologies do you work with?',
              'Show me your experience',
              'Navigate to project details'
            ].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => setInputText(suggestion)}
                disabled={isProcessing}
                className="text-left justify-start text-xs"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>

        {/* Conversation History */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm">
            Conversation History ({messages.length} messages)
          </h3>
          <div className="bg-muted/30 rounded-lg p-3 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                No messages yet. Start a conversation above!
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div key={message.id} className="space-y-1">
                    <div className={`p-2 rounded text-sm ${
                      message.role === 'user' 
                        ? 'bg-blue-50 border-l-2 border-blue-400' 
                        : 'bg-gray-50 border-l-2 border-gray-400'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <Badge variant={message.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                            {message.role}
                          </Badge>
                          <Badge className={`${getModeColor(message.inputMode)} text-xs`}>
                            {message.inputMode}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Message Metadata */}
                      {message.metadata && (
                        <div className="mt-1 pt-1 border-t border-gray-200">
                          <div className="text-xs text-muted-foreground flex gap-3">
                            {message.metadata.tokensUsed && (
                              <span>Tokens: {message.metadata.tokensUsed}</span>
                            )}
                            {message.metadata.cost && (
                              <span>Cost: ${message.metadata.cost.toFixed(4)}</span>
                            )}
                            {message.metadata.processingTime && (
                              <span>Time: {message.metadata.processingTime}ms</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {index < messages.length - 1 && <Separator className="my-1" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Debug Information */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Debug Information</h2>
          </div>
          {sessionId && (
            <div className="text-xs text-muted-foreground">
              Current Session: <span className="font-mono">{sessionId.slice(-8)}</span>
            </div>
          )}
        </div>

        {/* Conversation Selector */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">Select Conversation</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadRecentSessions}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            <Select 
              value={selectedSessionId || ''} 
              onValueChange={(value) => {
                setSelectedSessionId(value);
                if (value) {
                  loadDebugData(value);
                }
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a conversation to debug" />
              </SelectTrigger>
              <SelectContent>
                {sessionId && (
                  <SelectItem value={sessionId}>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">Current</Badge>
                      <span className="font-mono text-xs">{sessionId.slice(-8)}</span>
                    </div>
                  </SelectItem>
                )}
                {recentSessions
                  .filter(session => session.sessionId !== sessionId)
                  .map((session) => (
                    <SelectItem key={session.sessionId} value={session.sessionId}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{session.sessionId.slice(-8)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(session.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-48">
                          {session.lastInput}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDebugData()}
                disabled={loading}
                className="flex-1"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Load Debug Data
              </Button>
              {selectedSessionId && selectedSessionId !== sessionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSessionId(sessionId);
                    if (sessionId) {
                      loadDebugData(sessionId);
                    }
                  }}
                >
                  Back to Current
                </Button>
              )}
            </div>
          </div>
        </div>

        {debugData ? (
          <div className="space-y-3">
            {/* Request Information */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Request Information</h3>
                <Badge variant="outline" className="text-xs">
                  {formatTimestamp(debugData.timestamp)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium">Session ID:</span>
                  <div className={`font-mono bg-background p-1 rounded mt-1 break-all flex items-center gap-2 ${
                    debugData.sessionId === sessionId ? 'border border-green-200 bg-green-50' : 
                    debugData.sessionId === selectedSessionId ? 'border border-blue-200 bg-blue-50' : ''
                  }`}>
                    <span>{debugData.sessionId}</span>
                    {debugData.sessionId === sessionId && (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                        Current
                      </Badge>
                    )}
                    {debugData.sessionId === selectedSessionId && debugData.sessionId !== sessionId && (
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                        Selected
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Mode:</span>
                  <Badge className="ml-1 text-xs">{debugData.input.mode}</Badge>
                </div>
                <div>
                  <span className="font-medium">Model:</span>
                  <div className="font-mono">{debugData.aiRequest.model}</div>
                </div>
                <div>
                  <span className="font-medium">Temperature:</span>
                  <div className="font-mono">{debugData.aiRequest.temperature}</div>
                </div>
              </div>
            </div>

            {/* User Input */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">User Input</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(debugData.input.content, 'User input')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {debugData.input.content}
              </pre>
            </div>

            {/* System Prompt */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">System Prompt</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(debugData.systemPrompt, 'System prompt')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                {debugData.systemPrompt}
              </pre>
            </div>

            {/* Context String */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Context String</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {debugData.contextString.length} chars
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(debugData.contextString, 'Context string')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {debugData.contextString ? (
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {debugData.contextString}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">No context provided</p>
              )}
            </div>

            {/* Full AI Request */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Full AI Request</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {debugData.aiRequest.messages.length} messages
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(JSON.stringify(debugData.aiRequest, null, 2), 'AI request')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(debugData.aiRequest, null, 2)}
              </pre>
            </div>

            {/* AI Response */}
            {debugData.aiResponse && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">AI Response</h3>
                  <div className="flex items-center gap-2">
                    {debugData.aiResponse.tokensUsed && (
                      <Badge variant="outline" className="text-xs">
                        {debugData.aiResponse.tokensUsed} tokens
                      </Badge>
                    )}
                    {debugData.aiResponse.cost && (
                      <Badge variant="outline" className="text-xs">
                        ${debugData.aiResponse.cost.toFixed(4)}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(debugData.aiResponse!.content, 'AI response')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {debugData.aiResponse.content}
                </pre>
              </div>
            )}

            {/* Error */}
            {debugData.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Error
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(debugData.error!, 'Error details')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap text-destructive">
                  {debugData.error}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Copy className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">No Debug Data Available</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Send a message using the conversation tester to generate debug data.
            </p>
            <Button onClick={() => loadDebugData()} disabled={loading} size="sm">
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Load Debug Data
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIDebugPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="AI Debug & Test Panel"
        description="Test AI conversations and debug system prompts, context data, and requests"
        breadcrumbs={[
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Debug Panel', href: '/admin/ai/debug' }
        ]}
      >
        <AIDebugContent />
      </AdminPageLayout>
    </AdminLayout>
  );
}