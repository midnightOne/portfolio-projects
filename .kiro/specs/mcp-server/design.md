# mcp-server — Design

**Status:** current — implemented 2026-07-07 (Phase 4 Block B); v1.1 latency + tool-ergonomics pass 2026-07-09; §4 client-experience docs land with roadmap 4.6
**Owner domain:** external MCP server
**Last verified against code:** 2026-07-09 (MCP latency/ergonomics session — live-benchmarked)

---

## 1. Shape

```
POST /api/mcp   (MCP Streamable HTTP, stateless per request)
  └ withAIGateway({ feature: 'mcp', publicAllowed: true, bucket: 'mcp' })
      └ MCP request router (initialize / tools/list / tools/call)
          └ tool dispatch → BackendToolService implementations
              ├ search_portfolio → ContentSearchService (publicOnly: true)
              ├ get_project      → public project payload service
              └ list_projects    → public listing service
```

### Tool surface (v1.1, 2026-07-09 — same three names, richer contracts)

Designed so a weak client (the realtime voice model) resolves an answer in 1–2 small calls
instead of dumping whole projects:

- `search_portfolio { query, limit?, project? }` — `project` scopes to one slug. Each result
  carries `excerpt` (≤240 chars verbatim) and `location { project, section, tier }` where
  `section` is the T2 heading anchor ("where exactly is this paragraph").
- `get_project { slug, section?, detail? }` — default is a small **overview** (metadata +
  T1 summary + section index of `{anchor, title}`); `section:<anchor>` returns exactly one
  section's full text (an unknown anchor errors WITH the available section list);
  `detail:'full'` restores the whole write-up.
- `list_projects { tag?, technology?, sort? }` — `technology` matches entity technologies
  and tags case-insensitively; output includes each project's `technologies`
  ("which projects use X" in one call).

Server `instructions` carry the recipes (browse / locate / read-one-section / cross-project
synthesis) so clients that only read descriptions still follow the cheap path.

- Use the official MCP TypeScript SDK's Streamable HTTP server handler in stateless mode (one request = one JSON-RPC exchange; SSE streaming within the response where the SDK requires it). No session store; serverless-safe (D43).
- Tool schemas defined once alongside `UnifiedToolRegistry` definitions — same argument shapes as the internal `content_search`/`content_get` tools where they overlap, so documentation and behavior can't diverge from the assistant's tools (D39).

## 2. Gateway integration

The route is wrapped like every other cost-incurring route (`access-and-cost` design §1) with:
- **Own rate bucket** (`mcp`): stricter defaults than pill traffic (e.g., lower per-IP daily calls); admin-tunable in the Access & Spend panel. **Protocol frames** (initialize, tools/list, ping, notifications) bump only the per-minute window; only `tools/call` consumes the daily budget — a normal MCP handshake must not eat the day's allowance (v1.1, 2026-07-09).
- **Ledger tag `mcp`** on every tool call (tokens ≈ 0 for pure retrieval, but calls are still counted and cost-attributed for embedding queries). Ledger writes are scheduled **after the response** via Next `after()` (route passes a `defer` into `buildMcpServer`) — metering integrity without the ~30–60 ms transaction on the latency path. The `query_embedding` mirror inside `ContentSearchService` runs concurrently with the search and is settled before return.
- Kill switch + fail-closed identical to public chat. Gateway pre-checks (admin session ∥ kill switch; blacklist overlapped with settings; rate windows in parallel) were serialized before v1.1 and cost ~85 ms/request on top of handler time.

### Latency envelope (measured locally, 2026-07-09, WSL Postgres + dev server)

| Call | Warm p50 | Notes |
|---|---|---|
| initialize / tools/list | ~60 ms | protocol only |
| list_projects / get_project | ~60 ms | 1–2 indexed queries |
| search_portfolio (embedding cached) | ~60–90 ms | pgvector HNSW ~75 ms dominates |
| search_portfolio (novel query) | +140–500 ms | query embedding — the only external call; provider behind the `default-embedding` alias (google/gemini-embedding-001 since 2026-07-09 for tail stability: OpenAI spiked 1.5–3.7 s at p90, Google held ~210 ms). Switching the alias requires re-embedding all chunks. |
| cold start | ~5 s once | dev-route compile + first TLS to the embedding provider |

## 3. Hardening checklist (tested, not aspirational)

| Control | Mechanism | Test |
|---|---|---|
| Input validation | zod schemas per tool (length caps, enum ranges) before service calls | fuzz/oversize/typed-injection tests |
| Visibility filtering | `publicOnly` enforced in SQL by the services | attempt to fetch a PRIVATE slug/chunk |
| No internals in errors | error mapper → protocol errors only | force service throw; assert no stack/SQL |
| Prompt-injection inertness | tools return data, never execute instructions from content | content containing tool-call-like text stays inert |
| Spend bound | gateway metering + watchdog | simulated flood trips watchdog; MCP disabled |
| No write path | v1 registers zero mutating tools | tools/list snapshot test |

This checklist is also the outline for the visitor-facing "how this endpoint is safeguarded" section (Requirement 5) — the same table, in prose.

## 4. Client experience

Documented on the About/AI page: endpoint URL, tool list, and copy-paste configs for common MCP clients (Claude Code / claude.ai connectors, generic Streamable HTTP config). Optional: an `.well-known`-style discovery note if the ecosystem standardizes one by build time.

## 5. Deliberately out of v1

Bearer keys (enabled only if abuse warrants — design leaves the gateway hook in place), write tools, deep reasoning tools (Requirement 4 gate), resource/prompt MCP capabilities (tools only in v1), WebSocket/legacy SSE transport.
