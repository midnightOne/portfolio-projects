/**
 * Golden-scenario item ops (Block F2 — Req 10.2/10.4): read for editing,
 * PATCH (rename / edit script / repin expectedPath — the editor's re-baseline
 * button PATCHes the run's actual path here), DELETE. Admin-auth, no AI calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { getScenario, updateScenario, deleteScenario } from '@/lib/services/ai/scenario-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

type Params = { params: Promise<{ id: string; scenarioId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id, scenarioId } = await params;
  const scenario = await getScenario(id, scenarioId);
  if (!scenario) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Scenario not found'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess({ scenario }));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id, scenarioId } = await params;
  let body: { name?: unknown; turns?: unknown; expectedPath?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(createApiError('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 });
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 200)) {
    return NextResponse.json(createApiError('VALIDATION_ERROR', 'name must be a non-empty string (≤200 chars)'), { status: 400 });
  }
  const result = await updateScenario(id, scenarioId, {
    ...(body.name !== undefined ? { name: (body.name as string).trim() } : {}),
    ...(body.turns !== undefined ? { turns: body.turns } : {}),
    ...(body.expectedPath !== undefined ? { expectedPath: body.expectedPath } : {}),
  });
  if (result === null) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Scenario not found'), { status: 404 });
  }
  if ('error' in result) {
    return NextResponse.json(createApiError('VALIDATION_ERROR', result.error), { status: 400 });
  }
  return NextResponse.json(createApiSuccess({ scenario: result }));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id, scenarioId } = await params;
  const deleted = await deleteScenario(id, scenarioId);
  if (!deleted) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Scenario not found'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess({ deleted: true }));
}
