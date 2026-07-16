/**
 * Conversation Replay API Endpoint
 * ADMIN ONLY - Step-by-step conversation replay for debugging and analysis
 * (re-pointed at conversation-history-manager, Phase 3 task 2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';
import { getVersionMeta } from '@/lib/services/ai/graph-store';

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
    const sessionId = searchParams.get('sessionId');
    const conversationIdParam = searchParams.get('conversationId');

    if (!sessionId && !conversationIdParam) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing sessionId or conversationId parameter' } },
        { status: 400 }
      );
    }

    // conversationId is an exact key (cuid); sessionId resolves to the latest
    // conversation under that session. The browser passes conversationId.
    const conversation = conversationIdParam
      ? await conversationHistoryManager.getConversationById(conversationIdParam)
      : await conversationHistoryManager.getConversationBySessionId(sessionId!);

    if (!conversation) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Conversation not found'
      });
    }

    const processingTimes = conversation.messages
      .map((msg) => msg.metadata?.performanceMetrics?.totalProcessingTime ?? msg.metadata?.processingTime ?? 0)
      .filter((t) => t > 0);

    // Block E1 (Req 9.1): resolve the conversation's pinned graph version to
    // graph + node names so the viewers can attribute each message to the node
    // active when it was produced. Pin source: latestState.engine (authoritative,
    // P6), else the first transition marker (older conversations whose state was
    // since overwritten). Absent both → no engine section, viewers render as today.
    const latestEngine = ((conversation.latestState ?? {}) as { engine?: { graphVersionId?: unknown } }).engine;
    const pinnedVersionId =
      (typeof latestEngine?.graphVersionId === 'string' ? latestEngine.graphVersionId : null) ??
      conversation.messages
        .map((m) => (m.metadata as { markerType?: string; graphVersionId?: unknown } | undefined))
        .filter((meta) => meta?.markerType === 'node_transition' && typeof meta?.graphVersionId === 'string')
        .map((meta) => meta!.graphVersionId as string)[0] ??
      null;
    const engineMeta = pinnedVersionId ? await getVersionMeta(pinnedVersionId).catch(() => null) : null;

    // 7.5b: conversations older than the live usage counter (6.16) persisted
    // totalTokens = 0. Derive a display total from persisted evidence instead:
    // per-leg usage metadata (written by session_end/disruption since 6.15),
    // else the sum of per-message tokensUsed. Read-path only — the stored
    // aggregate is never rewritten, and non-zero stored totals win untouched.
    const storedTotalTokens = conversation.totalTokens ?? 0;
    const legUsageTokens = (conversation.legs ?? []).reduce((sum, leg) => {
      const usage = (leg.metadata as { usage?: { totalTokens?: unknown } } | undefined)?.usage;
      return sum + (typeof usage?.totalTokens === 'number' ? usage.totalTokens : 0);
    }, 0);
    const messageTokens = conversation.messages.reduce((sum, m) => sum + (m.tokensUsed ?? 0), 0);
    const effectiveTotalTokens =
      storedTotalTokens > 0 ? storedTotalTokens : legUsageTokens > 0 ? legUsageTokens : messageTokens;

    const replayData = {
      conversation: {
        id: conversation.id,
        sessionId: conversation.sessionId,
        reflinkId: conversation.reflinkId,
        startedAt: conversation.startedAt,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messageCount,
        totalTokens: effectiveTotalTokens,
        totalCost: conversation.totalCost,
        latestState: conversation.latestState ?? null
      },
      // Present only when the conversation ran under a graph (Block E1).
      engine: engineMeta,
      // D49 5b.2: provider legs — a multi-leg conversation reads as one timeline
      legs: (conversation.legs ?? []).map((leg) => ({
        id: leg.id,
        provider: leg.provider,
        modelAlias: leg.modelAlias,
        modelId: leg.modelId,
        startedAt: leg.startedAt,
        endedAt: leg.endedAt,
        endReason: leg.endReason
      })),
      timeline: conversation.messages.map((msg, index) => ({
        step: index + 1,
        timestamp: msg.timestamp,
        type: (msg.metadata as any)?.markerType
          ? 'marker'
          : msg.metadata?.eventType === 'navigation'
          ? 'navigation'
          : msg.metadata?.eventType === 'error'
          ? 'error'
          : msg.metadata?.eventType === 'clip_played'
          ? 'clip' // D50: client clip, NOT model speech — rendered distinctly
          : msg.role === 'user' ? 'input' : msg.role === 'system' ? 'system' : 'response',
        legId: msg.legId ?? null,
        message: {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          tokensUsed: msg.tokensUsed,
          cost: msg.costUsd !== undefined ? Number(msg.costUsd) : undefined,
          model: msg.modelUsed,
          mode: msg.transportMode,
          metadata: msg.metadata
        },
        debugInfo: msg.metadata?.debugInfo
          ? {
              systemPrompt: msg.metadata.debugInfo.systemPrompt,
              contextString: msg.metadata.debugInfo.contextString,
              aiRequest: msg.metadata.debugInfo.aiRequest,
              aiResponse: msg.metadata.debugInfo.aiResponse,
              error: msg.metadata.errorDetails?.message,
              performanceMetrics: msg.metadata.performanceMetrics ?? {
                totalProcessingTime: msg.metadata.processingTime ?? 0
              }
            }
          : null
      })),
      summary: {
        totalSteps: conversation.messages.length,
        userMessages: conversation.messages.filter((m) => m.role === 'user').length,
        assistantMessages: conversation.messages.filter((m) => m.role === 'assistant').length,
        averageResponseTime: processingTimes.length > 0
          ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
          : 0,
        totalProcessingTime: processingTimes.reduce((sum, t) => sum + t, 0),
        errorCount: conversation.messages.filter((m) => m.metadata?.errorDetails).length,
        modeBreakdown: {
          text: conversation.messages.filter((m) => m.transportMode === 'text').length,
          voice: conversation.messages.filter((m) => m.transportMode === 'voice').length,
          hybrid: conversation.messages.filter((m) => m.transportMode === 'hybrid').length
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: replayData
    });
  } catch (error) {
    console.error('Conversation replay API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REPLAY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate replay data'
        }
      },
      { status: 500 }
    );
  }
}
