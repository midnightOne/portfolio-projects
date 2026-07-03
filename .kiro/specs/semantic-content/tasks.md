# semantic-content — Tasks

**Status:** current
**Owner domain:** T0–T3 semantic pipeline, search, budgets, dashboard
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated per D36 (the old spec's duplicate "Task 15" is gone by regeneration). The semantic-system-fixes spec is archived; its unresolved items live here as verification tasks — branch commits (`2c4add4` "all stages work properly", `146dc21` HNSW reindexing, `5fa3417` duplicate-content fix) claim to have fixed most of them, unverified.**

---

## Already implemented (verified on branch)

T0–T3 heading-bounded generation with contextual prefixes and section hashes; stage-based resumable processing with SSE progress and queue; pgvector + HNSW storage and reindexing (incl. force rebuild); `ContentSearchService` (similarity × importance, MMR); change detection with configurable thresholds; summary generation with DB-backed config; budget gate + cost estimation; Batch API embedding jobs; full admin dashboard (tree, chunk editor with AI edit, configs, bulk ops, diagnostics service + `npm run diagnostics`).

## Open tasks

### Phase 0 — end-to-end verification (closes semantic-system-fixes)

- [x] 1. Verify the four historical failure modes on current code (roadmap task 0.5) — **run 2026-07-03 on the local dev DB (fixture project, all four stages immediate, real OpenAI). Evidence: `npm run check:semantic` (14/14 assertions).**
  - [x] 1.1 Ingest one full project through all four stages: 12 chunks (1×T0, 1×T1, 5×T2, 5×T3) persisted with embeddings, valid parent/root linkage. *Required fixing a real bug found during this run — see task 6.1.*
  - [x] 1.2 SSE progress verified functionally (`?sse=true`): open → staged progress events → auto-reconnect exercised → completion event. **Caveat: a true 10-minute operation could not be manufactured at fixture scale; long-run survival unproven.**
  - [x] 1.3 Queue endpoint reflects completed/failed/queued operations (admin-gated). *Bug found — see task 6.3.*
  - [x] 1.4 Chunks present after completion and after idempotent re-ingestion; T3 titles derive from parent T2 section titles.
  - [x] 1.5 Closed out; failures found during verification filed as task 6 below.

### Phase 0 follow-ups — defects found by task 1 (2026-07-03)

- [x] 6.1 ~~Parent-resolution heuristic corrupts hierarchy~~ **FIXED**: `StageBasedProcessingService` treated any `parentChunkId` starting with 'c' and ≥20 chars as a DB cuid, so slug-like logical IDs (e.g. `chrono-kiln-controller`) failed FK resolution and aborted chunking. Both `batchStoreChunks` and `storeValidatedChunk` now resolve map/DB-first with a strict cuid-pattern fallback.
- [ ] 6.2 **`scope: 'all'` processing is structurally broken**: every stage assumes a single project (`projects[0]`, `request.projectId` undefined → `projectAIIndex.upsert` crash in chunking; `executeSummariesStage` comments "Assuming single project for now"; chunks from all projects accumulate into one flat checkpoint persisted against one entity). Fix = per-project persistence loop (or per-project sub-operations). Until then the dashboard's "process all" bulk action fails.
- [ ] 6.3 **Queue entry status never updates without an SSE subscriber**: a completed operation stays `queued` in `JobQueueManager` unless a `?sse=true` subscription was attached (status transitions appear to ride the progress-subscription callback). Decouple queue status from SSE subscription.
- [ ] 6.4 **Unauthenticated cost-incurring route**: `POST /api/admin/semantic/processing/start` (and the start of stage operations generally) has no session check while sibling routes (`processing/queue`) do — anyone who can reach the dev/staging server can trigger OpenAI spend. Gateway (Phase 2, D33) is the systemic fix; an interim `getServerSession` guard is cheap and worth it.
- [ ] 6.5 `prisma/seed.ts` still ingests via the **legacy T0–T4 pipeline** (`ContentIngestionPipeline`) and `project-indexer`, producing tier-4 chunks (32 such rows existed in the old Neon dev DB). Swap seed to the stage-based pipeline or drop auto-ingestion from seed (goes with D27/D37 in Phase 3).

### Phase 2 — cost unification

- [ ] 2. Write actuals to the unified ledger (D32)
  - [ ] 2.1 Embedding/summary calls record tokens + cost to `AIUsageLog` (feature tag `semantic`), via the shared pricing module (D38)
  - [ ] 2.2 `SemanticBudget` remains pre-flight only; simplify estimation ceremony where it duplicates the ledger
  - _Requirements: 6_

### Phase 3 — one index, hygiene

- [ ] 3. Retire `ProjectAIIndex` (D37)
  - [ ] 3.1 Data migration: `summary` → T1 chunk where missing; keywords/topics/technologies → `ContentEntity`/`ContextChunk.metadata`
  - [ ] 3.2 Re-point `BackendToolService` + `/api/projects/search/ai-context` to `ContentSearchService`
  - [ ] 3.3 Delete `project-indexer.ts`, legacy `src/lib/services/content-ingestion.ts` (T0–T4), `use-project-indexing.ts`, `project-indexing-integration.ts`, `/api/admin/ai/project-indexing/*`, `/admin/ai/project-indexing` page; remove legacy re-exports from `src/lib/content/index.ts`
  - [ ] 3.4 Prisma migrations: drop `ContextChunk.projectIndexId`, then `ProjectAIIndex`
  - [ ] 3.5 Acceptance: semantic search unaffected; `prisma migrate` clean; no imports of deleted modules
  - [ ] 3.6 While in there: confirm ingestion reads content through a single content-source entry point (the Tiptap/`ArticleContent` reader) rather than scattered Prisma reads — the D48 content-source seam; extract the entry point if the refactor is trivial, otherwise note the gap in `_backlog/agentic-platform.md`
  - _Requirements: 8; registry D48(d)_

- [ ] 4. Delete one-off diagnostic routes (D42): the 9 routes listed in design §5; keep `diagnostics`, `diagnostics/t3`, `dashboard`

### Phase 3 — retrieval quality

- [ ] 5. Hybrid retrieval (D29)
  - [ ] 5.1 Fuse pgvector similarity with tsvector full-text (reciprocal-rank fusion or weighted union) in `ContentSearchService`
  - [ ] 5.2 Acceptance: keyword-exact queries (project names, tech terms) rank correctly in `content_search`
  - _Requirements: 5.2_

### Hygiene — DB (cross-cutting, no dependencies; do when convenient)

- [x] 7. Collapse migrations to a single fresh `init` (D54) — **done 2026-07-03**
  - [x] 7.1 Single `20260703220000_init` generated from `schema.prisma`. Prisma's `migrate diff --from-empty` already emits `CREATE EXTENSION IF NOT EXISTS "vector"` (positioned before the vector columns), so the extension is **automatic**; the one hand-patch is the HNSW index (`USING hnsw (embedding_vector vector_cosine_ops) WITH (m=16, ef_construction=64)`), which Prisma emits as a btree. All 8 prior migrations + the stray `setup-pgvector.sql` removed.
  - [x] 7.2 Verified on a **truly empty DB** (dropped, no extension): `migrate deploy` applied the init clean; `migrate diff` shows zero drift; extension present; HNSW index confirmed `USING hnsw`; base seed + fixture seed run clean.
  - [x] 7.3 Automation: `npm run db:reset` (= `prisma migrate reset` + fixture) with a `prisma.seed` hook so reset re-provisions extension + HNSW and reseeds in one command. (Prisma's AI-agent guardrail blocks `migrate reset` for assistants; works in a human terminal.)
  - _Requirements: registry D54_

## Backlog

Multi-embedding-model A/B (model-comparison endpoint exists; keep frozen); cross-project T0 variants; per-audience summaries (reflink personalization) — needs a registry decision.
