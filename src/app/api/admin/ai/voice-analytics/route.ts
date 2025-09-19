import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Mock analytics data for now - in production this would come from a database
const generateMockAnalytics = (timeRange: string, provider?: string) => {
  const now = new Date();
  const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  
  // Generate mock data based on time range
  const baseSessionCount = daysBack * 10;
  const totalSessions = Math.floor(baseSessionCount * (0.8 + Math.random() * 0.4));
  const totalMinutes = totalSessions * (2 + Math.random() * 8); // 2-10 minutes per session
  const totalCost = totalMinutes * 0.006; // ~$0.006 per minute average
  
  const openaiSessions = Math.floor(totalSessions * 0.6);
  const elevenlabsSessions = totalSessions - openaiSessions;
  
  const openaiMinutes = openaiSessions * (1.5 + Math.random() * 6);
  const elevenlabsMinutes = elevenlabsSessions * (2.5 + Math.random() * 7);
  
  const openaiCost = openaiMinutes * 0.005; // OpenAI pricing
  const elevenlabsCost = elevenlabsMinutes * 0.007; // ElevenLabs pricing
  
  return {
    overview: {
      totalSessions,
      totalMinutes: Math.round(totalMinutes),
      totalCost: Math.round(totalCost * 10000) / 10000,
      averageSessionDuration: Math.round((totalMinutes / totalSessions) * 100) / 100,
      successRate: 0.92 + Math.random() * 0.07,
      activeUsers: Math.floor(totalSessions * 0.3)
    },
    providerBreakdown: {
      openai: {
        sessions: openaiSessions,
        minutes: Math.round(openaiMinutes),
        cost: Math.round(openaiCost * 10000) / 10000,
        averageLatency: 180 + Math.random() * 100,
        errorRate: 0.02 + Math.random() * 0.03
      },
      elevenlabs: {
        sessions: elevenlabsSessions,
        minutes: Math.round(elevenlabsMinutes),
        cost: Math.round(elevenlabsCost * 10000) / 10000,
        averageLatency: 250 + Math.random() * 150,
        errorRate: 0.03 + Math.random() * 0.04
      }
    },
    timeSeriesData: Array.from({ length: Math.min(daysBack, 30) }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dailySessions = Math.floor(totalSessions / daysBack * (0.7 + Math.random() * 0.6));
      const dailyMinutes = dailySessions * (2 + Math.random() * 6);
      
      return {
        date: date.toISOString().split('T')[0],
        sessions: dailySessions,
        minutes: Math.round(dailyMinutes),
        cost: Math.round(dailyMinutes * 0.006 * 10000) / 10000,
        openaiSessions: Math.floor(dailySessions * 0.6),
        elevenlabsSessions: Math.floor(dailySessions * 0.4)
      };
    }).reverse(),
    performanceMetrics: {
      averageResponseTime: 220 + Math.random() * 80,
      p95ResponseTime: 450 + Math.random() * 150,
      p99ResponseTime: 800 + Math.random() * 300,
      connectionSuccessRate: 0.94 + Math.random() * 0.05,
      audioQualityScore: 8.2 + Math.random() * 1.5,
      interruptionRate: 0.08 + Math.random() * 0.05
    },
    costBreakdown: {
      openaiCosts: {
        inputTokens: openaiCost * 0.3,
        outputTokens: openaiCost * 0.4,
        audioMinutes: openaiCost * 0.3,
        totalCost: openaiCost
      },
      elevenlabsCosts: {
        conversationMinutes: elevenlabsCost * 0.7,
        characterCount: elevenlabsCost * 0.3,
        totalCost: elevenlabsCost
      }
    },
    topErrors: [
      {
        error: 'Connection timeout',
        count: Math.floor(Math.random() * 15) + 5,
        provider: 'openai',
        lastOccurrence: new Date(now.getTime() - Math.random() * 86400000 * 7).toISOString()
      },
      {
        error: 'Microphone permission denied',
        count: Math.floor(Math.random() * 10) + 3,
        provider: 'elevenlabs',
        lastOccurrence: new Date(now.getTime() - Math.random() * 86400000 * 3).toISOString()
      },
      {
        error: 'WebRTC connection failed',
        count: Math.floor(Math.random() * 8) + 2,
        provider: 'openai',
        lastOccurrence: new Date(now.getTime() - Math.random() * 86400000 * 5).toISOString()
      }
    ],
    usagePatterns: {
      peakHours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        sessions: Math.floor(Math.random() * 20) + (hour >= 9 && hour <= 17 ? 15 : 5)
      })).sort((a, b) => b.sessions - a.sessions),
      dailyDistribution: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
        day,
        sessions: Math.floor(Math.random() * 50) + 20
      })),
      averageSessionLength: 4.2 + Math.random() * 2,
      mostActiveReflinks: Array.from({ length: 5 }, (_, i) => ({
        reflinkId: `ref_${Math.random().toString(36).substr(2, 12)}`,
        sessions: Math.floor(Math.random() * 30) + 10,
        cost: Math.round((Math.random() * 5 + 2) * 100) / 100
      })).sort((a, b) => b.sessions - a.sessions)
    }
  };
};

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
    const timeRange = searchParams.get('timeRange') || '7d';
    const provider = searchParams.get('provider') || undefined;

    // Validate time range
    if (!['24h', '7d', '30d', '90d'].includes(timeRange)) {
      return NextResponse.json(
        { success: false, error: 'Invalid time range' },
        { status: 400 }
      );
    }

    // Validate provider
    if (provider && !['openai', 'elevenlabs'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    // Generate analytics data
    const analytics = generateMockAnalytics(timeRange, provider);

    // Filter by provider if specified
    if (provider) {
      if (provider === 'openai') {
        analytics.providerBreakdown.elevenlabs = {
          sessions: 0,
          minutes: 0,
          cost: 0,
          averageLatency: 0,
          errorRate: 0
        };
        analytics.overview.totalSessions = analytics.providerBreakdown.openai.sessions;
        analytics.overview.totalMinutes = analytics.providerBreakdown.openai.minutes;
        analytics.overview.totalCost = analytics.providerBreakdown.openai.cost;
      } else if (provider === 'elevenlabs') {
        analytics.providerBreakdown.openai = {
          sessions: 0,
          minutes: 0,
          cost: 0,
          averageLatency: 0,
          errorRate: 0
        };
        analytics.overview.totalSessions = analytics.providerBreakdown.elevenlabs.sessions;
        analytics.overview.totalMinutes = analytics.providerBreakdown.elevenlabs.minutes;
        analytics.overview.totalCost = analytics.providerBreakdown.elevenlabs.cost;
      }
    }

    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Voice analytics API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}