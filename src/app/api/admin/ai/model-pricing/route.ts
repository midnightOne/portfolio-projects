/**
 * Model pricing admin API (D38, ai-admin task 3.1 residual)
 *
 * GET    → list all AIModelPricing rows (the rates estimateCost() resolves through)
 * PUT    → update one row's rates/notes by modelId
 * POST   → create a new pricing row
 * DELETE → remove a row (?modelId=…) — unknown models then price at the most
 *          expensive known rate (conservative, never free)
 *
 * Rates are data, not constants: ledger writes and pre-flight estimates both
 * read this table, so a rate edit here changes costs system-wide with no deploy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { __clearPricingCache } from '@/lib/ai/pricing';

const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs', 'fake'];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any)?.role === 'admin';
}

function parseRate(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 10_000) return null;
  return n;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const rows = await prisma.aIModelPricing.findMany({
    orderBy: [{ provider: 'asc' }, { modelId: 'asc' }],
  });
  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      modelId: r.modelId,
      provider: r.provider,
      inputPerMTokUsd: Number(r.inputPerMTokUsd),
      outputPerMTokUsd: Number(r.outputPerMTokUsd),
      notes: r.notes,
      updatedAt: r.updatedAt,
    })),
  });
}

async function upsertRow(request: NextRequest, mustExist: boolean) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { modelId?: string; provider?: string; inputPerMTokUsd?: unknown; outputPerMTokUsd?: unknown; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { modelId, provider, notes } = body;
  if (!modelId || typeof modelId !== 'string' || modelId.length > 128) {
    return NextResponse.json({ success: false, error: 'modelId is required' }, { status: 400 });
  }
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { success: false, error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }
  const inputRate = parseRate(body.inputPerMTokUsd);
  const outputRate = parseRate(body.outputPerMTokUsd);
  if (inputRate === null || outputRate === null) {
    return NextResponse.json(
      { success: false, error: 'inputPerMTokUsd and outputPerMTokUsd must be numbers in [0, 10000] (USD per 1M tokens)' },
      { status: 400 }
    );
  }

  const existing = await prisma.aIModelPricing.findUnique({ where: { modelId } });
  if (mustExist && !existing) {
    return NextResponse.json({ success: false, error: `No pricing row for '${modelId}'` }, { status: 404 });
  }
  if (!mustExist && existing) {
    return NextResponse.json({ success: false, error: `Pricing row for '${modelId}' already exists — use PUT` }, { status: 409 });
  }

  const data = {
    provider,
    inputPerMTokUsd: inputRate,
    outputPerMTokUsd: outputRate,
    notes: typeof notes === 'string' ? notes.slice(0, 500) : existing?.notes ?? null,
  };
  const row = await prisma.aIModelPricing.upsert({
    where: { modelId },
    update: data,
    create: { modelId, ...data },
  });

  // Pricing consumers memoize ≤60s per instance — clear this instance now
  __clearPricingCache();

  return NextResponse.json({ success: true, data: row });
}

export async function PUT(request: NextRequest) {
  return upsertRow(request, true);
}

export async function POST(request: NextRequest) {
  return upsertRow(request, false);
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const modelId = request.nextUrl.searchParams.get('modelId');
  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId query parameter is required' }, { status: 400 });
  }
  try {
    await prisma.aIModelPricing.delete({ where: { modelId } });
  } catch {
    return NextResponse.json({ success: false, error: `No pricing row for '${modelId}'` }, { status: 404 });
  }
  __clearPricingCache();
  return NextResponse.json({ success: true });
}
