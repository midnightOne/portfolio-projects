/**
 * Conversation Debug API Endpoint
 * ADMIN ONLY - Provides debug data for conversation troubleshooting
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

    const debugData = await conversationManager.getDebugData(sessionId);

    return NextResponse.json({
      success: true,
      data: debugData
    });

  } catch (error) {
    console.error('Conversation debug API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: {
          code: 'DEBUG_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get debug data'
        }
      },
      { status: 500 }
    );
  }
}