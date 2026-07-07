/**
 * Conversation Analytics API Endpoint
 * ADMIN ONLY - Real aggregates from persisted conversation history
 * (mock data removed per D26; re-pointed at conversation-history-manager, Phase 3 task 2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const dateRange = dateFrom && dateTo
      ? { start: new Date(dateFrom), end: new Date(dateTo) }
      : undefined;

    const now = Date.now();
    const [stats, last24Hours, last7Days, last30Days, reflinkStats] = await Promise.all([
      conversationHistoryManager.getConversationStats(dateRange),
      prisma.aIConversation.count({ where: { startedAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
      prisma.aIConversation.count({ where: { startedAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.aIConversation.count({ where: { startedAt: { gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.aIConversation.groupBy({
        by: ['reflinkId'],
        _count: true,
        where: { reflinkId: { not: null } },
      }),
    ]);

    const reflinkUsage: Record<string, number> = {};
    for (const row of reflinkStats) {
      if (row.reflinkId) reflinkUsage[row.reflinkId] = row._count;
    }

    // Shape matches the admin conversation-management UI's ConversationAnalytics
    return NextResponse.json({
      success: true,
      data: {
        totalConversations: stats.totalConversations,
        totalMessages: stats.totalMessages,
        totalTokensUsed: stats.totalTokensUsed,
        totalCost: stats.totalCost,
        averageMessagesPerConversation: stats.averageMessagesPerConversation,
        averageResponseTime: stats.averageResponseTime,
        errorRate: stats.errorRate,
        modeBreakdown: stats.transportModeBreakdown,
        modelUsage: stats.modelUsageBreakdown,
        reflinkUsage,
        timeRangeStats: { last24Hours, last7Days, last30Days },
      },
    });
  } catch (error) {
    console.error('Conversation analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
