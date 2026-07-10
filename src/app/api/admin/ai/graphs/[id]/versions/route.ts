/**
 * Version history (Req 8.4): list + `?diff=versionIdA,versionIdB` structural
 * diff by stable node/edge ids (Req 1.5 / P15).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { listVersions, diffVersions } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;

  const diffParam = request.nextUrl.searchParams.get('diff');
  if (diffParam) {
    const [a, b] = diffParam.split(',').map((s) => s.trim());
    if (!a || !b) {
      return NextResponse.json(createApiError('BAD_REQUEST', 'diff expects two version ids: ?diff=idA,idB'), { status: 400 });
    }
    const diff = await diffVersions(id, a, b);
    if (!diff) return NextResponse.json(createApiError('NOT_FOUND', 'One or both versions not found for this graph'), { status: 404 });
    return NextResponse.json(createApiSuccess(diff));
  }

  const versions = await listVersions(id);
  if (!versions) return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  return NextResponse.json(createApiSuccess(versions));
}
