/**
 * Conversation Replay Component
 * 
 * Provides comprehensive conversation replay functionality for admin debugging.
 * Supports text, voice, and hybrid conversation modes with full context preservation.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  RotateCcw, 
  ChevronDown, 
  ChevronRight,
  Volume2,
  MessageSquare,
  Zap,
  Clock,
  DollarSign,
  User,
  Bot,
  Settings,
  Eye,
  Copy,
  Download
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { type ConversationRecord, type ConversationMessageRecord } from '@/lib/services/ai/conversation-history-manager';

export interface ConversationReplayProps {
  conversation: ConversationRecord;
  onClose?: () => void;
  className?: string;
}

interface ReplayState {
  currentMessageIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  showDebugInfo: boolean;
  expandedSections: Set<string>;
}

export function ConversationReplay({ conversation, onClose, className }: ConversationReplayProps) {
  const toast = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [replayState, setReplayState] = useState<ReplayState>({
    currentMessageIndex: -1,
    isPlaying: false,
    playbackSpeed: 1.0,
    showDebugInfo: false,
    expandedSections: new Set(['conversation-info'])
  });

  const currentMessage = replayState.currentMessageIndex >= 0 
    ? conversation.messages[replayState.currentMessageIndex] 
    : null;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startReplay = () => {
    if (conversation.messages.length === 0) return;

    setReplayState(prev => ({ ...prev, isPlaying: true }));

    intervalRef.current = setInterval(() => {
      setReplayState(prev => {
        const nextIndex = prev.currentMessageIndex + 1;
        
        if (nextIndex >= conversation.messages.length) {
          // End of conversation
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return { ...prev, isPlaying: false };
        }

        return { ...prev, currentMessageIndex: nextIndex };
      });
    }, 2000 / replayState.playbackSpeed); // Base speed: 2 seconds per message
  };

  const pauseReplay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setReplayState(prev => ({ ...prev, isPlaying: false }));
  };

  const resetReplay = () => {
    pauseReplay();
    setReplayState(prev => ({ 
      ...prev, 
      currentMessageIndex: -1, 
      isPlaying: false 
    }));
  };

  const stepForward = () => {
    setReplayState(prev => ({
      ...prev,
      currentMessageIndex: Math.min(prev.currentMessageIndex + 1, conversation.messages.length - 1)
    }));
  };

  const stepBackward = () => {
    setReplayState(prev => ({
      ...prev,
      currentMessageIndex: Math.max(prev.currentMessageIndex - 1, -1)
    }));
  };

  const jumpToMessage = (index: number) => {
    pauseReplay();
    setReplayState(prev => ({
      ...prev,
      currentMessageIndex: index
    }));
  };

  const toggleSection = (sectionId: string) => {
    setReplayState(prev => {
      const newExpanded = new Set(prev.expandedSections);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return { ...prev, expandedSections: newExpanded };
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard', `${label} copied successfully`);
    } catch (error) {
      toast.error('Copy failed', 'Failed to copy to clipboard');
    }
  };

  const exportConversation = () => {
    const exportData = {
      conversation: {
        id: conversation.id,
        sessionId: conversation.sessionId,
        reflinkId: conversation.reflinkId,
        messageCount: conversation.messageCount,
        totalTokens: conversation.totalTokens,
        totalCost: conversation.totalCost,
        startedAt: conversation.startedAt,
        lastMessageAt: conversation.lastMessageAt,
        metadata: conversation.metadata
      },
      messages: conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        tokensUsed: msg.tokensUsed,
        costUsd: msg.costUsd,
        modelUsed: msg.modelUsed,
        transportMode: msg.transportMode,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.sessionId.slice(-8)}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user': return <User className="h-4 w-4" />;
      case 'assistant': return <Bot className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Conversation Replay</h2>
          <Badge variant="outline" className="font-mono text-xs">
            {conversation.sessionId.slice(-8)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportConversation}
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel - Conversation Info & Controls */}
        <div className="space-y-4">
          {/* Conversation Overview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Conversation Info</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('conversation-info')}
                >
                  {replayState.expandedSections.has('conversation-info') ? 
                    <ChevronDown className="h-3 w-3" /> : 
                    <ChevronRight className="h-3 w-3" />
                  }
                </Button>
              </div>
            </CardHeader>
            <Collapsible open={replayState.expandedSections.has('conversation-info')}>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium">Started:</span>
                      <div className="text-muted-foreground">
                        {formatTimestamp(conversation.startedAt)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Last Message:</span>
                      <div className="text-muted-foreground">
                        {conversation.lastMessageAt ? 
                          formatTimestamp(conversation.lastMessageAt) : 
                          'N/A'
                        }
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Messages:</span>
                      <div className="text-muted-foreground">{conversation.messageCount}</div>
                    </div>
                    <div>
                      <span className="font-medium">Tokens:</span>
                      <div className="text-muted-foreground">{conversation.totalTokens.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="font-medium">Cost:</span>
                      <div className="text-muted-foreground">${conversation.totalCost.toFixed(4)}</div>
                    </div>
                    <div>
                      <span className="font-medium">Mode:</span>
                      <Badge className={`${getModeColor(conversation.metadata.conversationMode || 'text')} text-xs`}>
                        {conversation.metadata.conversationMode || 'text'}
                      </Badge>
                    </div>
                  </div>
                  
                  {conversation.reflinkId && (
                    <div>
                      <span className="font-medium text-xs">Reflink:</span>
                      <div className="font-mono text-xs bg-muted p-1 rounded mt-1">
                        {conversation.reflinkId}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Playback Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Playback Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stepBackward}
                  disabled={replayState.currentMessageIndex <= -1}
                >
                  <SkipBack className="h-3 w-3" />
                </Button>
                
                <Button
                  variant={replayState.isPlaying ? "secondary" : "default"}
                  size="sm"
                  onClick={replayState.isPlaying ? pauseReplay : startReplay}
                  disabled={conversation.messages.length === 0}
                >
                  {replayState.isPlaying ? 
                    <Pause className="h-3 w-3" /> : 
                    <Play className="h-3 w-3" />
                  }
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stepForward}
                  disabled={replayState.currentMessageIndex >= conversation.messages.length - 1}
                >
                  <SkipForward className="h-3 w-3" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetReplay}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Progress:</span>
                  <span>
                    {replayState.currentMessageIndex + 1} / {conversation.messages.length}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${conversation.messages.length > 0 ? 
                        ((replayState.currentMessageIndex + 1) / conversation.messages.length) * 100 : 
                        0}%` 
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Speed: {replayState.playbackSpeed}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={replayState.playbackSpeed}
                  onChange={(e) => setReplayState(prev => ({ 
                    ...prev, 
                    playbackSpeed: parseFloat(e.target.value) 
                  }))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-debug"
                  checked={replayState.showDebugInfo}
                  onChange={(e) => setReplayState(prev => ({ 
                    ...prev, 
                    showDebugInfo: e.target.checked 
                  }))}
                />
                <label htmlFor="show-debug" className="text-xs">
                  Show debug info
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Message Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Message Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {conversation.messages.map((message, index) => (
                    <div
                      key={message.id}
                      className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                        index === replayState.currentMessageIndex
                          ? 'bg-primary text-primary-foreground'
                          : index <= replayState.currentMessageIndex
                          ? 'bg-muted'
                          : 'bg-background hover:bg-muted/50'
                      }`}
                      onClick={() => jumpToMessage(index)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getRoleIcon(message.role)}
                        <Badge variant="outline" className="text-xs">
                          {message.role}
                        </Badge>
                        {message.transportMode && (
                          <Badge className={`${getModeColor(message.transportMode)} text-xs`}>
                            {message.transportMode}
                          </Badge>
                        )}
                      </div>
                      <div className="truncate">
                        {message.content.slice(0, 50)}
                        {message.content.length > 50 && '...'}
                      </div>
                      <div className="text-muted-foreground mt-1">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Current Message Display */}
        <div className="lg:col-span-2 space-y-4">
          {currentMessage ? (
            <>
              {/* Current Message */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(currentMessage.role)}
                      <CardTitle className="text-sm">
                        {currentMessage.role.charAt(0).toUpperCase() + currentMessage.role.slice(1)} Message
                      </CardTitle>
                      <Badge variant="outline">
                        #{replayState.currentMessageIndex + 1}
                      </Badge>
                      {currentMessage.transportMode && (
                        <Badge className={getModeColor(currentMessage.transportMode)}>
                          {currentMessage.transportMode}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(currentMessage.content, 'Message content')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(currentMessage.timestamp)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-muted/30 p-3 rounded">
                      <pre className="text-sm whitespace-pre-wrap font-sans">
                        {currentMessage.content}
                      </pre>
                    </div>

                    {/* Message Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {currentMessage.tokensUsed && (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          <span>{currentMessage.tokensUsed} tokens</span>
                        </div>
                      )}
                      {currentMessage.costUsd && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>${currentMessage.costUsd.toFixed(4)}</span>
                        </div>
                      )}
                      {currentMessage.metadata.processingTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{currentMessage.metadata.processingTime}ms</span>
                        </div>
                      )}
                      {currentMessage.modelUsed && (
                        <div className="flex items-center gap-1">
                          <Settings className="h-3 w-3" />
                          <span>{currentMessage.modelUsed}</span>
                        </div>
                      )}
                    </div>

                    {/* Voice Data */}
                    {currentMessage.metadata.voiceData && (
                      <div className="bg-green-50 p-3 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-sm text-green-800">Voice Data</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {currentMessage.metadata.voiceData.duration && (
                            <div>
                              <span className="font-medium">Duration:</span>
                              <div>{currentMessage.metadata.voiceData.duration}s</div>
                            </div>
                          )}
                          {currentMessage.metadata.voiceData.voiceModel && (
                            <div>
                              <span className="font-medium">Voice Model:</span>
                              <div>{currentMessage.metadata.voiceData.voiceModel}</div>
                            </div>
                          )}
                          {currentMessage.metadata.voiceData.audioUrl && (
                            <div className="col-span-2">
                              <span className="font-medium">Audio:</span>
                              <audio controls className="w-full mt-1">
                                <source src={currentMessage.metadata.voiceData.audioUrl} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Navigation Commands */}
                    {currentMessage.metadata.navigationCommands && currentMessage.metadata.navigationCommands.length > 0 && (
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm text-blue-800">Navigation Commands</span>
                        </div>
                        <div className="space-y-2">
                          {currentMessage.metadata.navigationCommands.map((cmd, index) => (
                            <div key={index} className="bg-white p-2 rounded text-xs">
                              <div className="font-mono">
                                {cmd.type}: {cmd.target}
                              </div>
                              {Object.keys(cmd.parameters).length > 0 && (
                                <div className="text-muted-foreground mt-1">
                                  {JSON.stringify(cmd.parameters)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Debug Information */}
                    {replayState.showDebugInfo && currentMessage.metadata.debugInfo && (
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <Settings className="h-4 w-4 text-gray-600" />
                          <span className="font-medium text-sm text-gray-800">Debug Information</span>
                        </div>
                        <div className="space-y-3">
                          {currentMessage.metadata.debugInfo.systemPrompt && (
                            <div>
                              <div className="font-medium text-xs mb-1">System Prompt:</div>
                              <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                {currentMessage.metadata.debugInfo.systemPrompt}
                              </pre>
                            </div>
                          )}
                          {currentMessage.metadata.debugInfo.contextString && (
                            <div>
                              <div className="font-medium text-xs mb-1">Context String:</div>
                              <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                {currentMessage.metadata.debugInfo.contextString}
                              </pre>
                            </div>
                          )}
                          {currentMessage.metadata.debugInfo.aiRequest && (
                            <div>
                              <div className="font-medium text-xs mb-1">AI Request:</div>
                              <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                {JSON.stringify(currentMessage.metadata.debugInfo.aiRequest, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <Play className="h-8 w-8 mx-auto mb-2" />
                  <p>Start replay to view messages</p>
                  <p className="text-xs mt-1">
                    {conversation.messages.length} messages available
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}