/**
 * Conversation Debug API Endpoint
 * ADMIN ONLY - Per-message debug snapshots (system prompt, context, AI request/response)
 * read from persisted message metadata (re-pointed at conversation-history-manager,
 * Phase 3 task 2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing sessionId parameter' } },
        { status: 400 }
      );
    }

    const conversation = await conversationHistoryManager.getConversationBySessionId(sessionId);
    const debugData = (conversation?.messages ?? [])
      .filter((msg) => msg.metadata?.debugInfo)
      .map((msg) => ({
        messageId: msg.id,
        timestamp: msg.timestamp,
        systemPrompt: msg.metadata.debugInfo?.systemPrompt,
        contextString: msg.metadata.debugInfo?.contextString,
        aiRequest: msg.metadata.debugInfo?.aiRequest,
        aiResponse: msg.metadata.debugInfo?.aiResponse,
        error: msg.metadata.errorDetails?.message,
        performanceMetrics: msg.metadata.performanceMetrics ?? {
          totalProcessingTime: msg.metadata.processingTime ?? 0
        }
      }));

    return NextResponse.json({
      success: true,
      data: debugData
    });
  } catch (error) {
    console.error('Conversation debug API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DEBUG_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get debug data'
        }
      },
      { status: 500 }
    );
  }
}
