/**
 * Single immutable version document (Block E1 — Req 9.1): the read-only
 * traversal viewer loads the EXACT version a conversation ran under (P6
 * pinning is the interpretation contract). Admin-only; embedding vectors are
 * stripped in the store.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { getVersionDetail } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id, versionId } = await params;
  const detail = await getVersionDetail(id, versionId);
  if (!detail) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Version not found for this graph'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess(detail));
}
