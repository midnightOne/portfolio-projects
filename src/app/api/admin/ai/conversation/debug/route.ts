/**
 * Admin Debug Endpoint for Conversation System
 * Persisted-log debug data (system prompt, context, AI request/response) read from
 * conversation-history-manager. The in-memory Gen-1 debug source was deleted in
 * Phase 3 (D21 — admin debug reads persisted logs; live turns carry the _debug envelope).
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationHistoryManager, type ConversationRecord } from '@/lib/services/ai/conversation-history-manager';

function buildDebugDataFromConversation(conversation: ConversationRecord) {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const lastUserMessage = conversation.messages.filter((m) => m.role === 'user').pop();
  if (!lastMessage || !lastUserMessage) return null;

  return {
    sessionId: conversation.sessionId,
    timestamp: lastMessage.timestamp,
    input: {
      content: lastUserMessage.content,
      mode: lastUserMessage.transportMode || 'text',
      sessionId: conversation.sessionId,
      metadata: lastUserMessage.metadata?.voiceData
        ? { voiceData: lastUserMessage.metadata.voiceData }
        : {}
    },
    options: {
      model: lastMessage.modelUsed || 'unknown'
    },
    systemPrompt: lastMessage.metadata?.debugInfo?.systemPrompt || 'System prompt not available',
    contextString: lastMessage.metadata?.debugInfo?.contextString || 'Context not available',
    aiRequest: lastMessage.metadata?.debugInfo?.aiRequest || {
      model: lastMessage.modelUsed || 'unknown',
      messages: []
    },
    aiResponse: lastMessage.role === 'assistant'
      ? {
          content: lastMessage.content,
          tokensUsed: lastMessage.tokensUsed,
          cost: lastMessage.costUsd !== undefined ? Number(lastMessage.costUsd) : undefined,
          model: lastMessage.modelUsed
        }
      : undefined,
    error: lastMessage.metadata?.errorDetails?.message
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action');

    if (action === 'recent-sessions') {
      const { conversations } = await conversationHistoryManager.searchConversations({
        limit: 20,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });

      const recentSessions = conversations.map((conv) => ({
        sessionId: conv.sessionId,
        timestamp: conv.lastMessageAt || conv.startedAt,
        lastInput: conv.messages.find((m) => m.role === 'user')?.content.slice(0, 50) + '...' || 'No messages'
      }));

      return NextResponse.json({
        success: true,
        data: recentSessions
      });
    }

    if (action === 'recent-debug') {
      const { conversations } = await conversationHistoryManager.searchConversations({
        limit: 20,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });

      const recentDebugData = conversations
        .map((conv) => buildDebugDataFromConversation(conv))
        .filter((d) => d !== null);

      return NextResponse.json({
        success: true,
        data: recentDebugData
      });
    }

    // Debug data for a specific session, or the most recent conversation
    let conversationData: ConversationRecord | null = null;
    if (sessionId) {
      conversationData = await conversationHistoryManager.getConversationBySessionId(sessionId);
    } else {
      const { conversations } = await conversationHistoryManager.searchConversations({
        limit: 1,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });
      conversationData = conversations[0] ?? null;
    }

    const debugData = conversationData ? buildDebugDataFromConversation(conversationData) : null;

    if (!debugData) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No persisted conversation data available'
      });
    }

    return NextResponse.json({
      success: true,
      data: debugData
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
