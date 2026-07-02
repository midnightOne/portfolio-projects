# Architecture & Spec Alignment Proposal

**Status:** DRAFT — awaiting owner review
**Date:** 2026-07-02
**Scope:** All specs in `/specs`, the diverged copy in `/.kiro/specs`, the Prisma schema, and the full `src/` tree (~660 TS files).

This document is the deliverable of a full spec+code audit. It is organized so that, once approved, each phase in Part F can be executed as an independent agent session without loading the whole document set into context.

---

## 0. Executive Summary

The project is further along than the specs admit, and the specs describe more system than the code needs. Three generations of architecture coexist:

1. **Gen 1 — Server-orchestrated AI** (ai-architecture-redesign + early client-side-ai): server-side conversation manager, `ProjectAIIndex`, T0–T4 tiers, "MCP" navigation commands sent from server to client.
2. **Gen 2 — Client-direct voice AI** (client-side-ai "Revised" sections): ephemeral tokens, client ↔ OpenAI Realtime / ElevenLabs directly, `UnifiedToolRegistry`, passive F-I-D context.
3. **Gen 3 — Semantic content system** (semantic-content-management + semantic-system-fixes): T0–T3 heading-bounded chunking, pgvector, budget management, stage-based processing.

Gen 2 and Gen 3 are the ground truth. Gen 1 survives as ~5,000+ lines of code that production UI never reaches, as duplicated spec sections, and as a parallel database indexing system. The single highest-value action of this whole effort is **deleting Gen 1 everywhere** — specs and code — and then writing down what remains as the canonical architecture.

Headline numbers found during the audit:

| Category | Finding |
|---|---|
| Duplicate spec sections | client-side-ai/design.md contains the same T0–T4 section twice; two "Provided APIs" sections; requirements.md has **three different "Requirement 15"s** |
| Parallel DB systems | `ProjectAIIndex` (own embedding vector) coexists with `ContentEntity`/`ContextChunk` |
| Redundant runtime code | 2 near-identical ~700-line ConversationalAgent providers; 3 conversation managers; `context-injector` + `context-provider` + `context-manager` |
| Dead UI surface | 30 `test-*` pages in `src/app`, debug panel mounted on the production homepage |
| Dead scripts/docs | 28 root-level `test-*.js`/`debug-*.js`, ~80 root-level implementation-log `.md` files |
| Debug API routes | 29 routes under `/api/admin/semantic` of which ~9 are one-off diagnostics |
| Spec divergence | `/.kiro/specs` and `/specs` have diverged (Batch API docs exist only in `.kiro`) |

---

## Part A — Inconsistencies *within* the specs

### A1. Broken numbering and duplicated sections

| Location | Problem | Fix |
|---|---|---|
| `ai-system/requirements.md` | Requirements 9 and 10 each appear **twice** (lines ~139–171 and ~173–231). The second set (9–13, tier management) was "moved" to the semantic spec per `ai-system/tasks.md` and `SPEC_SUMMARY.md`, but never deleted. | Delete Requirements 9–13 (the tier set); leave a pointer to `semantic-content-management`. |
| `client-side-ai/requirements.md` | **Three** "Requirement 15"s: (a) declarative navigation/F-I-D, (b) debugging/testing, (c) streamlined architecture. | Renumber; the doc has 21+ requirements in practice. |
| `client-side-ai/design.md` | "Hierarchical Content System (T0-T4 Tiers)" appears twice verbatim (lines ~610 and ~783). Two "Provided APIs" sections (~2017 and ~5991, the latter "Revised"). 6,583 lines mixing superseded and current designs, distinguishable only by "(Revised)" suffixes. | Split and rewrite (see Part E). |
| `client-side-ai/tasks.md` | Task numbers collide: three different tasks numbered **8**, two **7**s, two **9**s, two **10**s. Completion states contradict (e.g., ElevenLabs migration task 4 is `[ ]` but the code migration is done). | Renumber and re-baseline against actual code state. |
| `semantic-content-management/tasks.md` | Two tasks numbered **15** ("Stage-Based Content Processing" `[x]` and "Testing Suite" `[ ]`). | Renumber. |
| `ELEVENLABS_CLIENT_MIGRATION.md` | Two success criteria numbered **6**. | Trivial fix; better: archive the doc entirely (migration is complete — `ElevenLabsAdapter.ts` imports `@elevenlabs/client`). |

### A2. Cross-spec contradictions

1. **T0–T4 vs T0–T3 (the big one).** `semantic-content-management` (and the code) use the simplified T0–T3 heading-bounded structure. But `client-side-ai/design.md` still specifies T0–T4 with `tier: 0|1|2|3|4`, and `ai-system/design.md` carries a full "Hierarchical Content Management System" section with `tier: 0|1|2|3|4` and generation modes. Requirement 15(a) of client-side-ai even says "use tiered content (T0-T4)". **T0–T3 wins everywhere.**
2. **Ownership of ContextChunk.** `ai-system/design.md` says hierarchical content storage is "Required from Client-Side AI System"; `SPEC_SUMMARY.md` says it lives in `semantic-content-management`; the code has it in `src/lib/content/`. **The semantic spec owns it.** ai-system and client-side-ai should reference, not re-specify.
3. **Caching story contradicts itself.** client-side-ai Requirement 6 mandates a "distributed, persistent cache"; the design's "Simplified Caching Strategy" says active conversations are "kept in server-side memory". On Vercel serverless (the stated deployment target in the very first paragraph), per-instance memory is neither distributed nor persistent. The code resolves this correctly for rate limiting (DB-backed, `rate-limiter.ts` uses Prisma) but the spec text must pick one story: **DB-backed persistence + per-instance memoization as best-effort only.**
4. **Server-side vs client-side text chat.** Requirements 1–4, 20 describe a "server-side AI agent" processing text conversations through a unified server pipeline. The revised architecture (and production code) runs text through the same client-direct voice adapters (`sendMessage` on the adapter). The server pipeline (`/api/ai/conversation`) survives only as an admin-debug backend. The requirements must be rewritten to match the client-direct reality (see D2).
5. **specs/README.md is stale.** It lists a `portfolio-projects` spec that doesn't exist and omits `ai-architecture-redesign`, `semantic-content-management`, `semantic-system-fixes`. It also describes a 3-file convention (`requirements/design/tasks`) that half the folders violate.
6. **Two spec trees.** `/.kiro/specs/semantic-content-management` contains three Batch API docs (`BATCH_API_INTEGRATION.md`, `BATCH_API_STRATEGY.md`, `BATCH_MODE_UI_INTEGRATION.md`) that do not exist under `/specs`, while `/specs` has the requirements/design/tasks that `.kiro` lacks. **Pick `/specs` as canonical, move the three batch docs into it, delete `.kiro/specs`.**
7. **ai-architecture-redesign is finished and subsumed.** All tasks `[x]` except a docs task; `ai-system/tasks.md` explicitly says its requirements were migrated. It should be archived, not sit as a sibling of live specs.

### A3. Factual errors frozen into spec text

These matter because agents (and humans) copy them into code:

- `ai-system/design.md` `AnthropicProvider.supports = { jsonMode: false, functionCalling: false, vision: false }` — wrong even for the 2024 models it names; Claude has had tool use and vision since early 2024. Any capability gating built on this table silently disables features.
- Hardcoded pricing tables in the spec (`gpt-4o: $0.03/1k`, `claude-3-5-sonnet: $0.015/1k`) are stale and conflate input/output pricing. The same constants were then copy-pasted into **10+ code files** (see B6).
- Model ID lists (`gpt-3.5-turbo`, `claude-3-opus-20240229`) are two generations old. The spec's own Requirement 2 ("easy addition through the text input interface") is the right instinct — model IDs and prices must be **data, not spec text or code constants**.
- "MCP" is used throughout client-side-ai for what is plain provider function-calling. There is no Model Context Protocol involvement anywhere in the code. Now that MCP is a real, widely-adopted standard, this naming actively misleads. Rename to "client tools / server tools" (which the code's `UnifiedToolRegistry` already does) — or actually expose an MCP server (see D8, optional showcase idea).

---

## Part B — Inconsistencies *within* the code

### B1. Two parallel semantic indexing systems

- **Gen 1:** `ProjectAIIndex` (`prisma/schema.prisma:256`) — per-project summary, keywords, its own `embeddingVector vector(1536)`, `contentTiers Json`. Fed by `src/lib/services/project-indexer.ts`, `src/lib/services/content-ingestion.ts`, exposed via `/api/admin/ai/project-indexing/*`, `/api/projects/[slug]/index`, `/api/projects/index/batch`, consumed by `context-manager.ts` and parts of `BackendToolService.ts`.
- **Gen 3:** `ContentEntity` + `ContextChunk` (`prisma/schema.prisma:517/537`) — the T0–T3 system with HNSW-indexed embeddings, budget tracking, stage-based processing. This is what the semantic admin dashboard and `ContentSearchService` use.
- They are bridged by an optional `ContextChunk.projectIndexId` FK, meaning neither can be deleted without touching the other.

**Verdict:** `ContextChunk` T0/T1 already carry project metadata and summary — `ProjectAIIndex` is redundant. Retire it (D1).

### B2. Legacy T0–T4 ingestion still exported

`src/lib/services/content-ingestion.ts` (1,183 lines) literally documents itself as "the new hierarchical **T0-T4** tier system" and creates `tier: 4` chunks (line 246). It is re-exported from the *new* system's barrel file `src/lib/content/index.ts:27` as `ContentIngestionPipeline` / `LegacyContentIngestionResult`. The current pipeline is `src/lib/content/ContentIngestionService.ts` + `StageBasedProcessingService.ts` (T0–T3). Nothing in production should create tier-4 chunks. **Delete the legacy pipeline.**

### B3. Two ~700-line ConversationalAgent providers

- `src/components/providers/conversational-agent-provider.tsx` (695 lines) — used by the production floating AI interface.
- `src/contexts/ConversationalAgentContext.tsx` (711 lines) — used only by five admin debug components (`VoiceDebugInterface`, `ContextMonitor`, `ToolCallMonitor`, …).

This is the classic fork-instead-of-refactor. The admin debug surface must consume the same provider as production (that's the whole point of debugging production behavior — and spec Requirement "15(b)" #6 explicitly demands "production client-side endpoints for accurate testing"). **Merge into one provider.**

### B4. The orphaned server-side conversation stack

`src/lib/services/ai/` contains a complete Gen-1 server conversation pipeline: `conversation-manager.ts` (758), `unified-conversation-manager.ts` (1,028), `conversation-transport.ts` (590), `context-manager.ts` (630), `context-injector.ts` (448). Production text+voice both flow through client adapters; the only UI reaching `/api/ai/conversation` is `src/app/admin/ai/debug/page.tsx` via `use-unified-conversation.ts`.

Meanwhile the *spec-blessed* pieces — `conversation-history-manager.ts` (persistence, canonical logger per streamlined-architecture requirement) and `context-provider.ts` — coexist with the legacy ones. `context-injector.ts` is still imported by 5 live API routes even though the spec's own "streamlined architecture" requirement #1 says consolidate it into ContextProvider.

**Verdict:** keep `conversation-history-manager`, `context-provider`, reflink/rate-limit/abuse services. Delete or radically shrink the rest (D2/D3). This is roughly 3,500 lines of load-bearing-looking dead weight.

### B5. Debug/test surface shipped as production

- `src/app/page.tsx` mounts `<UIManagerDebugPanel />` on the public homepage.
- 30 `src/app/test-*` routes (theme tests, wave tests, tiptap tests, …) are publicly routable pages.
- `src/components/ai/` ships `budget-draining-test.tsx`, `session-persistence-test.tsx`, `simple-reflink-test.tsx`.
- 28 root-level `test-*.js` / `debug-*.js` ad-hoc scripts (plus `check-db.js`, `assign-thumbnails.js`) sit outside any test runner; the real Jest suites live in `src/**/__tests__`.
- ~9 of the 29 `/api/admin/semantic/*` routes are one-off diagnostics: `test-search-newchunks`, `trace-search-flow`, `which-entities-have-embeddings`, `inspect-vector`, `compare-embeddings`, `compare-chunk-structure`, `search-diagnostic`, `fix-missing-timestamps`, `check-new-embeddings`. They were the debugging trail for the semantic-system-fixes spec, now superseded by `SemanticDiagnosticService` + `npm run diagnostics`.
- `src/app/projects/page.new.tsx` is a dead alternate implementation next to `page.tsx`.

For a showcase repo this is the first thing a reviewer sees. **Delete or quarantine all of it** (D5).

### B6. Copy-pasted pricing and cost constants

Cost-per-token constants are independently declared in at least 10 files (`SelectiveSectionRegenerator.ts` ×10 occurrences, `ContentIngestionService.ts` ×9, `ChunkingConfigService.ts`, `ContentChangeDetector.ts`, `SmartContentGenerator.ts`, `CostEstimationService.ts`, `BudgetAwareAIOperations.ts`, both AI providers…). The repo even contains `OPENAI_PRICING_REFERENCE.md` and `PRICING_UPDATE_SUMMARY.md` documenting a manual update sweep — evidence the duplication already caused pain. **One pricing module** (D6).

### B7. Structural duplication

- `src/services/` (one file: `TranscriptService.ts`) vs `src/lib/services/`.
- `src/hooks/` (17 files) vs `src/lib/hooks/` (3 files) — no discernible rule for which goes where.
- Root has ~80 implementation-log markdown files (`TASK_*_COMPLETE.md`, `*_FIX_SUMMARY.md`, …) plus `docs/` with a partially overlapping set. `Architecture.md` at root describes "Iteration 2" (Next.js 14, no AI, no semantic system) — actively wrong; `package.json` is on Next 15.4 / React 19.

---

## Part C — Spec ↔ code drift (ground-truth resolution)

For each disagreement, which side wins:

| # | Topic | Spec says | Code does | Ground truth |
|---|---|---|---|---|
| C1 | Tier structure | client-side-ai & ai-system: T0–T4 | T0–T3 everywhere except legacy `content-ingestion.ts` | **Code (T0–T3).** Fix specs, delete legacy file. |
| C2 | ElevenLabs integration | tasks.md task 4 `[ ]` "CRITICAL migration" | Done — `@elevenlabs/client` in deps, adapter is real | **Code.** Mark done, archive migration doc. |
| C3 | Text chat path | Server-side AI agent pipeline | Client-direct via voice adapters; server pipeline reachable only from admin debug | **Code** (client-direct), but decision needed on public no-voice fallback (Open Question Q2). |
| C4 | Context layers | "Consolidate ContextInjector into ContextProvider" (streamlined-arch req) | Both alive; injector used by 5 routes | **Spec.** Finish the consolidation. |
| C5 | Canonical conversation logger | `conversation-history-manager` canonical | It exists, but `unified-conversation-manager` + `conversation-manager` also persist | **Spec.** Delete the other two. |
| C6 | Unified tool system | `UnifiedToolRegistry`, `/api/ai/tools/execute`, OpenAI wrapper pattern | Implemented as specified ✅ | Agree — this is a **keeper** and a showcase highlight. |
| C7 | Passive F-I-D context | Spec'd in detail | `PassiveFIDManager.ts`, `/api/ai/context/fid` exist | Agree ✅ keeper. |
| C8 | Semantic fixes spec | Tasks 3–7 open (SSE stability, queue display, persistence) | Git history (Oct 2025) shows "all stages work properly", HNSW reindex added; diagnostics built | **Mostly code.** Re-verify each open task once against the running system, then close or fold remaining bugs into the semantic spec and archive semantic-system-fixes. |
| C9 | ProjectAIIndex | ai-system/client-side-ai treat "project indexing" as live | Both systems live; semantic system is the maintained one | **Neither fully** — resolve via D1 (retire ProjectAIIndex). |
| C10 | Admin AI settings | ai-architecture-redesign: env keys, `AIModelConfig`, `AIGeneralSettings` | Implemented | Agree ✅. Archive that spec as completed history. |

---

## Part D — Target architecture (the proposal)

### The one-paragraph architecture

A Next.js 15 App-Router site on serverless hosting. **Public visitors** get an SSR portfolio plus a floating conversational AI that connects **directly from the browser** to OpenAI Realtime (WebRTC) or ElevenLabs (WebRTC) using **ephemeral tokens** minted by our API, with server-injected system prompts and reflink-based access control. Tools are defined once in a **UnifiedToolRegistry**: `client` tools mutate UI via `UIManager`, `server` tools hit a single `/api/ai/tools/execute` endpoint (semantic search, context fetch). A **passive F-I-D context provider** pushes current-UI context into the conversation so the model rarely needs tool calls for orientation. Content understanding comes from a **T0–T3 heading-bounded semantic index** (pgvector/HNSW) generated by a stage-based pipeline with budget controls and OpenAI Batch API cost optimization. **Admins** get a CMS (projects, media, rich text via Tiptap, AI-assisted editing through the server-side provider layer) plus dashboards for the semantic index, budgets, reflinks, rate limiting, and voice-session debugging that **replays persisted conversation logs** rather than running a parallel pipeline.

Everything in the codebase should be reachable from that paragraph. What isn't, goes.

### Decisions

**D1 — One semantic index.** Retire `ProjectAIIndex`:
- Migrate its `summary` into the project's T1 chunk (already the same concept) and keywords/topics/technologies into `ContentEntity`/`ContextChunk.metadata` (mostly already there).
- Point `BackendToolService`, `context-manager` consumers, and `/api/projects/search/ai-context` at `ContentSearchService`.
- Drop routes `/api/admin/ai/project-indexing/*`, `/api/projects/[slug]/index`, `/api/projects/index/batch`; drop `project-indexer.ts`, `services/content-ingestion.ts`, `use-project-indexing.ts`, `project-indexing-integration.ts`; drop the admin page `admin/ai/project-indexing`.
- Prisma migration: drop `ContextChunk.projectIndexId`, then `ProjectAIIndex`.

**D2 — One conversation architecture.** Client-direct adapters are the only conversation runtime. Concretely:
- Keep: `IConversationalAgentAdapter`, `OpenAIRealtimeAdapter`, `ElevenLabsAdapter`, `ClientAIModelManager`, config serializers, one merged ConversationalAgentProvider.
- Persistence: adapters → `/api/ai/conversation/log` → `conversation-history-manager` (the canonical logger). Admin debug reads persisted logs (+ SSE tail) — the "decoupled debugging" the spec already calls for.
- Delete: `conversation-manager.ts`, `unified-conversation-manager.ts`, `conversation-transport.ts`, and the `/api/ai/conversation` POST pipeline (keep the read-only history/transcript/analytics routes, re-pointed at `conversation-history-manager`).
- Rewrite client-side-ai requirements 1–4, 20 to describe this (text mode = `sendMessage` over the same provider session; mode continuity = same session, not a server thread).

**D3 — One context system.** `context-provider.ts` is the only server context assembler (sources via `content-source-manager`). Fold whatever `context-injector.ts` still uniquely does (prompt assembly for token minting) into it; update the 5 importing routes; delete `context-manager.ts` with the Gen-1 stack. Client side keeps `PassiveFIDManager` + `ContextFrameManager` and `/api/ai/context/fid`. Audit the remaining `/api/ai/context/{load,inject,cache}` routes — anything not called by adapters or F-I-D goes.

**D4 — One tool taxonomy, honest names.** Keep `UnifiedToolRegistry` as-is (it's good). Global rename of "MCP" in code comments, specs, and docs to "client/server tools". Fold `src/lib/voice/UINavigationTools.ts` and `src/lib/ai/tools/client-tools.ts` into a single client-tool module backed by `UIManager` (currently two places describe UI tools).

**D5 — Production/debug separation.**
- Remove `UIManagerDebugPanel` from `src/app/page.tsx` (gate behind admin or a query flag if still wanted).
- Delete all 30 `src/app/test-*` routes, `page.new.tsx`, and the `*-test.tsx` components. Anything genuinely still useful becomes a Jest/Playwright test or an `/admin/ai/*` debug tab (many already have equivalents there).
- Delete the ~9 one-off `/api/admin/semantic/*` diagnostic routes; `SemanticDiagnosticService` + `npm run diagnostics` is the sanctioned path. Keep `diagnostics/` and `dashboard`.
- Delete the 28 root `test-*.js`/`debug-*.js` scripts (git history preserves them).

**D6 — Pricing/models as data.** One module `src/lib/ai/pricing.ts` (or a small DB table beside `AIModelConfig`) holding `{model → {input, output, embedding?, batchDiscount}}` with a single `estimateCost()` used by budget, estimation, regeneration, and providers. Delete every local constant. Fix the Anthropic capability table (tool use: yes, vision: yes, JSON via tool-forcing).

**D7 — Serverless-honest state.** Write into the spec what the code already half-knows: durable state (rate limits, budgets, conversations, reflinks, configs) lives in Postgres; in-memory caches are per-instance memoization only, never correctness-bearing. Remove/mark any cache whose invalidation assumes a single instance (e.g., AI status cache, `PublicAccessManager` if still in-memory — verify during Phase 3).

**D8 — Docs and showcase posture.**
- Rewrite root `Architecture.md` → `ARCHITECTURE.md` as a 2–3 page current-state overview with the layer diagram and links into `/specs` (this is your GitHub showcase front door).
- Add `CLAUDE.md` (build/test commands, spec map, conventions) so future agent sessions stop re-deriving everything.
- Move the ~80 root `.md` implementation logs to `docs/archive/` (or delete; git history keeps them). Keep `docs/` for the handful of living guides.
- Optional showcase idea: since the tool registry is clean, exposing the server tools as a real **MCP server** endpoint would turn the "MCP" naming from a lie into a headline feature ("talk to my portfolio from any MCP client"). Cheap to build on the existing `/api/ai/tools/execute` plumbing; genuinely differentiating in 2026.

### Commentary on the 2025 design decisions, from a 2026 vantage point

**What has aged well — keep and advertise these:**
- **Serverless-first, client-direct voice with ephemeral tokens.** This is now the canonical pattern for realtime voice agents; OpenAI's GA Realtime API kept the ephemeral-token flow. Your server-injected prompt + reflink gating on top of it is a genuinely good design.
- **Passive F-I-D context injection.** You independently arrived at what the industry now calls context engineering: push cheap, structured state to the model instead of making it call tools to orient itself. The NAV_CONTEXT replace-don't-append pattern (delete old context items) is exactly right for realtime sessions. Document it prominently.
- **Heading-bounded chunking with section-hash surgical regeneration.** Structure-aware chunking beat fixed-window chunking decisively in practice; your section-hash approach to incremental re-embedding is better than what most RAG tutorials still teach. Also a showcase highlight.
- **Unified tool registry with explicit `client`/`server` execution context**, and the OpenAI wrapper trick to regain server control over client-executed tools — sound, and still how people do it.
- **Budget manager + Batch API for embeddings** (50% cost cut on non-urgent work) — pragmatic and unusual; keep.

**What has aged poorly — change:**
- **Hand-rolled multi-provider abstraction for the admin text AI.** In 2026 the Vercel AI SDK (or comparable) gives you provider switching, streaming, tool calls, structured outputs, and usage accounting for OpenAI + Anthropic in a few hundred lines less than `service-manager.ts` + two provider classes + error handler + status cache. The voice adapters must stay hand-rolled (provider SDKs are genuinely different), but the admin editing path is a textbook AI-SDK use case. Recommended, not mandatory — do it in Phase 4 only if the diff stays contained.
- **Chat-history-free single-shot editing** (ai-system Req 4.3/4.8) was a 2024 cost defense. With prompt caching and current token prices, a short-lived edit session with history is cheap and materially better UX. Keep single-shot as default, but don't architect it as a hard constraint.
- **Model IDs and prices in code/spec text** — already covered (D6). Every named model in the specs is deprecated or renamed; the system survived only because model config was a DB text field (good instinct — extend it to pricing).
- **Char/4 token estimation** feeding budget decisions accumulates real error across a large corpus; use the tokenizer you already depend on transitively (or `usage` from responses, which you already store) for accounting, keep char/4 only for pre-flight rough estimates.
- **"MCP" as branding for function calling** — covered in D4/D8.
- **NextAuth v4** works but is in maintenance mode; Auth.js v5 migration is low-risk and expected hygiene in a showcase repo (Phase 4, optional).
- **Three admin dashboards' worth of bespoke observability** (voice analytics, debug events, semantic logs) is impressive but heavy to maintain solo. Not worth ripping out now, but freeze feature growth there; if you were starting today you'd wire OpenTelemetry + a hosted trace viewer instead.

---

## Part E — Spec restructuring (context-window friendly)

You're right not to merge everything into one spec. The failure mode isn't "too many files", it's **files too big to load selectively** (client-side-ai/design.md alone is ~6.6k lines) and **no index telling an agent which file answers which question**. Proposal:

```
specs/
  README.md                  ← index: one line per spec {status, owns, reads}
  ARCHITECTURE_ALIGNMENT_PROPOSAL.md   (this doc; delete after execution)
  contracts.md               ← THE single home for cross-spec API contracts
  conversational-ai/         ← renamed from client-side-ai
    requirements.md          (renumbered, Gen-2 only, ~450 lines)
    design-voice-adapters.md
    design-tools-and-context.md      (registry, F-I-D, UIManager)
    design-reflinks-access.md
    design-debug-monitoring.md
    tasks.md                 (re-baselined; only genuinely open work)
  semantic-content/          ← merge of semantic-content-management
    requirements.md            + surviving parts of semantic-system-fixes
    design.md                   + the 3 Batch API docs from .kiro
    tasks.md
  admin-ai/                  ← renamed from ai-system (admin editing AI only)
  media-management/
  rich-content/
  ui-system/
  archive/
    ai-architecture-redesign/   (completed)
    semantic-system-fixes/      (after C8 verification)
    ELEVENLABS_CLIENT_MIGRATION.md
```

Conventions to adopt (put them in specs/README.md):
- **Status header** at the top of every file: `Status: current | archived | superseded-by:<link>`, `Last verified against code: <date>`.
- **Size budget:** no single spec file over ~1,500 lines; split by subsystem, not by doc type, when a design outgrows that.
- **One owner per concept:** a data model or API is *specified* in exactly one spec; everyone else links to `contracts.md`.
- **No embedded implementation code** beyond interface signatures. The 300-line class bodies currently pasted into design docs (OpenAI adapter internals, cache manager implementations) drift instantly; the real code is the truth for bodies.
- Requirements keep the EARS/user-story format you're using — it's good — but completed "CRITICAL IMPLEMENTATION NOTE" battle scars move to a `decisions.md` appendix or get deleted.

---

## Part F — Execution plan (phased; each phase = one agent session)

Ordering rule: **specs first, then deletions, then consolidations, then modernization.** Every code phase ends with `npm run type-check && npm run build && npm test` green plus a manual smoke of the floating AI + semantic dashboard.

**Phase 1 — Spec surgery (no code changes).**
Fix A1 numbering; delete duplicated sections; apply Part E restructure; rewrite conversation requirements per D2; update specs/README.md; merge `.kiro/specs` batch docs and delete `.kiro/specs`; archive completed specs. *Acceptance:* every spec file has a status header; grep finds no "T4", no duplicate requirement numbers, no "MCP" (except the D8 proposal).

**Phase 2 — Dead-weight deletion (low-risk code).**
D5 in full (test pages, debug panel off homepage, test components, root scripts, diagnostic routes), `page.new.tsx`, root `.md` logs → `docs/archive/`. No behavior consolidation yet. *Acceptance:* build green; `src/app` contains no `test-*` routes; homepage renders without debug panel.

**Phase 3 — Consolidations (the real refactor; can split into 3a/3b/3c).**
- 3a: D2 conversation stack (merge providers, delete Gen-1 managers, re-point debug UI at persisted logs).
- 3b: D3 context layers (injector → provider; route audit).
- 3c: D1 semantic index unification + Prisma migration; D4 tool-module merge.
*Acceptance per sub-phase:* voice + text conversation works with both providers; admin debug shows a replayed session; semantic search returns results; `prisma migrate` clean; no imports of deleted modules.

**Phase 4 — Modernization (optional items individually approvable).**
D6 pricing module + Anthropic capability fix (do this one unconditionally); AI-SDK migration of the admin editing path; Auth.js v5; token-accounting from `usage`.

**Phase 5 — Showcase polish.**
D8 docs (`ARCHITECTURE.md`, `CLAUDE.md`, README refresh with architecture diagram + F-I-D/heading-bounded-chunking highlights); optional MCP server endpoint; final `Last verified against code` stamp on all specs.

---

## Open questions for the owner

1. **Q1 — Anthropic path:** keep the Anthropic provider for admin editing (means fixing the capability table and pricing), or go OpenAI-only and delete it? Keeping it is cheap if Phase 4's AI-SDK migration happens.
2. **Q2 — Public text-only fallback:** with the server text pipeline gone, "Basic Only" public access (no voice) would run text through an OpenAI Realtime session anyway (works, but uses realtime pricing) — or we add one thin stateless `/api/ai/chat` route on the provider layer for cheap text-only access. Which?
3. **Q3 — ElevenLabs:** still want dual voice providers, or is OpenAI-only acceptable? (Audit found the adapter working; keeping it costs little, but it doubles the voice test matrix.)
4. **Q4 — Delete vs archive** for root scripts/md logs and test pages: hard delete (git history suffices) or `docs/archive/` + `scripts/archive/`?
5. **Q5 — MCP server endpoint** (D8 optional): in or out of scope?
