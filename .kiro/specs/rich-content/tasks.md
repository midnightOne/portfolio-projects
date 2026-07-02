# rich-content — Tasks

**Status:** current
**Owner domain:** Tiptap editor, custom blocks, content schema, rendering
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Tiptap 3 editor (`TiptapEditorWithAI`) with formatting, slash commands, and custom blocks (image, carousel, interactive, download, project link); media picker integration; selection-targeted AI editing bridge with review-before-apply; shared render components for edit/view parity; JSON persistence via the admin save path; iframe sandboxing for interactive embeds.

## Open tasks

- [ ] 1. Confirm no `/api/content/*` remnants and no Novel imports (D6/D8) — *Phase 3 verification*
  - [ ] 1.1 Grep for `api/content/`, `novel`, `NovelContent`, `NovelBlock`; delete stragglers
- [ ] 2. Interactive embed security audit — *Phase 3*
  - [ ] 2.1 Verify sandbox attribute set, src allowlist enforced, no `allow-same-origin`+`allow-scripts` pairing
  - _Requirements: 2.3; design §4_

## Backlog (D9 — inactive without a new decision)

Content versioning (snapshots, history UI, diff, retention); `ContentVersion` stays dormant. Collaboration features are cancelled outright, not backlogged.
