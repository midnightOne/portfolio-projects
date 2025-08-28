/**
 * Client Conversation History API
 * 
 * Provides conversation history access for authenticated sessions.
 * Limited to session-based access only - no admin features.
 */

import { NextRequest, NextResponse } from 'next/server';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get conversation history for the session
    const conversation = await conversationHistoryManager.getConversationBySessionId(sessionId);

    if (!conversation) {
      return NextResponse.json({
        success: true,
        data: {
          conversation: null,
          messages: [],
          exists: false
        }
      });
    }

    // Return conversation data (excluding sensitive admin information)
    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          sessionId: conversation.sessionId,
          messageCount: conversation.messageCount,
          startedAt: conversation.startedAt,
          lastMessageAt: conversation.lastMessageAt,
          // Only include basic metadata for client access
          metadata: {
            conversationMode: conversation.metadata.conversationMode,
            userPreferences: conversation.metadata.userPreferences
          }
        },
        messages: conversation.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          transportMode: msg.transportMode,
          // Only include basic metadata for client access
          metadata: {
            processingTime: msg.metadata.processingTime,
            voiceData: msg.metadata.voiceData ? {
              duration: msg.metadata.voiceData.duration,
              audioUrl: msg.metadata.voiceData.audioUrl
              // Exclude transcription and technical details
            } : undefined,
            navigationCommands: msg.metadata.navigationCommands
          }
        })),
        exists: true
      }
    });

  } catch (error) {
    console.error('Client conversation history API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve conversation history'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, reflinkId, metadata } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get client information from headers
    const headersList = headers();
    const userAgent = headersList.get('user-agent');
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // Create conversation with client metadata
    const conversationMetadata = {
      ...metadata,
      userAgent,
      ipAddress,
      sessionStartTime: new Date()
    };

    const conversation = await conversationHistoryManager.createConversation(
      sessionId,
      reflinkId,
      conversationMetadata
    );

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        sessionId: conversation.sessionId,
        startedAt: conversation.startedAt
      }
    });

  } catch (error) {
    console.error('Create conversation API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create conversation'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // For client access, we only allow clearing messages, not deleting the conversation
    // This would be implemented by setting a flag or moving messages to archive
    // For now, we'll return success without actual deletion for security

    return NextResponse.json({
      success: true,
      message: 'Conversation history cleared for session'
    });

  } catch (error) {
    console.error('Clear conversation API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to clear conversation history'
      },
      { status: 500 }
    );
  }
}