# ai-admin — Design

**Status:** current — editing path implemented; registry/aliases/adapter-layer sections are target design (Phases 3–4)
**Owner domain:** model registry, pricing, reasoning adapters, editing AI
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)

---

## 1. Current code map

```
src/lib/ai/
  service-manager.ts, provider-factory.ts     # provider orchestration (current)
  providers/{openai,anthropic,base}-provider.ts
  error-handler.ts, status-cache.ts, availability-checker.ts, environment.ts
  editors/                                    # editor abstraction files — EXIST BUT UNWIRED (zero component imports; the Tiptap AI panel calls the editing endpoints directly). Wire-or-delete at task 4.3 (Phase 3 manifest cross-reference §2). Sibling extensions/ was never wired either and was scheduled for deletion.
src/app/api/admin/ai/
  edit-content, improve-content, process-prompt, suggest-tags   # canonical editing endpoints (D23)
  available-models, model-config, providers*, environment-status, test-connection, initialize
```

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

Implementation choice (evaluate at build time): thin wrapper over the Vercel AI SDK (gets streaming/tools/structured-output/usage for free) vs. extending the current hand-rolled providers. Constraint either way: the **interface** is ours, consumers never import provider SDKs directly, and the voice adapter family stays separate.

Consumers and their aliases:

| Consumer | Alias |
|---|---|
| Admin editing AI | `default-chat` |
| Public text chat tier (`access-and-cost`) | `default-cheap` |
| Deep server tools / job analysis (`ai-assistant`), MCP deep tools | `default-reasoning` |
| Semantic pipeline summaries/embeddings (`semantic-content`) | `default-chat` (summaries) / `default-embedding` |

This is the D39 unification: one adapter family, admin-selectable models, consumed everywhere a classic LLM is needed — the voice↔reasoning orchestration question (D41) layers on top of this without changing it.

## 5. Editing AI flow (implemented)

Editor selection/context → endpoint (D23) → provider call with system prompt + project context → structured response `{reasoning, changes, confidence, warnings}` → editor adapter applies via review-before-apply → undo history. Editor abstraction (`src/lib/ai/editors/`) keeps the AI panel decoupled from Tiptap specifics.

## 6. Serverless notes (D43)

`status-cache` and availability checks are per-instance memoization — correctness never depends on them; DB/env are re-read on cold start. No cross-instance invalidation is assumed.
