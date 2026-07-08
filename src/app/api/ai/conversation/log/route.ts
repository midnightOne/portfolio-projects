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
  /** Labeled navigation/error event (owner, 2026-07-07) — distinct from raw tool_call/tool_result rows. */
  event?: {
    type: 'navigation' | 'error';
    label: string;
    detail?: unknown;
  };
}

interface ConversationLogResponse {
  success: boolean;
  message?: string;
  error?: string;
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
  | { kind: 'transcript'; id?: string; type?: string; content?: string; timestamp?: string | Date; duration?: number; reasoning?: string }
  | { kind: 'tool'; id?: string; toolName?: string; args?: unknown; result?: unknown; success?: boolean; executionTime?: number; timestamp?: string | Date }
  | { kind: 'event'; id?: string; eventType?: 'navigation' | 'error'; label?: string; detail?: unknown; timestamp?: string | Date };

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
          },
        });
        persisted++;
      } else if (entry.kind === 'tool') {
        if (!entry.toolName) continue;
        await conversationHistoryManager.addMessage(
          conversationId,
          {
            id: itemId,
            role: 'system',
            content: `[tool:${entry.toolName}] ${entry.success === false ? 'failed' : 'ok'}`,
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
      (data.endReason as import('@/lib/services/ai/conversation-history-manager').LegEndReason) ?? 'user_disconnect'
    );
  } else if (data.eventType === 'disruption') {
    const legId = await conversationHistoryManager.getOpenLegId(conversationId);
    await conversationHistoryManager.recordSessionMarker(conversationId, {
      type: 'session_disruption',
      legId: legId ?? undefined,
      issueType: data.issueType,
      diagnostics: data.diagnostics,
    });
    await conversationHistoryManager.endLeg(conversationId, 'disruption');
  }
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
        }]);
        console.log(`Individual transcript item received for session ${sessionId}:`, {
          provider,
          itemType: transcriptItem.type,
          persisted: stored.persisted
        });

        return NextResponse.json({
          success: true,
          message: `Transcript item processed successfully for session ${sessionId}`,
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

    const response: ConversationLogResponse = {
      success: true,
      message: `Conversation log processed successfully for session ${sessionId}`,
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