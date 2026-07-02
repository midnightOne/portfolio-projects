# portfolio-core — Tasks

**Status:** current
**Owner domain:** public portfolio experience, public project APIs, SSR/SEO, analytics, auth
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36 — history is summarized, only open work is tasked.**

---

## Already implemented (verified on branch)

Projects browser with grid/list/timeline views, real-time tag filtering, search and sort; two-column project detail modal with URL deep-linking and history; downloads (metadata panel + inline), external links, cross-project references; related projects; view/time analytics; config-driven homepage (hero + wave, about, featured `ProjectsSection` variant, contact) backed by `HomepageConfig`/`SectionConfig`; SSR with per-project metadata, OG tags, sitemap; NextAuth session gating for all admin surfaces; joined public project queries with pagination.

## Open tasks

- [ ] 1. Drop the legacy `status` column (D7) — *Phase 3*
  - [ ] 1.1 Verify no code path reads `Project.status` (grep `status` against project queries/components)
  - [ ] 1.2 Prisma migration removing the column; regenerate client
  - _Requirements: 14.2_

- [ ] 2. Delete test/debug public routes (D42) — *Phase 3*
  - [ ] 2.1 Remove `/api/projects/test`, `/api/simple-test`, `/api/test-homepage-config`, `/api/debug/test-monitoring`, `/api/admin/test`
  - [ ] 2.2 Remove `src/app/projects/page.new.tsx` (dead alternate implementation)
  - [ ] 2.3 Remove `UIManagerDebugPanel` mount from `src/app/page.tsx` (or gate behind admin session + query flag)
  - _Requirements: hygiene; registry D42, D16_

- [ ] 3. Re-point AI-facing project search before D37 retirement — *Phase 3, coordinate with `semantic-content` task set*
  - [ ] 3.1 `/api/projects/search/ai-context` consumers moved to `ContentSearchService`
  - [ ] 3.2 Delete `/api/projects/[slug]/index` and `/api/projects/index/batch`
  - _Requirements: design §3; registry D37_

- [ ] 4. Sitemap/SEO audit after hygiene deletions — *Phase 3 tail*
  - [ ] 4.1 Confirm sitemap contains only real public pages (no test routes) and all PUBLIC projects
  - _Requirements: 12.3_

## Backlog (not scheduled)

- Popularity indicators surfaced on cards (analytics data exists; UI intentionally minimal).
- Auth.js v5 migration (optional Phase 5 hygiene).
