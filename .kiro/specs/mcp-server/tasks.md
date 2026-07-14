# mcp-server — Tasks

**Status:** current — v1 implemented + hardening-verified 2026-07-07 (Phase 4 Block B); discoverability (task 5) shipped 2026-07-08 (Phase 4 Block D); task 6 (`portfolio_overview`) shipped + acceptance-verified 2026-07-14 (tool count now 4)
**Owner domain:** external MCP server
**Last verified against code:** 2026-07-08 (Phase 4 session — Block D)

---

## Open tasks (Phase 4)

- [x] 1. Endpoint — **done 2026-07-07**
  - [x] 1.1 `POST /api/mcp`: official SDK's `WebStandardStreamableHTTPServerTransport` (stateless: no sessionIdGenerator, `enableJsonResponse`; per-request server instance, D43). GET/DELETE answer 405 JSON-RPC errors (no SSE resumption stream by design). `src/lib/mcp/server.ts` + `src/app/api/mcp/route.ts`.
  - [x] 1.2 `withAIGateway({feature:'mcp', publicAllowed:true, bucket:'mcp'})`: new gateway `bucket` option — cookie-less public tier gated by `settings.mcpEnabled` + own `mcp_minute`/`mcp_day` per-IP windows (`AIPublicAccessSettings.mcpEnabled/mcpRequestsPerMinute/mcpRequestsPerDay`, migration `mcp_bucket_settings`); MCP responses skip the `_debug` envelope (JSON-RPC frames stay spec-pure — strict SDK clients reject unknown keys; found live). Knobs on the Access & Spend panel ("MCP Server" card). `check:gateway` explicit list includes the route.
  - _Requirements: 1, 3.1_

- [x] 2. Tools — **done 2026-07-07**
  - [x] 2.1 v1 tools exactly `search_portfolio` (→ `BackendToolService.executeTool('content_search', …, 'basic')` — same chain as the assistant, Req 2.4), `get_project` (Prisma with `visibility:'PUBLIC'` in the WHERE + T1/T2 chunk text), `list_projects` (PUBLIC-only listing). **`publicOnly` is now enforced in SQL end-to-end**: `ContentSearchService`/`VectorOperations` gained a `publicOnly` predicate (vector, full-text, metadata-fallback queries + `getContent` id filtering) threaded from `accessLevel==='basic'` — this also closed a pre-existing public-chat leak (see manifest surprises).
  - [x] 2.2 zod schemas with length caps (query ≤500, limit ≤10, slug regex ≤200, tag ≤100, sort enum); `safeError()` mapper returns generic text — no stack/SQL/paths.
  - _Requirements: 2, 3.2, 3.6_

- [x] 3. Hardening verification — **done 2026-07-07**
  - [x] 3.1 `src/lib/mcp/__tests__/mcp-hardening.test.ts` (11 tests, real SDK client over InMemoryTransport): tools/list snapshot (3 read-only tools, no mutating names), oversize/traversal inputs rejected before any service/DB call, PUBLIC constraint asserted in the Prisma WHERE (PRIVATE and nonexistent slugs answer identically — no existence oracle), service/DB throws mapped with no internals, instruction-shaped content returned verbatim as data (inert; exactly one backend call), every call metered with tool name.
  - [x] 3.2 Live drills 2026-07-07 (dev server, real client): fixture flipped PRIVATE → search 0 results (9 when PUBLIC), get_project "No public project found", list excludes; `mcpRequestsPerMinute=3` flood → 429 RATE_LIMITED; `AIGlobalLimits` tripped → `/api/mcp` 503 AI_PAUSED (dark with the rest of public AI); all states restored.
  - _Requirements: 3_

- [x] 4. Acceptance (roadmap 4.2) — **done 2026-07-07**
  - [x] 4.1 Real MCP client (official SDK `Client` + `StreamableHTTPClientTransport` — the same stack Claude clients use) connected over HTTP: initialize → tools/list (3 tools) → search_portfolio → list_projects → get_project (`verification-fixture-kiln`: 552-char T1 summary + 5 T2 sections).
  - [x] 4.2 Ledger rows `feature='mcp', usageType='mcp_tool_call'` with tool name metadata + hashed IP for every call; rate bucket enforced (drill above).

- [x] 5. Discoverability — **done 2026-07-08 (Phase 4 Block D)**
  - [x] 5.1 `/about/ai` (`src/app/about/ai/page.tsx`, linked from the main nav "AI" item): the architecture story as a portfolio piece — three modes/one brain, T0–T3 + hybrid retrieval, F-I-D, latency-aware clips, gateway/ledger/watchdog — with an MCP section: endpoint URL (origin-aware client component `McpConnectCard`, copy buttons), the 3 tools, copy-paste configs (Claude Code `claude mcp add --transport http`, Claude Desktop via `mcp-remote`, raw JSON-RPC curl), and the Req 3 safeguards rewritten as prose ("the hardening is part of the pitch"). **Verified live 2026-07-08:** page renders both themes at mobile/1600px with no horizontal overflow; the raw JSON-RPC snippet exactly as printed (bare `tools/call`, no initialize needed in stateless mode) returned real `search_portfolio` results against `POST /api/mcp`.
  - [x] 5.2 README rewritten (was Next.js-14-era, predated the whole AI system): MCP server features in the architecture story with its hardening posture; every stack/command claim cross-checked against package.json and code; stale claims (db:push setup flow, nonexistent LICENSE, `/admin/ai-settings`) removed.
  - _Requirements: 5_

- [x] 6. **`portfolio_overview` MCP tool (owner ask 2026-07-13; shared implementation with ai-assistant 7.13) — done 2026-07-14.** Expose the owner/portfolio overview through the MCP server: external models get no mint instructions, so they currently start blind — this tool is their equivalent of the start frame. Same single assembly module as the mint frame and the in-session tool (`assembleStartFrame()` extended — never a fork); same tiny `depth: 'brief' | 'full'` schema; rides the existing v1.1 contracts, metering, and limits. Update the /about/ai `McpConnectCard` tool list and README (tool count 3 → 4). Acceptance: raw stateless `tools/call` (the task-5.1 curl pattern) returns the brief overview.
  - _Evidence (2026-07-14):_ `registerTool('portfolio_overview')` in `src/lib/mcp/server.ts` — zod `depth` enum, `safeError`/`textResult`/`meter` posture identical to the v1 tools, dispatches to `assemblePortfolioOverview()` (start-frame.ts — the ONE module; `brief` IS the mint frame, now carrying owner identity per ai-assistant 7.2c); `MCP_TOOL_NAMES` 3→4 + a first-contact recipe line in the server instructions; /about/ai prose + README tool list updated. Hardening suite extended: tools/list snapshot (4 tools), both depths return the shared artifact, out-of-enum depth rejected at the schema without touching assembly. **Acceptance passed live:** raw stateless `tools/call` against the dev server (no initialize) returned the brief overview (owner bio + framing + visitor intro + project lines) and the 4,322-char full overview with PROJECT INDEX + per-project technology lists; ledger metering rides the same `mcp_tool_call` defer path as the v1 tools.
  - _Requirements: 1 (tool contract), 5 (discoverability); cross-spec: ai-assistant 7.13_

## Backlog

Bearer-key auth (trigger: abuse); deep reasoning tools (`analyze_job_fit`) gated on D41 + new registry decision; MCP resources/prompts capabilities.
