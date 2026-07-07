# ai-admin — Tasks

**Status:** current
**Owner domain:** model registry, pricing, reasoning adapters, editing AI
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)
**Ledger regenerated from code truth per D36. The completed ai-architecture-redesign work (env keys, `AIModelConfig`, `AIGeneralSettings`, admin AI settings page) is history, not tasks.**

---

## Already implemented (verified on branch)

Env-based provider keys with status/masking/test-connection; OpenAI + Anthropic providers behind `service-manager`/`provider-factory`; canonical editing endpoints (`edit-content`, `improve-content`, `process-prompt`, `suggest-tags`) with structured responses; **editor abstraction (`lib/ai/editors/`): files exist but are UNWIRED — zero component imports; the Tiptap AI panel talks to the endpoints directly. Wire-or-delete decision belongs to task 4.3 (Phase 3 manifest cross-reference §2)**; `AIModelConfig`/`AIGeneralSettings` persistence; admin AI settings UI; error handler + availability checker + per-instance status cache. Since Phase 2: `AIModelAlias`/`AIModelPricing` tables + `resolveModelAlias()` (`src/lib/ai/model-registry.ts`, 5 aliases, fail-closed) feed the gateway/chat/embeddings paths; `src/lib/ai/pricing.ts` `estimateCost()` is the single cost function for all ledger writes (D38); reasoning-adapter seam started (`src/lib/ai/reasoning/`: interface + OpenAI + Fake — task 4 extends it with Anthropic/Google and migrates the editing endpoints).

## Open tasks

### Phase 3

- [x] 1. Model registry + role aliases (D4) — **run-path complete 2026-07-07; residual = estimation tables + config-layer defaults (itemized in 1.2)**
  - [x] 1.1 `AIModelAlias` + `resolveModelAlias()` (Phase 2) + new `resolveAliasOrModelId()` (config may hold an alias or a pinned id); admin UI: `ModelAliasPanel` on /admin/ai over `/api/admin/ai/model-aliases` (GET/PUT, admin-gated, cache-busting) — model switch is a save, no deploy (verified live)
  - [x] 1.2 Every model reference that SELECTS a model to run resolves via the registry or admin DB config: gateway chat + embeddings (Phase 2), BudgetAwareAIOperations choke points, SummaryGenerationService config templates (now store aliases), ContentIngestionService/SmartContentGenerator raw calls, StageBasedProcessingService, voice mints via `VoiceProviderConfig`; hardcoded ElevenLabs agent ID removed (ai-assistant 5.1a). **Residual (selects nothing / config seeds — follow-ups named):** pre-flight estimation pricing tables in CostEstimationService + ChunkingConfigService (consolidate under `semantic-content` 2.2 + task 3.2 below), VectorOperations embedding-provenance column default (records what ran), admin dropdown option lists + voice serializer/type defaults (config-layer seeds; migrate when dropdowns read `available-models`), provider `getAvailableModels` lists (they ARE the refresh source)
  - [x] 1.3 Refresh surface: `/api/admin/ai/available-models` + `/api/admin/ai/providers/refresh` list provider models for admin selection; the alias registry is the mapping the system resolves through
  - [x] 1.4 Acceptance: grep shows remaining IDs only in tests, estimation tables, and config-layer defaults (all itemized above); chat + embeddings + summaries resolve via aliases (verified live via /api/ai/chat `_debug.model` alias-to-resolved and check:semantic re-ingestion); voice resolves via admin DB config
  - _Requirements: 2_

- [x] 2. Fix Anthropic capability table (D40) — **verified resolved 2026-07-07**
  - [x] 2.1 No false capability gating exists in live code (the false table lived in the archived Gen-1 spec docs, corrected by regeneration; the admin UI's Anthropic `disabled` props gate on env-key presence, which is correct). The D39 reasoning-adapter layer (task 4.2) implements Anthropic tool use when it lands.
  - _Requirements: 4.2_

### Phase 2 (pricing is needed by the gateway ledger — build early)

- [x] 3. Pricing module (D38) — **spend path complete (Phase 2, 2026-07-05; ticked 2026-07-07); residual = estimation tables + admin rates UI, itemized in 3.2**
  - [x] 3.1 `src/lib/ai/pricing.ts` + `AIModelPricing` table + `estimateCost()` as the only cost function; unknown models price at the most expensive known rate (never free); rates are DB rows seeded in `prisma/seed.ts`. **Residual:** no admin API/panel for editing rates yet — clone the `ModelAliasPanel`/`model-aliases` pattern when wanted; until then rates edit via Prisma studio.
  - [~] 3.2 **Every path that WRITES the ledger** uses `estimateCost()` — local cost tables deleted from `BudgetAwareAIOperations` (embeddings + summaries), `StageBasedProcessingService`, `ContentSearchService` (query embeddings). **Remaining constants are pre-flight ESTIMATION tables only** (select nothing, spend nothing): `SelectiveSectionRegenerator`, `ContentChangeDetector`, `SmartContentGenerator` (cost-saved estimates), `ChunkingConfigService`, `CostEstimationService`, `ContentIngestionService` (legacy, D27 deletion path), and both `service-manager` providers (2024-vintage rates — superseded by task 4.2). Consolidate the estimation tables onto `estimateCost()` with `semantic-content` 2.2 (cross-referenced from ai-admin 1.2 residual).
  - [x] 3.3 Every ledger write prefers provider `usage` (chat adapter, summaries, embeddings all read `response.usage`); char/4 lives only in pre-flight estimates (`estimateTokensFromChars`). **Residual:** the editing endpoints meter the providers' self-computed cost (their stale constants) — resolves when task 4.2 moves usage reporting into the adapter layer.
  - [x] 3.4 `OPENAI_PRICING_REFERENCE.md` / `PRICING_UPDATE_SUMMARY.md` verified absent from the repo root (removed with the Phase 3 hygiene sweep).
  - _Requirements: 3_

### Phase 4

- [ ] 4. Reasoning-model adapter layer (D39)
  - [ ] 4.1 Define the adapter interface; evaluate AI-SDK-backed vs extended hand-rolled implementation (contained diff wins)
  - [ ] 4.2 OpenAI + Anthropic + **Google** adapters; usage reporting into the ledger
  - [ ] 4.3 Migrate editing endpoints onto the layer; `default-reasoning` consumers (job analysis, MCP deep tools) plug in
  - [ ] 4.4 Acceptance: admin editing works via any configured provider; alias switch requires no deploy
  - _Requirements: 4_

## Backlog

Editing-session history persistence beyond the session (deliberately ephemeral); additional providers behind the adapter interface.
