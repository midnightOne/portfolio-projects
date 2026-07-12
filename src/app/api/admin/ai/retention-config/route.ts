/**
 * Admin: data-retention config + deletion audit trail (conversation-engine
 * Block K — Req 21.2/21.4 as amended 2026-07-11). GET/PUT the singleton
 * ConversationRetentionConfig row; GET also returns the recent
 * DataLifecycleAudit rows so every owner-side deletion is inspectable next to
 * the knobs that caused it. Visitor-initiated removal does not exist (owner
 * ruling) — these knobs are the ONLY deletion path. Every knob null (the
 * default) = retain indefinitely. Pure config CRUD: no model calls, no
 * gateway (D33 does not apply). Upserts so a fresh clone needs no seed step.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import {
  __clearRetentionConfigCache,
  normalizeRetentionDays,
  RETENTION_DEFAULTS,
} from '@/lib/services/ai/retention';

const KNOBS = ['transcriptRetentionDays', 'summaryRetentionDays', 'leadRetentionDays'] as const;

async function recentAudits() {
  const rows = await prisma.dataLifecycleAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    criteria: r.criteria,
    counts: r.counts,
    initiatedBy: r.initiatedBy,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const row = await prisma.conversationRetentionConfig.findUnique({ where: { id: 'retention' } });
  return NextResponse.json({
    transcriptRetentionDays: normalizeRetentionDays(row?.transcriptRetentionDays),
    summaryRetentionDays: normalizeRetentionDays(row?.summaryRetentionDays),
    leadRetentionDays: normalizeRetentionDays(row?.leadRetentionDays),
    audits: await recentAudits(),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data: Record<string, number | null> = {};
  for (const knob of KNOBS) {
    if (!(knob in body)) continue;
    const value = body[knob];
    if (value === null) {
      data[knob] = null; // explicit "keep forever"
    } else if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3650) {
      data[knob] = value;
    } else {
      return NextResponse.json(
        { error: `${knob} must be null (keep forever) or an integer between 1 and 3650 days` },
        { status: 400 }
      );
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const row = await prisma.conversationRetentionConfig.upsert({
    where: { id: 'retention' },
    create: { id: 'retention', ...RETENTION_DEFAULTS, ...data },
    update: data,
  });
  __clearRetentionConfigCache();

  const warnings: string[] = [];
  const transcript = normalizeRetentionDays(row.transcriptRetentionDays);
  const summary = normalizeRetentionDays(row.summaryRetentionDays);
  if (transcript !== null && summary !== null && summary < transcript) {
    warnings.push(
      'Summaries are configured to expire before transcripts — Req 21.4 intends summaries to outlive them.'
    );
  }
  return NextResponse.json({
    transcriptRetentionDays: transcript,
    summaryRetentionDays: summary,
    leadRetentionDays: normalizeRetentionDays(row.leadRetentionDays),
    warnings,
  });
}
