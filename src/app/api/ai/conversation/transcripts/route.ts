import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-utils';

// Mock transcript data generator
const generateMockTranscripts = () => {
  const transcripts = [];
  const providers = ['openai', 'elevenlabs'];
  
  for (let i = 0; i < 10; i++) {
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const sessionId = `session_${Math.random().toString(36).substr(2, 16)}`;
    const startTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + Math.random() * 10 * 60 * 1000);
    
    const items = [];
    const messageCount = Math.floor(Math.random() * 20) + 5;
    
    for (let j = 0; j < messageCount; j++) {
      const isUser = j % 2 === 0;
      const timestamp = new Date(startTime.getTime() + (j * 30000));
      
      items.push({
        id: `msg_${j}`,
        type: isUser ? 'user_speech' : 'ai_response',
        content: isUser 
          ? `User message ${j + 1}: This is a sample user message for testing.`
          : `AI response ${j + 1}: This is a sample AI response with helpful information.`,
        timestamp: timestamp.toISOString(),
        provider,
        metadata: {
          confidence: 0.8 + Math.random() * 0.2,
          duration: Math.random() * 5000 + 1000
        }
      });
    }
    
    transcripts.push({
      sessionId,
      items,
      session: {
        id: sessionId,
        provider,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        participantCount: 2,
        totalMessages: messageCount,
        totalDuration: endTime.getTime() - startTime.getTime(),
        metadata: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          contextId: `ctx_${Math.random().toString(36).substr(2, 8)}`,
          reflinkId: Math.random() > 0.5 ? `ref_${Math.random().toString(36).substr(2, 8)}` : undefined,
          accessLevel: 'premium'
        }
      },
      analytics: {
        averageResponseTime: 1500 + Math.random() * 1000,
        userMessageCount: Math.floor(messageCount / 2),
        aiMessageCount: Math.ceil(messageCount / 2),
        toolCallCount: Math.floor(Math.random() * 3),
        interruptionCount: Math.floor(Math.random() * 2),
        averageConfidence: 0.85 + Math.random() * 0.1,
        totalAudioDuration: Math.random() * 300000 + 60000
      }
    });
  }
  
  return transcripts;
};

export async function GET(request: NextRequest) {
  try {
    // Check authentication for admin endpoints
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const sessionId = searchParams.get('sessionId');

    // Generate mock transcripts
    let transcripts = generateMockTranscripts();

    // Apply filters
    if (provider && provider !== 'all') {
      transcripts = transcripts.filter(t => t.session.provider === provider);
    }

    if (sessionId) {
      transcripts = transcripts.filter(t => t.sessionId === sessionId);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      transcripts = transcripts.filter(t => new Date(t.session.startTime) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      transcripts = transcripts.filter(t => new Date(t.session.startTime) <= toDate);
    }

    // Sort by start time (newest first)
    transcripts.sort((a, b) => new Date(b.session.startTime).getTime() - new Date(a.session.startTime).getTime());

    return NextResponse.json({
      success: true,
      data: transcripts,
      pagination: {
        total: transcripts.length,
        page: 1,
        limit: 50,
        hasMore: false
      }
    });

  } catch (error) {
    console.error('Get transcripts API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}