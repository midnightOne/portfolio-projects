# admin-cms — Requirements

**Status:** current — largely implemented
**Owner domain:** admin shell/navigation, project management UI (`EnhancedProjectEditor`), homepage composer, admin project APIs
**Last verified against code:** 2026-07-17 (admin navigation connectivity audit)
**Registry decisions applied:** D6 (Tiptap only), D7 (visibility only), D8 (single save path), D10 (one editor), D12 (homepage config endpoints)
**Contracts:**

| Consumes | From |
|---|---|
| NextAuth session gate | `portfolio-core` |
| Tiptap editor + custom blocks | `rich-content` |
| Media library modal, upload pipeline | `media` |
| AI editing panel + endpoints (`edit-content`, `improve-content`, `process-prompt`, `suggest-tags`) | `ai-admin` |
| Semantic change-detection trigger on save | `semantic-content` |

| Provides | To |
|---|---|
| `/api/admin/projects`, `/api/admin/projects/[id]`, `/api/admin/projects/[id]/media*`, `/api/admin/projects/summary` | admin UI |
| `/api/admin/homepage/config`, `/api/admin/homepage/wave-config`, `/api/admin/homepage/sections/[sectionId]` | homepage composer, `ui-system` wave editor |
| Admin shell layout + navigation conventions | all admin surfaces (`semantic-content` dashboard, `ai-admin`, `access-and-cost` panels) |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Admin shell and navigation

**User story:** As the owner, I want a consistent professional admin interface, so that I can manage everything without context switching.

1. WHEN any standard admin page loads THEN the system SHALL display the shared left sidebar with collapsible task categories (Overview, Site Content, Media, AI Assistant, Knowledge Base, Access & Safety, Insights & Monitoring, Developer Tools), highlighting the current page with breadcrumbs.
2. WHEN admin pages are viewed on mobile THEN the sidebar SHALL collapse to a hamburger menu; on desktop it SHALL be hideable for workspace.
3. WHEN new admin pages are added THEN they SHALL follow the established layout, table, and form patterns (shadcn/ui based).
4. WHEN any admin page or `/api/admin/**` route is accessed THEN the system SHALL require an authenticated session (consumes `portfolio-core` auth).
5. WHEN an enabled navigation item or dashboard action is rendered THEN it SHALL resolve to an implemented route/action. Contextual dynamic pages SHALL have an owning list/detail workflow and SHALL use the shared admin chrome unless explicitly documented as a full-screen editor.

## Requirement 2 — Project management

**User story:** As the owner, I want to create, edit, and delete projects from a dashboard, so that the portfolio stays current.

1. WHEN the projects dashboard loads THEN the system SHALL list all projects (both visibilities) with search, filtering, and per-row actions.
2. WHEN a project is deleted THEN the system SHALL require confirmation and remove associated data and media associations.
3. WHEN working with multiple projects THEN the system SHALL support bulk operations (delete, tag changes).
4. WHEN a project is saved THEN persistence SHALL go through `/api/admin/projects/[id]` — the **single** content save path (D8), writing `ArticleContent.jsonContent` (Tiptap JSON) as the source of truth.

## Requirement 3 — Unified project editor

**User story:** As the owner, I want editing to look like the public view with inline controls, so that I always see what visitors will see.

1. WHEN creating or editing a project THEN the system SHALL use the single unified editor page (`EnhancedProjectEditor`, routed at `/admin/projects/editor/[[...id]]`) for both new and existing projects (D10).
2. WHEN the editor renders THEN it SHALL mirror the public detail layout (same positions, spacing, typography) with in-place editing for title, description, tags, and metadata.
3. WHEN entering tags THEN the system SHALL support comma/semicolon-separated input with instant chip creation and X-button removal (`SmartTagInput`).
4. WHEN uploading a thumbnail THEN the system SHALL support click-to-upload on the media area (`ClickableMediaUpload`), integrating the media modal with a drag-and-drop bypass.
5. WHEN the editor is open THEN a floating save bar SHALL expose visibility (PUBLIC/PRIVATE — the only publication control, D7) and live save status ("Saved" / time since last save).
6. WHEN editing article content THEN the system SHALL embed the Tiptap 3 editor with portfolio blocks (consumes `rich-content`); Novel is fully removed (D6).
7. WHEN using AI assistance THEN the editor SHALL host the AI panel side-by-side (consumes `ai-admin`), supporting text-selection-targeted edits with review-before-apply.

## Requirement 4 — Homepage composer

**User story:** As the owner, I want to compose the homepage from sections, so that I can evolve the landing experience without code.

1. WHEN managing the homepage THEN the system SHALL allow enabling/disabling, reordering, and configuring sections (hero, about, featured projects, contact) persisted to `HomepageConfig`/`SectionConfig` via `/api/admin/homepage/config`.
2. WHEN configuring the featured projects section THEN the system SHALL allow selecting projects and a display cap.
3. WHEN editing the wave hero THEN the system SHALL persist `waveConfig` via `/api/admin/homepage/wave-config` (D12; visual editor specified in `ui-system`).
4. WHEN changes are saved THEN the public homepage SHALL update without affecting the projects page; preview before publish SHALL be available.

## Requirement 5 — Media management integration

**User story:** As the owner, I want project media managed in place, so that uploads and reuse are frictionless.

1. WHEN managing a project's media THEN the system SHALL support upload and attach-existing flows (`/api/admin/projects/[id]/media`, `/media/add-existing`), delegating storage to `media`.
2. WHEN uploads occur THEN file-type validation and secure URLs SHALL be enforced by the `media` pipeline.

## Requirement 6 — Operational dashboards

**User story:** As the owner, I want basic operational visibility in admin, so that I can spot issues.

1. WHEN the admin overview loads THEN the system SHALL show summary stats (`/api/admin/stats`, `/api/admin/projects/summary`) and performance/cache panels (`/api/admin/performance`, `/api/admin/cache`).
