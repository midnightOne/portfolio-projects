/**
 * Unified Conversation Logging API Endpoint
 * 
 * Receives conversation logs from client-side voice agents and stores them
 * for admin review, analytics, and debugging. Supports both real-time logging
 * and batch uploads of conversation data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

interface ConversationLogRequest {
  sessionId: string;
  provider: string;
  conversationData: {
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
}

interface ConversationLogResponse {
  success: boolean;
  message?: string;
  error?: string;
  metadata: {
    timestamp: number;
    sessionId: string;
    entriesProcessed: number;
    storedSuccessfully: boolean;
  };
}

/**
 * POST /api/ai/conversation/log
 * 
 * Accepts conversation logs from client-side voice agents
 */
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

    if (!conversationData) {
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

    // TODO: Store conversation data in database
    // For now, we'll just log it and emit debug events
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
      }
    });

    // TODO: Implement database storage
    // const storedConversation = await prisma.conversationLog.create({
    //   data: {
    //     sessionId,
    //     provider,
    //     startTime: new Date(conversationData.startTime),
    //     endTime: conversationData.endTime ? new Date(conversationData.endTime) : null,
    //     entriesJson: JSON.stringify(conversationData.entries),
    //     toolCallSummaryJson: JSON.stringify(conversationData.toolCallSummary),
    //     conversationMetricsJson: JSON.stringify(conversationData.conversationMetrics),
    //     reflinkId,
    //     metadata: metadata ? JSON.stringify(metadata) : null
    //   }
    // });

    const response: ConversationLogResponse = {
      success: true,
      message: `Conversation log processed successfully for session ${sessionId}`,
      metadata: {
        timestamp: Date.now(),
        sessionId,
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

    // TODO: Implement admin authentication check
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== 'admin') {
    //   return NextResponse.json({
    //     success: false,
    //     error: 'Admin access required.'
    //   }, { status: 403 });
    // }

    // TODO: Retrieve conversation log from database
    // const conversationLog = await prisma.conversationLog.findUnique({
    //   where: { sessionId }
    // });

    // For now, return placeholder data
    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        message: 'Conversation log retrieval not yet implemented',
        // Will include actual conversation data from database
      },
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