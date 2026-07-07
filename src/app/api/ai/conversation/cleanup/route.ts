/**
 * Conversation Cleanup API Endpoint
 * ADMIN ONLY - Cleans up old conversations and manages storage
 * (re-pointed at conversation-history-manager, Phase 3 task 2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const sessionId = searchParams.get('sessionId');
    const olderThanDays = searchParams.get('olderThanDays');

    if (action === 'single' && sessionId) {
      const conversation = await conversationHistoryManager.getConversationBySessionId(sessionId);
      if (!conversation) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          { status: 404 }
        );
      }
      await conversationHistoryManager.deleteConversation(conversation.id);

      return NextResponse.json({
        success: true,
        message: 'Conversation deleted successfully'
      });
    }

    if (action === 'cleanup' && olderThanDays) {
      const days = parseInt(olderThanDays);
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid olderThanDays parameter' } },
          { status: 400 }
        );
      }

      const deletedCount = await conversationHistoryManager.clearOldConversations(days);

      return NextResponse.json({
        success: true,
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} conversations older than ${days} days`
        }
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action or missing parameters' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Conversation cleanup API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cleanup conversations'
        }
      },
      { status: 500 }
    );
  }
}
