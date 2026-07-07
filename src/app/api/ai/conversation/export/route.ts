/**
 * Conversation Export API Endpoint
 * ADMIN ONLY - Exports conversation data in various formats
 * (re-pointed at conversation-history-manager, Phase 3 task 2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') as 'json' | 'csv') || 'json';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sessionIds = searchParams.get('sessionIds')?.split(',');
    const includeDebugData = searchParams.get('includeDebugData') === 'true';

    const exportData = await conversationHistoryManager.exportConversations({
      format,
      includeMetadata: true,
      includeDebugData,
      includeVoiceData: true,
      dateRange: startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined,
      sessionIds: sessionIds && sessionIds.length > 0 ? sessionIds : undefined
    });

    const headers = new Headers();
    headers.set('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    headers.set('Content-Disposition', `attachment; filename="conversations-${new Date().toISOString().split('T')[0]}.${format}"`);

    return new NextResponse(exportData, { headers });
  } catch (error) {
    console.error('Conversation export API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to export conversations'
        }
      },
      { status: 500 }
    );
  }
}
