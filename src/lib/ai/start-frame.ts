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
const CACHE_TTL_MS = 60_000;
let cache: { at: number; frame: string } | null = null;

export async function assembleStartFrame(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.frame;

  const [projects, t1Chunks] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: 'PUBLIC' },
      select: { slug: true, title: true, tags: { select: { name: true } } },
      orderBy: { workDate: 'desc' },
    }),
    prisma.contextChunk.findMany({
      where: { tier: 1 },
      select: { content: true, entity: { select: { slug: true } } },
    }),
  ]);

  const summaryBySlug = new Map<string, string>();
  for (const c of t1Chunks) {
    if (c.entity?.slug) summaryBySlug.set(c.entity.slug, c.content);
  }

  const technologies = [...new Set(projects.flatMap((p) => p.tags.map((t) => t.name)))];
  const perProjectBudget = Math.floor(
    (FRAME_CHAR_BUDGET - 200) / Math.max(1, projects.length)
  );

  const lines: string[] = ['PORTFOLIO OVERVIEW (ground yourself in this):'];
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

  const frame = lines.join('\n').slice(0, FRAME_CHAR_BUDGET);
  cache = { at: now, frame };
  return frame;
}

export function __clearStartFrameCache(): void {
  cache = null;
}
