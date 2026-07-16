/**
 * Content-source registry (ai-assistant 7.15, owner ruling 2026-07-15).
 *
 * The ONE runtime owner of `AIContentSourceConfig`: the admin config is the
 * INGESTION MANIFEST for the single semantic corpus (option B) — a declarative
 * list saying "these sources exist in the index" — plus a lightweight
 * query-time allowlist so unticking a source hides it from retrieval WITHOUT
 * re-ingesting (the one piece of option A worth keeping). There is no second
 * retrieval path and no provider fan-out: everything lands in the same
 * ContentEntity/ContextChunk index projects live in, and ContentSearchService
 * stays the only query engine.
 *
 * Source kinds (by sourceId shape):
 *   - `projects`             — the built-in all-projects source (ingested via
 *                              the existing scope 'all'/'project' pipeline).
 *   - `doc:<slug>`           — a config-owned document (resume/CV, article,
 *                              arbitrary text/markdown — classic RAG). The
 *                              config JSON carries the source of truth text;
 *                              ingestion runs the SAME stage pipeline via
 *                              scope:'entity'. `uiLocation` distinguishes
 *                              sources with an on-site page (navigable) from
 *                              conversational-only documents (no navTarget).
 *   - `entity:<type>:<slug>` — an index-resident entity NOT owned by the
 *                              config (e.g. the script-ingested about-ai
 *                              article). Toggle-only: retrieval can exclude
 *                              it, but its content lives elsewhere.
 *
 * Legacy provider rows from the retired ContentSourceManager fan-out
 * ('about'/'resume'/'experience'/'skills') are ignored entirely.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const PROJECTS_SOURCE_ID = 'projects';
const DOC_PREFIX = 'doc:';
const ENTITY_PREFIX = 'entity:';

/** Non-project entity types a document source may declare (tiers stay T0–T3). */
export const DOCUMENT_ENTITY_TYPES = ['BIO', 'RESUME', 'EXPERIENCE', 'SKILLS', 'CUSTOM'] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export interface DocumentSourceSpec {
  configId: string;
  entityId: string | null;
  sourceId: string; // doc:<slug>
  entityType: DocumentEntityType;
  slug: string;
  title: string;
  description?: string;
  tags: string[];
  technologies: string[];
  /** Route path when the source has an on-site page (navigable); null = conversational-only. */
  uiLocation: string | null;
  /** Markdown/plain text — the ingestion source of truth. */
  content: string;
  enabled: boolean;
  updatedAt: Date;
}

export function docSourceId(slug: string): string {
  return `${DOC_PREFIX}${slug}`;
}

export function entitySourceId(entityType: string, slug: string): string {
  return `${ENTITY_PREFIX}${entityType}:${slug}`;
}

/** Stable identity for maps that must not conflate equal slugs across types. */
export function contentEntityKey(entityType: string, slug: string): string {
  return `${entityType}:${slug}`;
}

export function isDocSourceId(sourceId: string): boolean {
  return sourceId.startsWith(DOC_PREFIX);
}

export function isEntitySourceId(sourceId: string): boolean {
  return sourceId.startsWith(ENTITY_PREFIX);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

function parseDocRow(row: {
  id: string;
  sourceId: string;
  enabled: boolean;
  updatedAt: Date;
  config: unknown;
  contentEntity?: { id: string } | null;
}): DocumentSourceSpec | null {
  const cfg = (row.config ?? {}) as Record<string, unknown>;
  const slug = typeof cfg.slug === 'string' ? cfg.slug : row.sourceId.slice(DOC_PREFIX.length);
  const entityType = cfg.entityType as DocumentEntityType;
  if (!DOCUMENT_ENTITY_TYPES.includes(entityType) || !SLUG_RE.test(slug)) return null;
  return {
    configId: row.id,
    entityId: row.contentEntity?.id ?? null,
    sourceId: row.sourceId,
    entityType,
    slug,
    title: typeof cfg.title === 'string' && cfg.title ? cfg.title : slug,
    description: typeof cfg.description === 'string' ? cfg.description : undefined,
    tags: Array.isArray(cfg.tags) ? (cfg.tags as string[]) : [],
    technologies: Array.isArray(cfg.technologies) ? (cfg.technologies as string[]) : [],
    uiLocation: typeof cfg.uiLocation === 'string' && cfg.uiLocation ? cfg.uiLocation : null,
    content: typeof cfg.content === 'string' ? cfg.content : '',
    enabled: row.enabled,
    updatedAt: row.updatedAt,
  };
}

/** All config-owned document sources (invalid/legacy rows silently skipped). */
export async function listDocumentSources(): Promise<DocumentSourceSpec[]> {
  const rows = await prisma.aIContentSourceConfig.findMany({
    where: { sourceId: { startsWith: DOC_PREFIX } },
    include: { contentEntity: { select: { id: true } } },
  });
  return rows
    .map(parseDocRow)
    .filter((d): d is DocumentSourceSpec => d !== null)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getDocumentSource(slug: string): Promise<DocumentSourceSpec | null> {
  const row = await prisma.aIContentSourceConfig.findUnique({
    where: { sourceId: docSourceId(slug) },
    include: { contentEntity: { select: { id: true } } },
  });
  return row ? parseDocRow(row) : null;
}

export interface UpsertDocumentSourceInput {
  /** Existing source identity. Omit only when creating a new source. */
  sourceId?: string;
  slug: string;
  entityType: DocumentEntityType;
  title: string;
  description?: string;
  tags?: string[];
  technologies?: string[];
  uiLocation?: string | null;
  content: string;
  enabled?: boolean;
}

interface OwnedEntityInput {
  entityType: DocumentEntityType;
  slug: string;
  title: string;
  description?: string;
  tags: string[];
  technologies: string[];
}

function entityData(input: OwnedEntityInput) {
  return {
    entityType: input.entityType,
    slug: input.slug,
    title: input.title,
    description: input.description || '',
    tags: input.tags,
    technologies: input.technologies,
  };
}

async function ensureOwnedEntity(
  tx: Prisma.TransactionClient,
  configId: string,
  input: OwnedEntityInput,
): Promise<{ id: string }> {
  const owned = await tx.contentEntity.findUnique({ where: { sourceConfigId: configId } });
  if (owned) {
    const collision = await tx.contentEntity.findUnique({
      where: { entityType_slug: { entityType: input.entityType, slug: input.slug } },
      select: { id: true },
    });
    if (collision && collision.id !== owned.id) {
      throw new Error(`Content entity ${input.entityType}/${input.slug} already exists and is not owned by this source`);
    }
    return tx.contentEntity.update({
      where: { id: owned.id },
      data: entityData(input),
      select: { id: true },
    });
  }

  const collision = await tx.contentEntity.findUnique({
    where: { entityType_slug: { entityType: input.entityType, slug: input.slug } },
    select: { id: true, sourceConfigId: true },
  });
  if (collision) {
    throw new Error(`Content entity ${input.entityType}/${input.slug} already exists and is not owned by this source`);
  }

  return tx.contentEntity.create({
    data: { ...entityData(input), sourceConfigId: configId },
    select: { id: true },
  });
}

/** Resolve or create the entity owned by a document config without adopting collisions. */
export async function ensureDocumentSourceEntity(doc: DocumentSourceSpec): Promise<{ id: string }> {
  return prisma.$transaction(async tx => {
    const config = await tx.aIContentSourceConfig.findUnique({
      where: { id: doc.configId },
      select: { id: true },
    });
    if (!config) throw new Error(`Document source config no longer exists: ${doc.sourceId}`);
    return ensureOwnedEntity(tx, config.id, doc);
  });
}

export async function upsertDocumentSource(input: UpsertDocumentSourceInput): Promise<DocumentSourceSpec> {
  if (!SLUG_RE.test(input.slug)) {
    throw new Error(`Invalid slug "${input.slug}" — lowercase letters, digits, hyphens (2-64 chars)`);
  }
  if (!DOCUMENT_ENTITY_TYPES.includes(input.entityType)) {
    throw new Error(`Invalid entityType "${input.entityType}" — one of ${DOCUMENT_ENTITY_TYPES.join(', ')}`);
  }
  if (input.entityType === 'CUSTOM' && ['visitor-intro', 'owner-bio'].includes(input.slug)) {
    // These CUSTOM slugs are start-frame injection chunks read by exact
    // (entity,tier,chunkId) lookup — never semantic retrieval. Re-ingesting
    // them through the document pipeline would purge the owner-edited chunks.
    throw new Error(`Slug "${input.slug}" is reserved for start-frame content`);
  }
  if (!input.title?.trim()) throw new Error('title is required');

  const targetSourceId = docSourceId(input.slug);
  const row = await prisma.$transaction(async tx => {
    const existing = input.sourceId
      ? await tx.aIContentSourceConfig.findUnique({
          where: { sourceId: input.sourceId },
          include: { contentEntity: { select: { id: true } } },
        })
      : null;
    if (input.sourceId && !existing) throw new Error(`Document source not found: ${input.sourceId}`);
    if (existing && existing.providerId !== 'document') {
      throw new Error(`Source ${input.sourceId} is not a managed document source`);
    }
    if (!existing) {
      const duplicate = await tx.aIContentSourceConfig.findUnique({ where: { sourceId: targetSourceId } });
      if (duplicate) throw new Error(`Document source ${targetSourceId} already exists; edit it by sourceId`);
    } else if (existing.sourceId !== targetSourceId) {
      const duplicate = await tx.aIContentSourceConfig.findUnique({ where: { sourceId: targetSourceId } });
      if (duplicate && duplicate.id !== existing.id) throw new Error(`Document source ${targetSourceId} already exists`);
    }

    const previous = existing ? parseDocRow(existing) : null;
    const content = input.content?.trim() ? input.content : previous?.content ?? '';
    if (!content.trim()) throw new Error('content is required');
    const config = {
      entityType: input.entityType,
      slug: input.slug,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      tags: input.tags ?? [],
      technologies: input.technologies ?? [],
      uiLocation: input.uiLocation || null,
      content,
    };
    const saved = existing
      ? await tx.aIContentSourceConfig.update({
          where: { id: existing.id },
          data: {
            sourceId: targetSourceId,
            config,
            ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          },
        })
      : await tx.aIContentSourceConfig.create({
          data: {
            sourceId: targetSourceId,
            providerId: 'document',
            enabled: input.enabled ?? true,
            priority: 50,
            config,
          },
        });
    await ensureOwnedEntity(tx, saved.id, {
      entityType: input.entityType,
      slug: input.slug,
      title: config.title,
      description: config.description,
      tags: config.tags,
      technologies: config.technologies,
    });
    return tx.aIContentSourceConfig.findUniqueOrThrow({
      where: { id: saved.id },
      include: { contentEntity: { select: { id: true } } },
    });
  });
  invalidateSourceRegistryCache();
  return parseDocRow(row)!;
}

/** Delete a document source and (by default) its ingested entity + chunks. */
export async function deleteDocumentSource(
  slug: string,
  opts: { deleteEntity?: boolean } = {}
): Promise<{ deletedEntity: boolean }> {
  const deletedEntity = await prisma.$transaction(async tx => {
    const config = await tx.aIContentSourceConfig.findUnique({
      where: { sourceId: docSourceId(slug) },
      include: { contentEntity: { select: { id: true } } },
    });
    if (!config) return false;
    const ownsEntity = !!config.contentEntity;
    if (ownsEntity && opts.deleteEntity === false) {
      await tx.contentEntity.update({
        where: { id: config.contentEntity!.id },
        data: { sourceConfigId: null },
      });
    }
    await tx.aIContentSourceConfig.delete({ where: { id: config.id } });
    return ownsEntity && (opts.deleteEntity ?? true);
  });
  invalidateSourceRegistryCache();
  return { deletedEntity };
}

/** Enable/disable any source row (creates the row for `entity:`-kind ids). */
export async function setSourceEnabled(sourceId: string, enabled: boolean): Promise<void> {
  await prisma.aIContentSourceConfig.upsert({
    where: { sourceId },
    create: {
      sourceId,
      providerId: isDocSourceId(sourceId) ? 'document' : isEntitySourceId(sourceId) ? 'entity' : sourceId,
      enabled,
      priority: 50,
      config: {},
    },
    update: { enabled },
  });
  invalidateSourceRegistryCache();
}

// ---------------------------------------------------------------------------
// Query-time allowlist (the option-A graft): retrieval consults which sources
// are DISABLED and filters them out of the one corpus — no re-ingestion needed
// to hide a source, no second query path.
// ---------------------------------------------------------------------------

export interface SourceExclusions {
  /** Entity types fully excluded (only 'PROJECT', via the `projects` row). */
  entityTypes: Set<string>;
  /** Individual entities excluded, keyed `${entityType}:${slug}`. */
  entities: Set<string>;
  hasAny: boolean;
}

const EXCLUSIONS_TTL_MS = 30_000;
let exclusionsCache: { at: number; value: SourceExclusions } | null = null;
let uiLocationCache: { at: number; value: Map<string, string> } | null = null;

export function invalidateSourceRegistryCache(): void {
  exclusionsCache = null;
  uiLocationCache = null;
}

export async function getSourceExclusions(): Promise<SourceExclusions> {
  const now = Date.now();
  if (exclusionsCache && now - exclusionsCache.at < EXCLUSIONS_TTL_MS) return exclusionsCache.value;

  const entityTypes = new Set<string>();
  const entities = new Set<string>();
  try {
    const rows = await prisma.aIContentSourceConfig.findMany({
      where: { enabled: false },
      select: { id: true, sourceId: true, config: true },
    });
    for (const row of rows) {
      if (row.sourceId === PROJECTS_SOURCE_ID) {
        entityTypes.add('PROJECT');
      } else if (isDocSourceId(row.sourceId)) {
        const doc = parseDocRow({ ...row, enabled: false, updatedAt: new Date() });
        if (doc) entities.add(`${doc.entityType}:${doc.slug}`);
      } else if (isEntitySourceId(row.sourceId)) {
        const [, entityType, ...slugParts] = row.sourceId.split(':');
        if (entityType && slugParts.length > 0) entities.add(`${entityType}:${slugParts.join(':')}`);
      }
      // legacy provider rows: ignored
    }
  } catch (error) {
    console.error('[SourceRegistry] exclusion read failed (retrieval fails closed):', error);
    throw new Error('Source visibility is unavailable; retrieval refused to fail open', { cause: error });
  }

  const value: SourceExclusions = {
    entityTypes,
    entities,
    hasAny: entityTypes.size > 0 || entities.size > 0,
  };
  exclusionsCache = { at: now, value };
  return value;
}

export function isEntityExcluded(
  exclusions: SourceExclusions,
  entityType: string | null | undefined,
  slug: string | null | undefined
): boolean {
  if (!exclusions.hasAny || !entityType) return false;
  if (exclusions.entityTypes.has(entityType)) return true;
  return exclusions.entities.has(`${entityType}:${slug ?? ''}`);
}

/**
 * uiLocation by typed entity identity for non-project sources — lets search results
 * carry an honest route navTarget for sources that have an on-site page,
 * and none at all for conversational-only documents. Reads the doc-source
 * config AND the T0 metadata `page` field (script-ingested entities like
 * CUSTOM/about-ai record their page there).
 */
export async function getUiLocationByEntityKey(): Promise<Map<string, string>> {
  const now = Date.now();
  if (uiLocationCache && now - uiLocationCache.at < EXCLUSIONS_TTL_MS) return uiLocationCache.value;
  const map = new Map<string, string>();
  try {
    const t0s = await prisma.contextChunk.findMany({
      where: { tier: 0, entity: { entityType: { not: 'PROJECT' } } },
      select: { content: true, entity: { select: { entityType: true, slug: true } } },
    });
    for (const t0 of t0s) {
      try {
        const meta = JSON.parse(t0.content) as { page?: string };
        if (meta.page && t0.entity?.slug) {
          map.set(contentEntityKey(t0.entity.entityType, t0.entity.slug), meta.page);
        }
      } catch {
        // non-JSON T0 — no page
      }
    }
    const docs = await listDocumentSources();
    for (const d of docs) {
      if (d.uiLocation) map.set(contentEntityKey(d.entityType, d.slug), d.uiLocation);
    }
  } catch (error) {
    console.error('[SourceRegistry] uiLocation read failed:', error);
  }
  uiLocationCache = { at: now, value: map };
  return map;
}
