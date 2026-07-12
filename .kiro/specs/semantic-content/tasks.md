# semantic-content — Tasks

**Status:** current — all open tasks closed 2026-07-12 (bulk-operation reliability gate passed)
**Owner domain:** T0–T3 semantic pipeline, search, budgets, dashboard
**Last verified against code:** 2026-07-12 (scope-finalization session — drills run live)
**Ledger regenerated per D36 (the old spec's duplicate "Task 15" is gone by regeneration). The semantic-system-fixes spec is archived; its unresolved items lived here as verification tasks and are now closed.**

---

## Already implemented (verified on branch)

T0–T3 heading-bounded generation with contextual prefixes and section hashes; stage-based resumable processing with SSE progress and queue; pgvector + HNSW storage and reindexing (incl. force rebuild); `ContentSearchService` (similarity × importance, MMR); change detection with configurable thresholds; summary generation with DB-backed config; budget gate + cost estimation; Batch API embedding jobs; full admin dashboard (tree, chunk editor with AI edit, configs, bulk ops, diagnostics service + `npm run diagnostics`).

**2026-07-12 (Req 9 closure):** durable operation state machine (`SemanticProcessingOperation` table + `ProcessingOperationStore`; every stage/terminal transition writes durably BEFORE SSE notification; queue + SSE are read-only projections; in-memory `JobQueueManager` deleted); `scope:'all'` runs the verified single-project pipeline as durable child operations (`parentId` linkage) with parent aggregating immutable per-project outcomes only; cumulative parent T2 summaries (scaffold auto-populate decides on the SUBTREE; summaries stage runs T2s bottom-up via shared `summary-source.ts`, source = own T3 prose + child T2 summaries, provenance recorded in `metadata.summarySource`); `SelectiveSectionRegenerator` rebuilt (post-D37 `project_index_id` crash fixed, singleton, ancestor-chain invalidation: child edit re-summarizes + re-embeds parent T2 chain and T1 while siblings stay untouched); parser TTL-cache busted before scaffold (stale-content regeneration bug found by the drill); embedding model id recorded from the actual provider result (two hardcoded `text-embedding-3-small` writes removed, D4); embedding ledger rows carry `metadata.operationId` for correlation.

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
- [x] 6.2 **`scope: 'all'` FIXED + drilled — done 2026-07-12.** The flat cross-project accumulator is gone: `executeAllProjectsProcessing` enumerates PUBLIC projects with content and runs the verified single-project stage pipeline once per project as a durable CHILD operation (`{parent}-pN`, `parentId` set), each with its own entity resolution, checkpoints, and error state. The parent never holds chunks — it aggregates immutable per-project outcomes (`childOutcomes` json: slug, status, counts, cost, error). A failed project fails its child + (after all projects run) the parent; surviving projects complete. `scope:'all'` is now permitted (reliability gate task 10 passed); the dashboard's scope-all panel stands.
  - [x] 6.2.1 Per-project persistence unit = child operation rows on `semantic_processing_operations`; parent aggregates outcomes only.
  - [x] 6.2.2 `npm run drill:scope-all` (scripts/drill-scope-all.ts): four-project drill (kiln fixture + 3 marker-vocabulary drill projects; other PUBLIC projects temporarily privatized so the REAL enumeration sees exactly four — restore in finally). Run 1 injects a scaffold throw on project #2: parent failed, 1/4 child failed with the injected error, 3/4 completed, zero cross-marker contamination, per-project outcomes recorded. Run 2 re-runs clean: all completed, all embedded, isolation holds. **PASSED 2026-07-12** (fake embeddings + stubbed summaries — persistence topology under test; real-AI path covered by task 10's drill).
- [x] 6.3 **Queue status decoupled from SSE — done 2026-07-12.** New `SemanticProcessingOperation` model (migration `20260712063453`) + `ProcessingOperationStore`: `startProcessing` creates the row; every stage transition and terminal status is written durably FIRST, then notified (throttled opportunistic writes for per-item progress). The queue route is a read-only projection of the table (in-memory `JobQueueManager` deleted); the SSE route serves a persisted snapshot on connect (terminal → snapshot + close), supports multiple subscribers with per-client unsubscribe, and can never cause a transition. `getProgressOrPersisted` falls back to the durable row after cleanup/restart; `resumeProcessing` reconstructs scope/projectId/stages from the row (the old reconstruction hardcoded `scope:'project'` with no projectId). Regenerations persist to the same table (`type:'regeneration'`).
  - [x] 6.3.1 All transitions on the durable write path; subscriptions observe only.
  - [x] 6.3.2 Drilled twice: drill-scope-all (no subscriber at all + fresh-instance snapshot equality) and drill-semantic-reliability (HTTP: SSE attach → deliberate mid-run disconnect → completion with no subscriber → queue API shows completed → SSE reconnect first event = persisted terminal snapshot, equal to the queue projection, stream closes). **PASSED 2026-07-12.**
- [x] 6.4 **Cost-incurring semantic starts are gateway-protected** — verified against current routes 2026-07-11: `POST /api/admin/semantic/processing/start` and the other semantic mutation routes use `withAIGateway({ feature: 'semantic', publicAllowed: false })`; `access-and-cost` task 2.2 and `check:gateway` own the systemic invariant. The former unauthenticated-route finding is resolved.
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

### Ingestion quality — hierarchical summarization (added 2026-07-09)

- [x] 9. **Cumulative parent T2 summaries — done 2026-07-12.** Fixed at both defect sites:
  - Scaffold (`SmartContentGenerator.createT2ChunkOrPlaceholder`): the auto-populate decision is made on the CUMULATIVE subtree (own T3s + every descendant heading's T3s via `getDescendantHeadingAnchorIds`); a small parent-with-children now auto-populates with the whole subtree verbatim, a large one becomes an AI placeholder. `metadata.hasChildSections` recorded.
  - Summaries stage: T2s processed bottom-up (deepest first, T1 last — `orderSummaryChunksBottomUp`), parent source = own T3 prose + direct child T2 summaries (`buildT2SummarySource` in the new shared `src/lib/content/summary-source.ts`; DB-loaded chunks get parent uuids normalized to logical ids first). Provenance persisted as `metadata.summarySource = {ownT3Count, childChunkIds}` — asserted deterministically by check:semantic.
  - [x] 9.1 `"Covers:"` fallback retired to the truly-empty subtree (no own prose AND no child content); fallback-resolved chunks now flow into modifiedChunks so they persist + re-embed in summaries-only runs.
  - [x] 9.2 Modified parents re-embed via the summaries checkpoint (unchanged path, verified); `SelectiveSectionRegenerator` REBUILT: the old `regenerateSectionContent` crashed post-D37 (raw INSERT into dropped `project_index_id`) and never touched ancestors. New `regenerateSectionsWithAncestors`: fresh scaffold (parser cache busted — TTL cache served pre-edit content, caught live by the drill), affected set = changed sections' subtrees + parent-T2 chain + T1, bottom-up summaries via the SAME shared source-builder, per-chunk re-embedding (shared `chunk-embedding.ts`, ledger-correlated), manual-edit chunks preserved, stale subtree rows purged. Singleton accessor added (routes previously built separate instances, so regeneration SSE could never see progress).
  - [x] 9.3 Fixture extended with a nested subtree (Glaze Chemistry Database H2 → 2 H3 children, `### ` converter added); `expected-semantic.json` re-pinned (T2=7, T3=7±2, `cumulativeParents` assertions for `chrono-kiln-controller` + `glaze-chemistry-database`); `check:semantic` extended (parent content real + not "Covers:", parent linkage, AI provenance covers children / auto-populated contains child text). **22/22 assertions green 2026-07-12 incl. live canonical query.**
  - Related: the voice-UX suggestion doc (`docs/voice-conversation-ux-improvements-2026-07-09.md` S3) wants T2 search results to carry a real gist — the ingestion-side half is now in place.

### Scope-finalization verification

- [x] 10. Semantic operation reliability gate — **PASSED 2026-07-12**; `scope:'all'` is enabled. `npm run drill:semantic-reliability` (scripts/drill-semantic-reliability.ts, HTTP against the dev server with real AI, blast-radius-contained to the 4 drill projects): scope-all ingest of kiln (nested H2→H3) + 3 drill projects → SSE attach + deliberate mid-run disconnect → completion with NO subscriber → queue API projection completed with 4 completed children + per-project outcomes → SSE reconnect returns the persisted terminal snapshot equal to the queue projection and closes → ledger rows correlated via `AIUsageLog.metadata.operationId` → child H3 edit + `scope:'section'` regeneration re-summarizes/re-embeds the ancestor chain (celadon T2, glaze T2 with child provenance, chrono T2, T1) while the unrelated sibling (thermal) is untouched → edit reverted, fixture canonical → `check:semantic` 22/22 green. Recipe recorded in the verification spec ledger (task 9 there). 21/21 drill assertions.
  - _Requirements: 3, 9; verification Requirements 5–7_

## Backlog

Multi-embedding-model A/B (model-comparison endpoint exists; keep frozen); cross-project T0 variants; per-audience summaries (reflink personalization) — needs a registry decision.
