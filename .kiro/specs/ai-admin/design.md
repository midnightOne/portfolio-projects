# ai-admin — Design

**Status:** current — editing path + registry/aliases/pricing + reasoning-adapter layer implemented (Phase 4 Block A, 2026-07-07)
**Owner domain:** model registry, pricing, reasoning adapters, editing AI
**Last verified against code:** 2026-07-07 (Phase 4 session — Block A)

---

## 1. Current code map

```
src/lib/ai/
  service-manager.ts, provider-factory.ts     # provider status/listing orchestration + editing prompt/parse logic
  providers/{openai,anthropic,google,base}-provider.ts   # key validation + model listing ONLY (registry refresh source)
  reasoning/{types,index,openai,anthropic,google,fake}-adapter.ts  # D39 adapter family — ALL chat/completion calls
  model-registry.ts, pricing.ts               # D4 aliases + D38 estimateCost()
  error-handler.ts, status-cache.ts, availability-checker.ts, environment.ts
src/app/api/admin/ai/
  edit-content, improve-content, process-prompt, suggest-tags   # canonical editing endpoints (D23), adapter-backed
  available-models, model-config, providers*, environment-status, test-connection, initialize
```

**Resolved at task 4.3 (2026-07-07):** the never-wired editor abstraction (`src/lib/ai/editors/`, 10 files + tests) was **deleted**, not wired — the Tiptap AI panel has always called the editing endpoints directly, and the adapter-layer migration made the server side provider-agnostic without any client abstraction. §5 below corrected to match.

## 2. Target: model registry + aliases (D4)

- `AIModelConfig` (existing) becomes the registry backbone: per-provider model lists (admin text input + provider-API refresh) and an alias table mapping `default-chat | default-cheap | default-realtime | default-embedding | default-reasoning` → `{provider, modelId}`.
- Resolution API: `resolveModel(alias)` server-side; `ClientAIModelManager` serves resolved config to the client (voice aliases). No literal model IDs outside seed/config — enforced by grep in CI (Phase 3.4 acceptance).
- Enums with dated model lists (serializers, UI dropdown constants) are deleted; dropdowns read the registry.

## 3. Target: pricing module (D38)

`src/lib/ai/pricing.ts` (or table beside `AIModelConfig`): `{model → {inputPerMTok, outputPerMTok, embeddingPerMTok?, batchDiscount}}`, admin-editable, with `estimateCost(model, usage)` as the only cost function. Consumers: `SemanticBudget` pre-flight gates, `CostEstimationService`, regeneration estimates, ledger writes (`access-and-cost`). Accounting prefers provider `usage` (already stored on responses); char/4 stays only in pre-flight estimating. All local constants deleted (the audit found 10+ files).

## 4. Target: reasoning-adapter layer (D39/D40)

One interface (signatures indicative): `chat(messages, {model|alias, tools?, stream?, json?}) → {content, toolCalls?, usage}` with adapters:

| Adapter | Notes |
|---|---|
| OpenAI | port of current provider |
| Anthropic | **kept + fixed** (D40): tool use ✓, vision ✓, JSON via tool-forcing; pricing via §3 |
| Google | new; needed for the adapter-family showcase and D22 parity |

**Implementation choice (decided at build time, 2026-07-07): extended the hand-rolled family, no AI SDK.** The interface is ~50 lines and each adapter fits it in ~100 (Anthropic via the installed `@anthropic-ai/sdk`; Google via native REST `generateContent` — zero new dependencies); an AI-SDK rewrite would have touched every consumer for no capability the seam needs. Constraint held: the **interface** is ours, consumers never import provider SDKs directly, and the voice adapter family stays separate (D48).

Consumers and their aliases:

| Consumer | Alias |
|---|---|
| Admin editing AI | `default-reasoning` (request may pin an id or another alias) |
| Public text chat tier (`access-and-cost`) | `default-cheap` |
| Deep server tools / job analysis (`ai-assistant`), MCP deep tools | `default-reasoning` |
| Semantic pipeline summaries/embeddings (`semantic-content`) | `default-chat` (summaries) / `default-embedding` |

This is the D39 unification: one adapter family, admin-selectable models, consumed everywhere a classic LLM is needed — the voice↔reasoning orchestration question (D41) layers on top of this without changing it.

## 5. Editing AI flow (implemented)

Editor selection/context → endpoint (D23) → **reasoning adapter** (`getReasoningAdapterForAliasOrModel`; request `model` may be a registry alias — default `default-reasoning` — or a pinned id) with system prompt + project context → structured response `{reasoning, changes, confidence, warnings}` → the Tiptap AI panel applies via review-before-apply → editor undo history. Usage is metered from the provider's usage fields; cost only via `estimateCost()` (D38). There is no client-side editor abstraction — the panel talks to the endpoints directly (the unwired `lib/ai/editors/` files were deleted at task 4.3).

## 6. Serverless notes (D43)

`status-cache` and availability checks are per-instance memoization — correctness never depends on them; DB/env are re-read on cold start. No cross-instance invalidation is assumed.
