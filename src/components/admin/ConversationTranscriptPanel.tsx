'use client';

/**
 * Full-conversation transcript panel (owner, 2026-07-08).
 *
 * The admin view of a conversation is the WHOLE thing at once, read as a chat —
 * every user/assistant turn, tool call + result, navigation/error event, and
 * D49 resume marker, scrollable top to bottom — NOT the stepped Previous/Next
 * replay (that stepper is for replaying a conversation over the live portfolio
 * homepage, a separate surface). Rendered as a right-hand panel beside the
 * conversation list so the list stays visible. Reuses ReplayStepCard so the
 * per-step rendering matches the stepper exactly.
 */

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { ReplayStepCard, type ReplayData } from './ConversationReplayViewer';

interface ConversationTranscriptPanelProps {
  conversationId: string | null;
  onClose?: () => void;
}

export function ConversationTranscriptPanel({ conversationId, onClose }: ConversationTranscriptPanelProps) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/ai/conversation/replay?conversationId=${encodeURIComponent(conversationId)}`)
      .then((r) => r.json())
      .then((res) => setData(res.success ? res.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [conversationId]);

  const timeline = data?.timeline ?? [];
  const legIndex = new Map((data?.legs ?? []).map((leg, i) => [leg.id, i + 1]));

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground text-center px-6">
        Select a conversation to see its full transcript here.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b pb-3 mb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium">Transcript</div>
            <code className="font-mono text-xs text-muted-foreground break-all">{data?.conversation?.id ?? conversationId}</code>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {data && (
          <>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span>{new Date(data.conversation.startedAt).toLocaleString()}</span>
              <span>{data.conversation.messageCount} msgs</span>
              <span>{data.conversation.totalTokens} tok</span>
              <span>${data.conversation.totalCost.toFixed(4)}</span>
              {data.summary.errorCount > 0 && (
                <span className="text-red-600 dark:text-red-400">{data.summary.errorCount} errors</span>
              )}
            </div>
            {data.legs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.legs.map((leg, i) => (
                  <Badge key={leg.id} variant="outline" className="text-[10px]">
                    leg {i + 1}: {leg.provider}{leg.modelAlias ? ` (${leg.modelAlias})` : ''} · {leg.endReason ?? 'open'}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && !data && (
          <p className="text-sm text-muted-foreground text-center py-8">Conversation not found.</p>
        )}
        {!loading && data && timeline.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No messages recorded.</p>
        )}
        {!loading && data && timeline.map((step) => (
          <ReplayStepCard key={step.message.id || step.step} step={step} legIndex={legIndex} />
        ))}
      </div>
    </div>
  );
}
