/**
 * Admin Conversation History API Endpoint
 * ADMIN ONLY - Provides conversation history access for authenticated admin sessions
 * This is NOT for public client access - only for admin debugging and management
 * Security: Requires admin authentication for all operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationManager } from '@/lib/services/ai/conversation-manager';
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

    // Get conversation history from simplified manager first
    let conversation = await conversationManager.getConversationBySessionId(sessionId);

    // Fallback to legacy conversation history manager if not found
    if (!conversation) {
      const legacyConversation = await conversationHistoryManager.getConversationBySessionId(sessionId);
      
      if (!legacyConversation) {
        return NextResponse.json({
          success: true,
          messages: [],
          exists: false
        });
      }

      // Convert legacy format to simplified format
      conversation = {
        id: legacyConversation.id,
        sessionId: legacyConversation.sessionId,
        reflinkId: legacyConversation.reflinkId,
        messageCount: legacyConversation.messageCount,
        totalTokens: legacyConversation.totalTokens,
        totalCost: legacyConversation.totalCost,
        startedAt: legacyConversation.startedAt,
        lastMessageAt: legacyConversation.lastMessageAt,
        messages: legacyConversation.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          tokensUsed: msg.tokensUsed,
          cost: msg.costUsd ? Number(msg.costUsd) : undefined,
          model: msg.modelUsed,
          mode: msg.transportMode,
          metadata: msg.metadata
        }))
      };
    }

    // Convert to client-side format
    const messages = conversation.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      inputMode: msg.mode || 'text',
      metadata: {
        tokensUsed: msg.tokensUsed,
        cost: msg.cost,
        model: msg.model,
        processingTime: msg.metadata?.processingTime,
        voiceData: msg.metadata?.voiceData,
        contextUsed: msg.metadata?.contextUsed,
        navigationCommands: msg.metadata?.navigationCommands
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

    // Delete from simplified manager first
    await conversationManager.deleteConversation(sessionId);
    
    // Also try to delete from legacy manager for cleanup
    try {
      const legacyConversation = await conversationHistoryManager.getConversationBySessionId(sessionId);
      if (legacyConversation) {
        await conversationHistoryManager.deleteConversation(legacyConversation.id);
      }
    } catch (error) {
      console.warn('Failed to delete from legacy conversation manager:', error);
      // Continue without failing
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