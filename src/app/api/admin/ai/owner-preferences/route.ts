/**
 * GET/PUT /api/admin/ai/owner-preferences (conversation-engine Req 13.4
 * expanded, Block G3): the owner's work-preferences text fed to the JD
 * compatibility analysis. Admin-only, server-side only — deliberately NOT a
 * content chunk so it can never leak through retrieval or full-text search
 * (P13); edited from the admin job-analysis page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

const MAX_PREFS_CHARS = 8_000;

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await prisma.aIOwnerPreferences.findUnique({ where: { id: 'owner' } });
  return NextResponse.json({ workPreferences: row?.workPreferences ?? '', updatedAt: row?.updatedAt ?? null });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const text = typeof body?.workPreferences === 'string' ? body.workPreferences : null;
  if (text === null) {
    return NextResponse.json({ error: 'workPreferences (string) is required' }, { status: 400 });
  }
  if (text.length > MAX_PREFS_CHARS) {
    return NextResponse.json({ error: `workPreferences exceeds ${MAX_PREFS_CHARS} characters` }, { status: 400 });
  }
  const row = await prisma.aIOwnerPreferences.upsert({
    where: { id: 'owner' },
    create: { id: 'owner', workPreferences: text },
    update: { workPreferences: text },
  });
  return NextResponse.json({ workPreferences: row.workPreferences, updatedAt: row.updatedAt });
}
