'use client';

/**
 * Interactive stepped conversation replay (owner, 2026-07-07) — replaces the
 * old static window.open() + document.write() HTML dump with a real
 * Previous/Next stepper through the full timeline: turns, tool calls,
 * labeled navigation/error events, and D49 session-resume markers.
 *
 * Block E1 (Req 9.1): when the conversation ran under a graph, every turn
 * carries a node chip (attribution from the in-order transition-marker walk),
 * node_transition markers render as first-class hops, and "Show on graph"
 * opens the read-only traversal view pinned to the run's graph version.
 * Block E2 (Req 9.2): any turn can be marked (bad answer / missed transition /
 * note) — the annotation lands in the editor's TODO drawer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Loader2, Flag, GitBranch } from 'lucide-react';
import { nodeAtEachStep } from './graph-editor/traversal-utils';
import type { AnnotationRow } from '@/lib/services/ai/graph-store';

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

/** Graph pin resolved by the replay API when the run had one (Block E1). */
export interface ReplayEngineMeta {
  graphId: string;
  graphName: string;
  graphVersionId: string;
  version: number;
  nodeNames: Record<string, string>;
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
    /** Block K: the retention sweep stamps when it scrubbed visitor turns. */
    latestState?: { retention?: { transcriptsExpiredAt?: string } } | null;
  };
  engine?: ReplayEngineMeta | null;
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

const ANNOTATION_KINDS = [
  { value: 'bad_answer', label: 'Bad answer' },
  { value: 'missed_transition', label: 'Missed transition' },
  { value: 'note', label: 'Note' },
] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number]['value'];

export const ANNOTATION_KIND_LABELS: Record<string, string> = Object.fromEntries(
  ANNOTATION_KINDS.map((k) => [k.value, k.label])
);

/**
 * Shared annotation state for the two replay surfaces (E2): loads the
 * conversation's annotations and exposes a create handler. Enabled only when
 * the conversation ran under a graph — annotations anchor to {node, version}.
 */
export function useGraphAnnotations(conversationId: string | null | undefined, engine: ReplayEngineMeta | null | undefined) {
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);
  const enabled = !!conversationId && !!engine;

  const reload = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/admin/ai/graph-annotations?conversationId=${encodeURIComponent(conversationId)}`);
      const json = await res.json();
      if (json.success) setAnnotations(json.data);
    } catch {
      /* annotation load failure never breaks replay */
    }
  }, [conversationId]);

  useEffect(() => {
    if (enabled) void reload();
    else setAnnotations([]);
  }, [enabled, reload]);

  const annotate = useCallback(
    async (input: { messageId: string; nodeId: string; kind: AnnotationKind; note: string }): Promise<boolean> => {
      if (!conversationId || !engine) return false;
      try {
        const res = await fetch('/api/admin/ai/graph-annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            messageId: input.messageId,
            nodeId: input.nodeId,
            graphVersionId: engine.graphVersionId,
            kind: input.kind,
            note: input.note || undefined,
          }),
        });
        const json = await res.json();
        if (json.success) {
          await reload();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [conversationId, engine, reload]
  );

  const byMessageId = useMemo(() => {
    const map = new Map<string, AnnotationRow[]>();
    for (const a of annotations) {
      if (!a.messageId) continue;
      if (!map.has(a.messageId)) map.set(a.messageId, []);
      map.get(a.messageId)!.push(a);
    }
    return map;
  }, [annotations]);

  return { annotations, byMessageId, annotate, enabled };
}

/**
 * Block K (Req 21.2 as amended): honest note when the retention sweep deleted
 * this conversation's visitor turns — the remaining rows are operational
 * telemetry, and the reader should know WHY the transcript looks thin.
 */
export function RetentionExpiryNote({ latestState }: { latestState?: ReplayData['conversation']['latestState'] }) {
  const expiredAt = latestState?.retention?.transcriptsExpiredAt;
  if (!expiredAt) return null;
  return (
    <p
      className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      data-testid="retention-expired-note"
    >
      Visitor turns were deleted by the owner retention policy on {new Date(expiredAt).toLocaleString()} —
      what remains below is operational telemetry (markers, traversal, summaries on their own clock).
    </p>
  );
}

/** Block K (Req 21.2): one-line content-class legend for transcript surfaces. */
export function ContentClassLegend() {
  return (
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground" data-testid="content-class-legend">
      user/assistant turns + slot fills = visitor content · system markers (transitions, disruptions,
      safety) = operational telemetry
    </p>
  );
}

/** Header chip + link: which graph/version the run pinned, and the way onto the canvas (E1). */
export function ShowOnGraphLink({ engine, conversationId }: { engine: ReplayEngineMeta; conversationId: string }) {
  return (
    <span className="flex items-center gap-2">
      <Badge variant="outline" className="text-[10px]">
        graph: {engine.graphName} v{engine.version}
      </Badge>
      <Link
        href={`/admin/ai/conversation-graphs/${engine.graphId}?traversal=${encodeURIComponent(conversationId)}&version=${encodeURIComponent(engine.graphVersionId)}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        data-testid="show-on-graph"
      >
        <GitBranch className="h-3.5 w-3.5" /> Show on graph
      </Link>
    </span>
  );
}

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

  const engine = data?.engine ?? null;
  const stepNodes = useMemo(() => nodeAtEachStep(timeline), [timeline]);
  const { byMessageId, annotate, enabled: annotationsEnabled } = useGraphAnnotations(data?.conversation?.id, engine);

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

  const activeNodeId = stepNodes[stepIndex] ?? null;

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
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pb-2 border-b items-center">
              <span>Started: {new Date(data.conversation.startedAt).toLocaleString()}</span>
              <span>Messages: {data.conversation.messageCount}</span>
              <span>Tokens: {data.conversation.totalTokens}</span>
              <span>Cost: ${data.conversation.totalCost.toFixed(4)}</span>
              {data.summary.errorCount > 0 && (
                <span className="text-red-600">Errors: {data.summary.errorCount}</span>
              )}
              {engine && <ShowOnGraphLink engine={engine} conversationId={data.conversation.id} />}
            </div>

            <RetentionExpiryNote latestState={data.conversation.latestState} />

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
                <ReplayStepCard
                  step={step}
                  legIndex={legIndex}
                  nodeId={activeNodeId}
                  nodeNames={engine?.nodeNames}
                  annotations={byMessageId.get(step.message.id)}
                  onAnnotate={
                    annotationsEnabled && activeNodeId && step.message.id
                      ? (kind, note) => annotate({ messageId: step.message.id, nodeId: activeNodeId, kind, note })
                      : undefined
                  }
                />
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

/** Marker headline per markerType — node_transition/summary/edge_evaluated became first-class in Block E. */
function markerHeadline(step: ReplayStep, nodeNames?: Record<string, string>): string {
  const meta = step.message.metadata ?? {};
  const name = (id: string | null | undefined) => (id ? nodeNames?.[id] ?? id : '∅');
  switch (meta.markerType) {
    case 'session_resumed':
      return '🟢 Session resumed';
    case 'session_disruption':
      return '🔴 Session disruption';
    case 'node_transition':
      return `🧭 ${name(meta.fromNode)} → ${name(meta.toNode)}${meta.conditionType ? ` (${meta.conditionType})` : ''}`;
    case 'conversation_summary':
      return `📝 Running summary v${meta.summaryVersion ?? '?'}`;
    case 'slot_filled': {
      // H1 (Req 14.2): show WHAT filled without opening metadata.
      const fills = (meta.slotFills ?? {}) as Record<string, string>;
      const parts = Object.entries(fills).map(([k, v]) => `${k}="${String(v).slice(0, 40)}"`);
      return `🎯 Slot${parts.length > 1 ? 's' : ''} filled: ${parts.join(', ') || '?'}`;
    }
    case 'lead_captured':
      return `📬 Lead captured${meta.leadId ? ` (${meta.leadId})` : ''}`;
    case 'safety_investigation':
      // L2 (Req 22.2): the conversation links to its investigation inline.
      return `🛡️ Safety investigation — ${meta.verdict ?? 'unknown'}${meta.actedAction ? ` → ${meta.actedAction}` : ''}`;
    case 'edge_evaluated':
      return '⚖️ Edges evaluated (debug)';
    default:
      return `Marker: ${meta.markerType ?? 'unknown'}`;
  }
}

/**
 * Event-row detail renderer. context_flush details carry `blockText` — the
 * complete merged passive-context block as the model received it (owner
 * 2026-07-11: the per-turn "what does the model remember" debugging view);
 * it renders as readable text with the flush metadata alongside. Everything
 * else renders as the raw detail payload.
 */
function EventDetail({ detail }: { detail: string }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    const candidate = JSON.parse(detail);
    if (candidate && typeof candidate === 'object') parsed = candidate as Record<string, unknown>;
  } catch {
    /* plain-string detail — rendered raw below */
  }
  const blockText = parsed && typeof parsed.blockText === 'string' ? (parsed.blockText as string) : null;

  if (blockText !== null && parsed) {
    const { blockText: _omitted, ...meta } = parsed;
    return (
      <details className="mt-2" data-testid="context-flush-detail">
        <summary className="text-xs text-muted-foreground cursor-pointer select-none">
          Context block — full model-visible state
        </summary>
        <p className="text-xs text-muted-foreground mt-1">
          {Object.entries(meta)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('+') : String(v)}`)
            .join(' · ')}
        </p>
        <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2 max-h-96 overflow-auto">
          {blockText}
        </pre>
      </details>
    );
  }

  return (
    <details className="mt-2">
      <summary className="text-xs text-muted-foreground cursor-pointer select-none">Detail</summary>
      <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2 max-h-96 overflow-auto">
        {parsed ? JSON.stringify(parsed, null, 2) : detail}
      </pre>
    </details>
  );
}

/**
 * 7.5a: tool results are stringified once at persist time (the /log route
 * stores `aiResponse.result` as a JSON *string*, sliced to 8000 chars), so
 * stringifying the envelope again rendered escaped-backslash walls. Decode
 * the result once for DISPLAY only — persistence and what the model received
 * stay untouched. Truncated payloads no longer parse; they render raw.
 */
function prettyToolResponse(aiResponse: Record<string, unknown>): string {
  const display: Record<string, unknown> = { ...aiResponse };
  if (typeof display.result === 'string') {
    try {
      display.result = JSON.parse(display.result);
    } catch {
      /* not valid JSON (plain string or 8000-char truncation) — render as-is */
    }
  }
  return JSON.stringify(display, null, 2);
}

export function ReplayStepCard({
  step,
  legIndex,
  nodeId,
  nodeNames,
  annotations,
  onAnnotate,
}: {
  step: ReplayStep;
  legIndex: Map<string, number>;
  /** Node active when this step was produced (E1); undefined = engine-less rendering. */
  nodeId?: string | null;
  nodeNames?: Record<string, string>;
  annotations?: AnnotationRow[];
  /** Present ⇒ the annotate affordance renders (E2). */
  onAnnotate?: (kind: AnnotationKind, note: string) => Promise<boolean>;
}) {
  const markerType = step.message.metadata?.markerType;
  const isTransition = markerType === 'node_transition';
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<AnnotationKind>('bad_answer');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const submit = async () => {
    if (!onAnnotate) return;
    setSaving(true);
    setSaveFailed(false);
    const ok = await onAnnotate(kind, note.trim());
    setSaving(false);
    if (ok) {
      setFormOpen(false);
      setNote('');
    } else {
      setSaveFailed(true);
    }
  };

  return (
    <div className={`p-4 rounded border-l-4 text-sm text-foreground ${TYPE_STYLES[step.type] ?? 'bg-gray-50 dark:bg-gray-900/60 border-gray-400'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{TYPE_LABELS[step.type] ?? step.type}</Badge>
          {step.legId && legIndex.has(step.legId) && (
            <Badge variant="outline" className="text-xs">leg {legIndex.get(step.legId)}</Badge>
          )}
          {step.message.mode && <Badge variant="outline" className="text-xs">{step.message.mode}</Badge>}
          {/* E1: node attribution chip — which graph state governed this step */}
          {nodeId && !isTransition && (
            <Badge
              variant="outline"
              className="text-xs border-indigo-400/60 text-indigo-600 dark:text-indigo-400"
              title={`Node active when this was produced: ${nodeId}`}
              data-testid="node-chip"
            >
              ⦿ {nodeNames?.[nodeId] ?? nodeId}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {/* The row timestamp is turn-END; firstAudioAt is when the visitor
              actually started HEARING this turn (9b.5) — the honest latency. */}
          {step.message.metadata?.firstAudioAt && (
            <span title="Turn onset — first audible audio chunk">
              🔊 {new Date(step.message.metadata.firstAudioAt).toLocaleTimeString(undefined, { hour12: false })}
              <span className="opacity-60">.{String(new Date(step.message.metadata.firstAudioAt).getMilliseconds()).padStart(3, '0')}</span>
              {' → '}
            </span>
          )}
          {new Date(step.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {step.type === 'marker' ? (
        <div>
          <p className="font-medium" data-testid="marker-headline">{markerHeadline(step, nodeNames)}</p>
          {isTransition && step.message.metadata?.evidence && (
            <p className="text-xs text-muted-foreground mt-1">evidence: {step.message.metadata.evidence}</p>
          )}
          {!isTransition && <p className="whitespace-pre-wrap mt-1">{step.message.content}</p>}
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

      {markerType === 'edge_evaluated' && step.message.metadata?.evaluated && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">Evaluated edges</summary>
          <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2">
            {JSON.stringify(step.message.metadata.evaluated, null, 2)}
          </pre>
        </details>
      )}

      {step.debugInfo?.aiRequest && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">Tool call detail</summary>
          <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2">
            {JSON.stringify(step.debugInfo.aiRequest, null, 2)}
          </pre>
          {step.debugInfo.aiResponse && (
            <pre className="text-xs whitespace-pre-wrap mt-1 bg-black/5 dark:bg-white/5 rounded p-2" data-testid="tool-result-detail">
              {prettyToolResponse(step.debugInfo.aiResponse)}
            </pre>
          )}
        </details>
      )}

      {/* Event detail — includes 'system' rows: context_flush/engine_directive/
          window_prune events land there, and context_flush carries the FULL
          model-visible block (owner 2026-07-11: replay must show exactly what
          the model remembered at each flush). */}
      {(step.type === 'navigation' || step.type === 'error' || step.type === 'clip' || step.type === 'system') &&
        step.message.metadata?.detail && <EventDetail detail={step.message.metadata.detail} />}

      {step.debugInfo?.error && (
        <p className="text-xs text-red-600 mt-2">Error: {step.debugInfo.error}</p>
      )}

      {/* E2: existing annotations on this message */}
      {annotations && annotations.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="step-annotations">
          {annotations.map((a) => (
            <div key={a.id} className="flex items-start gap-1.5 text-xs">
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${a.status === 'resolved' ? 'opacity-60' : 'border-amber-500/60 text-amber-700 dark:text-amber-400'}`}
              >
                <Flag className="h-2.5 w-2.5 mr-1" />
                {ANNOTATION_KIND_LABELS[a.kind] ?? a.kind}
                {a.status === 'resolved' ? ' · resolved' : ''}
              </Badge>
              {a.note && <span className="text-muted-foreground">{a.note}</span>}
            </div>
          ))}
        </div>
      )}

      {/* E2: mark-turn affordance */}
      {onAnnotate && !formOpen && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={() => setFormOpen(true)}
            data-testid="annotate-open"
          >
            <Flag className="h-3 w-3 mr-1" /> Annotate
          </Button>
        </div>
      )}
      {onAnnotate && formOpen && (
        <div className="mt-2 space-y-2 rounded border border-border bg-background/60 p-2" data-testid="annotate-form">
          <div className="flex gap-1.5">
            {ANNOTATION_KINDS.map((k) => (
              <Button
                key={k.value}
                size="sm"
                variant={kind === k.value ? 'default' : 'outline'}
                className="h-6 px-2 text-[11px]"
                onClick={() => setKind(k.value)}
              >
                {k.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What went wrong / what should the graph do here?"
            className="text-xs min-h-16"
            data-testid="annotate-note"
          />
          {saveFailed && <p className="text-[11px] text-destructive">Failed to save — try again.</p>}
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" className="h-6 px-2 text-[11px]" onClick={submit} disabled={saving} data-testid="annotate-save">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
