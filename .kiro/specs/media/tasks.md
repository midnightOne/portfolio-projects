# media — Tasks

**Status:** current
**Owner domain:** media storage, upload, library, picker, providers
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Upload pipeline with validation and progress; Cloudinary provider integration; `MediaItem` persistence with thumbnails/metadata; library page with search/filter/batch-delete; context-filtered picker modal used by the editor and rich-content blocks; media sync endpoint; project media attach flows (via `admin-cms`).

## Open tasks

- [x] 1. Delete `/api/media/test-cloudinary` diagnostic route (D42) — **done 2026-07-06** (with `scripts/test-cloudinary-display.ts` and the dead `cloudinary-image` component)
- [ ] 2. Verify delete flows remove provider-side objects and clean project associations — *Phase 3 verification; **blocked on credential rotation** (Cloudinary key stale per the 2026-07-03 deployment-state note) — verify at deploy-time re-provisioning*
  - _Requirements: 3.2_

## Backlog (per D11 — requires a new registry decision to activate)

Usage tracking, storage analytics, webhooks, duplicate detection, provider migration tools, additional storage providers.
