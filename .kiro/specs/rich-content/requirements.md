# rich-content — Requirements

**Status:** current — implemented; parallel API cancelled (D8), versioning descoped (D9)
**Owner domain:** Tiptap 3 editor, custom portfolio blocks, content JSON schema, read-only rendering
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D6 (Tiptap only), D8 (single save path), D9 (versioning backlog)
**Contracts:**

| Consumes | From |
|---|---|
| Media picker + `MediaItem` | `media` |
| AI editing endpoints + panel behavior | `ai-admin` |
| Save path `/api/admin/projects/[id]` | `admin-cms` |
| Project references validation (`ProjectReference`) | `portfolio-core` |

| Provides | To |
|---|---|
| `ArticleContent` (+ `EmbeddedMedia`, `MediaCarousel`, `CarouselImage`, `InteractiveExample`) data models | `portfolio-core`, `admin-cms`, `semantic-content` |
| Tiptap editor component + custom block extensions | `admin-cms` editor |
| Read-only renderer (identical components) | `portfolio-core` detail view |
| Tiptap JSON (`jsonContent`) as the content source of truth | `semantic-content` ingestion |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Editor

**User story:** As the owner, I want a modern rich text editor, so that I can write professional case studies.

1. WHEN editing content THEN the system SHALL provide a Tiptap 3 editor with standard formatting (bold, italic, headings, lists, links) and keyboard shortcuts. Tiptap is the **only** editor (D6); Novel is removed.
2. WHEN content is stored THEN it SHALL persist as structured Tiptap JSON (`ArticleContent.jsonContent`) — the source of truth for rendering, AI processing, and semantic ingestion.
3. WHEN switching between edit and public view THEN rendering SHALL be consistent (same components both sides).
4. WHEN editing large documents THEN the editor SHALL remain responsive.

## Requirement 2 — Custom blocks

**User story:** As the owner, I want portfolio-specific blocks, so that case studies are rich and interactive.

1. WHEN typing slash commands THEN the system SHALL offer `/image`, `/carousel`, `/interactive`, `/download`, `/project-link` block insertion.
2. WHEN inserting image/carousel/download blocks THEN the system SHALL use the `media` picker with correct context filtering.
3. WHEN embedding interactive content THEN the system SHALL sandbox iframes and apply security constraints; failed embeds SHALL show fallbacks.
4. WHEN inserting project links THEN the system SHALL validate the referenced project exists (auto-completion from project list).
5. WHEN blocks render publicly THEN they SHALL reuse the same components as the editor (ImageCarousel, DownloadButton, interactive embed).
6. WHEN a block is edited THEN inline editing UIs SHALL validate configuration.

## Requirement 3 — Selection-targeted AI editing

**User story:** As the owner, I want precise AI edits on selections, so that assistance never clobbers my document.

1. WHEN text is selected THEN the system SHALL expose AI quick actions and custom prompts scoped to the selection (endpoints owned by `ai-admin`).
2. WHEN AI edits apply THEN only the selected span SHALL change; formatting, links, and blocks SHALL survive; full-document context is provided to the model.
3. WHEN AI changes land THEN the user SHALL review/approve before apply, with undo support.
4. WHEN AI processes content THEN it SHALL preserve intent and never fabricate facts (enforced via prompts + review flow).

## Requirement 4 — Rendering

**User story:** As a visitor, I want fast, consistent content rendering.

1. WHEN project content renders THEN formatting, blocks, media, and internal links SHALL work responsively with lazy loading and graceful fallbacks.
2. WHEN assistive tech is used THEN content SHALL support screen readers and keyboard navigation.

## Requirement 5 — Validation

**User story:** As the owner, I want structural validation on save, so that broken content never ships.

1. WHEN content saves THEN the system SHALL validate document structure, block configuration, media references, and project references, reporting actionable errors.

## Cancelled / backlog

- **Cancelled (D8):** the parallel `/api/content/[projectId]` content API. All persistence goes through `/api/admin/projects/[id]`.
- **Cancelled:** real-time collaboration, commenting, approval workflows, offline editing (former Reqs 9–10) — single-owner product.
- **Backlog (D9):** content versioning/snapshots (auto-save intervals, history UI, diff, retention). The `ContentVersion` model may remain dormant; no UI or API ships without a new decision.
- **Backlog:** content analytics beyond `portfolio-core`'s view metrics; SEO/accessibility advisors.
