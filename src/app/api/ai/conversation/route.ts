/**
 * Unified Conversation API Endpoint
 * ADMIN ONLY - HTTP transport endpoint for the unified conversation system
 * Handles text, voice, and hybrid conversation inputs through a single interface
 * Security: All operations require admin authentication - this is an interactive portfolio, not a public chatbot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  unifiedConversationManager,
  type ConversationInput,
  type ConversationOptions 
} from '@/lib/services/ai/unified-conversation-manager';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { type ProviderChatRequest } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    
    // Remove direct chat request handling to prevent recursive calls
    // All AI requests should go through the unified conversation manager
    
    // Handle both nested format (from transport) and flat format (direct calls)
    let input: ConversationInput;
    let options: ConversationOptions;
    
    if (body.input && body.options) {
      // Nested format from transport
      input = body.input;
      options = body.options;
    } else {
      // Flat format for direct calls
      input = {
        content: body.content,
        mode: body.mode || 'text',
        sessionId: body.sessionId,
        metadata: body.metadata || {}
      };
      
      options = {
        model: body.model,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
        includeContext: body.includeContext !== false, // Default to true
        contextOptions: body.contextOptions || {},
        enableNavigation: body.enableNavigation !== false, // Default to true
        enableVoiceResponse: body.enableVoiceResponse || false,
        systemPrompt: body.systemPrompt
      };
    }
    
    // Validate required fields
    if (!input.content || !input.sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: content and sessionId' 
          }
        },
        { status: 400 }
      );
    }

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
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      },
      { status: 500 }
    );
  }
}

// Removed handleDirectChatRequest to prevent recursive API calls
// All AI processing should go through the unified conversation manager

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