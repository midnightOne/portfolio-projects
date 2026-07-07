/**
 * Model alias registry admin API (D4, ai-admin task 1.1)
 *
 * GET  → list all alias rows (the registry the whole system resolves through)
 * PUT  → update one alias's {provider, modelId}; alias set is fixed (the five
 *        role aliases) — aliases are roles, not a free-form list.
 *
 * No literal model IDs belong in feature code — this registry is the single
 * mapping point, admin-editable so a model switch needs no deploy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { __clearModelAliasCache, type ModelAliasName } from '@/lib/ai/model-registry';

const VALID_ALIASES: ModelAliasName[] = [
  'default-chat',
  'default-cheap',
  'default-reasoning',
  'default-embedding',
  'default-realtime',
];

const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs'];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any)?.role === 'admin';
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const rows = await prisma.aIModelAlias.findMany({ orderBy: { alias: 'asc' } });
  return NextResponse.json({ success: true, data: rows });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { alias?: string; provider?: string; modelId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { alias, provider, modelId } = body;
  if (!alias || !VALID_ALIASES.includes(alias as ModelAliasName)) {
    return NextResponse.json(
      { success: false, error: `alias must be one of: ${VALID_ALIASES.join(', ')}` },
      { status: 400 }
    );
  }
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { success: false, error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!modelId || typeof modelId !== 'string' || modelId.length > 128) {
    return NextResponse.json({ success: false, error: 'modelId is required' }, { status: 400 });
  }

  const row = await prisma.aIModelAlias.upsert({
    where: { alias },
    update: { provider, modelId },
    create: { alias, provider, modelId },
  });

  // Registry consumers memoize for 60s per instance — clear this instance now
  __clearModelAliasCache();

  return NextResponse.json({ success: true, data: row });
}
