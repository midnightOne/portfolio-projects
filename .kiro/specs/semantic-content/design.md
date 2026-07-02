# semantic-content — Design

**Status:** current — describes implemented system (verification pending, see tasks)
**Owner domain:** T0–T3 semantic pipeline, search, budgets, dashboard
**Last verified against code:** 2026-07-02 (`e2d75b4`)
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

~27 services under `src/lib/content/` (generation, ingestion, staging, vectors, search, summaries, budget/cost, diagnostics). Key ones: `SmartContentGenerator`, `ContentIngestionService`, `StageBasedProcessingService`, `VectorOperations`, `ContentSearchService`, `SummaryGenerationService`, `SelectiveSectionRegenerator`, `ContentChangeDetector`, `SemanticDiagnosticService`.

## 2. Data model

See `prisma/schema.prisma` (truth for shapes): `ContentEntity` (indexed entity), `ContextChunk` (tier, content, embedding `vector(1536)`, importance, sectionHash, metadata; HNSW-indexed), `SemanticOperation`/`SemanticBudget` (processing + pre-flight gate), `ChunkingConfig`, `SummaryGenerationConfig`/`Log`, `BatchEmbeddingJob`. `ContextChunk.projectIndexId` is a legacy bridge to `ProjectAIIndex` — dropped with D37.

## 3. Retrieval

`ContentSearchService.search(query, {limit, tiers?, projectId?, publicOnly})`:
1. Embed query (`default-embedding` alias).
2. pgvector cosine top-K (HNSW) with importance weighting.
3. MMR diversification.
4. **Planned (D29):** fuse with tsvector keyword results (reciprocal-rank fusion) before MMR.
5. Map to results carrying content, tier, project/section linkage, `navTarget`.

Visibility filtering happens in SQL, not post-hoc — public sessions can never retrieve PRIVATE content.

## 4. Budgets & cost (post-D32 shape)

`SemanticBudget` remains the pre-flight gate (block/warn before expensive operations). Actuals: every embedding/summary call writes tokens + cost (shared pricing module, D38) to `AIUsageLog` — the same ledger the watchdog reads. `SemanticOperation` keeps operational telemetry (stages, timing), not authoritative cost. Batch API path (`BatchEmbeddingJob`) persists for non-urgent bulk embedding at 50% discount; see batch docs for the split criteria (urgent → sync, bulk → batch).

## 5. Admin dashboard

`/admin/semantic`: health dashboard, per-project tree (T0→T3), chunk editor with AI-assisted edit + summary regeneration, chunking/summary/change-detection config editors, processing start/queue/operation views (SSE), budget panel, bulk ops (regenerate/importance/cleanup/export/import), model comparison, force reindex. Diagnostics via `SemanticDiagnosticService` + `npm run diagnostics`.

One-off diagnostic routes to delete (D42, Phase 3): `test-search-newchunks`, `trace-search-flow`, `which-entities-have-embeddings`, `inspect-vector`, `compare-embeddings`, `compare-chunk-structure`, `search-diagnostic`, `fix-missing-timestamps`, `check-new-embeddings`.

## 6. Serverless constraints (D43)

Long operations are chunked into resumable stages precisely because serverless functions are time-boxed; `SemanticOperation` state lives in Postgres so any instance can resume/report. SSE endpoints re-read operation state — no instance-local operation registry may be correctness-bearing.
