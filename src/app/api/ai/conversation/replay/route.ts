/**
 * Conversation Replay API Endpoint
 * ADMIN ONLY - Provides conversation replay functionality for debugging and analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationManager } from '@/lib/services/ai/conversation-manager';

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

    // Get conversation data
    const conversation = await conversationManager.getConversationBySessionId(sessionId);
    
    if (!conversation) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Conversation not found'
      });
    }

    // Get debug data
    const debugData = await conversationManager.getDebugData(sessionId);

    // Create replay data with step-by-step breakdown
    const replayData = {
      conversation: {
        id: conversation.id,
        sessionId: conversation.sessionId,
        reflinkId: conversation.reflinkId,
        startedAt: conversation.startedAt,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messageCount,
        totalTokens: conversation.totalTokens,
        totalCost: conversation.totalCost
      },
      timeline: conversation.messages.map((msg, index) => {
        const relatedDebugData = debugData.find(d => d.messageId === msg.id);
        
        return {
          step: index + 1,
          timestamp: msg.timestamp,
          type: msg.role === 'user' ? 'input' : 'response',
          message: {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            tokensUsed: msg.tokensUsed,
            cost: msg.cost,
            model: msg.model,
            mode: msg.mode,
            metadata: msg.metadata
          },
          debugInfo: relatedDebugData ? {
            systemPrompt: relatedDebugData.systemPrompt,
            contextString: relatedDebugData.contextString,
            aiRequest: relatedDebugData.aiRequest,
            aiResponse: relatedDebugData.aiResponse,
            error: relatedDebugData.error,
            performanceMetrics: relatedDebugData.performanceMetrics
          } : null
        };
      }),
      summary: {
        totalSteps: conversation.messages.length,
        userMessages: conversation.messages.filter(m => m.role === 'user').length,
        assistantMessages: conversation.messages.filter(m => m.role === 'assistant').length,
        averageResponseTime: debugData.length > 0 ? 
          debugData.reduce((sum, d) => sum + d.performanceMetrics.totalProcessingTime, 0) / debugData.length : 0,
        totalProcessingTime: debugData.reduce((sum, d) => sum + d.performanceMetrics.totalProcessingTime, 0),
        errorCount: debugData.filter(d => d.error).length,
        modeBreakdown: {
          text: conversation.messages.filter(m => m.mode === 'text').length,
          voice: conversation.messages.filter(m => m.mode === 'voice').length,
          hybrid: conversation.messages.filter(m => m.mode === 'hybrid').length
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: replayData
    });

  } catch (error) {
    console.error('Conversation replay API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'REPLAY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate replay data'
        }
      },
      { status: 500 }
    );
  }
}