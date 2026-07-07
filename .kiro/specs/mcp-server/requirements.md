# mcp-server — Requirements

**Status:** current — implemented + hardening-verified 2026-07-07 (Phase 4 Block B); Req 5 (discoverability) lands with roadmap 4.6
**Owner domain:** the public external MCP server: transport, tools, discovery, and its security posture
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D20 (name reserved for this), D30, D39 (shared chain), D43
**Owner emphasis (Q5, 2026-07-02):** safeguarding is a first-class requirement, twice over — real security, and a public demonstration of how to build open AI endpoints securely.
**Contracts:**

| Consumes | From |
|---|---|
| AI Gateway (full chain, own rate bucket, ledger tag `mcp`) | `access-and-cost` |
| `ContentSearchService` (search), public project payloads | `semantic-content`, `portfolio-core` |
| `BackendToolService` implementations (shared chain, D39) | `ai-assistant` |
| Reasoning adapters for v2 deep tools | `ai-admin` |

| Provides | To |
|---|---|
| `POST /api/mcp` (MCP Streamable HTTP) | external AI clients (Claude, ChatGPT, agent frameworks) |
| Visitor-facing documentation of the endpoint + its hardening | About/AI page |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Protocol & transport

**User story:** As an external AI agent, I want a standards-compliant MCP endpoint, so that any MCP client can query this portfolio.

1. WHEN a client connects THEN `POST /api/mcp` SHALL implement the MCP **Streamable HTTP** transport with **stateless per-request handling** (fits Vercel serverless, D43); no session affinity required.
2. WHEN capabilities are listed THEN the server SHALL advertise exactly the registered read-only tools (Requirement 2) and protocol-required metadata — nothing speculative.
3. WHEN protocol errors occur THEN responses SHALL be spec-compliant errors, never stack traces or internals.

## Requirement 2 — Tools (v1: read-only)

**User story:** As an external agent, I want to search and read the portfolio, so that my user can evaluate the owner without visiting.

1. `search_portfolio(query, limit?)` → `ContentSearchService` hybrid search over PUBLIC content; results include project/section provenance.
2. `get_project(slug)` → the public project payload (same data `GET /api/projects/[slug]` serves).
3. `list_projects(tag?, sort?)` → public listing.
4. Tool implementations SHALL be the **same `BackendToolService` chain the voice assistant uses** (D39) — exposed twice, implemented once. No MCP-only data paths.
5. **No write tools in v1.** Contact/message tools, if ever, require a new registry decision and their own abuse analysis.

## Requirement 3 — Security posture (the showcase requirement)

**User story:** As the owner, I want the open endpoint provably bounded, so that public exposure is safe and the hardening itself demonstrates skill.

1. WHEN any MCP call arrives THEN it SHALL pass the full AI Gateway chain (`access-and-cost`): kill switch → tier (anonymous-public) → rate limits (**own bucket**, stricter than pill traffic) → execute → meter to ledger with feature tag `mcp`.
2. WHEN tools execute THEN inputs SHALL be schema-validated (types, lengths, enum ranges) before touching services; outputs SHALL be filtered to PUBLIC-visibility content **at the service layer** (SQL-level), never by prompt or post-hoc trimming.
3. WHEN the gateway or ledger is unreachable THEN the endpoint SHALL fail closed.
4. WHEN the watchdog trips THEN MCP SHALL disable with the rest of public AI (it shares the ledger and kill switch — every entry point is covered).
5. WHEN abuse warrants THEN optional bearer-key auth CAN be enabled without breaking anonymous access design (backlog trigger, not v1).
6. THE endpoint SHALL expose no PII, no PRIVATE projects, no admin data, no provider keys, no internal error details — verified by tests that attempt each.

## Requirement 4 — v2 candidates (gated on D41 prototyping)

1. Deep tools (e.g., `analyze_job_fit`) MAY be added using the reasoning model (`default-reasoning`) — the same implementation the reflink voice flow uses — but only with per-call cost caps and possibly bearer-key gating; requires a registry decision.

## Requirement 5 — Discoverability & storytelling

**User story:** As a visitor (or their AI), I want to find and understand the endpoint, so that the feature actually lands.

1. WHEN the About/AI page renders THEN it SHALL document the MCP URL, available tools, example client config, and a plain-language description of the safeguards (Requirement 3) — the hardening is part of the pitch.
2. WHEN the README is refreshed (Phase 4.6) THEN the MCP server SHALL feature in the architecture story.
