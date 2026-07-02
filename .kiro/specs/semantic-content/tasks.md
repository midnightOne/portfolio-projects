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

- [ ] 1. Verify the four historical failure modes on current code (roadmap task 0.5)
  - [ ] 1.1 Ingest one full project through all four stages: T0–T3 chunks persisted with embeddings, valid linkage
  - [ ] 1.2 SSE progress survives a 10-minute operation (reconnect/backoff path exercised)
  - [ ] 1.3 Queue panel reflects active + completed operations
  - [ ] 1.4 Chunks still present after completion (no premature cleanup); T3 titles derived correctly
  - [ ] 1.5 Close out: mark verified here; if anything fails, file targeted fix tasks in this ledger

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
  - _Requirements: 8_

- [ ] 4. Delete one-off diagnostic routes (D42): the 9 routes listed in design §5; keep `diagnostics`, `diagnostics/t3`, `dashboard`

### Phase 3 — retrieval quality

- [ ] 5. Hybrid retrieval (D29)
  - [ ] 5.1 Fuse pgvector similarity with tsvector full-text (reciprocal-rank fusion or weighted union) in `ContentSearchService`
  - [ ] 5.2 Acceptance: keyword-exact queries (project names, tech terms) rank correctly in `content_search`
  - _Requirements: 5.2_

## Backlog

Multi-embedding-model A/B (model-comparison endpoint exists; keep frozen); cross-project T0 variants; per-audience summaries (reflink personalization) — needs a registry decision.
