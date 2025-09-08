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
  const [activeTab, setActiveTab] = useState<'conversation' | 'connection' | 'transcripts' | 'context' | 'tools' | 'integration' | 'state'>('conversation');

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
    <div className="space-y-6">
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

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Voice AI Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-3 rounded-lg border ${getConnectionStatusColor()}`}>
              <div className="flex items-center gap-2 mb-2">
                {getConnectionStatusIcon()}
                <span className="font-medium">Connection</span>
              </div>
              <p className="text-sm capitalize">{connectionStatus}</p>
            </div>

            <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-600">Provider</span>
              </div>
              <p className="text-sm text-blue-600">
                {selectedProvider === 'openai' ? 'OpenAI Realtime' : 'ElevenLabs'}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-purple-50 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-600">Audio</span>
              </div>
              <p className="text-sm text-purple-600">
                {isRecording() ? 'Recording' : 'Idle'}
              </p>
            </div>
          </div>

          {lastActivity && (
            <div className="mt-4 text-sm text-muted-foreground">
              Last activity: {lastActivity.toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('conversation')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'conversation'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <MessageSquare className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">Voice</span>
        </button>
        <button
          onClick={() => setActiveTab('context')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'context'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Eye className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">Context</span>
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'tools'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Settings className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">Tools</span>
        </button>
        <button
          onClick={() => setActiveTab('state')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'state'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Activity className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">State</span>
        </button>
        <button
          onClick={() => setActiveTab('integration')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'integration'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <CheckCircle className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">Health</span>
        </button>
        <button
          onClick={() => setActiveTab('connection')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'connection'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <RefreshCw className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">Debug</span>
        </button>
        <button
          onClick={() => setActiveTab('transcripts')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'transcripts'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Headphones className="h-4 w-4 inline mr-1" />
          <span className="hidden sm:inline">History</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'conversation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Voice Provider Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">AI Provider</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={selectedProvider === 'openai' ? 'default' : 'outline'}
                      onClick={() => handleProviderSwitch('openai')}
                      disabled={isConnecting || isConnected()}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <span>OpenAI Realtime</span>
                      <Badge variant="outline" className="text-xs">WebRTC</Badge>
                    </Button>
                    <Button
                      variant={selectedProvider === 'elevenlabs' ? 'default' : 'outline'}
                      onClick={() => handleProviderSwitch('elevenlabs')}
                      disabled={isConnecting || isConnected()}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <span>ElevenLabs</span>
                      <Badge variant="outline" className="text-xs">Conversational AI</Badge>
                      <Badge variant="secondary" className="text-xs mt-1">Debug Mode</Badge>
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!isConnected() ? (
                    <Button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="flex-1"
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
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voice Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {!isRecording() ? (
                    <Button
                      onClick={handleStartVoice}
                      disabled={!isConnected()}
                      className="flex-1"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Start Voice Input
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopVoice}
                      variant="destructive"
                      className="flex-1"
                    >
                      <MicOff className="h-4 w-4 mr-2" />
                      Stop Voice Input
                    </Button>
                  )}

                  <Button
                    onClick={handleMute}
                    variant="outline"
                    disabled={!isConnected()}
                  >
                    {state.audioState.isRecording ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Volume: {Math.round(volume * 100)}%</label>
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
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Interrupt AI Speech
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Text Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type a message to send to the AI..."
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
                  >
                    Send
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
                      className="text-xs text-left justify-start"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium mb-2">Debug Actions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Trigger real context loading for testing
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
                        // Test MCP tool calls directly
                        try {
                          const { mcpClient } = await import('@/lib/mcp/client');
                          await mcpClient.initialize();
                          
                          // Test navigation tool
                          const result = await mcpClient.executeTool({
                            name: 'scrollToSection',
                            arguments: { sectionId: 'projects', smooth: true }
                          });
                          
                          toast({
                            title: 'Tool call executed',
                            description: `Navigation tool ${result.success ? 'succeeded' : 'failed'}`,
                          });
                        } catch (error) {
                          toast({
                            title: 'Tool call failed',
                            description: error instanceof Error ? error.message : 'Unknown error',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="text-xs"
                    >
                      Test Tool Calls
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Test server tool call
                        try {
                          const { mcpClient } = await import('@/lib/mcp/client');
                          await mcpClient.initialize();
                          
                          const result = await mcpClient.executeTool({
                            name: 'loadProjectContext',
                            arguments: { projectId: 'sample-project' }
                          });
                          
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
                        // Test multiple tool calls in sequence
                        try {
                          const { mcpClient } = await import('@/lib/mcp/client');
                          await mcpClient.initialize();
                          
                          // Execute multiple tools
                          const tools = [
                            { name: 'highlightText', arguments: { selector: '.project-card', text: 'React', color: 'yellow' } },
                            { name: 'openProjectModal', arguments: { projectId: 'test-project' } },
                            { name: 'focusElement', arguments: { selector: '#main-content' } }
                          ];
                          
                          for (const tool of tools) {
                            await mcpClient.executeTool(tool);
                            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                          }
                          
                          toast({
                            title: 'Multiple tools executed',
                            description: 'Check the Tool Call Monitor for details',
                          });
                        } catch (error) {
                          toast({
                            title: 'Multiple tools failed',
                            description: error instanceof Error ? error.message : 'Unknown error',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="text-xs"
                    >
                      Test Multiple Tools
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Trigger debug events for monitoring system testing
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
                              description: `Triggered ${result.results.length} debug events. Check the monitoring tabs!`,
                            });
                          } else {
                            throw new Error('Failed to trigger debug events');
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
                      🔥 Trigger All Debug Events (Test Monitoring)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Transcript */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Live Conversation Transcript</span>
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
                <div className="bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
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
                                {/* Show tool name for tool calls/results */}
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
                            
                            {/* Content rendering based on type */}
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

                            {/* Metadata */}
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
                                  {/* Show execution time for tool results */}
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
      )}

      {activeTab === 'connection' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection Testing & Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Current State</h4>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm">
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
              </div>

              {state.lastError && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Last Error Details</h4>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <div className="font-mono text-sm text-red-800">
                      <div><strong>Error:</strong> {state.lastError}</div>
                      <div><strong>Type:</strong> {typeof state.lastError}</div>
                      <div><strong>Length:</strong> {state.lastError?.length || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Connection History</h4>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                  <div>Last Connected: {state.connectionState.lastConnected?.toISOString() || 'Never'}</div>
                  <div>Reconnect Attempts: {state.connectionState.reconnectAttempts}</div>
                  <div>Max Reconnect Attempts: {state.connectionState.maxReconnectAttempts}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    console.log('Manual debug log - Full state:', state);
                    console.log('Manual debug log - Last error:', getLastError());
                  }}
                  variant="outline"
                >
                  Log State to Console
                </Button>
                <Button
                  onClick={clearErrors}
                  variant="outline"
                  disabled={!state.lastError}
                >
                  Clear Errors
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'context' && (
        <ContextMonitor
          conversationId={state.conversationMetadata?.sessionId || (isConnected() ? `live-session-${selectedProvider}-${Date.now()}` : '')}
          activeProvider={selectedProvider}
          onContextUpdate={(update) => {
            console.log('Context update:', update);
          }}
        />
      )}

      {activeTab === 'tools' && (
        <ToolCallMonitor
          conversationId={state.conversationMetadata?.sessionId || (isConnected() ? `live-session-${selectedProvider}-${Date.now()}` : '')}
          activeProvider={selectedProvider}
          onToolCallUpdate={(toolCall) => {
            console.log('Tool call update:', toolCall);
          }}
        />
      )}

      {activeTab === 'state' && (
        <ConversationStateInspector
          conversationId={state.conversationMetadata?.sessionId || (isConnected() ? `live-session-${selectedProvider}-${Date.now()}` : '')}
          onStateUpdate={(state) => {
            console.log('State update:', state);
          }}
        />
      )}

      {activeTab === 'integration' && (
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
      )}

      {activeTab === 'transcripts' && (
        <Card>
          <CardHeader>
            <CardTitle>Conversation Transcripts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Transcript management interface will be implemented here.</p>
          </CardContent>
        </Card>
      )}
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