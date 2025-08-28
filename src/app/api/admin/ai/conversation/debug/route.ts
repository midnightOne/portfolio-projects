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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action');

    // Handle different actions
    if (action === 'recent-sessions') {
      const recentSessions = unifiedConversationManager.getRecentConversationSessions();
      return NextResponse.json({
        success: true,
        data: recentSessions
      });
    }

    if (action === 'recent-debug') {
      const recentDebugData = unifiedConversationManager.getRecentDebugData();
      return NextResponse.json({
        success: true,
        data: recentDebugData.map(data => ({
          sessionId: data.sessionId,
          timestamp: data.timestamp,
          input: {
            content: data.input.content,
            mode: data.input.mode,
            sessionId: data.input.sessionId,
            metadata: data.input.metadata
          },
          options: data.options,
          systemPrompt: data.systemPrompt,
          contextString: data.contextString,
          aiRequest: {
            model: data.aiRequest.model,
            messages: data.aiRequest.messages,
            temperature: data.aiRequest.temperature,
            maxTokens: data.aiRequest.maxTokens
          },
          aiResponse: data.aiResponse ? {
            content: data.aiResponse.content,
            tokensUsed: data.aiResponse.tokensUsed,
            cost: data.aiResponse.cost,
            model: data.aiResponse.model
          } : null,
          error: data.error || null
        }))
      });
    }

    // Get debug data - either for specific session or most recent
    const debugData = sessionId 
      ? unifiedConversationManager.getDebugDataForSession(sessionId)
      : unifiedConversationManager.getLastDebugData();

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