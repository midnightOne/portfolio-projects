/**
 * Scenario batch run (design §6 route table; Block F2 — Req 10.3/10.4):
 * runs a graph's golden scenarios against the draft (default), the active
 * version, or a named version — ALWAYS against fakes (P16: scripted
 * classifier, stable-vector embeddings, fixed clock; runScenario builds its
 * own engine). Zero AI spend, so no gateway. `rebaseline: true` is Req 10.4's
 * one action: diverged scenarios get their expectedPath repinned to the new
 * actual path (structural errors and empty traversals stay untouched).
 *
 * POST body: { target?: 'draft' | 'active' | { versionId },
 *              scenarioIds?: string[], rebaseline?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { runGraphScenarios, type ScenarioRunTarget } from '@/lib/services/ai/scenario-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

function parseTarget(raw: unknown): ScenarioRunTarget | { error: string } {
  if (raw === undefined || raw === 'draft') return 'draft';
  if (raw === 'active') return 'active';
  if (raw && typeof raw === 'object' && typeof (raw as { versionId?: unknown }).versionId === 'string') {
    return { versionId: (raw as { versionId: string }).versionId };
  }
  return { error: "target must be 'draft', 'active', or { versionId }" };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  let body: { target?: unknown; scenarioIds?: unknown; rebaseline?: unknown } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(createApiError('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 });
  }
  const target = parseTarget(body.target);
  if (typeof target === 'object' && 'error' in target) {
    return NextResponse.json(createApiError('VALIDATION_ERROR', target.error), { status: 400 });
  }
  const scenarioIds = Array.isArray(body.scenarioIds)
    ? body.scenarioIds.filter((s): s is string => typeof s === 'string')
    : undefined;

  const result = await runGraphScenarios(id, {
    target,
    scenarioIds,
    rebaseline: body.rebaseline === true,
  });
  if (result === null) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  }
  if ('error' in result) {
    return NextResponse.json(createApiError('VALIDATION_ERROR', result.error), { status: 400 });
  }
  return NextResponse.json(createApiSuccess(result));
}
