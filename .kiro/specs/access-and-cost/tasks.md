# access-and-cost — Tasks

**Status:** current — this is the Phase 2 build plan (roadmap Phase 2 in the proposal)
**Owner domain:** gateway, tiers, public chat, rate limits, reflinks, ledger, watchdog
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## Already implemented (verified on branch)

Postgres-backed rate-limit tables + engine (`rate-limiter.ts`) — **built but unwired**; reflink CRUD/validation (`/api/ai/reflink/validate` canonical) with budget fields; IP blacklist + abuse detection + security notifications; `AIUsageLog` model (missing feature/hashedIp/session fields and real cost writes); public-access-manager (JSON config, default `disabled` — to be replaced).

## Open tasks (Phase 2 unless noted)

- [ ] 1. Schema
  - [ ] 1.1 `AIGlobalLimits` + `AIPublicAccessSettings` models; extend `AIUsageLog` (feature tag, hashedIp, sessionId, costUsd)
  - _Requirements: 5, 6.1_

- [ ] 2. Gateway
  - [ ] 2.1 Implement `withAIGateway` with the 6-step chain (kill switch → tier → session → rate limit → execute → meter), fail-closed
  - [ ] 2.2 Wire onto every cost-incurring route (chat, both/all token mints, tools/execute, analyze-job, semantic regeneration; MCP joins in Phase 4)
  - [ ] 2.3 Unit tests: check order, fail-closed, allowlist rejection; grep check for unguarded routes
  - [ ] 2.4 Delete or absorb `withRateLimit` middleware
  - _Requirements: 1_

- [ ] 3. Public text chat
  - [ ] 3.1 `POST /api/ai/chat/session`: Turnstile-gated JWT issuance, IP-bound, issuance caps
  - [ ] 3.2 `POST /api/ai/chat`: gateway-wrapped, `default-cheap` alias via reasoning adapters (needs `ai-admin` pricing task; adapter layer can start as current provider)
  - [ ] 3.3 Public tool allowlist enforced at tier + at `/api/ai/tools/execute` dispatch
  - [ ] 3.4 Acceptance: anonymous chat works; scripted call without session token rejected before any model call
  - _Requirements: 2, 3_

- [ ] 4. Watchdog
  - [ ] 4.1 Counters atomic with ledger writes; pre-call + post-write cap checks; trip logic + notifier; manual re-enable endpoint
  - [ ] 4.2 Acceptance: simulated spend past cap trips within the crossing request; button re-enables
  - _Requirements: 6_

- [ ] 5. Ledger unification (D32)
  - [ ] 5.1 Real per-call cost via `estimateCost()`/provider usage; kill the `estimatedCost: 0.001` placeholder
  - [ ] 5.2 Reflink `spendUsed` derived from ledger writes; budget-status reflects reality
  - [ ] 5.3 Semantic pipeline actuals mirrored to ledger (with `semantic-content` task 2)
  - _Requirements: 5, 7.3_

- [ ] 6. Public visibility flip (D31)
  - [ ] 6.1 Replace `public-access-manager` JSON config with `AIPublicAccessSettings`; default = text-chat tier
  - [ ] 6.2 AI pill visible to anonymous visitors in text mode; voice affordance only with reflink
  - _Requirements: 2.3_

- [ ] 7. Admin Access & Spend panel
  - [ ] 7.1 Extend `/admin/ai/rate-limiting`: toggles, knobs, caps, live gauges, trip history, re-enable
  - _Requirements: 8_

- [ ] 8. Voice session caps — *with `ai-assistant`*
  - [ ] 8.1 Duration caps enforced at token mint for all voice providers
  - _Requirements: 2.4_

## Backlog

Optional bearer keys for MCP (if abuse warrants — `mcp-server` backlog mirrors this); anomaly-detection heuristics beyond current abuse detection; per-country blocks.
