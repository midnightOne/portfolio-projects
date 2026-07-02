# admin-cms — Tasks

**Status:** current
**Owner domain:** admin shell, project editor, homepage composer, admin project APIs
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Admin shell with sidebar navigation and session gating; projects dashboard with search/filter/bulk actions; `EnhancedProjectEditor` at `/admin/projects/editor/[[...id]]` with view-identical layout, `SmartTagInput`, `ClickableMediaUpload`, Tiptap 3 article editing, AI panel, floating save bar with visibility control; single save path through `/api/admin/projects/[id]`; homepage composer (sections, hero, featured selection) + wave config endpoints; media attach flows; stats/performance/cache panels.

## Open tasks

- [ ] 1. Delete legacy editors (D10) — *Phase 3*
  - [ ] 1.1 Remove `project-editor.tsx`, `unified-project-editor.tsx`, `project-preview-editor.tsx` and any dead imports/exports
  - [ ] 1.2 Type-check + build green; editor route unaffected
  - _Requirements: 3.1_

- [ ] 2. Remove draft/published remnants from admin UI (D7) — *Phase 3, with portfolio-core task 1*
  - [ ] 2.1 Grep admin components for `status` badges/filters; remove or map to visibility
  - _Requirements: 3.5_

- [ ] 3. Purge Novel leftovers (D6) — *Phase 3*
  - [ ] 3.1 Delete `NovelContent`/`NovelBlock`/`AINovelIntegration` types and any `novel` imports/deps if still present
  - _Requirements: 3.6_

- [ ] 4. Admin shell hosts new panels — *Phase 2/4, coordinate*
  - [ ] 4.1 Access & Spend panel added under the shell (owned by `access-and-cost`)
  - [ ] 4.2 MCP status/config surface if needed (owned by `mcp-server`)
  - _Requirements: 1.3_

## Backlog

- Editor autosave (deliberate: manual save + status indicator is the current model).
- Homepage composer drag-and-drop reorder polish (functional reorder exists).
