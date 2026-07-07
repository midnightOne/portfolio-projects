# portfolio-core — Tasks

**Status:** current
**Owner domain:** public portfolio experience, public project APIs, SSR/SEO, analytics, auth
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)
**Ledger regenerated from code truth per D36 — history is summarized, only open work is tasked.**

---

## Already implemented (verified on branch)

Projects browser with grid/list/timeline views, real-time tag filtering, search and sort; two-column project detail modal with URL deep-linking and history; downloads (metadata panel + inline), external links, cross-project references; related projects; view/time analytics; config-driven homepage (hero + wave, about, featured `ProjectsSection` variant, contact) backed by `HomepageConfig`/`SectionConfig`; SSR with per-project metadata and OG tags (**no sitemap exists — see task 4.1**); NextAuth session gating for all admin surfaces; joined public project queries with pagination. Publication model is `visibility` only (D7 — `status` column dropped 2026-07-06).

## Open tasks

- [x] 1. Drop the legacy `status` column (D7) — **done 2026-07-06**
  - [x] 1.1 Every reader re-pointed to `visibility` (public queries, raw SQL, DB adapters' partial indexes, search helpers, semantic services, seeds, perf scripts, zod schemas, editor UI chain) — compiler-verified, zero `Project.status` references remain
  - [x] 1.2 Migration `20260707030000_drop_project_status` drops column + `project_status` enum + status index (visibility index added); applied, zero drift; client regenerated
  - _Requirements: 14.2_

- [x] 2. Delete test/debug public routes (D42) — **done 2026-07-06**
  - [x] 2.1 All five removed (plus `/api/media/test-cloudinary` and the 9 semantic diagnostic routes with their owning specs)
  - [x] 2.2 `page.new.tsx` removed (Wave 1)
  - [x] 2.3 `UIManagerDebugPanel` unmounted from the homepage and deleted (hard delete per D42 — admin surfaces cover debugging)
  - _Requirements: hygiene; registry D42, D16_

- [x] 3. Re-point AI-facing project search before D37 retirement — **done 2026-07-06**
  - [x] 3.1 The route's only consumer (`content-source-manager` project provider) now calls `ContentSearchService` directly; the route itself deleted (fetch-self antipattern, engine retired)
  - [x] 3.2 Both deleted
  - _Requirements: design §3; registry D37_

- [x] 4. Sitemap/SEO audit after hygiene deletions — **done 2026-07-07**
  - [x] 4.1 `app/sitemap.ts` created (none existed — the "sitemap" claim in the old Already-implemented was inaccurate): static public pages + every PUBLIC project's canonical deep link (`/projects?project=<slug>`), env-derived base URL, fail-soft on DB error. Verified live: sitemap.xml serves all public projects; no test routes remain to exclude (D16/D42).
  - _Requirements: 12.3_

## Backlog (not scheduled)

- Popularity indicators surfaced on cards (analytics data exists; UI intentionally minimal).
- Auth.js v5 migration (optional Phase 5 hygiene).
