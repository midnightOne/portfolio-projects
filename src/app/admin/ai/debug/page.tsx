'use client';

/**
 * Admin AI Debug & Test Panel (Phase 3 task 1.3 / D21)
 *
 * Left: conversation tester driving the PRODUCTION public text path
 * (/api/ai/chat via the gateway). Admin sessions are debug-authorized, so every
 * response carries the `_debug` envelope (system prompt, context string, model,
 * retrieval trace, tool trace, usage, timings) — the same envelope the
 * verification flow asserts against.
 *
 * Right: debug inspector for the selected turn, plus a browser over persisted
 * conversation logs (conversation-history-manager). Voice debugging lives at
 * /admin/ai/voice-debug; replay at /admin/ai/conversations.
 */

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, Copy, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface ChatDebugEnvelope {
  requestId: string;
  tier: string;
  rateLimit?: { remainingMinute?: number; remainingDay?: number };
  model?: { alias?: string; resolved?: string };
  retrieval?: Array<Record<string, unknown>>;
  toolCalls?: Array<{ name: string; args?: unknown; ms?: number; ok: boolean; error?: string }>;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd: number; ledgerId: string };
  systemPrompt?: string;
  contextString?: string;
  timings?: { totalMs: number; modelMs?: number };
}

interface TesterMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  debug?: ChatDebugEnvelope;
  error?: string;
}

interface PersistedDebugData {
  sessionId: string;
  timestamp: string;
  input: { content: string; mode: string };
  systemPrompt: string;
  contextString: string;
  aiRequest: { model: string; temperature?: number; messages: unknown[] };
  aiResponse?: { content: string; tokensUsed?: number; cost?: number };
  error?: string;
}

function AIDebugContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  // Conversation tester state (production /api/ai/chat)
  const [messages, setMessages] = useState<TesterMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDebug, setSelectedDebug] = useState<ChatDebugEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Persisted-log browser state
  const [recentSessions, setRecentSessions] = useState<Array<{ sessionId: string; timestamp: string; lastInput: string }>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [persistedDebug, setPersistedDebug] = useState<PersistedDebugData | null>(null);
  const [loadingPersisted, setLoadingPersisted] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session) loadRecentSessions();
  }, [session]);

  const loadRecentSessions = async () => {
    try {
      const response = await fetch('/api/admin/ai/conversation/debug?action=recent-sessions');
      const data = await response.json();
      if (data.success) setRecentSessions(data.data || []);
    } catch (err) {
      console.error('Failed to load recent sessions:', err);
    }
  };

  const loadPersistedDebug = async (sessionId: string) => {
    setLoadingPersisted(true);
    try {
      const response = await fetch(`/api/admin/ai/conversation/debug?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      if (data.success && data.data) {
        setPersistedDebug(data.data);
        toast.success('Debug data loaded', `Persisted debug data for session ${sessionId.slice(-8)}`);
      } else {
        setPersistedDebug(null);
        toast.info('No debug data', 'No persisted debug data for this session');
      }
    } catch (err) {
      toast.error('Failed to load', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingPersisted(false);
    }
  };

  const handleSendMessage = async () => {
    const message = inputText.trim();
    if (!message || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setInputText('');

    const userMessage: TesterMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Bounded history rides in the request (D43 — stateless server)
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const assistantMessage: TesterMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? '',
        timestamp: new Date(),
        debug: data._debug,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (data._debug) {
        setSelectedDebug(data._debug);
      } else {
        toast.info('No _debug envelope', 'Response carried no debug envelope — check DEV_VERIFICATION / admin session');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed';
      setError(errorMessage);
      setMessages((prev) => [
        ...prev,
        { id: `error_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), error: errorMessage },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard', `${label} copied successfully`);
    } catch {
      toast.error('Copy failed', 'Failed to copy to clipboard');
    }
  };

  const formatTimestamp = (timestamp: string | Date) => new Date(timestamp).toLocaleString();

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
      {/* Left Side - Production Chat Tester */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Production Chat Tester</h2>
          <Badge variant="outline" className="text-xs">/api/ai/chat</Badge>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => setError(null)}>Clear</Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Send Message</label>
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage} disabled={isProcessing || !inputText.trim()}>
              {isProcessing ? 'Processing...' : 'Send'}
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { setMessages([]); setSelectedDebug(null); }}
            disabled={isProcessing || messages.length === 0}
          >
            Clear History
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Quick Tests</label>
          <div className="grid grid-cols-1 gap-2">
            {[
              'Tell me about your projects',
              'What technologies do you work with?',
              'overview',
              'How does the kiln regulate temperature?',
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

        <div className="space-y-2">
          <h3 className="font-medium text-sm">Conversation ({messages.length} messages)</h3>
          <div className="bg-muted/30 rounded-lg p-3 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                No messages yet. Start a conversation above!
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-2 rounded text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-50 border-l-2 border-blue-400'
                        : 'bg-gray-50 border-l-2 border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <Badge variant={message.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                          {message.role}
                        </Badge>
                        {message.debug && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-xs px-1"
                            onClick={() => setSelectedDebug(message.debug!)}
                          >
                            <Bug className="h-3 w-3 mr-1" />
                            debug
                          </Button>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    {message.error ? (
                      <p className="text-xs text-destructive">{message.error}</p>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                    )}
                    {message.debug?.usage && (
                      <div className="mt-1 pt-1 border-t border-gray-200 text-xs text-muted-foreground flex gap-3">
                        <span>In: {message.debug.usage.inputTokens}</span>
                        <span>Out: {message.debug.usage.outputTokens}</span>
                        <span>${message.debug.usage.costUsd.toFixed(5)}</span>
                        {message.debug.timings && <span>{message.debug.timings.totalMs}ms</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Debug Inspector */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Copy className="h-5 w-5" />
          <h2 className="text-lg font-semibold">_debug Envelope</h2>
        </div>

        {selectedDebug ? (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <h3 className="font-medium text-sm mb-2">Request</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium">Request ID:</span>
                  <div className="font-mono bg-background p-1 rounded mt-1 break-all">{selectedDebug.requestId}</div>
                </div>
                <div>
                  <span className="font-medium">Tier:</span>
                  <Badge className="ml-1 text-xs">{selectedDebug.tier}</Badge>
                </div>
                <div>
                  <span className="font-medium">Model:</span>
                  <div className="font-mono">{selectedDebug.model?.alias} → {selectedDebug.model?.resolved}</div>
                </div>
                <div>
                  <span className="font-medium">Timings:</span>
                  <div className="font-mono">
                    total {selectedDebug.timings?.totalMs}ms / model {selectedDebug.timings?.modelMs ?? '—'}ms
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">System Prompt</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(selectedDebug.systemPrompt ?? '', 'System prompt')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedDebug.systemPrompt || 'Not exposed'}
              </pre>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Context String (start frame)</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {(selectedDebug.contextString ?? '').length} chars
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedDebug.contextString ?? '', 'Context string')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {selectedDebug.contextString ? (
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedDebug.contextString}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">No context provided</p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <h3 className="font-medium text-sm mb-2">
                Retrieval Trace ({selectedDebug.retrieval?.length ?? 0} chunks)
              </h3>
              {selectedDebug.retrieval && selectedDebug.retrieval.length > 0 ? (
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {JSON.stringify(selectedDebug.retrieval, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">No retrieval this turn</p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <h3 className="font-medium text-sm mb-2">
                Tool Calls ({selectedDebug.toolCalls?.length ?? 0})
              </h3>
              {selectedDebug.toolCalls && selectedDebug.toolCalls.length > 0 ? (
                <div className="space-y-1">
                  {selectedDebug.toolCalls.map((call, i) => (
                    <div key={i} className="text-xs bg-background p-2 rounded flex items-center gap-2">
                      <Badge variant={call.ok ? 'default' : 'destructive'} className="text-xs">
                        {call.ok ? 'ok' : 'fail'}
                      </Badge>
                      <span className="font-mono">{call.name}</span>
                      <span className="text-muted-foreground">{call.ms}ms</span>
                      {call.error && <span className="text-destructive">{call.error}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No tool calls this turn</p>
              )}
            </div>

            {selectedDebug.usage && (
              <div className="bg-muted/50 rounded-lg p-3">
                <h3 className="font-medium text-sm mb-2">Usage & Ledger</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="font-medium">Input tokens:</span> {selectedDebug.usage.inputTokens}</div>
                  <div><span className="font-medium">Output tokens:</span> {selectedDebug.usage.outputTokens}</div>
                  <div><span className="font-medium">Cost:</span> ${selectedDebug.usage.costUsd.toFixed(6)}</div>
                  <div>
                    <span className="font-medium">Ledger ID:</span>
                    <div className="font-mono break-all">{selectedDebug.usage.ledgerId}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <Copy className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">No Debug Data Selected</h3>
            <p className="text-muted-foreground text-sm">
              Send a message with the tester to inspect its _debug envelope.
            </p>
          </div>
        )}

        {/* Persisted conversation browser */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">Persisted Conversations</h3>
            <Button size="sm" variant="ghost" onClick={loadRecentSessions}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <Select
            value={selectedSessionId}
            onValueChange={(value) => {
              setSelectedSessionId(value);
              if (value) loadPersistedDebug(value);
            }}
          >
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select a persisted conversation" />
            </SelectTrigger>
            <SelectContent>
              {recentSessions.map((s) => (
                <SelectItem key={s.sessionId} value={s.sessionId}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{s.sessionId.slice(-8)}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(s.timestamp)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loadingPersisted && (
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Loading persisted debug data…
            </div>
          )}
          {persistedDebug && (
            <div className="mt-3 space-y-2">
              <div className="text-xs">
                <span className="font-medium">Last input:</span> {persistedDebug.input.content}
              </div>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {persistedDebug.systemPrompt}
              </pre>
              {persistedDebug.aiResponse && (
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {persistedDebug.aiResponse.content}
                </pre>
              )}
              {persistedDebug.error && (
                <p className="text-xs text-destructive">{persistedDebug.error}</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Full replay lives at <a className="underline" href="/admin/ai/conversations">/admin/ai/conversations</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AIDebugPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="AI Debug & Test Panel"
        description="Test the production chat path and inspect the _debug envelope (system prompt, context, retrieval, tools, usage)"
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
