/**
 * Content Sources Management API (ai-assistant 7.15).
 *
 * The content-source config is the INGESTION MANIFEST for the one semantic
 * corpus plus a query-time allowlist (src/lib/content/source-registry.ts):
 *  - GET  lists every real source with its index state (chunks/embedded)
 *  - POST creates/updates a document source (resume/CV, article, arbitrary
 *    text/markdown — classic RAG). Ingestion itself runs through the SAME
 *    stage pipeline via POST /api/admin/semantic/processing/start with
 *    scope:'entity' + sourceId.
 *
 * The Gen-1 provider fan-out (ContentSourceManager provider classes) is
 * retired — its rows ('about'/'resume'/'experience'/'skills') are ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import {
  listDocumentSources,
  upsertDocumentSource,
  entitySourceId,
  docSourceId,
  PROJECTS_SOURCE_ID,
  DOCUMENT_ENTITY_TYPES,
  DocumentEntityType,
} from '@/lib/content/source-registry';

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }
  return null;
}

/**
 * GET /api/admin/ai/content-sources — all sources with index state.
 */
export async function GET(_request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const [configRows, docs, entityStats] = await Promise.all([
      prisma.aIContentSourceConfig.findMany(),
      listDocumentSources(),
      prisma.$queryRaw<Array<{ entityType: string; slug: string; title: string | null; chunks: bigint; embedded: bigint }>>`
        SELECT e."entityType", e.slug, e.title,
               count(c.id) AS chunks, count(c.embedding_vector) AS embedded
        FROM content_entities e
        LEFT JOIN context_chunks c ON c.entity_id = e.id
        GROUP BY e."entityType", e.slug, e.title`,
    ]);
    const enabledById = new Map(configRows.map(r => [r.sourceId, r.enabled]));
    const statFor = (entityType: string, slug: string) =>
      entityStats.find(s => s.entityType === entityType && s.slug === slug);

    const sources: any[] = [];

    // Built-in: all projects (ingested via scope 'all'/'project')
    const projectStats = entityStats.filter(s => s.entityType === 'PROJECT');
    sources.push({
      sourceId: PROJECTS_SOURCE_ID,
      kind: 'projects',
      title: 'Projects',
      entityType: 'PROJECT',
      enabled: enabledById.get(PROJECTS_SOURCE_ID) ?? true,
      entities: projectStats.length,
      chunks: projectStats.reduce((n, s) => n + Number(s.chunks), 0),
      embedded: projectStats.reduce((n, s) => n + Number(s.embedded), 0),
      uiLocation: '/',
    });

    // Config-owned documents
    const docSlugs = new Set<string>();
    for (const doc of docs) {
      docSlugs.add(`${doc.entityType}:${doc.slug}`);
      const stat = statFor(doc.entityType, doc.slug);
      sources.push({
        sourceId: doc.sourceId,
        kind: 'document',
        title: doc.title,
        entityType: doc.entityType,
        slug: doc.slug,
        description: doc.description,
        tags: doc.tags,
        technologies: doc.technologies,
        uiLocation: doc.uiLocation,
        contentLength: doc.content.length,
        enabled: doc.enabled,
        ingested: !!stat && Number(stat.chunks) > 0,
        chunks: stat ? Number(stat.chunks) : 0,
        embedded: stat ? Number(stat.embedded) : 0,
        updatedAt: doc.updatedAt,
      });
    }

    // Index-resident non-project entities NOT owned by the config (e.g. the
    // script-ingested about-ai article): toggle-only. Start-frame injection
    // entities (unembedded, exact-lookup) are hidden — they are not retrieval
    // sources and disabling them here would do nothing.
    for (const stat of entityStats) {
      if (stat.entityType === 'PROJECT') continue;
      if (docSlugs.has(`${stat.entityType}:${stat.slug}`)) continue;
      if (Number(stat.embedded) === 0) continue;
      const sourceId = entitySourceId(stat.entityType, stat.slug);
      sources.push({
        sourceId,
        kind: 'entity',
        title: stat.title || stat.slug,
        entityType: stat.entityType,
        slug: stat.slug,
        enabled: enabledById.get(sourceId) ?? true,
        ingested: true,
        chunks: Number(stat.chunks),
        embedded: Number(stat.embedded),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sources,
        documentEntityTypes: DOCUMENT_ENTITY_TYPES,
        totalCount: sources.length,
        enabledCount: sources.filter(s => s.enabled).length,
      },
    });
  } catch (error) {
    console.error('Error getting content sources:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get content sources', details: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ai/content-sources — create or update a document source.
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const doc = await upsertDocumentSource({
      slug: String(body.slug ?? ''),
      entityType: body.entityType as DocumentEntityType,
      title: String(body.title ?? ''),
      description: body.description ? String(body.description) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      technologies: Array.isArray(body.technologies) ? body.technologies.map(String) : [],
      uiLocation: body.uiLocation ? String(body.uiLocation) : null,
      content: String(body.content ?? ''),
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    });
    return NextResponse.json({
      success: true,
      data: {
        sourceId: doc.sourceId,
        message: `Document source saved. Ingest it via processing/start scope:'entity' sourceId:'${docSourceId(doc.slug)}'.`,
      },
    });
  } catch (error) {
    console.error('Error saving document source:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to save document source' } },
      { status: 400 }
    );
  }
}
