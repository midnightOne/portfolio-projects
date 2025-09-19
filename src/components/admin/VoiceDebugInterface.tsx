'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { Separator } from '@/components/ui/separator';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  MessageSquare,
  Activity,
  Headphones,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ConversationalAgentProvider, useConversationalAgent } from '@/contexts/ConversationalAgentContext';
import { ContextMonitor } from './ContextMonitor';
import { ToolCallMonitor } from './ToolCallMonitor';
import { IntegrationValidator } from './IntegrationValidator';
import { ConversationStateInspector } from './ConversationStateInspector';

interface VoiceDebugInterfaceProps { }

function VoiceDebugContent() {
  const { toast } = useToast();
  const {
    state,
    switchProvider,
    connect,
    disconnect,
    startVoiceInput,
    stopVoiceInput,
    mute,
    unmute,
    setVolume,
    sendMessage,
    interrupt,
    clearTranscript,
    exportTranscript,
    isConnected,
    isRecording,
    getLastError,
    clearErrors
  } = useConversationalAgent();

  // Debug: Log state changes
  useEffect(() => {
    console.log('VoiceDebugInterface - State Update:', {
      connectionStatus: state.connectionState.status,
      activeProvider: state.activeProvider,
      lastError: state.lastError,
      errorCount: state.errorCount
    });
  }, [state.connectionState.status, state.activeProvider, state.lastError, state.errorCount]);

  // Local state
  const [textInput, setTextInput] = useState('');
  const [volume, setVolumeState] = useState(1.0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set(['conversation', 'transcript']));

  const togglePanel = (panelId: string) => {
    setExpandedPanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  };

  // Derive state from context instead of local state
  const selectedProvider = state.activeProvider || 'openai';
  const connectionStatus = state.connectionState.status;

  // Update connecting state based on connection status
  useEffect(() => {
    if (state.connectionState.status === 'connecting') {
      setIsConnecting(true);
    } else {
      setIsConnecting(false);
    }
  }, [state.connectionState.status]);

  // Update last activity when transcript changes
  useEffect(() => {
    if (state.transcript.length > 0) {
      setLastActivity(new Date());
    }
  }, [state.transcript.length]);

  const handleProviderSwitch = useCallback(async (provider: 'openai' | 'elevenlabs') => {
    // Don't switch if already on this provider
    if (selectedProvider === provider) {
      return;
    }

    try {
      await switchProvider(provider);
      toast({
        title: 'Provider switched',
        description: `Switched to ${provider === 'openai' ? 'OpenAI Realtime' : 'ElevenLabs'}`,
      });
    } catch (error) {
      toast({
        title: 'Provider switch failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [switchProvider, toast, selectedProvider]);

  const handleConnect = useCallback(async () => {
    try {
      await connect();
      toast({
        title: 'Connected',
        description: `Connected to ${selectedProvider === 'openai' ? 'OpenAI Realtime' : 'ElevenLabs'}`,
      });
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive',
      });
    }
  }, [connect, selectedProvider, toast]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      toast({
        title: 'Disconnected',
        description: 'Voice AI connection closed',
      });
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [disconnect, toast]);

  const handleStartVoice = useCallback(async () => {
    try {
      await startVoiceInput();
      toast({
        title: 'Voice input started',
        description: 'Microphone is now active',
      });
    } catch (error) {
      toast({
        title: 'Voice input failed',
        description: error instanceof Error ? error.message : 'Failed to start microphone',
        variant: 'destructive',
      });
    }
  }, [startVoiceInput, toast]);

  const handleStopVoice = useCallback(async () => {
    try {
      await stopVoiceInput();
      toast({
        title: 'Voice input stopped',
        description: 'Microphone is now inactive',
      });
    } catch (error) {
      toast({
        title: 'Voice stop failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [stopVoiceInput, toast]);

  const handleSendMessage = useCallback(async () => {
    if (!textInput.trim()) return;

    try {
      // sendMessage already handles interrupt internally
      await sendMessage(textInput);
      setTextInput('');
      toast({
        title: 'Message sent',
        description: 'Text message sent to AI (interrupted any ongoing speech)',
      });
    } catch (error) {
      toast({
        title: 'Send failed',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    }
  }, [textInput, sendMessage, toast]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setVolumeState(newVolume);
  }, [setVolume]);

  const handleMute = useCallback(() => {
    if (state.audioState.isRecording) {
      mute();
      toast({
        title: 'Muted',
        description: 'Audio output muted',
      });
    } else {
      unmute();
      toast({
        title: 'Unmuted',
        description: 'Audio output unmuted',
      });
    }
  }, [state.audioState.isRecording, mute, unmute, toast]);

  const handleInterrupt = useCallback(async () => {
    try {
      await interrupt();
      toast({
        title: 'Interrupted',
        description: 'AI speech interrupted',
      });
    } catch (error) {
      toast({
        title: 'Interrupt failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [interrupt, toast]);

  const handleClearTranscript = useCallback(() => {
    clearTranscript();
    toast({
      title: 'Transcript cleared',
      description: 'Conversation history cleared',
    });
  }, [clearTranscript, toast]);

  const handleExportTranscript = useCallback(async () => {
    try {
      const transcript = await exportTranscript();
      const blob = new Blob([transcript], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-transcript-${new Date().toISOString().slice(0, 19)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: 'Transcript exported',
        description: 'Conversation transcript downloaded',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export transcript',
        variant: 'destructive',
      });
    }
  }, [exportTranscript, toast]);

  const getConnectionStatusColor = useCallback(() => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-50 border-green-200';
      case 'connecting': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'reconnecting': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, [connectionStatus]);

  const getConnectionStatusIcon = useCallback(() => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'connecting':
      case 'reconnecting': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  }, [connectionStatus]);

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {getLastError() && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="font-medium mb-1">Voice Connection Error:</div>
              <div className="text-sm bg-red-50 p-3 rounded border border-red-200">
                {getLastError()}
              </div>
              {getLastError()?.includes('session.type') && (
                <div className="text-xs text-red-600 mt-2">
                  <strong>Note:</strong> This is a known issue with the OpenAI Realtime SDK v0.1.0. 
                  Voice functionality may still work despite this error.
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={clearErrors}>
              Clear
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Compact Status Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon()}
            <span className="text-sm font-medium capitalize">{connectionStatus}</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {selectedProvider === 'openai' ? 'OpenAI Realtime' : 'ElevenLabs'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {isRecording() ? 'Recording' : 'Idle'}
            </span>
          </div>
        </div>
        {lastActivity && (
          <div className="text-sm text-muted-foreground">
            Last activity: {lastActivity.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Main Layout - Two Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left Column - Controls (1/3 width) */}
        <div className="space-y-4">
          {/* Voice Provider & Connection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedProvider === 'openai' ? 'default' : 'outline'}
                  onClick={() => handleProviderSwitch('openai')}
                  disabled={isConnecting || isConnected()}
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                >
                  <span className="text-xs">OpenAI</span>
                  <Badge variant="outline" className="text-xs">WebRTC</Badge>
                </Button>
                <Button
                  variant={selectedProvider === 'elevenlabs' ? 'default' : 'outline'}
                  onClick={() => handleProviderSwitch('elevenlabs')}
                  disabled={isConnecting || isConnected()}
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                >
                  <span className="text-xs">ElevenLabs</span>
                  <Badge variant="outline" className="text-xs">AI</Badge>
                </Button>
              </div>

              {!isConnected() ? (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full"
                  size="sm"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Voice Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Voice Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {!isRecording() ? (
                  <Button
                    onClick={handleStartVoice}
                    disabled={!isConnected()}
                    className="flex-1"
                    size="sm"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopVoice}
                    variant="destructive"
                    className="flex-1"
                    size="sm"
                  >
                    <MicOff className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}

                <Button
                  onClick={handleMute}
                  variant="outline"
                  disabled={!isConnected()}
                  size="sm"
                >
                  {state.audioState.isRecording ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Volume: {Math.round(volume * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full"
                  disabled={!isConnected()}
                />
              </div>

              <Button
                onClick={handleInterrupt}
                variant="outline"
                disabled={!isConnected() || state.sessionState.status !== 'speaking'}
                className="w-full"
                size="sm"
              >
                <Pause className="h-4 w-4 mr-2" />
                Interrupt
              </Button>
            </CardContent>
          </Card>

          {/* Text Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Text Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={!isConnected()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!isConnected() || !textInput.trim()}
                  size="sm"
                >
                  Send
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-1">
                {[
                  'Hello, can you hear me?',
                  'Tell me about your capabilities',
                  'What projects are available?',
                  'Navigate to project details'
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setTextInput(suggestion)}
                    disabled={!isConnected()}
                    className="text-xs text-left justify-start h-auto py-1"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Transcript (2/3 width) */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4" />
                  Live Conversation Transcript
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportTranscript}
                    variant="outline"
                    size="sm"
                    disabled={state.transcript.length === 0}
                  >
                    Export
                  </Button>
                  <Button
                    onClick={handleClearTranscript}
                    variant="destructive"
                    size="sm"
                    disabled={state.transcript.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-4 h-[600px] overflow-y-auto">
                {state.transcript.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    No conversation yet. Start speaking or send a text message!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {state.transcript.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="space-y-1">
                        <div className={`p-3 rounded text-sm ${
                          item.type === 'user_speech'
                            ? 'bg-blue-50 border-l-4 border-blue-400'
                            : item.type === 'ai_response'
                              ? 'bg-green-50 border-l-4 border-green-400'
                              : item.type === 'tool_call'
                                ? 'bg-orange-50 border-l-4 border-orange-400'
                                : item.type === 'tool_result'
                                  ? 'bg-purple-50 border-l-4 border-purple-400'
                                  : 'bg-gray-50 border-l-4 border-gray-400'
                          }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                item.type === 'user_speech' ? 'default' :
                                  item.type === 'ai_response' ? 'secondary' :
                                    item.type === 'tool_call' ? 'destructive' :
                                      item.type === 'tool_result' ? 'secondary' : 'outline'
                              } className="text-xs">
                                {item.type === 'user_speech' ? 'User' :
                                  item.type === 'ai_response' ? 'AI' :
                                    item.type === 'tool_call' ? 'Tool Call' :
                                      item.type === 'tool_result' ? 'Tool Result' : 'System'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {item.provider}
                              </Badge>
                              {(item.type === 'tool_call' || item.type === 'tool_result') && item.metadata?.toolName && (
                                <Badge variant="outline" className="text-xs bg-orange-100">
                                  {item.metadata.toolName}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {item.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {item.type === 'tool_call' ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-orange-700">
                                🔧 Calling: {item.metadata?.toolName || 'Unknown Tool'}
                              </p>
                              {item.metadata?.toolArgs && (
                                <div className="bg-orange-100 rounded p-2">
                                  <p className="text-xs font-medium text-orange-800 mb-1">Arguments:</p>
                                  <pre className="text-xs text-orange-700 whitespace-pre-wrap">
                                    {JSON.stringify(item.metadata.toolArgs, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {item.content && (
                                <p className="text-sm text-orange-600 italic">{item.content}</p>
                              )}
                            </div>
                          ) : item.type === 'tool_result' ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-purple-700">
                                ✅ Result from: {item.metadata?.toolName || 'Unknown Tool'}
                              </p>
                              {item.metadata?.toolResult && (
                                <div className="bg-purple-100 rounded p-2">
                                  <p className="text-xs font-medium text-purple-800 mb-1">Result:</p>
                                  <pre className="text-xs text-purple-700 whitespace-pre-wrap">
                                    {typeof item.metadata.toolResult === 'string' 
                                      ? item.metadata.toolResult 
                                      : JSON.stringify(item.metadata.toolResult, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {item.content && (
                                <p className="text-sm text-purple-600">{item.content}</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                          )}

                          {item.metadata && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                                {item.metadata.confidence && (
                                  <span>Confidence: {Math.round(item.metadata.confidence * 100)}%</span>
                                )}
                                {item.metadata.duration && (
                                  <span>Duration: {item.metadata.duration}ms</span>
                                )}
                                {item.metadata.interrupted && (
                                  <Badge variant="destructive" className="text-xs">Interrupted</Badge>
                                )}
                                {item.type === 'tool_result' && item.metadata.duration && (
                                  <span className="text-purple-600">Execution: {item.metadata.duration}ms</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {index < state.transcript.length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Debug and Monitoring Panels */}
      <div className="space-y-4">
        {/* Debug Actions Panel */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => togglePanel('debug')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Debug Actions & Testing
              </div>
              <Button variant="ghost" size="sm">
                {expandedPanels.has('debug') ? '−' : '+'}
              </Button>
            </CardTitle>
          </CardHeader>
          {expandedPanels.has('debug') && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/ai/context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          sessionId: state.conversationMetadata?.sessionId || `debug-session-${selectedProvider}`,
                          query: 'Tell me about your React projects and experience',
                          sources: ['projects', 'profile'],
                          options: { includeSystemPrompt: true },
                          useCache: false
                        }),
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        toast({
                          title: 'Context loaded',
                          description: `Loaded ${result.data?.tokenCount || 0} tokens`,
                        });
                      }
                    } catch (error) {
                      toast({
                        title: 'Context load failed',
                        description: error instanceof Error ? error.message : 'Unknown error',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="text-xs"
                >
                  Test Context Load
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const { uiNavigationTools } = await import('@/lib/voice/UINavigationTools');
                      const result = await uiNavigationTools.scrollIntoView(
                        { selector: '#projects', behavior: 'smooth' },
                        `debug-session-${selectedProvider}`
                      );
                      
                      toast({
                        title: 'Unified tool executed',
                        description: `Navigation tool ${result.success ? 'succeeded' : 'failed'}`,
                      });
                    } catch (error) {
                      toast({
                        title: 'Unified tool failed',
                        description: error instanceof Error ? error.message : 'Unknown error',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="text-xs"
                >
                  Test UI Tools
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/ai/tools/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          toolName: 'loadProjectContext',
                          parameters: { projectId: 'sample-project' },
                          sessionId: `debug-session-${selectedProvider}`,
                          toolCallId: `debug-${Date.now()}`
                        })
                      });
                      
                      const result = await response.json();
                      
                      toast({
                        title: 'Server tool executed',
                        description: `Context loading ${result.success ? 'succeeded' : 'failed'}`,
                      });
                    } catch (error) {
                      toast({
                        title: 'Server tool failed',
                        description: error instanceof Error ? error.message : 'Unknown error',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="text-xs"
                >
                  Test Server Tools
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/test-monitoring', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ testType: 'all' })
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        toast({
                          title: 'Debug events triggered',
                          description: `Triggered ${result.results.length} debug events`,
                        });
                      }
                    } catch (error) {
                      toast({
                        title: 'Debug trigger failed',
                        description: error instanceof Error ? error.message : 'Unknown error',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  🔥 Trigger All Events
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    console.log('Manual debug log - Full state:', state);
                    console.log('Manual debug log - Last error:', getLastError());
                  }}
                  variant="outline"
                  size="sm"
                >
                  Log State to Console
                </Button>
                <Button
                  onClick={clearErrors}
                  variant="outline"
                  size="sm"
                  disabled={!state.lastError}
                >
                  Clear Errors
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Connection Debug Panel */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => togglePanel('connection')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Connection Debug Info
              </div>
              <Button variant="ghost" size="sm">
                {expandedPanels.has('connection') ? '−' : '+'}
              </Button>
            </CardTitle>
          </CardHeader>
          {expandedPanels.has('connection') && (
            <CardContent className="space-y-3">
              <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                <pre>{JSON.stringify({
                  connectionStatus: state.connectionState.status,
                  activeProvider: state.activeProvider,
                  sessionStatus: state.sessionState.status,
                  isRecording: state.audioState.isRecording,
                  lastError: state.lastError,
                  errorCount: state.errorCount,
                  transcriptCount: state.transcript.length
                }, null, 2)}</pre>
              </div>

              {state.lastError && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="font-mono text-xs text-red-800">
                    <div><strong>Error:</strong> {state.lastError}</div>
                    <div><strong>Type:</strong> {typeof state.lastError}</div>
                    <div><strong>Length:</strong> {state.lastError?.length || 'N/A'}</div>
                  </div>
                </div>
              )}

              <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                <div>Last Connected: {state.connectionState.lastConnected?.toISOString() || 'Never'}</div>
                <div>Reconnect Attempts: {state.connectionState.reconnectAttempts}</div>
                <div>Max Reconnect Attempts: {state.connectionState.maxReconnectAttempts}</div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Context Monitor Panel */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => togglePanel('context')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Context Monitor
              </div>
              <Button variant="ghost" size="sm">
                {expandedPanels.has('context') ? '−' : '+'}
              </Button>
            </CardTitle>
          </CardHeader>
          {expandedPanels.has('context') && (
            <CardContent>
              <ContextMonitor
                conversationId={state.conversationMetadata?.sessionId || (isConnected() ? `live-session-${selectedProvider}-${Date.now()}` : '')}
                activeProvider={selectedProvider}
                onContextUpdate={(update) => {
                  console.log('Context update:', update);
                }}
              />
            </CardContent>
          )}
        </Card>

        {/* Tool Call Monitor Panel */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => togglePanel('tools')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Tool Call Monitor
              </div>
              <Button variant="ghost" size="sm">
                {expandedPanels.has('tools') ? '−' : '+'}
              </Button>
            </CardTitle>
          </CardHeader>
          {expandedPanels.has('tools') && (
            <CardContent>
              <ToolCallMonitor
                conversationId={state.conversationMetadata?.sessionId || (isConnected() ? `live-session-${selectedProvider}-${Date.now()}` : '')}
                activeProvider={selectedProvider}
                onToolCallUpdate={(toolCall) => {
                  console.log('Tool call update:', toolCall);
                }}
              />
            </CardContent>
          )}
        </Card>

        {/* State Inspector Panel */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => togglePanel('state')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Conversation State Inspector
              </div>
              <Button variant="ghost" size="sm">
                {expandedPanels.has('state') ? '−' : '+'}
              </Button>
            </CardTitle>
          </CardHeader>
          {expandedPanels.has('state') && (
            <CardContent>
              <ConversationStateInspector
                conversationId={state.conversationMetadata?.sessionId || (isConnected() ? `live-session-${selectedProvider}-${Date.now()}` : '')}
                onStateUpdate={(state) => {
                  console.log('State update:', state);
                }}
              />
            </CardContent>
          )}
        </Card>

        {/* Integration Validator Panel */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => togglePanel('integration')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Integration Health Check
              </div>
              <Button variant="ghost" size="sm">
                {expandedPanels.has('integration') ? '−' : '+'}
              </Button>
            </CardTitle>
          </CardHeader>
          {expandedPanels.has('integration') && (
            <CardContent>
              <IntegrationValidator
                onValidationComplete={(results) => {
                  console.log('Validation results:', results);
                  toast({
                    title: 'Integration validation complete',
                    description: `Overall status: ${results.overall}`,
                    variant: results.overall === 'healthy' ? 'default' : 'destructive'
                  });
                }}
              />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

export function VoiceDebugInterface(_props: VoiceDebugInterfaceProps) {
  return (
    <ConversationalAgentProvider
      defaultProvider="openai"
      autoConnect={false}
      accessLevel="premium"
    >
      <VoiceDebugContent />
    </ConversationalAgentProvider>
  );
}