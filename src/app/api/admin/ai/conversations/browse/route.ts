/**
 * Admin Conversation Browser API (owner, 2026-07-07)
 *
 * Lightweight, purpose-built listing for the admin transcript browser: returns
 * one summary row per stored conversation with the provider/model resolved from
 * its most-recent D49 leg, plus reflink, timing, and counts — WITHOUT loading
 * every message (the detail view fetches the full timeline via
 * /api/ai/conversation/replay). Supports lookup by exact conversationId or
 * sessionId, and filtering by provider, reflink, time range, and content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId')?.trim();
    const sessionId = searchParams.get('sessionId')?.trim();
    const reflinkId = searchParams.get('reflinkId')?.trim();
    const provider = searchParams.get('provider')?.trim();
    const q = searchParams.get('q')?.trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Prisma.AIConversationWhereInput = {};
    if (conversationId) where.id = conversationId;
    if (sessionId) where.sessionId = sessionId;
    if (reflinkId) where.reflinkId = reflinkId;
    if (startDate && endDate) {
      where.startedAt = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      where.startedAt = { gte: new Date(startDate) };
    } else if (endDate) {
      where.startedAt = { lte: new Date(endDate) };
    }
    if (provider) {
      where.legs = { some: { provider } };
    }
    if (q) {
      where.messages = { some: { content: { contains: q, mode: 'insensitive' } } };
    }

    const total = await prisma.aIConversation.count({ where });

    const conversations = await prisma.aIConversation.findMany({
      where,
      select: {
        id: true,
        sessionId: true,
        reflinkId: true,
        startedAt: true,
        lastMessageAt: true,
        messageCount: true,
        totalCost: true,
        metadata: true,
        legs: {
          select: { provider: true, modelAlias: true, modelId: true, startedAt: true, endReason: true },
          orderBy: { startedAt: 'desc' },
        },
        reflink: { select: { code: true, recipientName: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const rows = conversations.map((c) => {
      const latestLeg = c.legs[0];
      const metaProvider = (c.metadata as any)?.provider as string | undefined;
      return {
        id: c.id,
        sessionId: c.sessionId,
        reflinkId: c.reflinkId,
        reflinkCode: c.reflink?.code ?? null,
        recipientName: c.reflink?.recipientName ?? null,
        startedAt: c.startedAt,
        lastMessageAt: c.lastMessageAt,
        messageCount: c.messageCount,
        totalCost: Number(c.totalCost),
        provider: latestLeg?.provider ?? metaProvider ?? 'unknown',
        model: latestLeg?.modelAlias ?? latestLeg?.modelId ?? null,
        legCount: c.legs.length,
        open: latestLeg ? !latestLeg.endReason : false,
      };
    });

    return NextResponse.json({
      success: true,
      data: { conversations: rows, total, hasMore: offset + conversations.length < total },
    });
  } catch (error) {
    console.error('[admin/conversations/browse] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to browse conversations' },
      { status: 500 }
    );
  }
}
