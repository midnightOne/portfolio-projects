/**
 * Re-activate a previously published version (Req 8.4). Moves the live
 * pointer only; the draft stays the working copy. Live conversations keep
 * their pinned version (P6). Route is additive to the design §6 table —
 * re-activation needed an explicit endpoint (noted in the Block D ledger).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { activateVersion } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id, versionId } = await params;
  const result = await activateVersion(id, versionId);
  if (!result) return NextResponse.json(createApiError('NOT_FOUND', 'Version not found for this graph'), { status: 404 });
  return NextResponse.json(createApiSuccess(result));
}
