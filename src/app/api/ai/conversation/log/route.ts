/**
 * Unified Conversation Logging API Endpoint
 * 
 * Receives conversation logs from client-side voice agents and stores them
 * for admin review, analytics, and debugging. Supports both real-time logging
 * and batch uploads of conversation data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';
import type { EngineDirective } from '@/lib/ai/engine/types';
import { peekSyntheticDirective } from '@/lib/ai/dev/synthetic-engine-directive';
import { runEngineTurn } from '@/lib/services/ai/engine-runtime';

interface ConversationLogRequest {
  sessionId: string;
  provider: string;
  conversationData?: {
    startTime: string;
    endTime?: string;
    entries: Array<{
      id: string;
      timestamp: string;
      type: 'tool_call' | 'transcript_item' | 'connection_event' | 'context_request' | 'system_event';
      provider?: string;
      executionContext?: 'client' | 'server';
      toolCallId?: string;
      correlationId?: string;
      data: any;
      metadata?: {
        executionTime?: number;
        success?: boolean;
        error?: string;
        accessLevel?: string;
        reflinkId?: string;
      };
    }>;
    toolCallSummary: {
      totalCalls: number;
      successfulCalls: number;
      failedCalls: number;
      clientCalls: number;
      serverCalls: number;
      averageExecutionTime: number;
    };
    conversationMetrics: {
      totalTranscriptItems: number;
      totalConnectionEvents: number;
      totalContextRequests: number;
      sessionDuration?: number;
    };
  };
  reflinkId?: string;
  metadata?: {
    userAgent?: string;
    clientTimestamp?: string;
    reportType?: 'real-time' | 'batch' | 'session-end';
  };
  
  // Legacy format support
  transcriptItem?: {
    id: string;
    type: string;
    content: string;
    timestamp: string;
    provider: string;
    metadata?: any;
  };
  timestamp?: string;
  toolName?: string;
  toolArgs?: any;
  /** Labeled event rows (owner, 2026-07-07; context_flush/engine_directive added
   *  by conversation-engine A3/A4 — D55 flush + directive-application telemetry). */
  event?: {
    type: 'navigation' | 'error' | 'context_flush' | 'engine_directive';
    label: string;
    detail?: unknown;
  };
  /**
   * Task A4 turn evidence: UI-state deltas since the previous user turn
   * (navigation, F-I-D refreshes), attached by the base adapter to user
   * transcript posts. Persisted into the message's metadata so the engine
   * evaluator (Block B) can score ui_state edge conditions from ground truth.
   */
  uiEvidence?: Array<Record<string, unknown>>;
}

interface ConversationLogResponse {
  success: boolean;
  message?: string;
  error?: string;
  /**
   * Task A4 directive return path (conversation-engine design §1): present
   * only for NATIVE voice sessions (openai/google) when the engine has a
   * control-plane update for this conversation — cascade/text never consume
   * it (their next turn re-derives from latestState, notes §2.2.9). Inert
   * while no graph is active (Req 2.7): with the Block B evaluator not yet
   * landed, only the dev drill seam can populate it.
   */
  engineDirective?: EngineDirective;
  metadata: {
    timestamp: number;
    sessionId: string;
    /** DB conversation id (cuid) the session persists under — surfaced so debug
     *  UIs can display it and the owner can look the conversation up later. */
    conversationId?: string;
    entriesProcessed: number;
    storedSuccessfully: boolean;
  };
}

/**
 * POST /api/ai/conversation/log
 * 
 * Accepts conversation logs from client-side voice agents
 */
/**
 * Persist voice-leg entries into the unified conversation store (task 2b.2,
 * Req 9.1 / D58): ONE text pipeline regardless of modality — voice
 * transcriptions land as messages labeled `transportMode: 'voice'` (user and
 * assistant alike), tool events as 'system' rows carrying debugInfo. Audio is
 * never stored here. Idempotent per adapter item id (retries are safe).
 */
type PersistableEntry =
  | { kind: 'transcript'; id?: string; type?: string; content?: string; timestamp?: string | Date; duration?: number; reasoning?: string; firstAudioAt?: string; uiEvidence?: Array<Record<string, unknown>> }
  | { kind: 'tool'; id?: string; toolName?: string; args?: unknown; result?: unknown; success?: boolean; executionTime?: number; timestamp?: string | Date }
  | { kind: 'event'; id?: string; eventType?: 'navigation' | 'error' | 'clip_played' | 'context_flush' | 'engine_directive'; label?: string; detail?: unknown; timestamp?: string | Date };

/**
 * Cap turn evidence (task A4): whole events only, newest kept when over the
 * ~4KB budget — a runaway client must not bloat message rows, and truncating
 * inside an event would corrupt the JSON the evaluator reads.
 */
function capUiEvidence(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const MAX_CHARS = 4000;
  const kept: Array<Record<string, unknown>> = [];
  let size = 2;
  for (let i = events.length - 1; i >= 0 && kept.length < 20; i--) {
    const eventSize = JSON.stringify(events[i]).length + 1;
    if (size + eventSize > MAX_CHARS) break;
    kept.unshift(events[i]);
    size += eventSize;
  }
  return kept;
}

async function persistVoiceEntries(
  sessionId: string,
  reflinkId: string | undefined,
  entries: PersistableEntry[]
): Promise<{ persisted: number; conversationId: string }> {
  let persisted = 0;
  const conversationId = await conversationHistoryManager.getOrCreateConversationId(
    sessionId,
    reflinkId,
    { conversationMode: 'voice' }
  );
  // D49 5b: tag rows with the conversation's open provider leg (null pre-legs)
  const legId = await conversationHistoryManager.getOpenLegId(conversationId);

  for (const entry of entries) {
    try {
      const itemId = entry.id || `${entry.kind}_${sessionId}_${new Date(entry.timestamp ?? Date.now()).getTime()}`;
      if (await conversationHistoryManager.hasTranscriptItem(conversationId, itemId)) continue;

      if (entry.kind === 'transcript') {
        const role = entry.type === 'user_speech' ? 'user'
          : entry.type === 'ai_response' ? 'assistant'
          : null;
        if (!role || !entry.content || !entry.content.trim()) continue;

        await conversationHistoryManager.addMessage(conversationId, {
          id: itemId,
          role,
          content: entry.content,
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
          inputMode: 'voice', // D58: every voice transcription is labeled 'voice'
          legId: legId ?? undefined,
          metadata: {
            transcriptItemId: itemId,
            voiceData: entry.duration ? { duration: entry.duration } : undefined,
            reasoning: entry.reasoning,
            // 9b.5 turn onset (assistant rows): first-audio time; the row's own
            // timestamp is turn-END — the difference IS the visible latency story.
            firstAudioAt: entry.firstAudioAt,
            // Task A4: UI-state deltas riding user turns — the engine's
            // ui_state transition evidence (Block B reads it from here).
            uiEvidence: entry.uiEvidence ? capUiEvidence(entry.uiEvidence) : undefined,
          },
        });
        persisted++;
      } else if (entry.kind === 'tool') {
        if (!entry.toolName) continue;
        // Execution ms in the label (owner, 2026-07-08): turn timestamps are
        // end-of-turn, so per-call latency must be readable in the row itself.
        const ms = typeof entry.executionTime === 'number' ? ` (${Math.round(entry.executionTime)}ms)` : '';
        await conversationHistoryManager.addMessage(
          conversationId,
          {
            id: itemId,
            role: 'system',
            content: `[tool:${entry.toolName}] ${entry.success === false ? 'failed' : 'ok'}${ms}`,
            timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
            inputMode: 'voice',
            legId: legId ?? undefined,
            metadata: {
              transcriptItemId: itemId,
              processingTime: entry.executionTime,
            },
          },
          {
            aiRequest: { toolName: entry.toolName, args: entry.args },
            aiResponse: { result: JSON.stringify(entry.result ?? null).slice(0, 8000), success: entry.success !== false },
          }
        );
        persisted++;
      } else if (entry.kind === 'event') {
        if (!entry.eventType || !entry.label) continue;
        await conversationHistoryManager.addMessage(conversationId, {
          id: itemId,
          role: 'system',
          content: entry.label,
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
          inputMode: 'voice',
          legId: legId ?? undefined,
          metadata: {
            transcriptItemId: itemId,
            eventType: entry.eventType,
            detail: entry.detail ? JSON.stringify(entry.detail).slice(0, 4000) : undefined,
          },
        });
        persisted++;
      }
    } catch (entryError) {
      console.error('[conversation/log] failed to persist entry (continuing):', entryError);
    }
  }
  return { persisted, conversationId };
}

/**
 * D49 5b: leg lifecycle + markers, driven by adapter connection events.
 *   session_start  → start a leg (ends any dangling one); when `resumed`, a
 *                    session_resumed marker is written with the new leg id
 *   session_end    → end the open leg (endReason from the event, default user_disconnect)
 *   disruption     → session_disruption marker + end the open leg ('disruption')
 */
async function handleLegEvent(
  sessionId: string,
  reflinkId: string | undefined,
  data: {
    eventType?: string;
    provider?: string;
    modelAlias?: string;
    modelId?: string;
    providerSessionId?: string;
    resumed?: boolean;
    endReason?: string;
    issueType?: string;
    diagnostics?: Record<string, unknown>;
    briefingSummary?: string;
  }
): Promise<void> {
  const conversationId = await conversationHistoryManager.getOrCreateConversationId(
    sessionId,
    reflinkId,
    { conversationMode: 'voice' }
  );

  if (data.eventType === 'session_start') {
    const leg = await conversationHistoryManager.startLeg(conversationId, {
      provider: data.provider ?? 'unknown',
      modelAlias: data.modelAlias,
      modelId: data.modelId,
      providerSessionId: data.providerSessionId,
    });
    if (data.resumed) {
      await conversationHistoryManager.recordSessionMarker(conversationId, {
        type: 'session_resumed',
        legId: leg.id,
        provider: data.provider,
        modelAlias: data.modelAlias,
        briefingSummary: data.briefingSummary,
      });
    }
  } else if (data.eventType === 'session_end') {
    await conversationHistoryManager.endLeg(
      conversationId,
      (data.endReason as import('@/lib/services/ai/conversation-history-manager').LegEndReason) ?? 'user_disconnect',
      (data as any).usage
    );
  } else if (data.eventType === 'disruption') {
    const legId = await conversationHistoryManager.getOpenLegId(conversationId);
    await conversationHistoryManager.recordSessionMarker(conversationId, {
      type: 'session_disruption',
      legId: legId ?? undefined,
      issueType: data.issueType,
      diagnostics: data.diagnostics,
    });
    await conversationHistoryManager.endLeg(conversationId, 'disruption', (data as any).usage);
  }
}

/**
 * Directive return path (A4 plumbing + B3 evaluation): what control-plane
 * update (if any) rides this /log response back to the live session. NATIVE
 * voice only — cascade/text re-derive server-side from latestState and never
 * consume the field (notes §2.2.9).
 *
 * The engine evaluates only when a USER turn just persisted (notes §2.2
 * trigger; assistant/tool rows become evidence for the NEXT user turn) and is
 * inert while no graph is active (Req 2.7). runEngineTurn is swallow-all (P1)
 * and idempotent per turn id (P2) — a retried POST re-evaluates nothing and
 * the same directive seq applies once client-side (P4). The dev synthetic
 * seam (non-production) remains as a fallback for drills.
 */
async function resolveEngineDirective(args: {
  sessionId: string;
  provider: string;
  conversationId: string;
  reflinkId?: string;
  userTurn?: { itemId: string; content: string; chipId?: string } | null;
  uiEvidence?: Array<Record<string, unknown>>;
}): Promise<EngineDirective | undefined> {
  if (args.provider !== 'openai' && args.provider !== 'google') return undefined;
  let directive: EngineDirective | null = null;
  if (args.userTurn) {
    directive = await runEngineTurn({
      conversationId: args.conversationId,
      evidence: {
        turnMessageId: args.userTurn.itemId,
        utterance: args.userTurn.content,
        chipId: args.userTurn.chipId,
        uiEvents: args.uiEvidence,
      },
      provider: args.provider,
      // Voice is reflink/admin-gated today; sessions without a reflink get the
      // stricter PUBLIC visibility filtering (P13 fail-safe direction).
      isPublic: !args.reflinkId,
    });
  }
  return directive ?? peekSyntheticDirective(args.sessionId);
}

export async function POST(request: NextRequest): Promise<NextResponse<ConversationLogResponse>> {
  const startTime = Date.now();
  let sessionId: string | undefined;
  let entriesCount = 0;

  try {
    const body: ConversationLogRequest = await request.json();
    const { 
      sessionId: requestSessionId, 
      provider, 
      conversationData, 
      reflinkId, 
      metadata 
    } = body;

    sessionId = requestSessionId;
    entriesCount = conversationData?.entries?.length || 0;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required and must be a string.',
        metadata: {
          timestamp: Date.now(),
          sessionId: sessionId || 'unknown',
          entriesProcessed: 0,
          storedSuccessfully: false
        }
      }, { status: 400 });
    }

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Provider is required and must be a string.',
        metadata: {
          timestamp: Date.now(),
          sessionId,
          entriesProcessed: 0,
          storedSuccessfully: false
        }
      }, { status: 400 });
    }

    // Handle both full conversation format and individual transcript items
    if (!conversationData) {
      // Live token counter (owner, 2026-07-08): per-response usage delta from
      // the adapter — keeps the conversation's "N tok" header counting up
      // during the session instead of staying 0 until a clean disconnect.
      if ((body as any).usageDelta) {
        const delta = (body as any).usageDelta as { totalTokens?: number };
        const conversationId = await conversationHistoryManager.getOrCreateConversationId(
          sessionId,
          reflinkId,
          { conversationMode: 'voice' }
        );
        await conversationHistoryManager.addUsageDelta(conversationId, delta.totalTokens ?? 0);
        return NextResponse.json({
          success: true,
          message: `Usage delta recorded for session ${sessionId}`,
          metadata: {
            timestamp: Date.now(),
            sessionId,
            conversationId,
            entriesProcessed: 1,
            storedSuccessfully: true
          }
        });
      }

      // Check if this is an individual transcript item (legacy format)
      if (body.transcriptItem) {
        // Convert individual transcript item to conversation format
        const transcriptItem = body.transcriptItem;
        const conversationData = {
          startTime: body.timestamp || new Date().toISOString(),
          entries: [{
            id: transcriptItem.id || `item_${Date.now()}`,
            timestamp: transcriptItem.timestamp || body.timestamp || new Date().toISOString(),
            type: 'transcript_item' as const,
            provider: body.provider,
            data: transcriptItem
          }],
          toolCallSummary: {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            clientCalls: 0,
            serverCalls: 0,
            averageExecutionTime: 0
          },
          conversationMetrics: {
            totalTranscriptItems: 1,
            totalConnectionEvents: 0,
            totalContextRequests: 0
          }
        };
        
        // Persist into the unified store (task 2b.2 / D58)
        const stored = await persistVoiceEntries(sessionId, reflinkId, [{
          kind: 'transcript',
          id: transcriptItem.id,
          type: transcriptItem.type,
          content: transcriptItem.content,
          timestamp: transcriptItem.timestamp || body.timestamp,
          duration: transcriptItem.metadata?.duration,
          reasoning: transcriptItem.metadata?.reasoning,
          firstAudioAt: transcriptItem.metadata?.firstAudioAt,
          // Task A4: UI-state deltas ride user turns as engine evidence
          uiEvidence: transcriptItem.type === 'user_speech' ? body.uiEvidence : undefined,
        }]);
        console.log(`Individual transcript item received for session ${sessionId}:`, {
          provider,
          itemType: transcriptItem.type,
          persisted: stored.persisted
        });

        const engineDirective = await resolveEngineDirective({
          sessionId,
          provider,
          conversationId: stored.conversationId,
          reflinkId,
          userTurn:
            transcriptItem.type === 'user_speech' && transcriptItem.id && transcriptItem.content
              ? { itemId: transcriptItem.id, content: transcriptItem.content, chipId: transcriptItem.metadata?.chipId }
              : null,
          uiEvidence: body.uiEvidence,
        });
        return NextResponse.json({
          success: true,
          message: `Transcript item processed successfully for session ${sessionId}`,
          ...(engineDirective ? { engineDirective } : {}),
          metadata: {
            timestamp: Date.now(),
            sessionId,
            conversationId: stored.conversationId,
            entriesProcessed: 1,
            storedSuccessfully: true
          }
        });
      }
      
      // Check if this is a tool call item (legacy format)
      if (body.toolName || body.toolArgs) {
        // Convert individual tool call to conversation format
        const toolCallData = {
          toolName: body.toolName,
          toolArgs: body.toolArgs,
          metadata: body.metadata
        };
        
        const toolStored = await persistVoiceEntries(sessionId, reflinkId, [{
          kind: 'tool',
          id: (body.metadata as any)?.toolCallId,
          toolName: body.toolName,
          args: body.toolArgs,
          // Was silently absent for Google sessions until 2026-07-08 — replay
          // showed result:"null" for every Gemini tool call.
          result: (body as any).toolResult,
          success: (body.metadata as any)?.success,
          executionTime: (body.metadata as any)?.executionTime,
          timestamp: body.timestamp,
        }]);
        console.log(`Individual tool call received for session ${sessionId}:`, {
          provider,
          toolName: body.toolName,
          hasArgs: !!body.toolArgs
        });

        return NextResponse.json({
          success: true,
          message: `Tool call processed successfully for session ${sessionId}`,
          metadata: {
            timestamp: Date.now(),
            sessionId,
            conversationId: toolStored.conversationId,
            entriesProcessed: 1,
            storedSuccessfully: true
          }
        });
      }

      // Check if this is a labeled navigation/error event (legacy format)
      if (body.event) {
        const eventStored = await persistVoiceEntries(sessionId, reflinkId, [{
          kind: 'event',
          eventType: body.event.type,
          label: body.event.label,
          detail: body.event.detail,
          timestamp: body.timestamp,
        }]);
        console.log(`Individual ${body.event.type} event received for session ${sessionId}:`, {
          provider,
          label: body.event.label
        });

        return NextResponse.json({
          success: true,
          message: `Event processed successfully for session ${sessionId}`,
          metadata: {
            timestamp: Date.now(),
            sessionId,
            conversationId: eventStored.conversationId,
            entriesProcessed: 1,
            storedSuccessfully: true
          }
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Conversation data is required.',
        metadata: {
          timestamp: Date.now(),
          sessionId,
          entriesProcessed: 0,
          storedSuccessfully: false
        }
      }, { status: 400 });
    }

    if (!Array.isArray(conversationData.entries)) {
      return NextResponse.json({
        success: false,
        error: 'Conversation data entries must be an array.',
        metadata: {
          timestamp: Date.now(),
          sessionId,
          entriesProcessed: 0,
          storedSuccessfully: false
        }
      }, { status: 400 });
    }

    // Emit debug event for conversation log received
    debugEventEmitter.emit('conversation_log_update', {
      sessionId,
      provider,
      entriesCount,
      reportType: metadata?.reportType || 'unknown',
      toolCallSummary: conversationData.toolCallSummary,
      conversationMetrics: conversationData.conversationMetrics,
      reflinkId
    }, 'conversation-log-api', undefined, sessionId);

    console.log(`Conversation log received for session ${sessionId}:`, {
      provider,
      entriesCount,
      toolCallSummary: conversationData.toolCallSummary,
      conversationMetrics: conversationData.conversationMetrics,
      reportType: metadata?.reportType
    });

    // Process each entry and emit appropriate debug events for real-time monitoring
    conversationData.entries.forEach(entry => {
      const entryTimestamp = new Date(entry.timestamp);
      
      switch (entry.type) {
        case 'tool_call':
          if (entry.data.phase === 'start') {
            debugEventEmitter.emit('tool_call_start', {
              toolName: entry.data.toolName,
              args: entry.data.parameters,
              sessionId,
              toolCallId: entry.toolCallId,
              executionContext: entry.executionContext,
              provider: entry.provider,
              timestamp: entryTimestamp
            }, 'conversation-log-replay', entry.correlationId, sessionId, entry.toolCallId);
          } else if (entry.data.phase === 'complete') {
            debugEventEmitter.emit('tool_call_complete', {
              toolName: entry.data.toolName,
              result: entry.data.result,
              executionTime: entry.metadata?.executionTime || 0,
              success: entry.metadata?.success || false,
              sessionId,
              toolCallId: entry.toolCallId,
              executionContext: entry.executionContext,
              provider: entry.provider,
              error: entry.metadata?.error,
              timestamp: entryTimestamp
            }, 'conversation-log-replay', entry.correlationId, sessionId, entry.toolCallId);
          }
          break;
        case 'transcript_item':
          debugEventEmitter.emit('transcript_update', {
            item: entry.data
          }, 'conversation-log-replay', entry.correlationId, sessionId);
          break;
        case 'connection_event':
          if (entry.data.eventType === 'session_start') {
            debugEventEmitter.emit('voice_session_start', {
              provider: entry.provider || provider,
              sessionId
            }, 'conversation-log-replay', entry.correlationId, sessionId);
          } else if (entry.data.eventType === 'session_end') {
            debugEventEmitter.emit('voice_session_end', {
              provider: entry.provider || provider,
              sessionId,
              duration: entry.data.duration || 0
            }, 'conversation-log-replay', entry.correlationId, sessionId);
          }
          break;
        case 'context_request':
          debugEventEmitter.emit('context_request', {
            query: entry.data.query,
            sources: entry.data.sources,
            sessionId
          }, 'conversation-log-replay', entry.correlationId, sessionId);
          break;
        case 'system_event':
          debugEventEmitter.emit('system_event', {
            eventType: entry.data?.eventType,
            label: entry.data?.label,
            sessionId
          }, 'conversation-log-replay', entry.correlationId, sessionId);
          break;
      }
    });

    // D49 5b: leg lifecycle + disruption/resume markers from connection events
    // (processed BEFORE message persistence so new messages tag the right leg)
    for (const entry of conversationData.entries) {
      if (entry.type === 'connection_event' && entry.data?.eventType) {
        try {
          await handleLegEvent(sessionId, reflinkId, { ...entry.data, provider: entry.data.provider ?? entry.provider ?? provider });
        } catch (legError) {
          console.error('[conversation/log] leg event failed (continuing):', legError);
        }
      }
    }

    // Persist batch entries into the unified store (task 2b.2 / D58)
    const persistable: PersistableEntry[] = [];
    for (const entry of conversationData.entries) {
      if (entry.type === 'transcript_item' && entry.data) {
        persistable.push({
          kind: 'transcript',
          id: entry.data.id || entry.id,
          type: entry.data.type,
          content: entry.data.content,
          timestamp: entry.data.timestamp || entry.timestamp,
          duration: entry.data.metadata?.duration,
          reasoning: entry.data.metadata?.reasoning,
          firstAudioAt: entry.data.metadata?.firstAudioAt,
        });
      } else if (entry.type === 'tool_call' && entry.data?.phase === 'complete') {
        persistable.push({
          kind: 'tool',
          id: entry.toolCallId || entry.id,
          toolName: entry.data.toolName,
          args: entry.data.parameters,
          result: entry.data.result,
          success: entry.metadata?.success,
          executionTime: entry.metadata?.executionTime,
          timestamp: entry.timestamp,
        });
      } else if (entry.type === 'system_event' && entry.data?.eventType) {
        persistable.push({
          kind: 'event',
          id: entry.id,
          eventType: entry.data.eventType,
          label: entry.data.label,
          detail: entry.data.detail,
          timestamp: entry.timestamp,
        });
      }
    }
    const batchStored = await persistVoiceEntries(sessionId, reflinkId, persistable);
    console.log(`[conversation/log] persisted ${batchStored.persisted}/${persistable.length} entries for session ${sessionId}`);

    // Engine evidence from the batch: the LAST user transcript entry (if any)
    const lastUserEntry = [...persistable]
      .reverse()
      .find(
        (e): e is Extract<PersistableEntry, { kind: 'transcript' }> =>
          e.kind === 'transcript' && e.type === 'user_speech' && !!e.id && !!e.content
      );
    const batchDirective = await resolveEngineDirective({
      sessionId,
      provider,
      conversationId: batchStored.conversationId,
      reflinkId,
      userTurn: lastUserEntry ? { itemId: lastUserEntry.id!, content: lastUserEntry.content! } : null,
      uiEvidence: lastUserEntry?.uiEvidence,
    });
    const response: ConversationLogResponse = {
      success: true,
      message: `Conversation log processed successfully for session ${sessionId}`,
      ...(batchDirective ? { engineDirective: batchDirective } : {}),
      metadata: {
        timestamp: Date.now(),
        sessionId,
        conversationId: batchStored.conversationId,
        entriesProcessed: entriesCount,
        storedSuccessfully: true // Will be based on actual database operation
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Emit debug event for conversation log error
    if (sessionId) {
      debugEventEmitter.emit('conversation_log_update', {
        sessionId,
        error: errorMessage,
        entriesCount,
        success: false
      }, 'conversation-log-api', undefined, sessionId);
    }

    console.error('Conversation log processing error:', {
      sessionId,
      entriesCount,
      error: errorMessage
    });

    const response: ConversationLogResponse = {
      success: false,
      error: errorMessage,
      metadata: {
        timestamp: Date.now(),
        sessionId: sessionId || 'unknown',
        entriesProcessed: entriesCount,
        storedSuccessfully: false
      }
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * GET /api/ai/conversation/log?sessionId=<id>
 * 
 * Retrieves conversation logs for a specific session (admin only)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required as query parameter.'
      }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required.'
      }, { status: 403 });
    }

    // Read the persisted conversation (Phase 3 task 2.1 — placeholder replaced with
    // conversation-history-manager; voice-leg persistence itself lands with D49 5b)
    const { conversationHistoryManager } = await import('@/lib/services/ai/conversation-history-manager');
    const conversation = await conversationHistoryManager.getConversationBySessionId(sessionId);

    return NextResponse.json({
      success: true,
      data: conversation,
      metadata: {
        timestamp: Date.now(),
        source: 'conversation-log-api'
      }
    });

  } catch (error) {
    console.error('Conversation log retrieval error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve conversation log',
      metadata: {
        timestamp: Date.now(),
        source: 'conversation-log-api'
      }
    }, { status: 500 });
  }
}