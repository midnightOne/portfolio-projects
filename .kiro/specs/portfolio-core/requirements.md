# portfolio-core — Requirements

**Status:** current — largely implemented
**Owner domain:** public portfolio experience: pages (homepage, projects), project browsing/detail, public project APIs, SSR/SEO, analytics, authentication
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D2, D7 (visibility only), D14 (desktop-first), D42
**Contracts:**

| Consumes | From |
|---|---|
| Rich content rendering (Tiptap read-only renderer, carousels, embeds, downloads blocks) | `rich-content` |
| Media URLs/types (`MediaItem`) | `media` |
| Theme, GSAP transitions, wave hero | `ui-system` |
| Floating AI pill mount point | `ai-assistant` |

| Provides | To |
|---|---|
| `Project`, `Tag`, `ProjectAnalytics`, `ExternalLink`, `DownloadableFile`, `ProjectReference`, `HomepageConfig`, `SectionConfig` data models | all specs |
| `GET /api/projects`, `GET /api/projects/[slug]`, `GET /api/tags`, `GET /api/homepage-config-public` | public UI, `ai-assistant` server tools |
| NextAuth session + admin gate | `admin-cms`, all admin APIs |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Project browsing

**User story:** As a visitor, I want to browse all public projects with basic information, so that I can quickly scan the available work.

1. WHEN the projects page loads THEN the system SHALL display all PUBLIC-visibility projects in grid or list layout, selectable by the visitor.
2. WHEN displaying each project THEN the system SHALL show name, tags, brief description, and preview thumbnail.
3. WHEN the page renders THEN the system SHALL be responsive (desktop-first per D14) across desktop, tablet, and mobile.

## Requirement 2 — Real-time filtering

**User story:** As a visitor, I want to filter projects by tags in real time, so that I can find relevant work.

1. WHEN the projects page loads THEN the system SHALL display tag filter options derived from existing tags.
2. WHEN a tag filter is toggled THEN the system SHALL immediately show only matching projects, animating the transition.
3. WHEN multiple tags are selected THEN the system SHALL show projects matching any selected tag.
4. WHEN filters are cleared THEN the system SHALL restore the full list with smooth animation.

## Requirement 3 — Search and sort

**User story:** As a visitor, I want to search and sort projects, so that I can find specific work or browse in my preferred order.

1. WHEN typing in the search field THEN the system SHALL filter projects in real time by name, description, and content.
2. WHEN sort options are used THEN the system SHALL support ordering by date, alphabetical, and popularity, animating reorder.
3. WHEN no results match THEN the system SHALL display a clear "no results" state.

## Requirement 4 — Timeline view

**User story:** As a visitor, I want a timeline view, so that I can see the chronological progression of work.

1. WHEN timeline view is selected THEN the system SHALL display projects chronologically by work date, grouped by period.
2. WHEN switching between grid and timeline THEN the system SHALL preserve active filters and search terms.
3. WHEN a timeline entry is clicked THEN the system SHALL open the project detail view.

## Requirement 5 — Project detail view

**User story:** As a visitor, I want a detailed project view with deep-linkable URLs, so that I can read the full case study and share it.

1. WHEN a project preview is clicked THEN the system SHALL open a modal with a two-column layout: fixed metadata panel (title, image, overview, tags, date, external links, downloads) left; scrollable article right.
2. WHEN a project opens or closes THEN the system SHALL update the browser URL (SEO-friendly slug) and maintain history; direct navigation to a project URL SHALL open that project.
3. WHEN the modal is open THEN the system SHALL close on X button or outside click, with animated transitions.
4. WHEN the article renders THEN the system SHALL use the `rich-content` read-only renderer (inline media, carousels, interactive embeds, download blocks, cross-project links).

## Requirement 6 — Downloads

**User story:** As a visitor, I want to download project files, so that I can try applications or access resources.

1. WHEN a project has attachments THEN the system SHALL show download buttons in the metadata panel (dropdown listing file names when multiple) and support inline references in the article.
2. WHEN a download is initiated THEN the system SHALL serve the file securely with correct MIME type, headers, and visible file name/size/type.
3. WHEN files are downloaded THEN the system SHALL record download analytics.

## Requirement 7 — External links and cross-references

**User story:** As a visitor, I want external links and links between related projects, so that I can explore demos, source code, and connected work.

1. WHEN external links exist THEN the system SHALL display them with icons/labels and open them in new tabs.
2. WHEN an article references another project THEN the system SHALL open the referenced project's detail view on click, styled distinctly from external links, with history preserved.
3. WHEN internal references are created THEN the system SHALL validate that the referenced project exists.

## Requirement 8 — Related projects

**User story:** As a visitor, I want related-project suggestions, so that I can discover connected work.

1. WHEN viewing a project THEN the system SHALL suggest up to 3–5 related projects ranked by shared tags, hiding the section when none exist.

## Requirement 9 — Engagement analytics

**User story:** As the owner, I want view metrics per project, so that I can identify popular work.

1. WHEN a project is viewed THEN the system SHALL increment its view count and track time-on-project.
2. WHEN analytics are collected THEN the system SHALL respect visitor privacy (no PII beyond what rate-limiting stores hashed — see `access-and-cost`).

## Requirement 10 — Homepage

**User story:** As a visitor, I want a homepage that presents the owner and highlights featured work, so that I get an overview before diving in.

1. WHEN the homepage loads THEN the system SHALL render config-driven sections (hero with wave background, about, featured projects, contact) in admin-defined order, skipping disabled sections.
2. WHEN the featured projects section renders THEN the system SHALL reuse the same `ProjectsSection` component as the projects page, in a variant that limits count and hides advanced filters.
3. WHEN a project is clicked from the homepage THEN the system SHALL open the same detail modal as the projects page.
4. WHEN homepage config changes are saved in admin THEN the public homepage SHALL reflect them without affecting the projects page.

## Requirement 11 — Section modularity

**User story:** As the owner, I want modular, reusable page sections, so that layout can evolve without duplicating functionality.

1. WHEN pages are composed THEN the system SHALL use section components reusable across pages with per-use variants (homepage, full-page, featured).
2. WHEN a shared component changes THEN all usages SHALL stay behaviorally and visually consistent.

## Requirement 12 — SSR, SEO, and social sharing

**User story:** As a search crawler or visitor, I want server-rendered content with correct metadata, so that the site is indexable and previews well.

1. WHEN public pages load THEN the system SHALL server-render full content (homepage, projects list, project detail) with hydration free of visual flicker.
2. WHEN pages are crawled or shared THEN the system SHALL provide meta tags, Open Graph/Twitter cards, structured data, and per-project preview images.
3. WHEN the sitemap is requested THEN the system SHALL generate XML covering all public pages with sensible priority/change frequency.
4. WHEN SSR is measured THEN the system SHALL maintain good TTFB/LCP and Core Web Vitals.

## Requirement 13 — Performance

**User story:** As a visitor, I want fast loads and responsive interactions.

1. WHEN the projects API is queried THEN the system SHALL use joined queries (no N+1), pagination/limits for large sets, and caching for repeated requests (per-instance memoization only — durable caches live in Postgres, D43).
2. WHEN media loads THEN the system SHALL lazy-load images/video.
3. WHEN interactions occur THEN the system SHALL target ≤200ms perceived response and 60fps animation.
4. WHEN queries exceed 100ms THEN the system SHALL log performance warnings.
5. WHEN data loads progressively THEN the system SHALL show skeletons/partial content immediately and update incrementally.

## Requirement 14 — Visibility model

**User story:** As the owner, I want a single, simple publication control, so that content state is unambiguous.

1. WHEN a project's visibility is PRIVATE THEN the system SHALL hide it from all public surfaces (pages, APIs, sitemap, search, AI tools) while allowing admin access.
2. The system SHALL use `visibility` (PUBLIC/PRIVATE) as the **only** publication state (D7). There is no draft/published status; the legacy `status` column is dropped in Phase 3.

## Requirement 15 — Authentication

**User story:** As the owner, I want secure admin authentication, so that only I can manage content.

1. WHEN `/admin` or any admin API is accessed THEN the system SHALL require an authenticated NextAuth session and reject anonymous requests.
2. WHEN authentication fails THEN the system SHALL return an appropriate error without leaking account information.
