/**
 * Conversation Cleanup API Endpoint
 * ADMIN ONLY - Cleans up old conversations and manages storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationManager } from '@/lib/services/ai/conversation-manager';

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'UNAUTHORIZED',
            message: 'Admin access required' 
          }
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const sessionId = searchParams.get('sessionId');
    const olderThanDays = searchParams.get('olderThanDays');

    if (action === 'single' && sessionId) {
      // Delete single conversation
      await conversationManager.deleteConversation(sessionId);
      
      return NextResponse.json({
        success: true,
        message: 'Conversation deleted successfully'
      });
    }

    if (action === 'cleanup' && olderThanDays) {
      // Cleanup old conversations
      const days = parseInt(olderThanDays);
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { 
            success: false,
            error: { 
              code: 'VALIDATION_ERROR',
              message: 'Invalid olderThanDays parameter' 
            }
          },
          { status: 400 }
        );
      }

      const deletedCount = await conversationManager.cleanupOldConversations(days);
      
      return NextResponse.json({
        success: true,
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} conversations older than ${days} days`
        }
      });
    }

    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: 'VALIDATION_ERROR',
          message: 'Invalid action or missing parameters' 
        }
      },
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