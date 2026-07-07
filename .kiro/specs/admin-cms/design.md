# admin-cms — Design

**Status:** current — describes implemented system
**Owner domain:** admin shell, project editor, homepage composer, admin project APIs
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)

---

## 1. Structure

```
src/app/admin/
  layout.tsx                     # shared shell: sidebar, breadcrumbs, session gate
  page.tsx                       # overview dashboard
  projects/                      # dashboard + editor route /admin/projects/editor/[[...id]]
  homepage/                      # composer (sections, hero, wave config editor)
  media/                         # media library (owned by `media` spec, hosted in this shell)
  ai/                            # ai-admin + ai-assistant debug surfaces (hosted here)
  semantic/                      # semantic dashboard (owned by `semantic-content`, hosted here)
src/components/admin/            # shell components (per-page tables/forms; no shared table/form primitives — see §5)
src/components/projects/EnhancedProjectEditor*  # the one editor (D10)
```

The admin shell (sidebar, breadcrumb, page-header patterns) is the hosting convention for every admin surface; other specs own their pages' content but must render inside this shell.

## 2. Editor architecture (D10)

`EnhancedProjectEditor` is the only project editor. It renders the public detail layout with editing affordances layered on:

- In-place metadata fields (title, description, date) matching public typography/positions.
- `SmartTagInput` — chip-based tag entry (comma/semicolon split, instant create/remove), reusable.
- `ClickableMediaUpload` — click-to-upload thumbnail area wired to the media modal, with direct drag-drop bypass.
- Tiptap 3 article editor (`rich-content` owns the editor + custom blocks; this spec owns its embedding and save wiring).
- AI panel docked side-by-side (`ai-admin` owns panel behavior/endpoints), fixed height, quick actions, selection-targeted edits with review-before-apply.
- Floating save bar: visibility toggle (PUBLIC/PRIVATE), save button, live "Saved / edited N min ago" status.

**Deleted in Phase 3 (D10):** `project-editor.tsx`, `unified-project-editor.tsx`, `project-preview-editor.tsx` — legacy unrouted editors.

## 3. Save path (D8)

One write path: editor state → `PUT/PATCH /api/admin/projects/[id]` → Prisma transaction updating `Project` + `ArticleContent` (`jsonContent` Tiptap JSON = source of truth; `content` string derived/legacy) + relations (tags, links, files). Saving triggers semantic change detection (`semantic-content` consumes the save event / detect-changes endpoint). The rich-content spec's former parallel `/api/content/[projectId]` API is cancelled — do not reintroduce.

## 4. Admin API surface (owned here)

| Endpoint | Behavior |
|---|---|
| `GET/POST /api/admin/projects` | List (all visibilities) / create |
| `GET/PUT/DELETE /api/admin/projects/[id]` | Read/update (single save path)/delete with cascade |
| `POST /api/admin/projects/[id]/media`, `.../media/add-existing` | Attach uploads or existing media |
| `GET /api/admin/projects/summary`, `GET /api/admin/stats` | Dashboard data |
| `GET/PUT /api/admin/homepage/config` | Homepage sections + hero content |
| `GET/PUT /api/admin/homepage/wave-config` | Wave hero parameters (`waveConfig` JSON on `HomepageConfig`) |
| `PUT /api/admin/homepage/sections/[sectionId]` | Per-section updates |
| `GET /api/admin/performance`, `GET/DELETE /api/admin/cache` | Ops panels |

All admin routes revalidate the NextAuth session server-side.

## 5. UX conventions

shadcn/ui primitives; each admin page composes its own table/form from shadcn parts (search + filters + row actions as a convention, not a shared component — the never-adopted `admin-table`/`admin-form`/`admin-actions` primitives were deleted in Phase 3, manifest correction #2); confirmation dialogs for destructive actions; optimistic UI only where a failed write is recoverable; toasts for save results. Desktop-first (D14) with responsive collapse.
