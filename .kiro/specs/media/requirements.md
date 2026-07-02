# media — Requirements

**Status:** current — implemented; trimmed to code reality per D11
**Owner domain:** media storage, upload pipeline, media library UI, media picker, storage providers
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D11 (Prisma `MediaItem` canonical; usage tracking backlogged), D42
**Contracts:**

| Consumes | From |
|---|---|
| Admin shell + session gate | `admin-cms`, `portfolio-core` |
| Project association (`Project`) | `portfolio-core` |

| Provides | To |
|---|---|
| `MediaItem` data model | `portfolio-core`, `rich-content`, `admin-cms` |
| `/api/media`, `/api/media/[id]`, `/api/media/upload`, `/api/media/batch-delete`, `/api/media/sync` | admin UI, editor |
| Media picker modal (context-filtered) | `rich-content` blocks, `admin-cms` editor |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Upload

**User story:** As the owner, I want a unified upload interface, so that all project assets live in one place.

1. WHEN uploading THEN the system SHALL support drag-and-drop with per-file progress, type/size validation against provider limits, and clear failure messages.
2. WHEN an upload completes THEN the media SHALL be immediately available in the library with generated thumbnail (images) and metadata.
3. WHEN uploading in a project context THEN the system SHALL associate media with that project.

## Requirement 2 — Picker

**User story:** As a content creator, I want a context-aware media picker, so that blocks get the right media type.

1. WHEN a picker opens with context THEN it SHALL filter types accordingly (carousel → images, download → files) with tabbed Images/Files UI.
2. WHEN selecting THEN the picker SHALL support single and multi-select with visual feedback and return selections to the requesting component.
3. WHEN the library is large THEN the picker SHALL paginate/infinite-scroll and support real-time search by filename/type.
4. WHEN nothing matches THEN the picker SHALL offer direct upload inline.

## Requirement 3 — Library management

**User story:** As the owner, I want to manage the library, so that assets stay organized.

1. WHEN viewing the library THEN the system SHALL list media with thumbnails and metadata, filterable by type/size/date.
2. WHEN deleting THEN the system SHALL confirm, support batch deletion, and remove provider-side objects.
3. WHEN editing metadata THEN the system SHALL support alt text and description updates.
4. WHEN library and provider drift THEN `/api/media/sync` SHALL reconcile DB records with provider state.

## Requirement 4 — Storage providers

**User story:** As the owner, I want pluggable storage providers, so that storage can match cost/performance needs.

1. WHEN configuring storage THEN the system SHALL support the implemented provider abstraction (Cloudinary primary; additional providers per code) with connectivity validation before activation.
2. WHEN serving media THEN the system SHALL deliver optimized URLs with caching headers; images served responsively.
3. WHEN a provider errors THEN the system SHALL fail gracefully with actionable messages.

## Requirement 5 — Visitor delivery

**User story:** As a visitor, I want fast media, so that browsing is smooth.

1. WHEN media renders publicly THEN the system SHALL lazy-load, use responsive sizes, and provide fallbacks for unavailable media.
2. WHEN files are downloaded THEN URLs SHALL be secure with proper MIME types (delivery contract shared with `portfolio-core` Req 6).

## Backlog (descoped per D11 — do not build without a new decision)

Usage tracking/dependency graphs (`usageCount`, where-used), storage/cost analytics dashboards, growth projections, webhook notifications, duplicate detection, provider migration tooling, resumable downloads. The former spec's provider-rich `MediaItem` TS shape (`storageProvider`, `optimizedUrls`, `usageCount`) is aspirational — the Prisma model is canonical.
