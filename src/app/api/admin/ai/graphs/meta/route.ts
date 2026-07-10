/**
 * Editor metadata (Block D2 pickers): live UnifiedToolRegistry enumeration
 * with metadata (Req 4.2 — never a hardcoded list), the D4 alias roles, and
 * voice-clip categories (distinct phrase tags, D50).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { editorMeta } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  return NextResponse.json(createApiSuccess(await editorMeta()));
}
