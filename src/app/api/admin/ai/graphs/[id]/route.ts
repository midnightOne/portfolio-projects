/**
 * Conversation-graph draft read/save + archive (Block D1, design §6).
 *
 * PUT saves the DRAFT only (Req 8.5 — live conversations continue on the
 * active version untouched); invalid drafts save deliberately (autosave must
 * not lose work) and validation issues ride back for the canvas badges.
 * DELETE archives — versions and telemetry joins are never destroyed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { getGraphDetail, saveDraft, archiveGraph } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  const detail = await getGraphDetail(id);
  if (!detail) return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  return NextResponse.json(createApiSuccess(detail));
}

const PutSchema = z.object({
  document: z.unknown(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

export async function PUT(request: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(createApiError('BAD_REQUEST', 'Invalid JSON body'), { status: 400 });
  }
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', parsed.error.errors[0]?.message ?? 'Invalid body'), { status: 400 });
  }
  try {
    const result = await saveDraft(id, parsed.data.document, {
      name: parsed.data.name,
      description: parsed.data.description,
    });
    if (!result) return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
    return NextResponse.json(createApiSuccess(result));
  } catch (err) {
    return NextResponse.json(createApiError('BAD_REQUEST', err instanceof Error ? err.message : 'Invalid document'), { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  const ok = await archiveGraph(id);
  if (!ok) return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  return NextResponse.json(createApiSuccess({ archived: true }));
}
