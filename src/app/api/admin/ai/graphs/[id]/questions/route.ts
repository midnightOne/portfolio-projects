/**
 * Per-node question clusters for the editor's "What visitors actually asked"
 * panel (Block D4 / Req 16.3, design §6 route table). Pure read over
 * NodeEntryQuestion rows the I1 batch produced — nodeId keys are stable across
 * graph versions (Req 1.5), so the panel survives edits.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { getNodeQuestionClusters } from '@/lib/services/ai/engine-batches';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json(createApiSuccess(await getNodeQuestionClusters(id)));
}
