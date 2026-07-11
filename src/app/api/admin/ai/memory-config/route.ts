/**
 * Admin: conversation-memory layer config (conversation-engine Block M2 —
 * Req 19.7). GET/PUT the singleton ConversationMemoryConfig row: the memory
 * switch (profile flags / behavior summarizer / rolling window, independent of
 * graph presence) and the graph-less default tool set (narrow-only). Upserts
 * so a fresh clone needs no seed step — a missing row reads as the defaults.
 * Pure config CRUD: no model calls, no gateway (D33 does not apply).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { __clearMemoryConfigCache, MEMORY_CONFIG_DEFAULTS } from '@/lib/services/ai/memory-config';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const row = await prisma.conversationMemoryConfig.findUnique({ where: { id: 'memory' } });
  return NextResponse.json({
    memoryEnabled: row?.memoryEnabled ?? MEMORY_CONFIG_DEFAULTS.memoryEnabled,
    graphlessToolAllowlist: Array.isArray(row?.graphlessToolAllowlist)
      ? row.graphlessToolAllowlist
      : null,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.memoryEnabled === 'boolean') data.memoryEnabled = body.memoryEnabled;
  if (body.graphlessToolAllowlist === null) {
    data.graphlessToolAllowlist = null;
  } else if (
    Array.isArray(body.graphlessToolAllowlist) &&
    body.graphlessToolAllowlist.every((t: unknown) => typeof t === 'string' && t.length > 0 && t.length <= 100)
  ) {
    // Empty array normalizes to null (= no narrowing): an accidental empty
    // save must not lock every tool out of graph-less sessions.
    data.graphlessToolAllowlist = body.graphlessToolAllowlist.length > 0 ? body.graphlessToolAllowlist : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const row = await prisma.conversationMemoryConfig.upsert({
    where: { id: 'memory' },
    create: { id: 'memory', ...data },
    update: data,
  });
  __clearMemoryConfigCache();
  return NextResponse.json({
    memoryEnabled: row.memoryEnabled,
    graphlessToolAllowlist: Array.isArray(row.graphlessToolAllowlist) ? row.graphlessToolAllowlist : null,
  });
}
