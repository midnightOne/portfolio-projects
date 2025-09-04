'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import the new OpenAI Realtime SDK components
import {
  RealtimeAgent,
  RealtimeSession,
  tool,
  TransportEvent,
  RealtimeItem,
  backgroundResult,
} from '@openai/agents/realtime';
import { z } from 'zod';

// Simple weather tool for testing
const weatherTool = tool({
  name: 'weather',
  description: 'Get the weather in a given location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return backgroundResult(`The weather in ${location} is sunny and 72°F.`);
  },
});

// Create a simple agent for testing
const testAgent = new RealtimeAgent({
  name: 'Test Assistant',
  instructions: 'You are a helpful test assistant. Keep responses brief and friendly.',
  tools: [weatherTool],
});

export default function VoiceTestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const sessionRef = useRef<RealtimeSession<any> | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [events, setEvents] = useState<TransportEvent[]>([]);
  const [history, setHistory] = useState<RealtimeItem[]>([]);
  const [mcpTools, setMcpTools] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      router.push('/admin/login');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    // Initialize the RealtimeSession
    sessionRef.current = new RealtimeSession(testAgent, {
      model: 'gpt-realtime',
      config: {
        audio: {
          output: {
            voice: 'alloy',
          },
        },
      },
    });

    // Set up event listeners
    sessionRef.current.on('transport_event', (event) => {
      setEvents((prev) => [...prev.slice(-49), event]); // Keep last 50 events
      
      // Handle connection state changes from transport events
      if (event.type === 'session.created') {
        setConnectionStatus('Session Created');
      } else if (event.type === 'session.updated') {
        setConnectionStatus('Session Updated');
      } else if (event.type === 'error') {
        setConnectionStatus(`Error: ${event.error?.message || 'Unknown error'}`);
        setIsConnected(false);
      }
    });

    sessionRef.current.on('mcp_tools_changed', (tools) => {
      setMcpTools(tools.map((t) => t.name));
    });

    sessionRef.current.on('history_updated', (history) => {
      setHistory(history);
    });

    sessionRef.current.on('tool_approval_requested', (_context, _agent, approvalRequest) => {
      // Auto-approve for testing
      sessionRef.current?.approve(approvalRequest.approvalItem);
    });

    // Try to listen for connection-related events
    try {
      sessionRef.current.on('connected', () => {
        console.log('Session connected event received');
        setIsConnected(true);
        setConnectionStatus('Connected');
      });

      sessionRef.current.on('disconnected', () => {
        console.log('Session disconnected event received');
        setIsConnected(false);
        setConnectionStatus('Disconnected');
      });

      sessionRef.current.on('error', (error: any) => {
        console.log('Session error event received:', error);
        setConnectionStatus(`Error: ${error.message || 'Unknown error'}`);
        setIsConnected(false);
      });
    } catch (e) {
      console.log('Some connection events not available:', e);
    }

    return () => {
      if (sessionRef.current && isConnected) {
        sessionRef.current.close();
      }
    };
  }, [isConnected]);

  // Monitor connection state
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionRef.current) {
        // Check if we can access session properties to determine if it's really connected
        try {
          // If the session is connected, we should be able to access its state
          // For now, just check if we have events or history as indicators of activity
          if (events.length > 0 || history.length > 0) {
            if (!isConnected) {
              console.log('Detected activity, updating connection state');
              setIsConnected(true);
              setConnectionStatus('Connected (detected activity)');
            }
          }
        } catch (error) {
          console.log('Session state check failed:', error);
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [events.length, history.length, isConnected]);

  const getToken = async () => {
    const response = await fetch('/api/ai/openai/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get token');
    }

    const { token } = await response.json();
    return token;
  };

  const connect = async () => {
    if (isConnected) {
      setConnectionStatus('Disconnecting...');
      try {
        await sessionRef.current?.close();
        setIsConnected(false);
        setConnectionStatus('Disconnected');
      } catch (error) {
        console.error('Disconnect failed:', error);
        setConnectionStatus('Disconnected'); // Still set to disconnected even if close fails
        setIsConnected(false);
      }
    } else {
      try {
        setConnectionStatus('Connecting...');
        console.log('Getting token...');
        const token = await getToken();
        console.log('Token received, connecting to session...');
        
        await sessionRef.current?.connect({
          apiKey: token,
        });
        
        console.log('Session connected successfully');
        setIsConnected(true);
        setConnectionStatus('Connected');
      } catch (error) {
        console.error('Connection failed:', error);
        setIsConnected(false);
        setConnectionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const toggleMute = async () => {
    if (isMuted) {
      await sessionRef.current?.mute(false);
      setIsMuted(false);
    } else {
      await sessionRef.current?.mute(true);
      setIsMuted(true);
    }
  };

  if (status === 'loading') {
    return (
      <AdminLayout>
        <AdminPageLayout
          title="Voice Test"
          description="Test OpenAI Realtime SDK 0.1.0"
          breadcrumbs={[
            { label: "Dashboard", href: "/admin" },
            { label: "AI Assistant", href: "/admin/ai" },
            { label: "Voice Test", href: "/admin/ai/voice-test" }
          ]}
        >
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p>Loading...</p>
            </div>
          </div>
        </AdminPageLayout>
      </AdminLayout>
    );
  }

  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Voice Test - OpenAI Realtime SDK 0.1.0"
        description="Test the new OpenAI Realtime implementation with MCP support"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "AI Assistant", href: "/admin/ai" },
          { label: "Voice Test", href: "/admin/ai/voice-test" }
        ]}
      >
        <div className="space-y-6">
          {/* Connection Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={connect}
                  variant={isConnected ? 'destructive' : 'default'}
                  size="lg"
                >
                  {isConnected ? 'Disconnect' : 'Connect'}
                </Button>
                
                {isConnected && (
                  <Button
                    onClick={toggleMute}
                    variant={isMuted ? 'default' : 'outline'}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                )}
                
                <div className="text-sm text-gray-600">
                  Status: <span className="font-medium">{connectionStatus}</span>
                </div>
                
                <Button
                  onClick={() => {
                    console.log('Session state:', {
                      sessionExists: !!sessionRef.current,
                      isConnected,
                      eventsCount: events.length,
                      historyCount: history.length,
                      mcpToolsCount: mcpTools.length
                    });
                  }}
                  variant="outline"
                  size="sm"
                >
                  Debug State
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* MCP Tools */}
          <Card>
            <CardHeader>
              <CardTitle>Available Tools</CardTitle>
            </CardHeader>
            <CardContent>
              {mcpTools.length === 0 ? (
                <p className="text-sm text-gray-500">No MCP tools available</p>
              ) : (
                <ul className="list-disc pl-4 space-y-1">
                  {mcpTools.map((name) => (
                    <li key={name} className="text-sm">{name}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 text-xs text-gray-400">
                Built-in tools: weather (test tool)
              </div>
            </CardContent>
          </Card>

          {/* Conversation History */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation History ({history.length} items)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">No conversation history yet. Connect and start talking!</p>
                ) : (
                  history.map((item, index) => {
                    // Extract readable content from the item
                    let content = '';
                    let itemType = item.type || 'unknown';
                    
                    if (item.type === 'message' && 'content' in item) {
                      if (Array.isArray(item.content)) {
                        content = item.content
                          .filter((c: any) => c.type === 'text')
                          .map((c: any) => c.text)
                          .join(' ');
                      } else {
                        content = String(item.content);
                      }
                    } else if ('text' in item) {
                      content = String(item.text);
                    } else {
                      content = JSON.stringify(item, null, 2);
                    }

                    return (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium text-xs text-gray-600 mb-1">
                          {itemType} - {new Date().toLocaleTimeString()}
                        </div>
                        <div className="whitespace-pre-wrap">{content}</div>
                        {/* Debug info */}
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer">Debug Info</summary>
                          <pre className="text-xs text-gray-500 mt-1">{JSON.stringify(item, null, 2)}</pre>
                        </details>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transport Events */}
          <Card>
            <CardHeader>
              <CardTitle>Transport Events ({events.length} events)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-64 overflow-y-auto text-xs">
                {events.length === 0 ? (
                  <p className="text-sm text-gray-500">No transport events yet</p>
                ) : (
                  events.slice(-10).map((event, index) => (
                    <div key={index} className="p-1 bg-gray-50 rounded">
                      <span className="font-medium">{event.type}</span>
                      {event.type !== 'transport_event' && (
                        <pre className="mt-1 text-xs">{JSON.stringify(event, null, 2)}</pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Click "Connect" to establish a connection to OpenAI Realtime</p>
              <p>2. Once connected, you can speak directly to the assistant</p>
              <p>3. Try asking about the weather in different locations to test the tool calling</p>
              <p>4. Watch the events and history panels to see the real-time communication</p>
              <p>5. Use "Mute" to temporarily disable microphone input</p>
            </CardContent>
          </Card>
        </div>
      </AdminPageLayout>
    </AdminLayout>
  );
}