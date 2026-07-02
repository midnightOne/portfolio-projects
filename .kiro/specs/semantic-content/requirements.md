# semantic-content — Requirements

**Status:** current — implemented; end-to-end verification pending (absorbed the open semantic-system-fixes items)
**Owner domain:** T0–T3 semantic index: chunking, summaries, embeddings, stage-based processing, semantic search, budgets, semantic admin dashboard
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D27 (T0–T3), D28 (chunking defaults), D29 (embedding + hybrid retrieval), D32 (ledger integration), D37 (ProjectAIIndex retirement), D38 (pricing module)
**Contracts:**

| Consumes | From |
|---|---|
| `ArticleContent.jsonContent` (Tiptap JSON) + save-triggered change detection | `rich-content`, `admin-cms` |
| Model aliases (`default-embedding`, `default-chat`) + pricing `estimateCost()` | `ai-admin` |
| Usage ledger for actual spend (D32) | `access-and-cost` |
| Admin shell | `admin-cms` |

| Provides | To |
|---|---|
| `ContentEntity`, `ContextChunk`, `SemanticBudget`, `SemanticOperation`, `ChunkingConfig`, `SummaryGenerationConfig`, `SummaryGenerationLog`, `BatchEmbeddingJob` models | — |
| `ContentSearchService` (semantic search) | `ai-assistant` server tools, `mcp-server` |
| `/api/admin/semantic/*` dashboard APIs | semantic admin UI |

Supporting docs in this folder: `HEADING_BOUNDED_CHUNKING.md` (chunking design deep-dive), `BATCH_API_STRATEGY.md`, `BATCH_API_INTEGRATION.md`, `BATCH_MODE_UI_INTEGRATION.md` (OpenAI Batch API embedding cost optimization).
Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Tier structure (T0–T3, D27)

**User story:** As the owner, I want a simple, explainable content hierarchy, so that AI navigation and retrieval are predictable.

1. THE tier model SHALL be exactly: **T0** portfolio overview (one chunk), **T1** project summary (one per project), **T2** section summaries, **T3** heading-bounded content chunks. No T4 exists; legacy T0–T4 code is deleted (Phase 3).
2. WHEN chunks are stored THEN each SHALL carry tier, project/section linkage, importance score, section hash, and a 1536-dim embedding (pgvector).

## Requirement 2 — Heading-bounded chunking (D28)

**User story:** As the owner, I want section-scoped chunks, so that editing one section never invalidates others.

1. WHEN T3 chunks are generated THEN boundaries SHALL respect headings (`respectHeadingBoundaries: true`); oversized sections split by paragraph with `sectionBoundaryOverlap: 25` tokens **within the section only**.
2. Defaults (DB-backed `ChunkingConfig`; code wins over docs): `targetChunkSize: 300`, `maxSectionSize: 500`, `minSectionSize: 50`, `splitStrategy: 'paragraph'`; T1 summary ≤ 200 tokens, T2 ≤ 150.
3. WHEN chunks are embedded THEN a contextual prefix (`Project: {title} | Section: {heading}`) SHALL be prepended before embedding.
4. WHEN a section's hash is unchanged THEN its chunks SHALL NOT be regenerated (surgical regeneration).

## Requirement 3 — Stage-based processing

**User story:** As the owner, I want resumable, observable index generation, so that long operations are trustworthy.

1. WHEN ingestion runs THEN it SHALL proceed through explicit stages (chunk → summarize → embed → validate) persisted per-operation (`SemanticOperation`), resumable after failure, with per-stage progress.
2. WHEN operations run long THEN progress SHALL stream via SSE surviving ≥ 10-minute operations (reconnection with backoff; status recoverable after connection loss).
3. WHEN operations complete THEN chunks SHALL be verified persisted (post-storage validation) and the queue/history panel SHALL reflect the run.
4. WHEN embeddings are written THEN HNSW indexes SHALL be maintained (reindex support incl. force rebuild).

## Requirement 4 — Change detection

**User story:** As the owner, I want minor edits to avoid full regeneration, so that upkeep is cheap.

1. WHEN a project saves THEN change detection SHALL compare section hashes and classify scope (none / section / structural), regenerating only affected chunks and summaries.
2. Thresholds live in `ChangeDetectionConfigService` (code canonical, D29).

## Requirement 5 — Semantic search

**User story:** As the AI assistant (and MCP clients), I want relevance-ranked retrieval, so that answers are grounded.

1. WHEN search executes THEN `ContentSearchService` SHALL rank by cosine similarity × importance weighting with MMR diversification, filtered to PUBLIC visibility for public sessions, returning chunks with `navTarget`s.
2. **Hybrid retrieval (D29, open):** vector similarity SHALL be fused with the existing tsvector full-text index (reciprocal-rank fusion or weighted union) so keyword-exact queries (project names, tech terms) rank correctly.

## Requirement 6 — Budgets and cost (D32/D38, simplified)

**User story:** As the owner, I want spend guardrails without ceremony, so that cost control is real but lightweight.

1. WHEN AI operations run THEN a pre-flight budget gate (`SemanticBudget`) MAY block over-budget operations; actual usage SHALL be written to the **unified ledger** (`AIUsageLog`, D32) using `estimateCost()`/provider usage (D38).
2. WHEN estimates are shown THEN they use the shared pricing module — no local pricing constants.
3. Batch API embedding (50% discount for non-urgent jobs) SHALL remain only where already working (`BatchEmbeddingJob`; see batch docs); no new batch ceremony. Estimation modals/projection services are simplified, not extended (proposal §5 "invert the investment").

## Requirement 7 — Admin dashboard

**User story:** As the owner, I want full visibility and control of the index, so that I can maintain it confidently.

1. WHEN the dashboard loads THEN it SHALL show per-project index health (chunk counts by tier, embedding coverage, staleness), with tree view, chunk editor (incl. AI-assisted chunk edit and summary regeneration), config editors (chunking, summary, change detection), processing queue, and bulk operations (regenerate, importance, cleanup, export/import).
2. WHEN importance is manually set THEN it SHALL persist and influence ranking.
3. Diagnostics: `SemanticDiagnosticService` + `npm run diagnostics` is the sanctioned path; one-off diagnostic API routes are deleted (D42).

## Requirement 8 — One semantic index (D37)

**User story:** As the owner, I want exactly one indexing system, so that there is a single source of retrieval truth.

1. `ContentEntity`/`ContextChunk` IS the semantic index. `ProjectAIIndex` is retired (Phase 3): summary → T1 chunk, keywords/topics → metadata; consumers re-pointed to `ContentSearchService`; `ContextChunk.projectIndexId` FK then the model dropped by migration.
2. The legacy T0–T4 ingestion pipeline (`src/lib/services/content-ingestion.ts`) and `project-indexer.ts` are deleted; `src/lib/content/index.ts` stops re-exporting them.
