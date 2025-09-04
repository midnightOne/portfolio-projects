'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  Download,
  RefreshCw,
  Play,
  Pause,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Clock,
  MessageSquare,
  Info,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversationalAgent } from '@/contexts/ConversationalAgentContext';

interface ConversationMetadata {
  conversationId: string;
  startTime: Date;
  duration: number;
  messageCount: number;
  toolCallCount: number;
  contextUpdateCount: number;
  provider: 'openai' | 'elevenlabs' | null;
  accessLevel: 'basic' | 'limited' | 'premium';
  reflinkId?: string;
}

interface ConversationStateInspectorProps {
  conversationId: string;
  onStateUpdate?: (state: any) => void;
}

export function ConversationStateInspector({ conversationId, onStateUpdate }: ConversationStateInspectorProps) {
  const { toast } = useToast();
  const {
    state,
    isConnected,
    isRecording,
    getLastError
  } = useConversationalAgent();

  const [metadata, setMetadata] = useState<ConversationMetadata>({
    conversationId,
    startTime: new Date(),
    duration: 0,
    messageCount: 0,
    toolCallCount: 0,
    contextUpdateCount: 0,
    provider: state.activeProvider,
    accessLevel: 'premium',
    reflinkId: undefined
  });

  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'connection' | 'session' | 'audio' | 'conversation'>('connection');

  // Update metadata based on state changes
  useEffect(() => {
    setMetadata(prev => ({
      ...prev,
      provider: state.activeProvider,
      messageCount: state.transcript.length,
      duration: Date.now() - prev.startTime.getTime()
    }));
    
    onStateUpdate?.(state);
  }, [state, onStateUpdate]);

  // Export conversation state
  const exportConversationState = useCallback(() => {
    const exportData = {
      conversationId,
      metadata,
      state: {
        activeProvider: state.activeProvider,
        connectionState: state.connectionState,
        sessionState: state.sessionState,
        audioState: state.audioState,
        transcript: state.transcript,
        conversationMetadata: state.conversationMetadata,
        availableTools: state.availableTools,
        pendingToolCalls: state.pendingToolCalls,
        errorCount: state.errorCount,
        lastError: state.lastError
      },
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-state-${conversationId}-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Conversation state exported',
      description: 'Complete state data downloaded successfully',
    });
  }, [conversationId, metadata, state, toast]);

  // Get connection status details
  const getConnectionDetails = () => {
    const { connectionState } = state;
    return {
      status: connectionState.status,
      lastConnected: connectionState.lastConnected,
      reconnectAttempts: connectionState.reconnectAttempts,
      maxReconnectAttempts: connectionState.maxReconnectAttempts,
      isConnected: isConnected(),
      provider: state.activeProvider
    };
  };

  // Get session status details
  const getSessionDetails = () => {
    const { sessionState } = state;
    return {
      status: sessionState.status,
      isAudioEnabled: sessionState.isAudioEnabled,
      isMuted: sessionState.isMuted,
      conversationActive: state.transcript.length > 0,
      toolsAvailable: state.availableTools.length,
      pendingCalls: state.pendingToolCalls.length
    };
  };

  // Get audio status details
  const getAudioDetails = () => {
    const { audioState } = state;
    return {
      isRecording: audioState.isRecording,
      isPlaying: audioState.isPlaying,
      volume: audioState.volume,
      config: audioState.config,
      microphoneActive: isRecording(),
      speakerActive: audioState.isPlaying
    };
  };

  // Get conversation details
  const getConversationDetails = () => {
    return {
      messageCount: state.transcript.length,
      lastMessage: state.transcript[0],
      conversationMetadata: state.conversationMetadata,
      errorCount: state.errorCount,
      lastError: getLastError(),
      duration: metadata.duration
    };
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!conversationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Conversation State Inspector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Start a voice conversation to inspect conversation state and metadata.
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
              <Activity className="h-5 w-5" />
              Conversation State Inspector
              <Badge variant="outline" className="ml-2">
                {formatDuration(metadata.duration)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInspecting(!isInspecting)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {isInspecting ? 'Stop Inspecting' : 'Start Inspecting'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportConversationState}
              >
                <Download className="h-4 w-4 mr-1" />
                Export State
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Metadata Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metadata.messageCount}</div>
              <div className="text-sm text-blue-600">Messages</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{metadata.toolCallCount}</div>
              <div className="text-sm text-green-600">Tool Calls</div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm font-bold text-purple-600 uppercase">
                {metadata.provider || 'None'}
              </div>
              <div className="text-sm text-purple-600">Provider</div>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-sm font-bold text-orange-600 uppercase">
                {metadata.accessLevel}
              </div>
              <div className="text-sm text-orange-600">Access Level</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-4">
            {[
              { id: 'connection', label: 'Connection', icon: Wifi },
              { id: 'session', label: 'Session', icon: MessageSquare },
              { id: 'audio', label: 'Audio', icon: Mic },
              { id: 'conversation', label: 'Conversation', icon: Clock }
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
          {selectedTab === 'connection' && (
            <div className="space-y-4">
              {(() => {
                const details = getConnectionDetails();
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        {details.isConnected ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">Connection Status</span>
                      </div>
                      <Badge variant={details.isConnected ? 'default' : 'destructive'}>
                        {details.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Provider Information</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm">
                            <div><strong>Active Provider:</strong> {details.provider || 'None'}</div>
                            <div><strong>Available:</strong> {state.availableProviders.join(', ')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Connection Details</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm">
                            <div><strong>Last Connected:</strong> {details.lastConnected?.toLocaleString() || 'Never'}</div>
                            <div><strong>Reconnect Attempts:</strong> {details.reconnectAttempts}/{details.maxReconnectAttempts}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedTab === 'session' && (
            <div className="space-y-4">
              {(() => {
                const details = getSessionDetails();
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Session Status</span>
                      </div>
                      <Badge variant="outline">{details.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Session State</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>Audio Enabled:</span>
                              <Badge variant={details.isAudioEnabled ? 'default' : 'secondary'}>
                                {details.isAudioEnabled ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Muted:</span>
                              <Badge variant={details.isMuted ? 'destructive' : 'default'}>
                                {details.isMuted ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Conversation Active:</span>
                              <Badge variant={details.conversationActive ? 'default' : 'secondary'}>
                                {details.conversationActive ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Tools & Calls</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm space-y-1">
                            <div><strong>Available Tools:</strong> {details.toolsAvailable}</div>
                            <div><strong>Pending Calls:</strong> {details.pendingCalls}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedTab === 'audio' && (
            <div className="space-y-4">
              {(() => {
                const details = getAudioDetails();
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        {details.microphoneActive ? (
                          <Mic className="h-4 w-4 text-green-600" />
                        ) : (
                          <MicOff className="h-4 w-4 text-gray-600" />
                        )}
                        <span className="font-medium">Audio Status</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={details.isRecording ? 'default' : 'secondary'}>
                          Recording: {details.isRecording ? 'On' : 'Off'}
                        </Badge>
                        <Badge variant={details.isPlaying ? 'default' : 'secondary'}>
                          Playing: {details.isPlaying ? 'On' : 'Off'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Audio State</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>Microphone:</span>
                              <Badge variant={details.microphoneActive ? 'default' : 'secondary'}>
                                {details.microphoneActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Speaker:</span>
                              <Badge variant={details.speakerActive ? 'default' : 'secondary'}>
                                {details.speakerActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Volume:</span>
                              <span>{Math.round(details.volume * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Audio Configuration</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm space-y-1">
                            <div><strong>Sample Rate:</strong> {details.config.sampleRate}Hz</div>
                            <div><strong>Channels:</strong> {details.config.channels}</div>
                            <div><strong>Bit Depth:</strong> {details.config.bitDepth}</div>
                            <div><strong>Echo Cancellation:</strong> {details.config.echoCancellation ? 'On' : 'Off'}</div>
                            <div><strong>Noise Suppression:</strong> {details.config.noiseSuppression ? 'On' : 'Off'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedTab === 'conversation' && (
            <div className="space-y-4">
              {(() => {
                const details = getConversationDetails();
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">Conversation Details</span>
                      </div>
                      <Badge variant="outline">{formatDuration(details.duration)}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Conversation Stats</div>
                        <div className="bg-background p-3 rounded border">
                          <div className="text-sm space-y-1">
                            <div><strong>Messages:</strong> {details.messageCount}</div>
                            <div><strong>Duration:</strong> {formatDuration(details.duration)}</div>
                            <div><strong>Errors:</strong> {details.errorCount}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Last Activity</div>
                        <div className="bg-background p-3 rounded border">
                          {details.lastMessage ? (
                            <div className="text-sm">
                              <div><strong>Type:</strong> {details.lastMessage.type}</div>
                              <div><strong>Time:</strong> {details.lastMessage.timestamp.toLocaleTimeString()}</div>
                              <div><strong>Content:</strong> {details.lastMessage.content.substring(0, 50)}...</div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No messages yet</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {details.lastError && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <strong>Last Error:</strong> {details.lastError}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}