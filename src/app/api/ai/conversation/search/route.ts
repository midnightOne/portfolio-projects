import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const provider = searchParams.get('provider');

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Mock search results
    const searchResults = [
      {
        transcript: {
          sessionId: 'session_search_result_1',
          items: [
            {
              id: 'msg_1',
              type: 'user_speech',
              content: `User asked about ${query} in this conversation`,
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              provider: 'openai',
              metadata: { confidence: 0.92 }
            },
            {
              id: 'msg_2',
              type: 'ai_response',
              content: `AI responded with information about ${query} and related topics`,
              timestamp: new Date(Date.now() - 3580000).toISOString(),
              provider: 'openai',
              metadata: { confidence: 0.95 }
            }
          ],
          session: {
            id: 'session_search_result_1',
            provider: 'openai',
            startTime: new Date(Date.now() - 3600000).toISOString(),
            endTime: new Date(Date.now() - 3400000).toISOString(),
            participantCount: 2,
            totalMessages: 2,
            metadata: {}
          },
          analytics: {
            averageResponseTime: 1600,
            userMessageCount: 1,
            aiMessageCount: 1,
            toolCallCount: 0,
            interruptionCount: 0,
            averageConfidence: 0.935,
            totalAudioDuration: 8500
          }
        },
        matches: [
          {
            item: {
              id: 'msg_1',
              type: 'user_speech',
              content: `User asked about ${query} in this conversation`,
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              provider: 'openai',
              metadata: { confidence: 0.92 }
            },
            snippet: `...asked about ${query} in this...`,
            score: 0.85
          }
        ]
      }
    ];

    return NextResponse.json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    console.error('Search transcripts API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}