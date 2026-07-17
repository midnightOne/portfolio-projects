/**
 * Conversation start frame (ai-assistant tasks 5d + 7.2c + 7.13, D47 seam (a)).
 *
 * ONE server-side place that assembles the grounding frame a fresh conversation
 * starts with: owner identity + what-this-portfolio-is framing (7.2c, owner
 * finalized 2026-07-13 — identity is static per session, so it rides the
 * cacheable mint instructions ONCE instead of re-paying in every floating-block
 * flush; native mint instructions survive J4 window pruning by construction) +
 * per-project T1 summaries + technology list from the semantic store.
 *
 * The same module serves three consumers (never fork it — one owner per
 * concept): session mints (OpenAI GET/POST + Google + /chat + analyze-job),
 * the `portfolio_overview` tool (`brief` = this exact artifact), and the MCP
 * server (external models get no mint instructions — for them the tool IS the
 * start frame).
 */

import { prisma } from '@/lib/prisma';
import { ownerBioLine } from './owner-profile';

const FRAME_CHAR_BUDGET = 1600; // ~400 tokens at chars/4 (D25) — overview section only
const INTRO_CHAR_CAP = 1200; // the intro is owner-authored but still bounded
const OWNER_BIO_CAP = 600; // identity stays a paragraph, not an essay
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
async function loadVisitorIntro(cap = INTRO_CHAR_CAP): Promise<string | null> {
  const chunk = await prisma.contextChunk.findFirst({
    where: {
      tier: 1,
      chunkId: 'intro',
      entity: { entityType: 'CUSTOM', slug: 'visitor-intro' },
    },
    select: { content: true },
  });
  const text = chunk?.content?.trim();
  return text ? text.slice(0, cap) : null;
}

/**
 * Owner bio (7.2c): the `CUSTOM/owner-bio` T1 chunk when the owner has
 * authored one (same pattern as visitor-intro), else the canonical
 * owner-profile constant. Never empty — identity always rides the frame.
 */
async function loadOwnerBio(cap = OWNER_BIO_CAP): Promise<string> {
  try {
    const chunk = await prisma.contextChunk.findFirst({
      where: {
        tier: 1,
        chunkId: 'bio',
        entity: { entityType: 'CUSTOM', slug: 'owner-bio' },
      },
      select: { content: true },
    });
    const text = chunk?.content?.trim();
    if (text) return text.slice(0, cap);
  } catch {
    // fall through to the constant
  }
  return ownerBioLine().slice(0, cap);
}

/**
 * The what-this-portfolio-is / how-it-works framing (7.2c). Framing about the
 * assistant's own situation is instruction material, not portfolio content —
 * so it is code here, while everything owner-authored stays in the DB.
 */
const PORTFOLIO_FRAMING =
  'THIS SITE: an interactive portfolio; you are its embedded AI assistant and yourself one of its working exhibits. ' +
  'Visitors explore projects while you answer questions grounded in portfolio content, navigate the UI for them on request, ' +
  'and pull deeper material on demand (NAV_CONTEXT shows where the visitor currently is; ui_details reads what they are looking at; ' +
  'content_search/content_get cover the whole portfolio).';

export async function assembleStartFrame(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.frame;

  const [projects, t1Chunks, intro, ownerBio, generatedSummary] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: 'PUBLIC' },
      select: { slug: true, title: true, tags: { select: { name: true } } },
      orderBy: { workDate: 'desc' },
    }),
    prisma.contextChunk.findMany({
      where: { tier: 1, chunkId: { not: 'intro' }, entity: { entityType: 'PROJECT' } },
      select: { content: true, entity: { select: { slug: true } } },
    }),
    loadVisitorIntro().catch(() => null),
    loadOwnerBio(),
    // 7.22: the LLM-generated whole-portfolio overview, regenerated at ingest
    // (lib/ai/portfolio-summary.ts). Import stays dynamic-free: a lazy require
    // here would buy nothing — the module is tiny and prisma is shared.
    import('./portfolio-summary').then((m) => m.loadGeneratedPortfolioSummary()).catch(() => null),
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
  // 7.2c: identity FIRST — the one place it lives (the fid no longer carries it).
  lines.push(`OWNER: ${ownerBio}`, PORTFOLIO_FRAMING, '');
  if (intro) {
    lines.push('VISITOR INTRO (owner-authored — use this to introduce the site and what you can do):', intro, '');
  }
  lines.push('PORTFOLIO OVERVIEW (ground yourself in this):');
  if (generatedSummary) {
    // 7.22 split: the generated summary is the overview prose; a compact index
    // straight from the DB rides alongside so slugs/titles are ALWAYS current
    // even if the summary lags a regeneration.
    lines.push(generatedSummary, '', `PROJECTS: ${projects.map((p) => `${p.title} (${p.slug})`).join('; ')}`);
  } else {
    // Fallback (no generated summary yet): the pre-7.22 per-project assembly.
    for (const p of projects) {
      const summary = summaryBySlug.get(p.slug);
      const line = summary
        ? `- ${p.title} (${p.slug}): ${summary.replace(/\s+/g, ' ')}`
        : `- ${p.title} (${p.slug})`;
      lines.push(line.length > perProjectBudget ? `${line.slice(0, perProjectBudget - 1)}…` : line);
    }
  }
  if (technologies.length > 0) {
    lines.push(`Technologies across the portfolio: ${technologies.join(', ')}.`);
  }

  // Identity + intro extend the budget rather than eating the overview — each
  // section is independently capped (bio ≤ OWNER_BIO_CAP, intro ≤
  // INTRO_CHAR_CAP, overview ≤ FRAME_CHAR_BUDGET; the 7.22 always-fresh
  // project index extends it too, so it can never crowd out the tech line).
  const budget =
    FRAME_CHAR_BUDGET +
    ownerBio.length +
    PORTFOLIO_FRAMING.length +
    120 +
    (intro ? intro.length + 120 : 0) +
    (generatedSummary ? projects.length * 60 + 40 : 0);
  const frame = lines.join('\n').slice(0, budget);
  cache = { at: now, frame };
  return frame;
}

/**
 * `portfolio_overview` assembly (ai-assistant 7.13 + mcp-server task 6).
 * `brief` = the start-frame artifact VERBATIM (one owner per concept);
 * `full` = the uncompressed read: full owner bio + full visitor intro +
 * a project index with per-project technology lists.
 */
export async function assemblePortfolioOverview(depth: 'brief' | 'full' = 'brief'): Promise<string> {
  if (depth !== 'full') return assembleStartFrame();

  const [projects, t1Chunks, intro, ownerBio] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: 'PUBLIC' },
      select: { slug: true, title: true, tags: { select: { name: true } } },
      orderBy: { workDate: 'desc' },
    }),
    prisma.contextChunk.findMany({
      where: { tier: 1, chunkId: { not: 'intro' } },
      select: { content: true, entity: { select: { slug: true } } },
    }),
    loadVisitorIntro(4000).catch(() => null),
    loadOwnerBio(4000),
  ]);

  const summaryBySlug = new Map<string, string>();
  for (const c of t1Chunks) {
    if (c.entity?.slug) summaryBySlug.set(c.entity.slug, c.content);
  }
  const technologies = [...new Set(projects.flatMap((p) => p.tags.map((t) => t.name)))];

  const lines: string[] = [`OWNER: ${ownerBio}`, PORTFOLIO_FRAMING, ''];
  if (intro) lines.push('VISITOR INTRO (owner-authored):', intro, '');
  lines.push('PROJECT INDEX:');
  for (const p of projects) {
    const summary = summaryBySlug.get(p.slug)?.replace(/\s+/g, ' ');
    lines.push(summary ? `- ${p.title} (${p.slug}): ${summary}` : `- ${p.title} (${p.slug})`);
    if (p.tags.length > 0) lines.push(`  technologies: ${p.tags.map((t) => t.name).join(', ')}`);
  }
  if (technologies.length > 0) {
    lines.push('', `Technologies across the portfolio: ${technologies.join(', ')}.`);
  }
  return lines.join('\n');
}

export function __clearStartFrameCache(): void {
  cache = null;
}
