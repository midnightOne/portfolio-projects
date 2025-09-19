import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
    const provider = searchParams.get('provider');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Mock analytics data
    const analytics = {
      totalSessions: 156,
      totalMessages: 1247,
      averageSessionDuration: 4.2 * 60 * 1000, // 4.2 minutes in milliseconds
      providerBreakdown: {
        openai: 89,
        elevenlabs: 67
      },
      dailyActivity: [
        { date: '2025-01-01', sessions: 23, messages: 184 },
        { date: '2025-01-02', sessions: 31, messages: 248 },
        { date: '2025-01-03', sessions: 28, messages: 221 },
        { date: '2025-01-04', sessions: 35, messages: 279 },
        { date: '2025-01-05', sessions: 25, messages: 198 },
        { date: '2025-01-06', sessions: 14, messages: 117 }
      ],
      topErrors: [
        { error: 'Connection timeout', count: 8 },
        { error: 'Microphone permission denied', count: 5 },
        { error: 'WebRTC connection failed', count: 3 }
      ],
      responseTimeStats: {
        average: 1850,
        median: 1650,
        p95: 3200,
        p99: 4800
      }
    };

    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Conversation analytics API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}