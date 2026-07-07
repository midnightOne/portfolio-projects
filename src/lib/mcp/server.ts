/**
 * Public MCP server (D30, mcp-server spec): read-only portfolio tools behind the
 * same BackendToolService/ContentSearchService chain the voice assistant uses
 * (Req 2.4 — exposed twice, implemented once). Stateless per request (D43).
 *
 * Security posture (Req 3): zod-validated inputs with length caps; PUBLIC-only
 * visibility enforced in SQL by the services (publicOnly); protocol errors carry
 * no internals; every call is metered to the ledger with feature tag 'mcp' by the
 * route's gateway context. NO write tools in v1 (Req 2.5).
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '@/lib/prisma';
import { BackendToolService } from '@/lib/ai/tools/BackendToolService';
import type { GatewayContext } from '@/lib/ai/gateway';

export const MCP_SERVER_INFO = {
  name: 'portfolio-mcp',
  version: '1.0.0',
} as const;

/** v1 tool names — snapshot-tested; adding a tool is a deliberate spec change. */
export const MCP_TOOL_NAMES = ['search_portfolio', 'get_project', 'list_projects'] as const;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

const searchInput = {
  query: z.string().min(1).max(500).describe('Natural-language search query'),
  limit: z.number().int().min(1).max(10).optional().describe('Max results (default 5)'),
};

const getProjectInput = {
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric with dashes')
    .describe('Project slug, e.g. from list_projects or search results'),
};

const listProjectsInput = {
  tag: z.string().min(1).max(100).optional().describe('Filter by tag name'),
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

/**
 * Build a per-request MCP server (stateless, D43). Tool calls meter through the
 * gateway context so ledger rows carry the request's hashed IP + requestId.
 */
export function buildMcpServer(ctx: GatewayContext): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    instructions:
      'Read-only access to a software engineering portfolio. Search grounded content ' +
      'with search_portfolio, browse with list_projects, then fetch details with get_project. ' +
      'All content is the portfolio owner\'s published, public material.',
  });

  const backend = BackendToolService.getInstance();
  const sessionId = `mcp_${ctx.requestId}`;

  const meter = (tool: string, ok: boolean) =>
    ctx
      .meter({ usageType: 'mcp_tool_call', metadata: { tool, ok } })
      .catch((error) => console.error('[mcp] meter failed:', error));

  server.registerTool(
    'search_portfolio',
    {
      title: 'Search portfolio content',
      description:
        'Hybrid semantic + keyword search over the public portfolio (projects, write-ups, skills). ' +
        'Returns ranked excerpts with project provenance.',
      inputSchema: searchInput,
    },
    async ({ query, limit }) => {
      try {
        // Same chain as the voice assistant's content_search (Req 2.4);
        // accessLevel 'basic' enforces publicOnly in SQL.
        const result = await backend.executeTool(
          'content_search',
          { query, k: limit ?? 5 },
          sessionId,
          'basic'
        );
        if (!result.success) {
          await meter('search_portfolio', false);
          return safeError('search_portfolio');
        }
        const data = result.data as { items?: Array<Record<string, unknown>>; totalResults?: number };
        await meter('search_portfolio', true);
        return textResult({
          results: (data.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.oneLiner,
            relevance: item.why,
            project: item.project,
            score: item.score,
            facets: item.facets,
          })),
          totalResults: data.totalResults ?? 0,
        });
      } catch (error) {
        console.error('[mcp] search_portfolio failed:', error);
        await meter('search_portfolio', false);
        return safeError('search_portfolio');
      }
    }
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get a project',
      description:
        'Fetch one public project by slug: metadata, tags, links, and its generated summaries/sections as text.',
      inputSchema: getProjectInput,
    },
    async ({ slug }) => {
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
          await meter('get_project', false);
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
              select: { tier: true, title: true, content: true },
              orderBy: [{ tier: 'asc' }, { chunkId: 'asc' }],
              take: 20,
            },
          },
        });

        await meter('get_project', true);
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
          sections: (entity?.contentChunks ?? [])
            .filter((c) => c.tier === 2)
            .map((c) => ({ title: c.title, content: c.content })),
        });
      } catch (error) {
        console.error('[mcp] get_project failed:', error);
        await meter('get_project', false);
        return safeError('get_project');
      }
    }
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List public projects with title, summary line, tags, and slug for use with get_project.',
      inputSchema: listProjectsInput,
    },
    async ({ tag, sort }) => {
      try {
        const projects = await prisma.project.findMany({
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
        });
        await meter('list_projects', true);
        return textResult({
          projects: projects.map((p) => ({
            slug: p.slug,
            title: p.title,
            description: p.description,
            workDate: p.workDate,
            tags: p.tags.map((t) => t.name),
          })),
          count: projects.length,
        });
      } catch (error) {
        console.error('[mcp] list_projects failed:', error);
        await meter('list_projects', false);
        return safeError('list_projects');
      }
    }
  );

  return server;
}
