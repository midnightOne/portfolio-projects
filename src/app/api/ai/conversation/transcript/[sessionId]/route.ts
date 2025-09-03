import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    // Mock transcript data - in production this would come from database
    const mockTranscript = {
      sessionId,
      items: [
        {
          id: 'msg_1',
          type: 'user_speech',
          content: 'Hello, can you tell me about the projects?',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          provider: 'openai',
          metadata: {
            confidence: 0.95,
            duration: 2500
          }
        },
        {
          id: 'msg_2',
          type: 'ai_response',
          content: 'I\'d be happy to tell you about the projects! There are several interesting projects in the portfolio.',
          timestamp: new Date(Date.now() - 280000).toISOString(),
          provider: 'openai',
          metadata: {
            confidence: 0.98,
            duration: 4200
          }
        }
      ],
      session: {
        id: sessionId,
        provider: 'openai',
        startTime: new Date(Date.now() - 300000).toISOString(),
        endTime: new Date(Date.now() - 250000).toISOString(),
        participantCount: 2,
        totalMessages: 2,
        totalDuration: 50000,
        metadata: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          contextId: 'ctx_sample123',
          reflinkId: 'ref_sample456',
          accessLevel: 'premium'
        }
      },
      analytics: {
        averageResponseTime: 1800,
        userMessageCount: 1,
        aiMessageCount: 1,
        toolCallCount: 0,
        interruptionCount: 0,
        averageConfidence: 0.965,
        totalAudioDuration: 6700
      }
    };

    return NextResponse.json({
      success: true,
      data: mockTranscript
    });

  } catch (error) {
    console.error('Get transcript API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    // In production, this would delete from database
    console.log(`Deleting transcript for session: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Transcript deleted successfully'
    });

  } catch (error) {
    console.error('Delete transcript API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}