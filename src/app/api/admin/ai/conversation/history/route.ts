/**
 * Admin Conversation History API
 * 
 * Comprehensive conversation management for administrators.
 * Includes search, filtering, export, and full conversation access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  conversationHistoryManager,
  type ConversationSearchOptions,
  type ConversationExportOptions
} from '@/lib/services/ai/conversation-history-manager';

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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle different actions
    switch (action) {
      case 'search':
        return handleSearchConversations(searchParams);
      
      case 'stats':
        return handleGetStats(searchParams);
      
      case 'export':
        return handleExportConversations(searchParams);
      
      case 'conversation':
        return handleGetConversation(searchParams);
      
      default:
        return handleListConversations(searchParams);
    }

  } catch (error) {
    console.error('Admin conversation history API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const action = searchParams.get('action');

    if (action === 'cleanup') {
      const olderThanDays = parseInt(searchParams.get('olderThanDays') || '30');
      const deletedCount = await conversationHistoryManager.clearOldConversations(olderThanDays);
      
      return NextResponse.json({
        success: true,
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} conversations older than ${olderThanDays} days`
        }
      });
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    await conversationHistoryManager.deleteConversation(conversationId);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Delete conversation API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete conversation'
      },
      { status: 500 }
    );
  }
}

// Helper functions for different actions

async function handleSearchConversations(searchParams: URLSearchParams) {
  const options: ConversationSearchOptions = {};

  // Parse search parameters
  if (searchParams.get('sessionId')) {
    options.sessionId = searchParams.get('sessionId')!;
  }

  if (searchParams.get('reflinkId')) {
    options.reflinkId = searchParams.get('reflinkId')!;
  }

  if (searchParams.get('startDate') && searchParams.get('endDate')) {
    options.dateRange = {
      start: new Date(searchParams.get('startDate')!),
      end: new Date(searchParams.get('endDate')!)
    };
  }

  if (searchParams.get('transportMode')) {
    options.transportMode = searchParams.get('transportMode') as 'text' | 'voice' | 'hybrid';
  }

  if (searchParams.get('modelUsed')) {
    options.modelUsed = searchParams.get('modelUsed')!;
  }

  if (searchParams.get('hasErrors')) {
    options.hasErrors = searchParams.get('hasErrors') === 'true';
  }

  if (searchParams.get('minTokens')) {
    options.minTokens = parseInt(searchParams.get('minTokens')!);
  }

  if (searchParams.get('maxTokens')) {
    options.maxTokens = parseInt(searchParams.get('maxTokens')!);
  }

  if (searchParams.get('contentSearch')) {
    options.contentSearch = searchParams.get('contentSearch')!;
  }

  if (searchParams.get('limit')) {
    options.limit = parseInt(searchParams.get('limit')!);
  }

  if (searchParams.get('offset')) {
    options.offset = parseInt(searchParams.get('offset')!);
  }

  if (searchParams.get('sortBy')) {
    options.sortBy = searchParams.get('sortBy') as 'timestamp' | 'tokens' | 'cost' | 'duration';
  }

  if (searchParams.get('sortOrder')) {
    options.sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc';
  }

  const result = await conversationHistoryManager.searchConversations(options);

  return NextResponse.json({
    success: true,
    data: result
  });
}

async function handleGetStats(searchParams: URLSearchParams) {
  let dateRange: { start: Date; end: Date } | undefined;

  if (searchParams.get('startDate') && searchParams.get('endDate')) {
    dateRange = {
      start: new Date(searchParams.get('startDate')!),
      end: new Date(searchParams.get('endDate')!)
    };
  }

  const stats = await conversationHistoryManager.getConversationStats(dateRange);

  return NextResponse.json({
    success: true,
    data: stats
  });
}

async function handleExportConversations(searchParams: URLSearchParams) {
  const options: ConversationExportOptions = {
    format: (searchParams.get('format') as 'json' | 'csv' | 'txt') || 'json',
    includeMetadata: searchParams.get('includeMetadata') === 'true',
    includeDebugData: searchParams.get('includeDebugData') === 'true',
    includeVoiceData: searchParams.get('includeVoiceData') === 'true'
  };

  if (searchParams.get('startDate') && searchParams.get('endDate')) {
    options.dateRange = {
      start: new Date(searchParams.get('startDate')!),
      end: new Date(searchParams.get('endDate')!)
    };
  }

  if (searchParams.get('sessionIds')) {
    options.sessionIds = searchParams.get('sessionIds')!.split(',');
  }

  const exportData = await conversationHistoryManager.exportConversations(options);

  // Set appropriate headers for file download
  const headers = new Headers();
  headers.set('Content-Type', getContentType(options.format));
  headers.set('Content-Disposition', `attachment; filename="conversations.${options.format}"`);

  return new NextResponse(exportData, { headers });
}

async function handleGetConversation(searchParams: URLSearchParams) {
  const conversationId = searchParams.get('conversationId');
  const sessionId = searchParams.get('sessionId');

  if (!conversationId && !sessionId) {
    return NextResponse.json(
      { error: 'Either conversationId or sessionId is required' },
      { status: 400 }
    );
  }

  let conversation;
  if (conversationId) {
    conversation = await conversationHistoryManager.getConversationById(conversationId);
  } else {
    conversation = await conversationHistoryManager.getConversationBySessionId(sessionId!);
  }

  if (!conversation) {
    return NextResponse.json({
      success: true,
      data: null,
      message: 'Conversation not found'
    });
  }

  return NextResponse.json({
    success: true,
    data: conversation
  });
}

async function handleListConversations(searchParams: URLSearchParams) {
  // Default list with basic pagination
  const options: ConversationSearchOptions = {
    limit: parseInt(searchParams.get('limit') || '20'),
    offset: parseInt(searchParams.get('offset') || '0'),
    sortBy: 'timestamp',
    sortOrder: 'desc'
  };

  const result = await conversationHistoryManager.searchConversations(options);

  return NextResponse.json({
    success: true,
    data: result
  });
}

function getContentType(format: string): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}