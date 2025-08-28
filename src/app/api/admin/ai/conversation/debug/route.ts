/**
 * Admin Debug Endpoint for Conversation System
 * Returns the context and system prompt data from the most recent conversation request
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unifiedConversationManager } from '@/lib/services/ai/unified-conversation-manager';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get the most recent debug data
    const debugData = unifiedConversationManager.getLastDebugData();

    if (!debugData) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No recent conversation data available'
      });
    }

    // Return debug information
    return NextResponse.json({
      success: true,
      data: {
        sessionId: debugData.sessionId,
        timestamp: debugData.timestamp,
        input: {
          content: debugData.input.content,
          mode: debugData.input.mode,
          sessionId: debugData.input.sessionId,
          metadata: debugData.input.metadata
        },
        options: debugData.options,
        systemPrompt: debugData.systemPrompt,
        contextString: debugData.contextString,
        aiRequest: {
          model: debugData.aiRequest.model,
          messages: debugData.aiRequest.messages,
          temperature: debugData.aiRequest.temperature,
          maxTokens: debugData.aiRequest.maxTokens
        },
        aiResponse: debugData.aiResponse ? {
          content: debugData.aiResponse.content,
          tokensUsed: debugData.aiResponse.tokensUsed,
          cost: debugData.aiResponse.cost,
          model: debugData.aiResponse.model
        } : null,
        error: debugData.error || null
      }
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