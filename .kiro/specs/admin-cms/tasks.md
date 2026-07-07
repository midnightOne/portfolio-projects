# admin-cms — Tasks

**Status:** current
**Owner domain:** admin shell, project editor, homepage composer, admin project APIs
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Admin shell with sidebar navigation and session gating; projects dashboard with search/filter/bulk actions; `EnhancedProjectEditor` at `/admin/projects/editor/[[...id]]` with view-identical layout, `SmartTagInput`, `ClickableMediaUpload`, Tiptap 3 article editing, AI panel, floating save bar with visibility control; single save path through `/api/admin/projects/[id]`; homepage composer (sections, hero, featured selection) + wave config endpoints; media attach flows; stats/performance/cache panels.

## Open tasks

- [x] 1. Delete legacy editors (D10) — **done 2026-07-06**
  - [x] 1.1 All three deleted, plus `project-display.tsx` and the never-adopted shared admin primitives (`admin-table`/`admin-form`/`admin-actions`/`floating-save-bar`/`inline-editable` + test) — verified `enhanced-project-editor` imports none of them
  - [x] 1.2 Type-check + build green; `/admin/projects/editor/[[...id]]` routes only `EnhancedProjectEditor`
  - _Requirements: 3.1_

- [x] 2. Remove draft/published remnants from admin UI (D7) — **done 2026-07-06, with portfolio-core task 1**
  - [x] 2.1 Status selector removed from the editor save bar (visibility control remains); dashboard badge shows visibility; admin projects API status filter/fields dropped; stats count public/private
  - _Requirements: 3.5_

- [x] 3. Purge Novel leftovers (D6) — **verified clean 2026-07-06**: grep finds no `NovelContent`/`NovelBlock`/`AINovelIntegration` or `novel` deps anywhere; nothing to delete
  - _Requirements: 3.6_

- [ ] 4. Admin shell hosts new panels — *Phase 2/4, coordinate*
  - [ ] 4.1 Access & Spend panel added under the shell (owned by `access-and-cost`)
  - [ ] 4.2 MCP status/config surface if needed (owned by `mcp-server`)
  - _Requirements: 1.3_

## Backlog

- Editor autosave (deliberate: manual save + status indicator is the current model).
- Homepage composer drag-and-drop reorder polish (functional reorder exists).
