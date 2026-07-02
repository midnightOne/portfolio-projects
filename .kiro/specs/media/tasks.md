# media — Tasks

**Status:** current
**Owner domain:** media storage, upload, library, picker, providers
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Upload pipeline with validation and progress; Cloudinary provider integration; `MediaItem` persistence with thumbnails/metadata; library page with search/filter/batch-delete; context-filtered picker modal used by the editor and rich-content blocks; media sync endpoint; project media attach flows (via `admin-cms`).

## Open tasks

- [ ] 1. Delete `/api/media/test-cloudinary` diagnostic route (D42) — *Phase 3*
- [ ] 2. Verify delete flows remove provider-side objects and clean project associations — *Phase 3 verification*
  - _Requirements: 3.2_

## Backlog (per D11 — requires a new registry decision to activate)

Usage tracking, storage analytics, webhooks, duplicate detection, provider migration tools, additional storage providers.
