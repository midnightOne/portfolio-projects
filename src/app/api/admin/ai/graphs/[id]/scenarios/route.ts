/**
 * Golden-scenario CRUD (Block F2 — Req 10.2). Route addition beyond the
 * design §6 table, with reason: the table lists only scenarios/run, but F2's
 * acceptance is "GraphScenario CRUD, record-from-test-session" — list/create
 * live here, item ops in [scenarioId]/route.ts (same precedent as E1's
 * versions/[versionId] addition). No AI calls, no gateway — admin-auth reads
 * and writes over Prisma.
 *
 * POST body: { name, turns, expectedPath }             → create from a script
 *            { name, recordFromConversationId }        → record from a finished
 *              (test) session's actual traversal, then edit (Req 10.2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { listScenarios, createScenario, recordScenarioFromConversation } from '@/lib/services/ai/scenario-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  const scenarios = await listScenarios(id);
  if (!scenarios) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess({ scenarios }));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  let body: {
    name?: unknown;
    turns?: unknown;
    expectedPath?: unknown;
    recordFromConversationId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(createApiError('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 });
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 200) {
    return NextResponse.json(createApiError('VALIDATION_ERROR', 'name is required (≤200 chars)'), { status: 400 });
  }

  const result =
    typeof body.recordFromConversationId === 'string'
      ? await recordScenarioFromConversation(id, { conversationId: body.recordFromConversationId, name: body.name.trim() })
      : await createScenario(id, { name: body.name.trim(), turns: body.turns, expectedPath: body.expectedPath });

  if (result === null) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  }
  if ('error' in result) {
    return NextResponse.json(createApiError('VALIDATION_ERROR', result.error), { status: 400 });
  }
  return NextResponse.json(createApiSuccess({ scenario: result }), { status: 201 });
}
