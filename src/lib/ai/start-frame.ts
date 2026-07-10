/**
 * Conversation start frame (ai-assistant task 5d, D47 seam (a)).
 *
 * ONE server-side place that assembles the grounding frame a fresh conversation
 * starts with: per-project T1 summaries + technology list, from the semantic store —
 * no hardcoded portfolio strings (D48). Budget ≤ ~400 tokens (D25). The D47 engine
 * later replaces this function with the start node's context set.
 *
 * Consumers: /api/ai/chat system prompt (public text tier); the realtime mint routes
 * join with ai-assistant task 5d.1.
 */

import { prisma } from '@/lib/prisma';

const FRAME_CHAR_BUDGET = 1600; // ~400 tokens at chars/4
const INTRO_CHAR_CAP = 1200; // the intro is owner-authored but still bounded
const CACHE_TTL_MS = 60_000;
let cache: { at: number; frame: string } | null = null;

/**
 * Owner-authored visitor intro (conversation-engine Req 18.5, Block G2):
 * what this site is, how it works, what the AI can do — including offering
 * the auto-navigation option. Content, not code (D48): lives as the
 * `CUSTOM/visitor-intro` entity's T1 `intro` chunk, editable in the existing
 * admin semantic chunk editor. Absent entity/chunk = no intro section —
 * pre-G2 behavior unchanged.
 */
async function loadVisitorIntro(): Promise<string | null> {
  const chunk = await prisma.contextChunk.findFirst({
    where: {
      tier: 1,
      chunkId: 'intro',
      entity: { entityType: 'CUSTOM', slug: 'visitor-intro' },
    },
    select: { content: true },
  });
  const text = chunk?.content?.trim();
  return text ? text.slice(0, INTRO_CHAR_CAP) : null;
}

export async function assembleStartFrame(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.frame;

  const [projects, t1Chunks, intro] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: 'PUBLIC' },
      select: { slug: true, title: true, tags: { select: { name: true } } },
      orderBy: { workDate: 'desc' },
    }),
    prisma.contextChunk.findMany({
      where: { tier: 1, chunkId: { not: 'intro' } },
      select: { content: true, entity: { select: { slug: true } } },
    }),
    loadVisitorIntro().catch(() => null),
  ]);

  const summaryBySlug = new Map<string, string>();
  for (const c of t1Chunks) {
    if (c.entity?.slug) summaryBySlug.set(c.entity.slug, c.content);
  }

  const technologies = [...new Set(projects.flatMap((p) => p.tags.map((t) => t.name)))];
  const perProjectBudget = Math.floor(
    (FRAME_CHAR_BUDGET - 200) / Math.max(1, projects.length)
  );

  const lines: string[] = [];
  if (intro) {
    lines.push('VISITOR INTRO (owner-authored — use this to introduce the site and what you can do):', intro, '');
  }
  lines.push('PORTFOLIO OVERVIEW (ground yourself in this):');
  for (const p of projects) {
    const summary = summaryBySlug.get(p.slug);
    const line = summary
      ? `- ${p.title} (${p.slug}): ${summary.replace(/\s+/g, ' ')}`
      : `- ${p.title} (${p.slug})`;
    lines.push(line.length > perProjectBudget ? `${line.slice(0, perProjectBudget - 1)}…` : line);
  }
  if (technologies.length > 0) {
    lines.push(`Technologies across the portfolio: ${technologies.join(', ')}.`);
  }

  // The intro extends the budget rather than eating the overview — both are
  // independently capped (intro ≤ INTRO_CHAR_CAP, overview ≤ FRAME_CHAR_BUDGET).
  const budget = FRAME_CHAR_BUDGET + (intro ? intro.length + 120 : 0);
  const frame = lines.join('\n').slice(0, budget);
  cache = { at: now, frame };
  return frame;
}

export function __clearStartFrameCache(): void {
  cache = null;
}
