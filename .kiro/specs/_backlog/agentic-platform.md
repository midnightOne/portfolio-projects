# Modular Agentic Platform (extraction path) — Backlog Outline

**Status:** backlog — not scheduled. Registry decision D48 holds the constraints that bind current work. Promoted to a real spec when extraction is scheduled (earliest: after the portfolio roadmap completes).
**Recorded:** 2026-07-02 (owner direction)

---

## 1. The idea

The agentic subsystem should be reusable beyond this portfolio — as a GitHub showcase, in the owner's other projects, or as a drop-in/business proposition for third-party sites. The portfolio then becomes *reference host #1* of a generic platform rather than the platform's owner.

## 2. Module map

```
┌────────────────────────────────────────────────────────────────┐
│ agent-core                                                     │
│   adapter interfaces + implementations (native S2S, cascade,   │
│   reasoning LLMs) · UnifiedToolRegistry · session/telemetry    │
│   contracts · (later) D47 conversation engine                  │
├────────────────────────────────────────────────────────────────┤
│ rag-core                                                       │
│   chunking (T0–T3, heading-bounded) · embeddings · pgvector    │
│   search · budgets — all behind a CONTENT-SOURCE INTERFACE     │
│   · MCP server exposure of the same tools                      │
├────────────────────────────────────────────────────────────────┤
│ ui-navigator (optional capability)                             │
│   SemanticIDRegistry · UIManager · ui_intent/ui_describe ·     │
│   F-I-D passive context                                        │
├────────────────────────────────────────────────────────────────┤
│ capability plugins (optional, discoverable via the registry)   │
│   e.g. job/CV analysis; contact intake; per-host custom tools  │
├────────────────────────────────────────────────────────────────┤
│ host layer (per project — NOT part of the platform)            │
│   content-source adapter (portfolio: Tiptap/Prisma reader) ·   │
│   semantic-ID instrumentation of the host UI · access policy   │
│   config (tiers, budgets, reflink-like schemes) · admin UI ·   │
│   prompts/branding as data                                     │
└────────────────────────────────────────────────────────────────┘
```

Compatibility rule (owner): modules compose but never require each other. No F-I-D → the agent still converses and uses RAG. No ui-navigator → pure Q&A. No rag-core → a scripted/tool-only agent still works.

## 3. The boundary question, answered

**Litmus test: "would the phone agent need it?"** If yes → platform. If only this website needs it → host layer.

| Use case | Modules |
|---|---|
| Phone agent (no UI, scripts + RAG) | agent-core (cascade voice + D47 engine) + rag-core |
| Drop-in Q&A widget for any site | agent-core + rag-core + a pill-style UI shell |
| Drop-in with UI navigation | + ui-navigator, host instruments its components with semantic IDs (that instrumentation *is* the custom logic per site) |
| This portfolio | all of it + reflinks/job-analysis/admin as host layer |

Consequences worth stating: reflinks are host policy (generic concept: "access tiers with budgets" lives in the platform's gateway; the reflink UX is host). Job/CV analysis is a capability plugin, never built-in — and the D47 engine discovers it via registry enumeration, exactly as the owner sketched.

## 4. The database bridge

Two complementary answers for "every site has a different database":

1. **Content-source interface** (ingestion side): `listEntities() / getContent(entity) → normalized document (headings + blocks + metadata)`. rag-core only ever sees normalized documents; the portfolio's Tiptap/Prisma reader becomes the first adapter, a foreign site writes its own (CMS API, SQL views, file dumps).
2. **MCP as the bridge** (query side): a host that already exposes an MCP server can have the agent *consume* it as a data source — the platform speaks MCP both northbound (exposing tools, `mcp-server` spec) and southbound (consuming a host's tools). This makes "point the agent at your MCP server" a legitimate integration story with zero custom adapter code for capable hosts.

## 5. Extraction strategy (deliberately lazy)

Now: folder discipline only (D48 constraints — dependency direction, no hardcoded host strings, optional modules, content-source interface). A future `check:modularity` script (import-boundary lint) makes it enforceable — listed in `verification` backlog.
Later, when a **second consumer actually exists** (phone agent or first drop-in): split into `packages/` (monorepo) or a separate repo, extract the pill UI as a themeable shell, write the platform README as its own showcase.
Never: extract speculatively. An unproven package boundary is worse than a disciplined folder.

## 6. What this changes about current work

Nothing is added to any phase. It only *forbids* certain shortcuts (D48 list): portfolio imports inside core libs, baked-in prompts, mandatory F-I-D, ingestion reading Prisma models directly instead of through the content-source seam (the Phase 3 legacy-ingestion deletion is the moment to check that seam), and premature package surgery.
