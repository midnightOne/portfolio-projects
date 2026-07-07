# ai-admin — Tasks

**Status:** current
**Owner domain:** model registry, pricing, reasoning adapters, editing AI
**Last verified against code:** 2026-07-07 (Phase 4 session — Block A)
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
  - [x] 3.2 **Every path that WRITES the ledger** uses `estimateCost()` — local cost tables deleted from `BudgetAwareAIOperations` (embeddings + summaries), `StageBasedProcessingService`, `ContentSearchService` (query embeddings). **Estimation tables consolidated 2026-07-07 (Phase 4 preflight, with `semantic-content` 2.2):** all pre-flight rate tables in `SelectiveSectionRegenerator`, `ContentChangeDetector`, `SmartContentGenerator`, `ChunkingConfigService`, `CostEstimationService`, `ContentIngestionService`, `BatchEmbeddingService`, `BulkOperationsService` deleted; estimates resolve `default-embedding`/`default-cheap` through `getPreflightRates()`/`listEmbeddingPricing()` (new in `pricing.ts`). The Batch API actuals path now uses `estimateCost()` + writes the ledger. **Sole remaining constants:** both `service-manager` providers' 2024-vintage rates — they die with task 4.2/4.3 (adapter-layer migration of the editing endpoints).
  - [x] 3.3 Every ledger write prefers provider `usage` (chat adapter, summaries, embeddings all read `response.usage`); char/4 lives only in pre-flight estimates (`estimateTokensFromChars`). **Residual resolved 2026-07-07 with task 4.3:** the editing endpoints now meter adapter-reported input/output tokens and let the ledger price them via `estimateCost()`; the providers' stale constants are deleted.
  - [x] 3.4 `OPENAI_PRICING_REFERENCE.md` / `PRICING_UPDATE_SUMMARY.md` verified absent from the repo root (removed with the Phase 3 hygiene sweep).
  - _Requirements: 3_

### Phase 4

- [x] 4. Reasoning-model adapter layer (D39) — **done 2026-07-07 (Phase 4 Block A)**
  - [x] 4.1 Interface kept from the Phase 2 seam (`src/lib/ai/reasoning/types.ts`, +`name` on tool messages for Google). **AI-SDK evaluation decided: extended hand-rolled** — each adapter fits the 50-line interface in ~100 lines (Anthropic via installed `@anthropic-ai/sdk`, Google via native REST `generateContent`, zero new deps); an AI-SDK rewrite would touch every consumer for no needed capability. Recorded in design §4.
  - [x] 4.2 `AnthropicReasoningAdapter` (D40 in practice: tool use + tool_result mapping; JSON via tool-forcing available) + `GoogleReasoningAdapter` (functionDeclarations, schema-key stripping, synthesized call ids, functionResponse keyed by name); factory grew `getReasoningAdapterForModel` + `getReasoningAdapterForAliasOrModel`; `resolveAliasOrModelId` now infers provider from the pricing table (was: hardcoded openai). Providers (`lib/ai/providers/*`) slimmed to key-validation + model listing — **their 2024 rate tables and chat paths are deleted** (closes 3.2/3.3 residuals); Anthropic lists via the live models API (fossilized list gone); new `GoogleProvider` + `GOOGLE_API_KEY` in factory/environment surfaces. Unit coverage: `reasoning/__tests__/reasoning-adapters.test.ts` (mocked SDK/fetch mapping tests, 8 tests).
  - [x] 4.3 All four editing endpoints run `AIServiceManager.{editContent,suggestTags,processCustomPrompt}` → `runAdapterChat` → adapter; `model` in requests may be an alias or pinned id and **defaults to `default-reasoning`**; endpoints meter provider-reported input/output tokens with cost computed by the ledger's `estimateCost()` (metadata records `requestedModel`). `UnifiedModelSelector` offers alias options above the provider lists. **Manifest hold resolved: `lib/ai/editors/*` DELETED** (wiring it = client-side Tiptap plumbing, far larger diff than deletion; the panel always called endpoints directly) — design §1/§5 corrected.
  - [x] 4.4 Acceptance verified live 2026-07-07: (a) fake-mode e2e (`AI_FAKE_MODE=reasoning` → FakeReasoningAdapter, usage propagated, $0 cost); (b) live-fire route e2e — admin login → `POST edit-content` with NO model field → `default-reasoning`→gpt-4o, ledger row `feature=admin-edit, provider=openai, modelUsed=gpt-4o, 183/149 tokens, $0.001948` (id cross-checked from `_debug.usage.ledgerId`); (c) **alias switch no-deploy drill**: flipped `default-reasoning` → gpt-4o-mini in DB, same request served by gpt-4o-mini after the 60s registry cache (cost 20× lower), alias restored; (d) suggestTags via `default-cheap` live (gpt-4o-mini). **Provider caveat (environment, not code):** Anthropic live-fire blocked by the stale ANTHROPIC_API_KEY (clean 401 from the real API — adapter wiring reaches Anthropic correctly); Google has no key yet. Both proven at the mapping level by mocked unit tests; re-run live-fire when the owner provisions fresh keys.
  - _Requirements: 4_

## Backlog

Editing-session history persistence beyond the session (deliberately ephemeral); additional providers behind the adapter interface.
