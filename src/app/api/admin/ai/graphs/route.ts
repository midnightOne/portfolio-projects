/**
 * Conversation-graph CRUD — list + create/duplicate (Block D1, design §6).
 * Admin-only (Req 8.6/11.1): the public runtimes receive engine EFFECTS, never
 * graph structure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { listGraphs, createGraph, duplicateGraph } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  return NextResponse.json(createApiSuccess(await listGraphs()));
}

const CreateSchema = z.union([
  z.object({ name: z.string().min(1).max(120), description: z.string().max(2000).optional() }),
  z.object({ duplicateFrom: z.string().min(1) }),
]);

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(createApiError('BAD_REQUEST', 'Invalid JSON body'), { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', parsed.error.errors[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  if ('duplicateFrom' in parsed.data) {
    const copy = await duplicateGraph(parsed.data.duplicateFrom);
    if (!copy) return NextResponse.json(createApiError('NOT_FOUND', 'Source graph not found'), { status: 404 });
    return NextResponse.json(createApiSuccess(copy), { status: 201 });
  }
  const graph = await createGraph(parsed.data);
  return NextResponse.json(createApiSuccess(graph), { status: 201 });
}
