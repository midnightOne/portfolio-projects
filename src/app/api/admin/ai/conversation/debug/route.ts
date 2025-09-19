/**
 * Admin Debug Endpoint for Conversation System
 * Returns the context and system prompt data from the most recent conversation request
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unifiedConversationManager } from '@/lib/services/ai/unified-conversation-manager';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

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
      try {
        // Get recent sessions from database
        const { conversations } = await conversationHistoryManager.searchConversations({
          limit: 20,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        });

        const recentSessions = conversations.map(conv => ({
          sessionId: conv.sessionId,
          timestamp: conv.lastMessageAt || conv.startedAt,
          lastInput: conv.messages.find(m => m.role === 'user')?.content.slice(0, 50) + '...' || 'No messages'
        }));

        return NextResponse.json({
          success: true,
          data: recentSessions
        });
      } catch (error) {
        console.error('Failed to load recent sessions from database:', error);
        // Fallback to in-memory data
        const recentSessions = unifiedConversationManager.getRecentConversationSessions();
        return NextResponse.json({
          success: true,
          data: recentSessions
        });
      }
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
    let debugData = null;
    let conversationData = null;

    try {
      if (sessionId) {
        // Get conversation from database by session ID
        conversationData = await conversationHistoryManager.getConversationBySessionId(sessionId);
        
        // Try to get in-memory debug data first
        debugData = unifiedConversationManager.getDebugDataForSession(sessionId);
      } else {
        // Get most recent conversation from database
        const { conversations } = await conversationHistoryManager.searchConversations({
          limit: 1,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        });
        
        if (conversations.length > 0) {
          conversationData = conversations[0];
          debugData = unifiedConversationManager.getDebugDataForSession(conversationData.sessionId);
        }
        
        // Fallback to in-memory debug data
        if (!debugData) {
          debugData = unifiedConversationManager.getLastDebugData();
        }
      }

      // If we have conversation data but no debug data, construct debug data from conversation
      if (conversationData && !debugData) {
        const lastMessage = conversationData.messages[conversationData.messages.length - 1];
        const lastUserMessage = conversationData.messages.filter(m => m.role === 'user').pop();
        
        if (lastMessage && lastUserMessage) {
          debugData = {
            sessionId: conversationData.sessionId,
            timestamp: lastMessage.timestamp,
            input: {
              content: lastUserMessage.content,
              mode: lastUserMessage.transportMode || 'text',
              sessionId: conversationData.sessionId,
              metadata: lastUserMessage.metadata.voiceData ? {
                voiceData: lastUserMessage.metadata.voiceData
              } : {}
            },
            options: {
              model: lastMessage.modelUsed || 'gpt-4o',
              temperature: 0.7,
              maxTokens: 2000
            },
            systemPrompt: lastMessage.metadata.debugInfo?.systemPrompt || 'System prompt not available',
            contextString: lastMessage.metadata.debugInfo?.contextString || 'Context not available',
            aiRequest: lastMessage.metadata.debugInfo?.aiRequest || {
              model: lastMessage.modelUsed || 'gpt-4o',
              messages: [],
              temperature: 0.7,
              maxTokens: 2000
            },
            aiResponse: lastMessage.role === 'assistant' ? {
              content: lastMessage.content,
              tokensUsed: lastMessage.tokensUsed,
              cost: lastMessage.costUsd,
              model: lastMessage.modelUsed
            } : undefined,
            error: lastMessage.metadata.errorDetails?.message
          };
        }
      }

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
      console.error('Failed to load debug data from database:', error);
      
      // Fallback to in-memory debug data
      const fallbackDebugData = sessionId 
        ? unifiedConversationManager.getDebugDataForSession(sessionId)
        : unifiedConversationManager.getLastDebugData();

      if (!fallbackDebugData) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'No recent conversation data available'
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          sessionId: fallbackDebugData.sessionId,
          timestamp: fallbackDebugData.timestamp,
          input: {
            content: fallbackDebugData.input.content,
            mode: fallbackDebugData.input.mode,
            sessionId: fallbackDebugData.input.sessionId,
            metadata: fallbackDebugData.input.metadata
          },
          options: fallbackDebugData.options,
          systemPrompt: fallbackDebugData.systemPrompt,
          contextString: fallbackDebugData.contextString,
          aiRequest: {
            model: fallbackDebugData.aiRequest.model,
            messages: fallbackDebugData.aiRequest.messages,
            temperature: fallbackDebugData.aiRequest.temperature,
            maxTokens: fallbackDebugData.aiRequest.maxTokens
          },
          aiResponse: fallbackDebugData.aiResponse ? {
            content: fallbackDebugData.aiResponse.content,
            tokensUsed: fallbackDebugData.aiResponse.tokensUsed,
            cost: fallbackDebugData.aiResponse.cost,
            model: fallbackDebugData.aiResponse.model
          } : null,
          error: fallbackDebugData.error || null
        }
      });
    }

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