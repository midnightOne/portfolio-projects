/**
 * Admin: embedding model switch (owner, 2026-07-09).
 *
 * GET  → current `default-embedding` resolution, stored-chunk model distribution
 *        (drift = stored ≠ current), corpus size, and per-candidate reindex cost.
 * POST → { provider, modelId, confirm: true } — repoints the alias AND re-embeds
 *        the whole corpus in one consented operation. `confirm` is enforced
 *        server-side: switching without reindexing silently breaks semantic
 *        search (query vs stored vectors from different models), so the two
 *        never happen separately. The generic model-aliases PUT rejects
 *        `default-embedding` and points here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withAIGateway } from '@/lib/ai/gateway';
import { SUPPORTED_EMBEDDING_MODELS } from '@/lib/ai/embeddings';
import { resolveModelAlias, __clearModelAliasCache } from '@/lib/ai/model-registry';
import { estimateReindex, reindexAllEmbeddings } from '@/lib/content/EmbeddingReindexService';

// Whole-corpus reindex runs inline (91 chunks ≈ 6 s today; revisit if the
// corpus outgrows the route budget — then it becomes a semantic operation).
export const maxDuration = 300;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const current = await resolveModelAlias('default-embedding').catch(() => null);
  const distribution = await prisma.$queryRaw<Array<{ embedding_model: string | null; n: bigint }>>`
    SELECT embedding_model, count(*) AS n FROM context_chunks
    WHERE embedding_vector IS NOT NULL GROUP BY embedding_model`;

  const candidates = await Promise.all(
    SUPPORTED_EMBEDDING_MODELS.map(async (m) => ({
      ...m,
      estimate: await estimateReindex(m.modelId),
    }))
  );

  const stored = distribution.map((d) => ({ model: d.embedding_model ?? 'unknown', chunks: Number(d.n) }));
  return NextResponse.json({
    success: true,
    current,
    stored,
    drift: !!current && stored.some((s) => s.model !== current.modelId),
    candidates,
  });
}

async function handlePOST(request: NextRequest) {
  // The gateway rejects public traffic and runs the kill-switch/metering chain
  // (D33 — the reindex spends on the embedding API); admin is still required
  // explicitly because a valid reflink also clears publicAllowed: false.
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { provider?: string; modelId?: string; confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const target = SUPPORTED_EMBEDDING_MODELS.find(
    (m) => m.provider === body.provider && m.modelId === body.modelId
  );
  if (!target) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported embedding model. Supported: ${SUPPORTED_EMBEDDING_MODELS.map((m) => `${m.provider}/${m.modelId}`).join(', ')}`,
      },
      { status: 400 }
    );
  }

  if (body.confirm !== true) {
    const estimate = await estimateReindex(target.modelId);
    return NextResponse.json(
      {
        success: false,
        error: 'Switching the embedding model re-embeds the entire corpus. Repeat the request with confirm: true.',
        requiresConfirmation: true,
        estimate,
      },
      { status: 409 }
    );
  }

  await prisma.aIModelAlias.upsert({
    where: { alias: 'default-embedding' },
    update: { provider: target.provider, modelId: target.modelId },
    create: { alias: 'default-embedding', provider: target.provider, modelId: target.modelId },
  });
  __clearModelAliasCache();

  try {
    const result = await reindexAllEmbeddings();
    return NextResponse.json({ success: true, switchedTo: target, reindex: result });
  } catch (error) {
    console.error('[embedding-model] reindex failed after alias switch:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          'Alias was switched but the reindex failed — semantic search is degraded until a retry succeeds. Retry the switch with the same model.',
        switchedTo: target,
      },
      { status: 500 }
    );
  }
}

export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
