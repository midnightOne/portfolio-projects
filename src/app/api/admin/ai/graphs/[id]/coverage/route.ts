/**
 * Coverage aggregates over traversal markers (Block E3 — Req 9.3, design §6
 * route table): per-node hit rates, dead nodes, hot off-graph exits, edge
 * fire counts over a bounded window (P14 — `?days=`, default 30, clamped to
 * 365). Test-tagged conversations excluded (P17). No AI calls — read-only
 * aggregation, no gateway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { graphCoverage } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  const daysParam = Number(request.nextUrl.searchParams.get('days') ?? '30');
  const days = Number.isFinite(daysParam) ? daysParam : 30;
  const report = await graphCoverage(id, days);
  if (!report) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found (or its document is unreadable)'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess(report));
}
