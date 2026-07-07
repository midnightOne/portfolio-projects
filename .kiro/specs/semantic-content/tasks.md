# semantic-content — Tasks

**Status:** current
**Owner domain:** T0–T3 semantic pipeline, search, budgets, dashboard
**Last verified against code:** 2026-07-07 (Phase 4 session — preflight)
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
- [ ] 6.2 **`scope: 'all'` processing is structurally broken** (crash half resolved by D37, 2026-07-06): the `projectAIIndex.upsert` throw is gone with the table, and scope-all chunking now runs to completion — but the flat-checkpoint accumulation persists all projects' chunks against ONE entity (verified live 2026-07-06: 79 chunks from 4 projects landed under the last project's entity). Fix = per-project persistence loop (or per-project sub-operations). Until then use per-project scope.
- [ ] 6.3 **Queue entry status never updates without an SSE subscriber**: a completed operation stays `queued` in `JobQueueManager` unless a `?sse=true` subscription was attached (status transitions appear to ride the progress-subscription callback). Decouple queue status from SSE subscription.
- [ ] 6.4 **Unauthenticated cost-incurring route**: `POST /api/admin/semantic/processing/start` (and the start of stage operations generally) has no session check while sibling routes (`processing/queue`) do — anyone who can reach the dev/staging server can trigger OpenAI spend. Gateway (Phase 2, D33) is the systemic fix; an interim `getServerSession` guard is cheap and worth it.
- [x] 6.5 **done 2026-07-06 (Wave 1)**: auto-ingestion dropped from `prisma/seed.ts` (both the project-indexer and ContentIngestionPipeline blocks); ingestion is per-project via `POST /api/admin/semantic/processing/start` as documented in CLAUDE.md. 3 leftover tier-4 chunks deleted from the dev DB (D27).

### Phase 2 — cost unification

- [x] 2. Write actuals to the unified ledger (D32) — **done 2026-07-07 (Phase 4 preflight)**
  - [x] 2.1 Embedding/summary actuals already flowed to `AIUsageLog` (feature `semantic`) from `BudgetAwareAIOperations`, `StageBasedProcessingService`, `ContentSearchService` (landed with Phase 2, never ticked). Last gap closed this session: `BatchEmbeddingService.processBatchResults` now prices actuals via `estimateCost(job.model, usage)` (batch = 0.5× standard, provider-policy constant) and writes a `usageType: 'embedding_batch'` ledger row; budget `deductCost` stays as the pre-flight gate's accounting.
  - [x] 2.2 Estimation ceremony consolidated onto the pricing module: all per-file rate tables deleted (`CostEstimationService` 3 tables, `SelectiveSectionRegenerator`, `ContentChangeDetector`, `SmartContentGenerator`, `ContentIngestionService`, `ChunkingConfigService` inline literals, `BatchEmbeddingService`, `BulkOperationsService`). Pre-flight estimates now resolve `default-embedding`/`default-cheap` through the registry via new `getPreflightRates()` (+ `listEmbeddingPricing()` for the frozen model-comparison endpoint, fake-provider rows excluded) in `src/lib/ai/pricing.ts` — a registry/pricing edit changes estimates with no deploy. Verified live: `getPreflightRates()` returns seeded rates; `estimateRegenerationCost({scope:'all'})` and `compareEmbeddingModels` produce real numbers from the dev DB. Residual (documented, deliberate): `costPerToken` config field (ChangeDetectionConfig + ChangeDetectionConfigService seed) is stored/roundtripped but unused in any math — vestigial knob, remove with a future change-detection panel touch.
  - _Requirements: 6_

### Phase 3 — one index, hygiene

- [x] 3. Retire `ProjectAIIndex` (D37) — **done 2026-07-06 (Wave 4)**
  - [x] 3.1 Migration `20260707020000_retire_project_ai_index`: technologies → `content_entities.technologies` (where empty), keywords/topics → T1 chunk metadata, summary → new T1 chunk where missing; applied clean, zero drift
  - [x] 3.2 `BackendToolService`'s aiIndex read removed (sectionsCount derived from heading hierarchy); `content-source-manager`'s project search now calls `ContentSearchService` directly (the `/api/projects/search/ai-context` fetch-self route deleted — its only consumer)
  - [x] 3.3 All deleted (`content-ingestion.ts` + barrel died in Wave 1); plus `project-indexing-status.tsx`, `/api/projects/[slug]/index`, `/api/projects/index/batch`, sidebar link, 20 dead scripts incl. `setup-pgvector.ts` (superseded by D54 init migration)
  - [x] 3.4 FK + column + `project_ai_index` table dropped in the same migration (data salvage runs first)
  - [x] 3.5 Verified: fixture cleanup → 4-stage re-ingestion through the new write path (12/12 chunks, expected tier distribution, all embedded) → `check:semantic` PASSED incl. live canonical query; `migrate diff` zero drift; no imports of deleted modules (type-check green)
  - [x] 3.6 The live hierarchical Tiptap parsing was extracted to `src/lib/content/HierarchicalContentParser.ts` — the single content-structure entry point the 7 semantic services consume (D48 seam). Non-structural reads (project metadata) still hit Prisma directly; acceptable, noted.
  - _Requirements: 8; registry D48(d)_

- [x] 4. Delete one-off diagnostic routes (D42) — **done 2026-07-06**: all 9 deleted; `diagnostics`, `diagnostics/t3`, `dashboard` kept (dashboard verified live post-D37: real per-project tier data)

### Phase 3 — retrieval quality

- [x] 5. Hybrid retrieval (D29) — **done 2026-07-07**
  - [x] 5.1 Generated tsvector + GIN index on `context_chunks` (migration `20260707040000_chunk_fulltext`, zero drift); the full-text half always runs beside pgvector in `ContentSearchService`; fusion is a **weighted union** — semantic hits keep their cosine spread, full-text-only hits inject at a ts_rank-derived 0.55–0.90 similarity, both-halves agreement gets +0.05. (Plain RRF was tried first and rejected: rank-flattened scores broke the canonical query's tier≥2 ranking — caught by check:semantic.)
  - [x] 5.2 Acceptance verified live: "glaze chemistry" → Glaze Chemistry Database, "ESP32"/"FreeRTOS" → Firmware Architecture, project name → fixture project; canonical natural-language query still 14/14
  - _Requirements: 5.2_

### Phase 4 — retrieval visibility (added 2026-07-07)

- [x] 8. SQL-level `publicOnly` visibility filtering (with mcp-server Req 3.2) — **done 2026-07-07 (Phase 4 Block B)**
  - [x] 8.1 `ContentSearchParams.publicOnly`/`ContentGetParams.publicOnly`: PUBLIC-project predicate in the vector search (`VectorOperations.semanticSearch`), the full-text half, the metadata fallback, and `getContent` id filtering; non-project entities (BIO/SKILLS/…) always public. Threaded from `BackendToolService` (`accessLevel==='basic'` → publicOnly; caches visibility-scoped). **This closed a live leak: the public chat tier could retrieve PRIVATE-project chunks** (manifest Phase 4 surprise #11). Verified live: fixture PRIVATE → 9→0 search results; canonical `check:semantic` still green.
  - _Requirements: 5; mcp-server Req 3.2/3.6_

### Hygiene — DB (cross-cutting, no dependencies; do when convenient)

- [x] 7. Collapse migrations to a single fresh `init` (D54) — **done 2026-07-03**
  - [x] 7.1 Single `20260703220000_init` generated from `schema.prisma`. Prisma's `migrate diff --from-empty` already emits `CREATE EXTENSION IF NOT EXISTS "vector"` (positioned before the vector columns), so the extension is **automatic**; the one hand-patch is the HNSW index (`USING hnsw (embedding_vector vector_cosine_ops) WITH (m=16, ef_construction=64)`), which Prisma emits as a btree. All 8 prior migrations + the stray `setup-pgvector.sql` removed.
  - [x] 7.2 Verified on a **truly empty DB** (dropped, no extension): `migrate deploy` applied the init clean; `migrate diff` shows zero drift; extension present; HNSW index confirmed `USING hnsw`; base seed + fixture seed run clean.
  - [x] 7.3 Automation: `npm run db:reset` (= `prisma migrate reset` + fixture) with a `prisma.seed` hook so reset re-provisions extension + HNSW and reseeds in one command. (Prisma's AI-agent guardrail blocks `migrate reset` for assistants; works in a human terminal.)
  - _Requirements: registry D54_

## Backlog

Multi-embedding-model A/B (model-comparison endpoint exists; keep frozen); cross-project T0 variants; per-audience summaries (reflink personalization) — needs a registry decision.
