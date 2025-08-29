/**
 * Admin Conversation History API Endpoint
 * ADMIN ONLY - Provides conversation history access for authenticated admin sessions
 * This is NOT for public client access - only for admin debugging and management
 * Security: Requires admin authentication for all operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function GET(request: NextRequest) {
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
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Missing sessionId parameter' 
          }
        },
        { status: 400 }
      );
    }

    // Get conversation history from database
    const conversation = await conversationHistoryManager.getConversationBySessionId(sessionId);

    if (!conversation) {
      return NextResponse.json({
        success: true,
        messages: [],
        exists: false
      });
    }

    // Convert to client-side format
    const messages = conversation.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      inputMode: msg.transportMode || 'text',
      metadata: {
        tokensUsed: msg.tokensUsed,
        cost: msg.costUsd,
        model: msg.modelUsed,
        processingTime: msg.metadata.processingTime,
        voiceData: msg.metadata.voiceData,
        contextUsed: msg.metadata.contextUsed,
        navigationCommands: msg.metadata.navigationCommands
      }
    }));

    return NextResponse.json({
      success: true,
      messages,
      exists: true
    });

  } catch (error) {
    console.error('Conversation history API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      },
      { status: 500 }
    );
  }
}

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
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Missing sessionId parameter' 
          }
        },
        { status: 400 }
      );
    }

    // Get conversation and delete it
    const conversation = await conversationHistoryManager.getConversationBySessionId(sessionId);
    
    if (conversation) {
      await conversationHistoryManager.deleteConversation(conversation.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation history cleared'
    });

  } catch (error) {
    console.error('Clear conversation history API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'CLEAR_HISTORY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      },
      { status: 500 }
    );
  }
}