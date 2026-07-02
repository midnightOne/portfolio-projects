# mcp-server — Design

**Status:** current — target design (Phase 4 build)
**Owner domain:** external MCP server
**Last verified against code:** 2026-07-02 (`e2d75b4`)

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

- Use the official MCP TypeScript SDK's Streamable HTTP server handler in stateless mode (one request = one JSON-RPC exchange; SSE streaming within the response where the SDK requires it). No session store; serverless-safe (D43).
- Tool schemas defined once alongside `UnifiedToolRegistry` definitions — same argument shapes as the internal `content_search`/`content_get` tools where they overlap, so documentation and behavior can't diverge from the assistant's tools (D39).

## 2. Gateway integration

The route is wrapped like every other cost-incurring route (`access-and-cost` design §1) with:
- **Own rate bucket** (`mcp`): stricter defaults than pill traffic (e.g., lower per-IP daily calls); admin-tunable in the Access & Spend panel.
- **Ledger tag `mcp`** on every tool call (tokens ≈ 0 for pure retrieval, but calls are still counted and cost-attributed for embedding queries).
- Kill switch + fail-closed identical to public chat.

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
