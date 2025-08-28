/**
 * Unified Conversation API Endpoint
 * HTTP transport endpoint for the unified conversation system
 * Handles text, voice, and hybrid conversation inputs through a single interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  unifiedConversationManager,
  type ConversationInput,
  type ConversationOptions 
} from '@/lib/services/ai/unified-conversation-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.content || !body.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: content and sessionId' },
        { status: 400 }
      );
    }

    // Extract conversation input
    const input: ConversationInput = {
      content: body.content,
      mode: body.mode || 'text',
      sessionId: body.sessionId,
      metadata: body.metadata || {}
    };

    // Extract conversation options
    const options: ConversationOptions = {
      model: body.model,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      includeContext: body.includeContext !== false, // Default to true
      contextOptions: body.contextOptions || {},
      enableNavigation: body.enableNavigation !== false, // Default to true
      enableVoiceResponse: body.enableVoiceResponse || false,
      systemPrompt: body.systemPrompt
    };

    // Process the conversation input
    const response = await unifiedConversationManager.processInput(input, options);

    // Return the response
    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Conversation API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'CONVERSATION_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: true
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Get conversation state
    const conversationState = await unifiedConversationManager.getConversationState(sessionId);

    if (!conversationState) {
      return NextResponse.json(
        { 
          success: true,
          data: {
            messages: [],
            exists: false
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        messages: conversationState.messages,
        currentContext: conversationState.currentContext,
        activeMode: conversationState.activeMode,
        isProcessing: conversationState.isProcessing,
        metadata: conversationState.metadata,
        exists: true
      }
    });

  } catch (error) {
    console.error('Conversation state API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'CONVERSATION_STATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
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
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Clear conversation history
    await unifiedConversationManager.clearConversationHistory(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Conversation history cleared'
    });

  } catch (error) {
    console.error('Clear conversation API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'CLEAR_CONVERSATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.sessionId || !body.mode) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId and mode' },
        { status: 400 }
      );
    }

    // Validate mode
    if (!['text', 'voice', 'hybrid'].includes(body.mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be text, voice, or hybrid' },
        { status: 400 }
      );
    }

    // Update conversation mode
    await unifiedConversationManager.updateConversationMode(body.sessionId, body.mode);

    return NextResponse.json({
      success: true,
      message: `Conversation mode updated to ${body.mode}`
    });

  } catch (error) {
    console.error('Update conversation mode API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'UPDATE_MODE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      },
      { status: 500 }
    );
  }
}