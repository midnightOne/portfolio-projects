# mcp-server — Tasks

**Status:** current — nothing implemented; Phase 4 build (blocked by `access-and-cost` Phase 2 gateway)
**Owner domain:** external MCP server
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## Open tasks (Phase 4)

- [ ] 1. Endpoint
  - [ ] 1.1 `POST /api/mcp` with MCP Streamable HTTP (official SDK, stateless mode)
  - [ ] 1.2 Wrap with `withAIGateway` (feature `mcp`, own rate bucket)
  - _Requirements: 1, 3.1_

- [ ] 2. Tools
  - [ ] 2.1 `search_portfolio`, `get_project`, `list_projects` dispatching to `BackendToolService`/public services with `publicOnly` enforced in SQL
  - [ ] 2.2 zod input schemas (length caps, enums); protocol-error mapper (no internals)
  - _Requirements: 2, 3.2, 3.6_

- [ ] 3. Hardening verification
  - [ ] 3.1 Test suite covering the design §3 checklist (private-content attempts, oversize inputs, error leakage, injection inertness, tools/list snapshot)
  - [ ] 3.2 Watchdog integration test: simulated flood trips the kill switch and MCP goes dark
  - _Requirements: 3_

- [ ] 4. Acceptance (roadmap 4.2)
  - [ ] 4.1 A real MCP client (Claude) connects, lists tools, searches the portfolio, retrieves a project
  - [ ] 4.2 Calls appear in the ledger tagged `mcp`; rate bucket enforced

- [ ] 5. Discoverability (with roadmap 4.6)
  - [ ] 5.1 About/AI page section: URL, tools, client configs, safeguards-in-prose
  - [ ] 5.2 README architecture story includes the MCP server
  - _Requirements: 5_

## Backlog

Bearer-key auth (trigger: abuse); deep reasoning tools (`analyze_job_fit`) gated on D41 + new registry decision; MCP resources/prompts capabilities.
