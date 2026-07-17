/**
 * Generated portfolio summary (ai-assistant 7.22, owner ask 2026-07-17).
 *
 * The mint start frame's portfolio overview splits into TWO halves:
 *
 *  1. OWNER-CURATED — already content, not code: the `CUSTOM/owner-bio` and
 *     `CUSTOM/visitor-intro` T1 chunks (admin semantic chunk editor), with
 *     `OWNER_PROFILE` as the code fallback and `PORTFOLIO_FRAMING` staying in
 *     code (instruction material about the assistant's own situation).
 *
 *  2. LLM-GENERATED — this module: a `CUSTOM/portfolio-summary` T1 chunk
 *     (`summary`) written by the `default-summarizer` alias from the CURRENT
 *     project data (titles, slugs, T1 summaries, technologies), regenerated
 *     automatically when a semantic processing operation completes — so the
 *     overview follows the data instead of drifting stale.
 *
 * Regeneration discipline:
 *  - A `sourceHash` over the inputs makes repeat triggers no-ops (scope-'all'
 *    fires once per completion; unchanged data costs a hash compare, not an
 *    LLM call).
 *  - A manually-edited chunk is NEVER overwritten (same preservation rule as
 *    re-chunking, 7.15) — the owner's hand-tuned overview wins until they
 *    clear the flag in the chunk editor.
 *  - Generation rides `runSecondaryLLMJob` (Block M — the required path),
 *    metered as `portfolio_summary`. Failure leaves the previous chunk in
 *    place; the start frame also keeps a per-project fallback assembly, so a
 *    missing/stale summary degrades, never breaks.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { runSecondaryLLMJob } from '@/lib/services/ai/secondary-llm';
import { __clearStartFrameCache } from './start-frame';

const SUMMARY_ENTITY = { entityType: 'CUSTOM', slug: 'portfolio-summary' } as const;
const SUMMARY_CHUNK_ID = 'summary';
const SUMMARY_CHAR_CAP = 1400; // the frame's overview budget — never exceed it

const SummarySchema = z.object({ summary: z.string() });

export type PortfolioSummaryOutcome =
  | { status: 'generated'; chars: number; modelId: string | null }
  | { status: 'skipped_manual' }
  | { status: 'skipped_unchanged' }
  | { status: 'skipped_no_projects' }
  | { status: 'failed'; reason: string };

interface SummaryInputs {
  digest: string;
  sourceHash: string;
  projectCount: number;
}

async function collectInputs(): Promise<SummaryInputs> {
  const [projects, t1Chunks] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: 'PUBLIC' },
      select: { slug: true, title: true, tags: { select: { name: true } } },
      orderBy: { workDate: 'desc' },
    }),
    prisma.contextChunk.findMany({
      where: { tier: 1, entity: { entityType: 'PROJECT' } },
      select: { content: true, entity: { select: { slug: true } } },
    }),
  ]);
  const summaryBySlug = new Map<string, string>();
  for (const c of t1Chunks) {
    if (c.entity?.slug) summaryBySlug.set(c.entity.slug, c.content);
  }
  const lines = projects.map((p) => {
    const t1 = summaryBySlug.get(p.slug)?.replace(/\s+/g, ' ').trim();
    const tech = p.tags.map((t) => t.name).join(', ');
    return `- ${p.title} (slug: ${p.slug})${tech ? ` [${tech}]` : ''}${t1 ? `: ${t1}` : ''}`;
  });
  const digest = lines.join('\n');
  return {
    digest,
    sourceHash: createHash('sha256').update(digest).digest('hex').slice(0, 32),
    projectCount: projects.length,
  };
}

/**
 * Regenerate the `CUSTOM/portfolio-summary` chunk from current project data.
 * Never throws — callers are fire-and-forget hooks on the ingestion pipeline.
 */
export async function regeneratePortfolioSummary(opts: { force?: boolean } = {}): Promise<PortfolioSummaryOutcome> {
  try {
    const inputs = await collectInputs();
    if (inputs.projectCount === 0) return { status: 'skipped_no_projects' };

    const existing = await prisma.contextChunk.findFirst({
      where: {
        tier: 1,
        chunkId: SUMMARY_CHUNK_ID,
        entity: { entityType: SUMMARY_ENTITY.entityType, slug: SUMMARY_ENTITY.slug },
      },
      select: { id: true, manuallyEdited: true, metadata: true },
    });
    if (existing?.manuallyEdited && !opts.force) return { status: 'skipped_manual' };
    const priorHash = (existing?.metadata as { sourceHash?: string } | null)?.sourceHash;
    if (priorHash === inputs.sourceHash && !opts.force) return { status: 'skipped_unchanged' };

    const outcome = await runSecondaryLLMJob({
      alias: 'default-summarizer',
      prompt: [
        {
          role: 'system',
          content:
            'You write the grounding overview an AI portfolio assistant reads at session start. From the project data below, write ONE compact overview of the whole portfolio: what it contains, one clause per project — every project MUST appear, each with its slug in parentheses exactly as given — and a closing sentence on the technology story across projects. Plain prose, no markdown, no headings, 100-170 words. Respond with ONLY a JSON object: {"summary": "..."}',
        },
        { role: 'user', content: `Current project data:\n\n${inputs.digest}` },
      ],
      schema: SummarySchema,
      usageType: 'portfolio_summary',
      feature: 'semantic',
      temperature: 0.3,
      // Generous cap: reasoning-enabled models (Gemini 2.5 family) spend
      // "thinking" tokens inside the output budget — 500 starved the JSON.
      maxOutputTokens: 2000,
      timeoutMs: 30_000,
      metadata: { sourceHash: inputs.sourceHash },
    });

    const summary = outcome.result?.summary?.trim().slice(0, SUMMARY_CHAR_CAP);
    if (!summary) {
      return { status: 'failed', reason: outcome.timedOut ? 'timed out' : 'unparseable model output' };
    }

    const entity = await prisma.contentEntity.upsert({
      where: { entityType_slug: SUMMARY_ENTITY },
      update: {},
      create: {
        ...SUMMARY_ENTITY,
        title: 'Portfolio summary (generated)',
        description: 'LLM-generated portfolio overview for the mint start frame — regenerated at ingest.',
      },
      select: { id: true },
    });
    await prisma.contextChunk.upsert({
      where: { entityId_tier_chunkId: { entityId: entity.id, tier: 1, chunkId: SUMMARY_CHUNK_ID } },
      update: {
        content: summary,
        tokenCount: Math.ceil(summary.length / 4),
        generationMode: 'system',
        modifiedBy: 'portfolio-summary-regen',
        metadata: {
          sourceHash: inputs.sourceHash,
          generatedAt: new Date().toISOString(),
          provider: outcome.provider,
          modelId: outcome.modelId,
        },
      },
      create: {
        entityId: entity.id,
        tier: 1,
        chunkId: SUMMARY_CHUNK_ID,
        title: 'Portfolio summary (generated)',
        content: summary,
        tokenCount: Math.ceil(summary.length / 4),
        generationMode: 'system',
        modifiedBy: 'portfolio-summary-regen',
        metadata: {
          sourceHash: inputs.sourceHash,
          generatedAt: new Date().toISOString(),
          provider: outcome.provider,
          modelId: outcome.modelId,
        },
      },
    });

    __clearStartFrameCache(); // the next mint assembles against the fresh summary
    return { status: 'generated', chars: summary.length, modelId: outcome.modelId };
  } catch (error) {
    console.error('[portfolio-summary] regeneration failed (previous summary stays):', error);
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Read the generated summary chunk (start-frame consumer). Null = not generated yet. */
export async function loadGeneratedPortfolioSummary(): Promise<string | null> {
  const chunk = await prisma.contextChunk.findFirst({
    where: {
      tier: 1,
      chunkId: SUMMARY_CHUNK_ID,
      entity: { entityType: SUMMARY_ENTITY.entityType, slug: SUMMARY_ENTITY.slug },
    },
    select: { content: true },
  });
  const text = chunk?.content?.trim();
  return text ? text.slice(0, SUMMARY_CHAR_CAP) : null;
}
