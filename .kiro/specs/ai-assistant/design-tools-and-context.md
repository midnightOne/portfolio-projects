# ai-assistant — Design: Tools & Context

**Status:** current
**Owner domain:** UnifiedToolRegistry, declarative navigation, F-I-D context
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. Tool registry

`UnifiedToolRegistry` (`src/lib/ai/tools/`) defines every tool once with: name (underscores, D17), JSON-schema parameters, description, and `executionContext: 'client' | 'server'`. Registration invariant (D18): **a registered tool must have a working handler** — the registry is the provider-facing truth of capability.

### Server tools (execute via `POST /api/ai/tools/execute` → `BackendToolService`)

| Tool | Backing |
|---|---|
| `content_search(query, limit?)` | `ContentSearchService` (pgvector similarity × importance, MMR; hybrid retrieval planned D29). Results carry `navTarget` for follow-up `ui_intent`. |
| `content_get(id)` / `content_getHierarchy(projectId)` / `content_searchSection(...)` / `content_getRelated(id)` | chunk/hierarchy reads (`semantic-content`) |
| job analysis (reflink only) | reasoning model (D39) + semantic grounding → `AIJobAnalysis` |

The execute route is gateway-wrapped (`access-and-cost`): tier allowlist → rate limit → execute → meter to ledger. **This same chain backs the MCP server's tools (D39)** — implementations live in `BackendToolService`, exposed twice, cloned never.

### Client tools (execute in-browser via `UIManager`)

| Tool | Effect |
|---|---|
| `ui_intent(target, intent, options?)` | Declarative navigation: resolve semantic ID → orchestrate navigation/highlight through `ui-system` primitives |
| `ui_describe()` | Current UI state snapshot from `SemanticIDRegistry` |

Client-tool results return to the model through the server wrapper pattern (server receives the call, instructs the client, reports the outcome), preserving server-side control and metering.

Removed (Phase 3): handler-less `fillFormField`/`submitForm`/`animateElement` registrations (D18), orphaned `content_navigateTo` definition (D19), `UINavigationTools.ts`+`client-tools.ts` merged into one module.

## 2. Declarative navigation

`SemanticIDRegistry`: components self-register stable semantic IDs (project cards, modal, sections) with metadata. `UIManager` resolves `ui_intent` against the registry, plans the transition (open modal / scroll / highlight), and executes through `ui-system` guided-navigation primitives (~0.7s coordinated sequences, spotlight/outline with persistent or timed removal). Interruptions (user acts mid-sequence) resolve the intent early and are reported in the tool result so the model stays truthful about UI state.

## 3. F-I-D passive context

- **Frame** (≤ 400 tokens): where the user is — page, open modal, visible section.
- **Index** (≤ 600): what exists — compact map of available projects/sections.
- **Details** (≤ 1000): what's focused — current item's key content.

`PassiveFIDManager` (client) watches UI state, debounces, caches, and pushes updates; `ContextFrameManager` (server, via `/api/ai/context/fid`) assembles budgeted content from the semantic index. Injection uses **NAV_CONTEXT replace-don't-append**: prior context items are deleted before new ones are added, so long sessions never accumulate stale context. Budgets are D25-fixed.

Design intent: the model orients from pushed context (zero-latency) and spends tool calls only on retrieval beyond the current frame. This is the context-engineering pattern the portfolio showcases — document it visitor-facing in Phase 4.6.

## 4. Server context assembly

`context-provider.ts` (+ `content-source-manager`) is the single server-side context assembler — used at token mint (system prompt) and by `ContextFrameManager`. `context-injector.ts`'s surviving duties fold into it (Phase 3); `context-manager.ts` dies with the Gen-1 stack. Remaining `/api/ai/context/{load,inject,cache}` routes are audited in Phase 3: anything not called by adapters or F-I-D is deleted.

## 5. D41 exploration seam (open)

If a watchdog/in-loop reasoning model is added later, it plugs in as: (a) an internal consumer inside deep `BackendToolService` tools (already allowed), or (b) a parallel transcript subscriber injecting NAV_CONTEXT-style grounded hints — both behind existing seams (tool execute route; context injection contract). Nothing in the current design needs to change to enable either; that is the point of recording the seam.
