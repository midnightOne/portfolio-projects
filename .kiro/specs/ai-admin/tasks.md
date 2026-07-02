# ai-admin — Tasks

**Status:** current
**Owner domain:** model registry, pricing, reasoning adapters, editing AI
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36. The completed ai-architecture-redesign work (env keys, `AIModelConfig`, `AIGeneralSettings`, admin AI settings page) is history, not tasks.**

---

## Already implemented (verified on branch)

Env-based provider keys with status/masking/test-connection; OpenAI + Anthropic providers behind `service-manager`/`provider-factory`; canonical editing endpoints (`edit-content`, `improve-content`, `process-prompt`, `suggest-tags`) with structured responses; editor abstraction with Tiptap adapter, selection-targeted edits, review-before-apply; `AIModelConfig`/`AIGeneralSettings` persistence; admin AI settings UI; error handler + availability checker + per-instance status cache.

## Open tasks

### Phase 3

- [ ] 1. Model registry + role aliases (D4)
  - [ ] 1.1 Alias mapping storage + `resolveModel(alias)`; admin UI for alias assignment
  - [ ] 1.2 Remove hardcoded model IDs/enums across code (incl. voice serializers, ElevenLabs agent ID with `ai-assistant` task 5); dropdowns read the registry
  - [ ] 1.3 Provider model-list refresh endpoints wired to registry
  - [ ] 1.4 Acceptance: grep finds no model IDs outside seed/config; voice + chat + embeddings resolve via aliases
  - _Requirements: 2_

- [ ] 2. Fix Anthropic capability table (D40) — cheap, do with task 1
  - [ ] 2.1 `tool use: yes, vision: yes, JSON via tool-forcing`; delete the false capability gating
  - _Requirements: 4.2_

### Phase 2 (pricing is needed by the gateway ledger — build early)

- [ ] 3. Pricing module (D38)
  - [ ] 3.1 `pricing.ts`/table + `estimateCost()`; admin-editable rates
  - [ ] 3.2 Replace local constants in `SelectiveSectionRegenerator`, `ContentIngestionService`, `ChunkingConfigService`, `ContentChangeDetector`, `SmartContentGenerator`, `CostEstimationService`, `BudgetAwareAIOperations`, both providers (grep for stragglers)
  - [ ] 3.3 Accounting from provider `usage` where available
  - [ ] 3.4 Delete `OPENAI_PRICING_REFERENCE.md` / `PRICING_UPDATE_SUMMARY.md` root docs (D42) once the module lands
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
