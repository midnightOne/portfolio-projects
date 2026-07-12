# semantic-content — Design

**Status:** current — describes implemented system (bulk-operation integrity §7 implemented + drilled 2026-07-12)
**Owner domain:** T0–T3 semantic pipeline, search, budgets, dashboard
**Last verified against code:** 2026-07-12
**Deep-dive:** [HEADING_BOUNDED_CHUNKING.md](./HEADING_BOUNDED_CHUNKING.md) · Batch API: [strategy](./BATCH_API_STRATEGY.md), [integration](./BATCH_API_INTEGRATION.md), [UI](./BATCH_MODE_UI_INTEGRATION.md)

---

## 1. Pipeline

```
ArticleContent.jsonContent (Tiptap JSON)
   │  save → ContentChangeDetector (section hashes → none | section | structural)
   ▼
SmartContentGenerator ── heading-bounded T3 chunking (+ contextual prefixes)
   │                     T2 section summaries, T1 project summary, T0 overview
   ▼
StageBasedProcessingService (SemanticOperation: chunk → summarize → embed → validate,
   │                          resumable, SSE progress, queue/history)
   ▼
VectorOperations ── raw SQL pgvector writes, vector(1536), HNSW maintenance
   ▼
ContextChunk / ContentEntity  ──▶  ContentSearchService (similarity × importance, MMR)
                                        ▲ consumed by ai-assistant tools + mcp-server
```

~25 services under `src/lib/content/` (generation, staging, vectors, search, summaries, budget/cost, diagnostics). Key ones: `SmartContentGenerator` (scaffold only — no AI, no provider client), `StageBasedProcessingService`, `VectorOperations`, `ContentSearchService`, `SummaryGenerationService` (rides the M1 secondary-LLM job path), `SelectiveSectionRegenerator`, `ContentChangeDetector`, `SemanticDiagnosticService`. `ContentIngestionService` + the `/api/admin/semantic/ingest` route (the pre-stage-pipeline one-shot path) were deleted 2026-07-12 — `processing/start` is the only ingestion entry point.

## 2. Data model

See `prisma/schema.prisma` (truth for shapes): `ContentEntity` (indexed entity), `ContextChunk` (tier, content, embedding `vector(1536)`, importance, sectionHash, metadata; HNSW-indexed), `SemanticOperation`/`SemanticBudget` (budget accounting + pre-flight gate), `SemanticProcessingOperation` (the durable stage-processing state machine of §7 — one row per operation, `parentId` links scope:'all' children, `childOutcomes` aggregates per-project results; `ProcessingOperationStore` is the single writer), `ChunkingConfig`, `SummaryGenerationConfig`/`Log`, `BatchEmbeddingJob`. `ProjectAIIndex` and the `ContextChunk.projectIndexId` bridge were dropped with D37.

## 3. Retrieval

`ContentSearchService.search(query, {limit, tiers?, projectId?, publicOnly})`:
1. Embed query (`default-embedding` alias).
2. pgvector cosine top-K (HNSW) with importance weighting.
3. MMR diversification.
4. Fuse with tsvector keyword results (weighted union: semantic spread is retained, full-text-only results receive a rank-derived band, agreement receives a small bonus) before MMR.
5. Map to results carrying content, tier, project/section linkage, `navTarget`.

Visibility filtering happens in SQL, not post-hoc — public sessions can never retrieve PRIVATE content.

## 4. Budgets & cost (post-D32 shape)

`SemanticBudget` remains the pre-flight gate (block/warn before expensive operations). Actuals: every embedding/summary call writes tokens + cost (shared pricing module, D38) to `AIUsageLog` — the same ledger the watchdog reads. `SemanticOperation` keeps operational telemetry (stages, timing), not authoritative cost. Batch API path (`BatchEmbeddingJob`) persists for non-urgent bulk embedding at 50% discount; see batch docs for the split criteria (urgent → sync, bulk → batch).

## 5. Admin dashboard

`/admin/semantic`: health dashboard, per-project tree (T0→T3), chunk editor with AI-assisted edit + summary regeneration, chunking/summary/change-detection config editors, processing start/queue/operation views (SSE), budget panel, bulk ops (regenerate/importance/cleanup/export/import), model comparison, force reindex. Diagnostics via `SemanticDiagnosticService` + `npm run diagnostics`.

One-off diagnostic routes were deleted in Phase 3 (D42): `test-search-newchunks`, `trace-search-flow`, `which-entities-have-embeddings`, `inspect-vector`, `compare-embeddings`, `compare-chunk-structure`, `search-diagnostic`, `fix-missing-timestamps`, `check-new-embeddings`. `SemanticDiagnosticService` and the dashboard remain the sanctioned diagnostics surfaces.

## 6. Serverless constraints (D43)

Long operations are chunked into resumable stages precisely because serverless functions are time-boxed; `SemanticOperation` state lives in Postgres so any instance can resume/report. SSE endpoints re-read operation state — no instance-local operation registry may be correctness-bearing.

## 7. Bulk-operation integrity (scope-finalization work)

`scope: 'all'` is a coordinator, never a single cross-project content buffer. It enumerates projects and runs a persistence/validation unit per project (as child operations or durable checkpoints on the parent). Each unit carries its own entity id, chunk-id map, stage checkpoints, errors, and final counts. The parent aggregates only immutable per-project outcomes; it never owns a flat array of chunks that can be written against the final project's entity.

The operation row is the state machine. Worker completion/failure writes the durable transition first; queue/history projections and SSE notifications observe that write afterwards. An SSE disconnect can lose an event but cannot leave a job queued, and reconnect uses the persisted stage/progress/status rather than process-local state.

Summary generation is bottom-up for nested headings: leaf T2 summaries derive from their T3 prose, then each parent receives its own prose plus its completed child summaries (or an equivalent transitive T3 closure). A child content change invalidates the ancestor chain before embedding, so a parent summary and embedding can never describe stale descendants.
