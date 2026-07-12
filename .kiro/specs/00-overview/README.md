# 00-overview — System Map & Spec Index

**Status:** current
**Owner domain:** cross-cutting (system map, spec index, conventions)
**Last verified against code:** 2026-07-02 (`e2d75b4`, branch `claude/semantic-content-management-review` == `feature/semantic-content-management-2`)

This folder is the entry point for any agent or human working on the project. Read this file, then load only the spec(s) that own the domain you're touching.

---

## 1. What this project is

A portfolio website that *is itself* the flagship portfolio piece — a production Next.js 15 application whose embedded AI assistant demonstrates, live, the owner's command of current AI engineering.

- **Public visitors:** SSR portfolio (project grid/list/timeline, Tiptap-rendered case studies, Three.js wave hero) + a floating AI pill: **text chat for everyone** (rate-limited, bot-challenged), **voice for invited guests** via reflinks. The agent answers from portfolio content via RAG and drives the UI through declarative navigation tools.
- **External AI agents:** a public, heavily safeguarded **MCP server** (implemented — see `mcp-server/`) exposing read-only portfolio search/retrieval.
- **Admin:** full CMS under `/admin` — project editor with AI assist, semantic content dashboard, voice + reasoning model config, reflinks, rate limits, spend watchdog, conversation replay/debug.

**Deployment target:** Vercel serverless. Durable state lives in Postgres (Prisma + pgvector); in-memory caches are per-instance memoization only, never correctness-bearing.

## 2. System map

```mermaid
flowchart TB
    subgraph publicSurface [Public Surface]
        Site[Portfolio UI]
        Pill[AI Pill - text public, voice via reflink]
        MCPExt[External AI clients]
    end

    subgraph aiLayer [AI Assistant Layer - client]
        Adapters[Voice adapters: OpenAI Realtime, Google Live, Cascade]
        Registry[UnifiedToolRegistry - client/server tools]
        UIMgr[UIManager - ui_intent navigation]
        FID[F-I-D context]
    end

    subgraph gateway [AI Gateway - every cost-incurring call]
        Access[Access tiers + reflinks]
        RateLimit[Rate limits]
        Ledger[Usage ledger]
        Watchdog[Spend watchdog + kill switch]
    end

    subgraph serverSide [Server Services]
        Reasoning[Reasoning-model adapters: OpenAI, Anthropic, Google]
        Tools[BackendToolService - content_search, content_get, job analysis]
        Semantic[Semantic pipeline T0-T3]
        Vector[(Postgres + pgvector + tsvector)]
        MCPSrv[MCP server - implemented]
    end

    subgraph adminCMS [Admin CMS]
        Editor[EnhancedProjectEditor + Tiptap AI]
        SemanticUI[Semantic dashboard]
        AIAdmin[Model config, reflinks, limits, debug]
    end

    Site --> Pill --> Adapters --> Registry
    Registry -->|client tools| UIMgr
    Registry -->|server tools| gateway
    Pill -->|text chat| gateway
    MCPExt --> MCPSrv --> gateway
    gateway --> Tools --> Vector
    Tools -->|deep tools| Reasoning
    Editor -->|save triggers change detection| Semantic --> Vector
    AIAdmin --> gateway
    SemanticUI --> Semantic
```

**The load-bearing seam:** `BackendToolService` + the server side of `UnifiedToolRegistry` form the single data-access chain. Voice adapters reach it via `/api/ai/tools/execute`; the MCP server exposes a curated read-only subset of the same implementations; deep tools may internally consult the reasoning model. Nothing else talks to the semantic index directly.

## 3. Spec index

| Spec | Status | Owns | Key open work |
|---|---|---|---|
| [00-overview](./README.md) | current | system map, decision registry, conventions | keep index honest |
| [portfolio-core](../portfolio-core/requirements.md) | current — implemented | public pages, project APIs, homepage, SSR/SEO, analytics, auth | no scheduled feature work |
| [admin-cms](../admin-cms/requirements.md) | current — implemented | admin shell, project editor, homepage composer | only explicit backlog decisions |
| [media](../media/requirements.md) | current — implemented | media library, upload, storage providers | provider-side deletion verification at deployment re-provisioning |
| [rich-content](../rich-content/requirements.md) | current — implemented | Tiptap editor, extensions, renderers | legacy-remnant and embed-security verification; versioning remains backlogged |
| [ui-system](../ui-system/requirements.md) | current — implemented | theme, GSAP animation, wave hero, layout | liquid pill/sidebar and its browser acceptance work |
| [ai-assistant](../ai-assistant/requirements.md) | current — core implemented | visitor AI: adapters, pill UI, tool registry, F-I-D, navigation | runtime hygiene: UI-state pull, prompt diet, provider accounting, browser/live-fire confirmation |
| [ai-admin](../ai-admin/requirements.md) | current — implemented | model registry + aliases, pricing-as-data, reasoning-model adapters, editing AI | no scheduled feature work |
| [semantic-content](../semantic-content/requirements.md) | current — implemented, reliability closure pending | T0–T3 pipeline, chunking, embeddings, search, budgets | durable all-project operations, SSE-independent queue state, cumulative parent summaries |
| [access-and-cost](../access-and-cost/requirements.md) | current — implemented | AI gateway, public text chat, rate limiting, reflinks, usage ledger, watchdog | browser-level panel/pill verification and deploy-time Turnstile activation |
| [mcp-server](../mcp-server/requirements.md) | current — implemented and hardening-verified | external MCP server | backlog only (keys/deep tools/resources) |
| [verification](../verification/requirements.md) | current — partially implemented | agentic e2e verification: fakes, fixture, `check:*`, debug envelope, telemetry access, live-fire, CLAUDE.md | fake voice, correlation reads, Playwright, formal live-fire, `check:models`, remote CI activation |
| [conversation-engine](../conversation-engine/requirements.md) | current — implemented through Block F (D47 ✅ 2026-07-12) | D47 graph engine, memory, leads, analytics, privacy lifecycle, safety, editor, golden scenarios + seed graph | G5 (PDF/DOCX extraction), dynamic suggestions (M4/M5) deferred |
| [_backlog](../_backlog/) | backlog | future-direction outlines whose **seam constraints bind now** (D48 modular platform; D47 outline superseded by `conversation-engine/`) | promoted to real specs when scheduled |
| [_archive](../_archive/) | archived | superseded specs & analysis docs | — |

Master direction document: [`ARCHITECTURE_ALIGNMENT_PROPOSAL.md`](../ARCHITECTURE_ALIGNMENT_PROPOSAL.md) (frozen rationale; the registry below is the living copy of its decisions). Roadmap phases live in its Section 7.

### Scope-finalization order (2026-07-11)

The remaining work is intentionally narrow and should close in this order:

1. `semantic-content` tasks 6.2–6.3, 9, and 10: make bulk operations durable and safe before enabling `scope:'all'`.
2. `verification` tasks 4–8: deterministic fake voice, correlated telemetry reads, browser coverage, formal live-fire, model-policy check, and—after owner approval—the first remote CI pass.
3. ~~`conversation-engine` Block F: seed graph, golden scenarios, and multi-runtime drill.~~ *Done 2026-07-12.* Dynamic suggestions remain explicitly deferred.
4. `ai-assistant` runtime-hygiene tasks and `ui-system` liquid-pill acceptance tests.

No new broad AI subsystem is in scope. New work belongs to one of these owners or requires a decision-registry entry first.

## 4. Decision registry

See [decision-registry.md](./decision-registry.md) — D1–D44. Rule of the registry: *implemented-and-working beats specced-but-imaginary; where neither is built, the simpler design wins.* When a spec sentence conflicts with a registry decision, the registry wins and the spec must be fixed — do not preserve both with a note.

## 5. Spec conventions (binding)

1. **Shape:** each spec = `requirements.md` + `design.md` + `tasks.md` (plus optional focused design sub-files). **Soft cap ~50KB per file** — split by subsystem, not doc type, when a design outgrows it.
2. **Status header** at the top of every file: `Status: current | archived | superseded-by:<link>`, `Owner domain`, `Last verified against code: <date> (<commit>)`.
3. **Contracts:** each spec declares "consumes / provides" tables. A data model or API is *specified* in exactly one spec; everyone else links to the owner.
4. **No embedded implementation code** beyond interface signatures — pasted class bodies drift instantly.
5. **Requirements format:** EARS/user-story style ("WHEN … THEN the system SHALL …").
6. **Task ledgers:** regenerated from code truth, never copied. A parent may be `[x]` only if all children are. Duplicate task/requirement numbers are forbidden. Completed history goes in a short "Already implemented" section, not a sea of checked boxes.
7. **Naming:** tool names use underscores (`ui_intent`, `content_search`). "MCP" refers exclusively to the real external MCP server. Tiers are T0–T3.
8. **Models & pricing are data** (registry D4/D38): no model IDs or prices in spec text or code — reference role aliases (`default-chat`, `default-cheap`, `default-realtime`, `default-embedding`, `default-reasoning`).
9. **Definition of done includes agentic verification** (registry D46): a ledger task is `[x]` only after the deterministic suite passes and the feature's e2e path has been exercised (fakes in-session; live-fire at phase completion). New cost-incurring routes/tools/pipeline stages land **with** their verification hooks (`_debug` coverage, telemetry correlation, check script or Playwright tag). See the `verification` spec.

## 6. Repo orientation

- App repo: `portfolio-projects/` — Next.js 15.4 App Router, React 19, Prisma 6 (Postgres + pgvector), Tailwind 4, Tiptap 3, NextAuth, `@openai/agents`, `@elevenlabs/client`.
- Specs: `portfolio-projects/.kiro/specs/` (this tree) — the only spec location, versioned with the code.
- Key source areas: `src/lib/content/` (semantic pipeline), `src/lib/ai/` (tools, providers), `src/lib/voice/` + `src/components/providers/conversational-agent-provider.tsx` (voice), `src/lib/navigation/` (UIManager), `src/app/api/ai/` + `src/app/api/admin/` (API), `src/app/admin/` (CMS UI).
- Verification: `npm run type-check && npm run build && npm test`; semantic health via `npm run diagnostics`.
