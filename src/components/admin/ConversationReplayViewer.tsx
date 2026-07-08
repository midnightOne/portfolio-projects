'use client';

/**
 * Interactive stepped conversation replay (owner, 2026-07-07) — replaces the
 * old static window.open() + document.write() HTML dump with a real
 * Previous/Next stepper through the full timeline: turns, tool calls,
 * labeled navigation/error events, and D49 session-resume markers.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export interface ReplayStep {
  step: number;
  timestamp: string;
  type: 'marker' | 'input' | 'system' | 'response' | 'navigation' | 'error' | 'clip';
  legId: string | null;
  message: {
    id: string;
    role: string;
    content: string;
    tokensUsed?: number;
    cost?: number;
    model?: string;
    mode?: string;
    metadata?: any;
  };
  debugInfo: {
    systemPrompt?: string;
    contextString?: string;
    aiRequest?: any;
    aiResponse?: any;
    error?: string;
    performanceMetrics?: { totalProcessingTime?: number };
  } | null;
}

export interface ReplayData {
  conversation: {
    id: string;
    sessionId: string;
    reflinkId?: string;
    startedAt: string;
    lastMessageAt?: string;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
  };
  legs: Array<{
    id: string;
    provider: string;
    modelAlias?: string;
    modelId?: string;
    startedAt: string;
    endedAt?: string;
    endReason?: string;
  }>;
  timeline: ReplayStep[];
  summary: {
    totalSteps: number;
    errorCount: number;
    modeBreakdown: { text: number; voice: number; hybrid: number };
  };
}

interface ConversationReplayViewerProps {
  /** Logical session id; resolves to the latest conversation under it. */
  sessionId?: string | null;
  /** Exact DB conversation id (cuid) — preferred when known (browser passes it). */
  conversationId?: string | null;
  onClose: () => void;
}

export const TYPE_STYLES: Record<string, string> = {
  input: 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600',
  response: 'bg-green-50 dark:bg-green-950/40 border-green-400 dark:border-green-600',
  system: 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600',
  navigation: 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600',
  error: 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-600',
  marker: 'bg-orange-50 dark:bg-orange-950/40 border-2 border-dashed border-orange-400 dark:border-orange-600',
  // D50 clip: dashed cyan — visually distinct from model speech (green) on
  // purpose; replay must show what the visitor actually heard (Req 13.5).
  clip: 'bg-cyan-50 dark:bg-cyan-950/40 border-2 border-dashed border-cyan-400 dark:border-cyan-600',
};

export const TYPE_LABELS: Record<string, string> = {
  input: 'User',
  response: 'AI',
  system: 'Tool',
  navigation: 'Navigation',
  error: 'Error',
  marker: 'Marker',
  clip: 'Clip (client audio)',
};

export function ConversationReplayViewer({ sessionId, conversationId, onClose }: ConversationReplayViewerProps) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const key = conversationId ?? sessionId ?? null;

  useEffect(() => {
    if (!key) {
      setData(null);
      return;
    }
    const query = conversationId
      ? `conversationId=${encodeURIComponent(conversationId)}`
      : `sessionId=${encodeURIComponent(sessionId!)}`;
    setLoading(true);
    setStepIndex(0);
    fetch(`/api/ai/conversation/replay?${query}`)
      .then(r => r.json())
      .then(res => setData(res.success ? res.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [key, conversationId, sessionId]);

  const timeline = data?.timeline ?? [];
  const step = timeline[stepIndex];
  const legIndex = new Map((data?.legs ?? []).map((leg, i) => [leg.id, i + 1]));

  const goPrev = () => setStepIndex(i => Math.max(0, i - 1));
  const goNext = () => setStepIndex(i => Math.min(timeline.length - 1, i + 1));

  useEffect(() => {
    if (!key) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeline.length]);

  return (
    <Dialog open={!!key} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Conversation Replay</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {data?.conversation?.id ?? key}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!loading && !data && (
          <p className="text-sm text-muted-foreground text-center py-8">Conversation not found.</p>
        )}

        {!loading && data && (
          <>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pb-2 border-b">
              <span>Started: {new Date(data.conversation.startedAt).toLocaleString()}</span>
              <span>Messages: {data.conversation.messageCount}</span>
              <span>Tokens: {data.conversation.totalTokens}</span>
              <span>Cost: ${data.conversation.totalCost.toFixed(4)}</span>
              {data.summary.errorCount > 0 && (
                <span className="text-red-600">Errors: {data.summary.errorCount}</span>
              )}
            </div>

            {data.legs.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {data.legs.map((leg, i) => (
                  <Badge key={leg.id} variant="outline" className="text-xs">
                    leg {i + 1}: {leg.provider}{leg.modelAlias ? ` (${leg.modelAlias})` : ''} · {leg.endReason ?? 'open'}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-[200px]">
              {step ? (
                <ReplayStepCard step={step} legIndex={legIndex} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No steps recorded.</p>
              )}
            </div>
          </>
        )}

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {timeline.length > 0 ? `Step ${stepIndex + 1} of ${timeline.length}` : ''}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={goPrev} disabled={stepIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button size="sm" variant="outline" onClick={goNext} disabled={stepIndex >= timeline.length - 1}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReplayStepCard({ step, legIndex }: { step: ReplayStep; legIndex: Map<string, number> }) {
  const markerType = step.message.metadata?.markerType;

  return (
    <div className={`p-4 rounded border-l-4 text-sm text-foreground ${TYPE_STYLES[step.type] ?? 'bg-gray-50 dark:bg-gray-900/60 border-gray-400'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{TYPE_LABELS[step.type] ?? step.type}</Badge>
          {step.legId && legIndex.has(step.legId) && (
            <Badge variant="outline" className="text-xs">leg {legIndex.get(step.legId)}</Badge>
          )}
          {step.message.mode && <Badge variant="outline" className="text-xs">{step.message.mode}</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</span>
      </div>

      {step.type === 'marker' ? (
        <div>
          <p className="font-medium">{markerType === 'session_resumed' ? '🟢 Session resumed' : '🔴 Session disruption'}</p>
          <p className="whitespace-pre-wrap mt-1">{step.message.content}</p>
        </div>
      ) : (
        <p className="whitespace-pre-wrap">{step.message.content}</p>
      )}

      {step.message.metadata?.reasoning && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">
            Reasoning (hidden by default)
          </summary>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
            {step.message.metadata.reasoning}
          </p>
        </details>
      )}

      {step.debugInfo?.aiRequest && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">Tool call detail</summary>
          <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2">
            {JSON.stringify(step.debugInfo.aiRequest, null, 2)}
          </pre>
          {step.debugInfo.aiResponse && (
            <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2">
              {JSON.stringify(step.debugInfo.aiResponse, null, 2)}
            </pre>
          )}
        </details>
      )}

      {(step.type === 'navigation' || step.type === 'error') && step.message.metadata?.detail && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">Detail</summary>
          <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2">
            {step.message.metadata.detail}
          </pre>
        </details>
      )}

      {step.debugInfo?.error && (
        <p className="text-xs text-red-600 mt-2">Error: {step.debugInfo.error}</p>
      )}
    </div>
  );
}
