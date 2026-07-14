/**
 * Public MCP server (D30, mcp-server spec): read-only portfolio tools behind the
 * same BackendToolService/ContentSearchService chain the voice assistant uses
 * (Req 2.4 — exposed twice, implemented once). Stateless per request (D43).
 *
 * Security posture (Req 3): zod-validated inputs with length caps; PUBLIC-only
 * visibility enforced in SQL by the services (publicOnly); protocol errors carry
 * no internals; every call is metered to the ledger with feature tag 'mcp' by the
 * route's gateway context. NO write tools in v1 (Req 2.5).
 *
 * Latency posture (owner, 2026-07-09): ledger writes are scheduled off the
 * response path via the route-supplied `defer` (Next `after()`), and tool
 * results carry precise locations (section anchors + excerpts) so weak clients
 * — the realtime voice model included — resolve an answer in one or two calls
 * instead of dumping whole projects.
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '@/lib/prisma';
import { BackendToolService } from '@/lib/ai/tools/BackendToolService';
import type { GatewayContext } from '@/lib/ai/gateway';

export const MCP_SERVER_INFO = {
  name: 'portfolio-mcp',
  version: '1.1.0',
} as const;

/** Tool names — snapshot-tested; adding a tool is a deliberate spec change.
 *  portfolio_overview added 2026-07-13 (task 6, shared with ai-assistant 7.13). */
export const MCP_TOOL_NAMES = ['search_portfolio', 'get_project', 'list_projects', 'portfolio_overview'] as const;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

const searchInput = {
  query: z.string().min(1).max(500).describe('Natural-language search query'),
  limit: z.number().int().min(1).max(10).optional().describe('Max results (default 5)'),
  project: z
    .string()
    .min(1)
    .max(200)
    .regex(SLUG_PATTERN, 'project must be a lowercase slug')
    .optional()
    .describe('Restrict the search to one project (slug from list_projects)'),
};

const getProjectInput = {
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric with dashes')
    .describe('Project slug, e.g. from list_projects or search results'),
  section: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Fetch ONLY this section's full text (anchor id from search results' location.section or the overview section list)"),
  detail: z
    .enum(['overview', 'full'])
    .optional()
    .describe("'overview' (default): metadata + summary + section index without bodies. 'full': every section's text."),
};

const portfolioOverviewInput = {
  depth: z
    .enum(['brief', 'full'])
    .optional()
    .describe("'brief' (default): compact owner + portfolio grounding. 'full': complete bio, site intro, project index."),
};

const listProjectsInput = {
  tag: z.string().min(1).max(100).optional().describe('Filter by tag name'),
  technology: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Filter to projects that use this technology (matches technologies and tags, case-insensitive), e.g. 'react'"),
  sort: z.enum(['recent', 'title']).optional().describe("Sort order (default 'recent')"),
};

/**
 * Map any tool failure to a safe, generic protocol error (design §3: no stack
 * traces, no SQL, no internal paths in responses).
 */
function safeError(toolName: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return {
    content: [{ type: 'text', text: `The ${toolName} tool could not complete the request.` }],
    isError: true,
  };
}

function textResult(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/** Options the route supplies; tests use the defaults. */
export interface McpServerOptions {
  /**
   * Schedule a task off the response's critical path (route passes Next's
   * `after()`). Default runs the task immediately, fire-and-forget — correct
   * for tests and long-lived dev servers.
   */
  defer?: (task: () => Promise<unknown>) => void;
}

/**
 * Build a per-request MCP server (stateless, D43). Tool calls meter through the
 * gateway context so ledger rows carry the request's hashed IP + requestId —
 * scheduled via `defer` so the ledger transaction never blocks the response.
 */
export function buildMcpServer(ctx: GatewayContext, options?: McpServerOptions): McpServer {
  const defer = options?.defer ?? ((task) => void task());

  const server = new McpServer(MCP_SERVER_INFO, {
    instructions:
      "Read-only access to a software engineering portfolio. Recipes:\n" +
      "- First contact / 'who is the owner?': portfolio_overview (depth 'brief' to orient, 'full' for the complete bio + project index).\n" +
      "- Browse or 'which projects use <tech>?': list_projects (optionally with technology/tag filters).\n" +
      "- 'Where is <topic> discussed?': search_portfolio — each result carries location {project, section} plus an excerpt.\n" +
      "- Read one section in full: get_project with slug + section (anchor from a search result or the overview section index).\n" +
      "- Whole write-up: get_project with detail:'full'.\n" +
      "- Cross-project synthesis ('lessons learned with React'): search_portfolio with the topic (optionally per project via the project filter), then quote excerpts with their locations.\n" +
      "All content is the portfolio owner's published, public material.",
  });

  const backend = BackendToolService.getInstance();
  const sessionId = `mcp_${ctx.requestId}`;

  const meter = (tool: string, ok: boolean) =>
    defer(() =>
      ctx
        .meter({ usageType: 'mcp_tool_call', metadata: { tool, ok } })
        .catch((error) => console.error('[mcp] meter failed:', error))
    );

  server.registerTool(
    'search_portfolio',
    {
      title: 'Search portfolio content',
      description:
        'Hybrid semantic + keyword search over the public portfolio (projects, write-ups, skills). ' +
        'Each result carries an excerpt and a precise location {project, section anchor} — ' +
        'follow up with get_project {slug, section} to read a matched section in full. ' +
        'Use the project filter to scope the search to one project.',
      inputSchema: searchInput,
    },
    async ({ query, limit, project }) => {
      try {
        // Same chain as the voice assistant's content_search (Req 2.4);
        // accessLevel 'basic' enforces publicOnly in SQL.
        const result = await backend.executeTool(
          'content_search',
          { query, k: limit ?? 5, ...(project ? { scope: { projectId: project } } : {}) },
          sessionId,
          'basic'
        );
        if (!result.success) {
          meter('search_portfolio', false);
          return safeError('search_portfolio');
        }
        const data = result.data as { items?: Array<Record<string, any>>; totalResults?: number };
        meter('search_portfolio', true);
        return textResult({
          results: (data.items ?? []).map((item) => {
            const navTarget = item.navTarget as { type?: string; id?: string; sectionId?: string } | undefined;
            const section =
              navTarget?.type === 'section' ? navTarget.id : navTarget?.sectionId ?? undefined;
            return {
              title: item.title,
              excerpt: item.snippet ?? item.oneLiner,
              relevance: item.why,
              score: item.score,
              location: {
                project: item.project ?? null,
                // Section anchor within the project's write-up; null = the
                // match is the project's top-level summary/metadata.
                section: section ?? null,
                tier: item.facets?.tier,
              },
              technologies: item.facets?.tech,
            };
          }),
          totalResults: data.totalResults ?? 0,
          hint: 'Read a matched section in full with get_project {slug: location.project, section: location.section}.',
        });
      } catch (error) {
        console.error('[mcp] search_portfolio failed:', error);
        meter('search_portfolio', false);
        return safeError('search_portfolio');
      }
    }
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get a project',
      description:
        "Fetch one public project by slug. Default ('overview') returns metadata, summary, and a section index " +
        "(anchor + title per section) — cheap and small. Pass section:<anchor> to read exactly one section's full text, " +
        "or detail:'full' for the entire write-up.",
      inputSchema: getProjectInput,
    },
    async ({ slug, section, detail }) => {
      try {
        // Visibility enforced in the SQL predicate — PRIVATE/UNLISTED slugs 404 identically
        const project = await prisma.project.findUnique({
          where: { slug, visibility: 'PUBLIC' },
          select: {
            slug: true,
            title: true,
            description: true,
            briefOverview: true,
            workDate: true,
            tags: { select: { name: true } },
            externalLinks: { select: { label: true, url: true }, orderBy: { order: 'asc' }, take: 10 },
          },
        });
        if (!project) {
          meter('get_project', false);
          return {
            content: [{ type: 'text' as const, text: `No public project found for slug '${slug}'.` }],
            isError: true as const,
          };
        }

        // Text content from the semantic index (T1 summary + T2 sections) — the
        // same generated content the assistant grounds on.
        const entity = await prisma.contentEntity.findUnique({
          where: { entityType_slug: { entityType: 'PROJECT', slug } },
          select: {
            technologies: true,
            contentChunks: {
              where: { tier: { in: [1, 2] } },
              select: { tier: true, chunkId: true, title: true, content: true },
              orderBy: [{ tier: 'asc' }, { chunkId: 'asc' }],
              take: 20,
            },
          },
        });

        const sections = (entity?.contentChunks ?? []).filter((c) => c.tier === 2);

        // section=<anchor>: exactly one section's full text (the fast path a
        // search result points at via location.section).
        if (section) {
          const match = sections.find((c) => c.chunkId === section);
          meter('get_project', !!match);
          if (!match) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    error: `No section '${section}' in '${slug}'.`,
                    availableSections: sections.map((c) => ({ section: c.chunkId, title: c.title })),
                  }),
                },
              ],
              isError: true as const,
            };
          }
          return textResult({
            slug: project.slug,
            title: project.title,
            section: { anchor: match.chunkId, title: match.title, content: match.content },
          });
        }

        const full = detail === 'full';
        meter('get_project', true);
        return textResult({
          slug: project.slug,
          title: project.title,
          description: project.description,
          overview: project.briefOverview,
          workDate: project.workDate,
          tags: project.tags.map((t) => t.name),
          technologies: entity?.technologies ?? [],
          links: project.externalLinks,
          summary: entity?.contentChunks.find((c) => c.tier === 1)?.content ?? null,
          sections: sections.map((c) =>
            full
              ? { section: c.chunkId, title: c.title, content: c.content }
              : { section: c.chunkId, title: c.title }
          ),
          ...(full
            ? {}
            : { hint: "Section bodies omitted — fetch one with {section: <anchor>} or all with {detail: 'full'}." }),
        });
      } catch (error) {
        console.error('[mcp] get_project failed:', error);
        meter('get_project', false);
        return safeError('get_project');
      }
    }
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'List public projects with title, summary line, tags, technologies, and slug for use with get_project. ' +
        "Answer 'which projects use <tech>?' with the technology filter.",
      inputSchema: listProjectsInput,
    },
    async ({ tag, technology, sort }) => {
      try {
        const [projects, entities] = await Promise.all([
          prisma.project.findMany({
            where: {
              visibility: 'PUBLIC',
              ...(tag ? { tags: { some: { name: { equals: tag, mode: 'insensitive' } } } } : {}),
            },
            select: {
              slug: true,
              title: true,
              description: true,
              workDate: true,
              tags: { select: { name: true } },
            },
            orderBy: sort === 'title' ? { title: 'asc' } : { workDate: { sort: 'desc', nulls: 'last' } },
            take: 50,
          }),
          prisma.contentEntity.findMany({
            where: { entityType: 'PROJECT' },
            select: { slug: true, technologies: true },
          }),
        ]);

        const techBySlug = new Map(entities.map((e) => [e.slug, (e.technologies as string[]) ?? []]));
        const techNeedle = technology?.toLowerCase();
        const filtered = techNeedle
          ? projects.filter((p) => {
              const haystack = [...(techBySlug.get(p.slug) ?? []), ...p.tags.map((t) => t.name)];
              return haystack.some((t) => t.toLowerCase().includes(techNeedle));
            })
          : projects;

        meter('list_projects', true);
        return textResult({
          projects: filtered.map((p) => ({
            slug: p.slug,
            title: p.title,
            description: p.description,
            workDate: p.workDate,
            tags: p.tags.map((t) => t.name),
            technologies: techBySlug.get(p.slug) ?? [],
          })),
          count: filtered.length,
        });
      } catch (error) {
        console.error('[mcp] list_projects failed:', error);
        meter('list_projects', false);
        return safeError('list_projects');
      }
    }
  );

  // Task 6 (2026-07-13): external models never receive our mint instructions —
  // for them this tool IS the start frame. Same assembly module as the mint
  // and the in-session tool (ai-assistant 7.13) — one owner per concept.
  server.registerTool(
    'portfolio_overview',
    {
      title: 'Portfolio overview',
      description:
        'Overview of the portfolio owner and the portfolio as a whole — who Kirill is, what this site is, and the project index. ' +
        "Start here to orient yourself. depth 'brief' (default) = compact grounding; 'full' = complete bio, site intro, and per-project detail.",
      inputSchema: portfolioOverviewInput,
    },
    async ({ depth }) => {
      try {
        const { assemblePortfolioOverview } = await import('@/lib/ai/start-frame');
        const resolvedDepth = depth === 'full' ? 'full' : 'brief';
        const overview = await assemblePortfolioOverview(resolvedDepth);
        meter('portfolio_overview', true);
        return textResult({ depth: resolvedDepth, overview });
      } catch (error) {
        console.error('[mcp] portfolio_overview failed:', error);
        meter('portfolio_overview', false);
        return safeError('portfolio_overview');
      }
    }
  );

  return server;
}
