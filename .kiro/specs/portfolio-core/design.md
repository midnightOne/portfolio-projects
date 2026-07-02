# portfolio-core — Design

**Status:** current — describes implemented system
**Owner domain:** public portfolio experience, public project APIs, SSR/SEO, analytics, auth
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. Architecture

Next.js 15 App Router, deployed on Vercel serverless (D43). Public pages are server-rendered and hydrated; interactivity (filtering, search, modal navigation) is client-side enhancement over SSR output. PostgreSQL via Prisma is the only durable store.

```
src/app/
  page.tsx                 # homepage (config-driven sections)
  projects/page.tsx        # projects browser (grid/list/timeline)
  projects/[slug]/         # deep-linked project detail (modal-over-list pattern)
  api/projects/            # public project APIs
  api/tags/                # public tag list
  api/homepage-config-public/  # public homepage config
  api/auth/[...nextauth]/  # NextAuth
  api/health/              # health checks
src/components/
  projects-section/        # shared ProjectsSection (variants: homepage | full-page | featured)
  project-modal/           # two-column detail modal
```

### Modal-over-list navigation

The project detail is a modal layered over the list, driven by the URL: opening a project pushes `/projects/[slug]`, closing pops back. Direct hits on `/projects/[slug]` SSR the detail (full content + metadata for SEO) with the list behind it. Browser back/forward works at every step. The AI assistant drives the same navigation declaratively via `ui_intent` (see `ai-assistant`) — the modal and list register semantic IDs with `UIManager`; this spec owns the surfaces, `ai-assistant` owns the tooling.

## 2. Data models (owned here)

Specified once here; other specs link. Field lists live in `prisma/schema.prisma` — the schema is the truth for shapes (convention: no pasted bodies in specs).

| Model | Purpose | Notes |
|---|---|---|
| `Project` | Core entity: title, slug, description, `visibility` (PUBLIC/PRIVATE), workDate, relations to everything below | `status` column is legacy — dropped in Phase 3 (D7). `visibility` gates every public surface. |
| `Tag` | Many-to-many with Project | Tag list feeds public filters and admin SmartTagInput |
| `ProjectAnalytics` | View counts, time-on-project | Incremented server-side on detail views |
| `ExternalLink` | Labeled outbound links per project | |
| `DownloadableFile` | Attachments with metadata (name, size, type) | Served with correct MIME + security headers; downloads tracked |
| `ProjectReference` | Internal project→project links | Referential validity checked at authoring time |
| `HomepageConfig` | Singleton homepage settings incl. `waveConfig` JSON | Canonical per D12; `ui-system` consumes `waveConfig`, `admin-cms` writes via composer |
| `SectionConfig` | Per-section type/order/enabled/config JSON | Ordered render on homepage |

Related but owned elsewhere: `ArticleContent`, `EmbeddedMedia`, `MediaCarousel`, `CarouselImage`, `InteractiveExample` (→ `rich-content`); `MediaItem` (→ `media`); all `AI*` models (→ `ai-assistant` / `ai-admin` / `access-and-cost`); semantic models (→ `semantic-content`).

## 3. API surface (owned here)

| Endpoint | Method | Behavior |
|---|---|---|
| `/api/projects` | GET | Public list; joined query (tags, thumbnail, analytics), filters/search/sort params, pagination; PUBLIC visibility only |
| `/api/projects/[slug]` | GET | Full public project payload (metadata + article content + media refs); 404 for PRIVATE |
| `/api/tags` | GET | Public tag list with usage counts |
| `/api/homepage-config-public` | GET | Public homepage config (sections, hero text, waveConfig) |
| `/api/auth/[...nextauth]` | * | NextAuth (credentials); session cookie gates `/admin/**` and `/api/admin/**` |
| `/api/health`, `/api/health/homepage` | GET | Liveness/config sanity |

Admin-side project CRUD lives in `admin-cms` (`/api/admin/projects*`). Semantic AI search over projects lives in `semantic-content`/`ai-assistant` (`content_search` tool), **not** in a bespoke public search API.

To be removed (D42, Phase 3 hygiene): `/api/projects/test`, `/api/simple-test`, `/api/test-homepage-config`, `/api/debug/test-monitoring`, `/api/admin/test`. To be removed with `ProjectAIIndex` retirement (D37, Phase 3): `/api/projects/[slug]/index`, `/api/projects/index/batch`, `/api/projects/search/ai-context` (re-pointed to `ContentSearchService` first).

## 4. SSR/SEO

- All public pages use server components for initial render; `generateMetadata` provides per-project meta/OG/Twitter tags with preview images.
- XML sitemap generated from PUBLIC projects + static pages.
- Structured data (JSON-LD) on project pages.
- Core Web Vitals: lazy media, `next/image` optimization, minimal client JS on first paint.

## 5. Analytics

View counts and time-on-project recorded in `ProjectAnalytics` via lightweight server calls; download events recorded per `DownloadableFile`. No third-party analytics; no raw-IP storage (rate limiting hashes IPs — see `access-and-cost`).

## 6. Auth

NextAuth v4 (credentials provider) with session cookies. Every `/api/admin/**` route revalidates the session server-side; middleware protects `/admin/**` pages. Auth.js v5 migration is optional Phase 5 hygiene (registry §5 commentary) — not planned work.

## 7. Error handling & loading

Skeleton states for list/detail; progressive rendering (show available data, hydrate incrementally); explicit error boundaries with retry for data fetch failures; graceful 404 for missing slugs.
