/**
 * Graph annotations — the review loop (Block E2 — Req 9.2, design §6 route
 * table): mark a turn in replay → row linked to {conversation, message,
 * active node, graph version}; the editor's TODO drawer lists open marks;
 * resolving links the annotation to the graph version that addressed it
 * (explicit `resolvedByVersionId`, or the graph's current version by default
 * — see graph-store.updateAnnotation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { listAnnotations, createAnnotation, updateAnnotation } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  if (status && status !== 'open' && status !== 'resolved') {
    return NextResponse.json(createApiError('BAD_REQUEST', 'status must be open or resolved'), { status: 400 });
  }
  const rows = await listAnnotations({
    graphId: sp.get('graphId') ?? undefined,
    conversationId: sp.get('conversationId') ?? undefined,
    status: (status as 'open' | 'resolved' | null) ?? undefined,
  });
  return NextResponse.json(createApiSuccess(rows));
}

const CreateSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  nodeId: z.string().min(1),
  graphVersionId: z.string().min(1),
  kind: z.enum(['bad_answer', 'missed_transition', 'note']),
  note: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid payload'), { status: 400 });
  }
  const result = await createAnnotation(parsed.data);
  if ('error' in result) {
    return NextResponse.json(createApiError('BAD_REQUEST', result.error), { status: 400 });
  }
  return NextResponse.json(createApiSuccess(result), { status: 201 });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['open', 'resolved']).optional(),
  note: z.string().max(2000).optional(),
  resolvedByVersionId: z.string().min(1).optional(),
});

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid payload'), { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  const row = await updateAnnotation(id, patch);
  if (!row) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Annotation not found'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess(row));
}
