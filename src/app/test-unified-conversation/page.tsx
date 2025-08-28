/**
 * Test page for Unified Conversation System
 * Demonstrates mode-agnostic conversation pipeline with text, voice, and hybrid inputs
 */

'use client';

import React, { useState } from 'react';
import { useUnifiedConversation } from '@/hooks/use-unified-conversation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export default function TestUnifiedConversationPage() {
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<'text' | 'voice' | 'hybrid'>('text');

  const {
    messages,
    isProcessing,
    currentMode,
    sessionId,
    isConnected,
    transportState,
    activeTransport,
    error,
    sendMessage,
    switchMode,
    switchTransport,
    clearHistory,
    clearError
  } = useUnifiedConversation({
    initialMode: 'text',
    autoConnect: true,
    defaultTransport: 'http'
  });

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      await sendMessage(inputText, selectedMode);
      setInputText('');
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

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'voice': return 'bg-green-100 text-green-800';
      case 'hybrid': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Unified Conversation System Test</h1>
          <p className="text-gray-600">
            Test the mode-agnostic conversation pipeline with text, voice, and hybrid inputs
          </p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Session ID:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {sessionId}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Connected:</span>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Active Transport:</span>
              <Badge variant="secondary">
                {activeTransport || 'None'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Current Mode:</span>
              <Badge className={getModeColor(currentMode)}>
                {currentMode}
              </Badge>
            </div>
            {transportState && (
              <div className="flex items-center justify-between">
                <span>Quality:</span>
                <Badge variant={transportState.quality === 'excellent' ? 'default' : 'secondary'}>
                  {transportState.quality || 'Unknown'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message}</span>
              <Button variant="outline" size="sm" onClick={clearError}>
                Clear
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Conversation Mode</label>
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

            {/* Clear History */}
            <div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearHistory}
                disabled={isProcessing || messages.length === 0}
              >
                Clear History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Message Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Send Message</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message..."
                disabled={isProcessing || !isConnected}
                onKeyPress={(e) => {
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
            <p className="text-xs text-gray-500 mt-2">
              Mode: <span className="font-medium">{selectedMode}</span> | 
              Press Enter to send
            </p>
          </CardContent>
        </Card>

        {/* Conversation History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Conversation History ({messages.length} messages)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No messages yet. Start a conversation above!
              </p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.map((message, index) => (
                  <div key={message.id} className="space-y-2">
                    <div className={`p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-blue-50 border-l-4 border-blue-400' 
                        : 'bg-gray-50 border-l-4 border-gray-400'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>
                            {message.role}
                          </Badge>
                          <Badge className={getModeColor(message.inputMode)}>
                            {message.inputMode}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Message Metadata */}
                      {message.metadata && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-500 space-y-1">
                            {message.metadata.tokensUsed && (
                              <div>Tokens: {message.metadata.tokensUsed}</div>
                            )}
                            {message.metadata.cost && (
                              <div>Cost: ${message.metadata.cost.toFixed(4)}</div>
                            )}
                            {message.metadata.model && (
                              <div>Model: {message.metadata.model}</div>
                            )}
                            {message.metadata.processingTime && (
                              <div>Processing: {message.metadata.processingTime}ms</div>
                            )}
                            {message.metadata.navigationCommands && message.metadata.navigationCommands.length > 0 && (
                              <div>Navigation Commands: {message.metadata.navigationCommands.length}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {index < messages.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'Tell me about your projects',
                'What technologies do you work with?',
                'Show me your experience',
                'Navigate to project details',
                'What makes you unique?',
                'Help me understand your background'
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => setInputText(suggestion)}
                  disabled={isProcessing}
                  className="text-left justify-start"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}