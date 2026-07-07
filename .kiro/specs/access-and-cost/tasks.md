# access-and-cost — Tasks

**Status:** current — Phase 2 core landed 2026-07-05 (tasks 1–7 done; 8 defers to Phase 4 voice)
**Owner domain:** gateway, tiers, public chat, rate limits, reflinks, ledger, watchdog
**Last verified against code:** 2026-07-05 (staging branch, post-build)

---

## Already implemented (verified on branch)

Postgres-backed rate-limit tables + engine (`rate-limiter.ts`) — **built but unwired**; reflink CRUD/validation (`/api/ai/reflink/validate` canonical) with budget fields; IP blacklist + abuse detection + security notifications; `AIUsageLog` model (missing feature/hashedIp/session fields and real cost writes); public-access-manager (JSON config, default `disabled` — to be replaced).

## Open tasks (Phase 2 unless noted)

- [x] 1. Schema — *done 2026-07-05*
  - [x] 1.1 `AIGlobalLimits` + `AIPublicAccessSettings` models; extend `AIUsageLog` (feature tag, hashedIp, requestId, provider, input/output token split, costUsd Decimal(10,6)). Added seed tables `AIModelAlias` (D4) + `AIModelPricing` (D38). Migration `20260705205427_access_and_cost_phase2`.
  - _Requirements: 5, 6.1_

- [x] 2. Gateway — *done 2026-07-05*
  - [x] 2.1 `withAIGateway` 6-step chain in `src/lib/ai/gateway.ts`, fail-closed for public on any limits/settings read failure
  - [x] 2.2 Wired: `/api/ai/chat`, `/api/ai/chat/session`, `/api/ai/openai/session`, `/api/ai/openai/token` (legacy), `/api/ai/elevenlabs/token`, `/api/ai/tools/execute`, `/api/ai/analyze-job`, admin editing AI (4 routes), semantic starts (9 routes). MCP joins Phase 4.
  - [x] 2.3 `check:gateway` (explicit list + heuristic scan + justified allowlist) proves no unguarded route. Unit tests deferred to verification task 6 (Playwright); acceptance is the e2e HTTP suite (15 assertions, all passing).
  - [x] 2.4 Deleted `withRateLimit` middleware (`src/lib/middleware/rate-limiting.ts`)
  - [x] 2.5 `resolveDebugAuth` + `_debug` envelope (verification task 3); negative test confirms envelope absent when unauthorized
  - _Requirements: 1_

- [x] 3. Public text chat — *done 2026-07-05*
  - [x] 3.1 `POST /api/ai/chat/session`: Turnstile-gated (fail-closed when unconfigured; dev uses CF test keys), IP-bound HttpOnly JWT, per-IP issuance caps
  - [x] 3.2 `POST /api/ai/chat`: gateway-wrapped, `default-cheap` via reasoning adapters (OpenAI + Fake), public tool allowlist, bounded stateless history
  - [x] 3.3 Allowlist enforced at tier and re-checked at `/api/ai/tools/execute` dispatch
  - [x] 3.4 Acceptance verified: anonymous chat works (real gpt-4o-mini, grounded); no-token/forged-token rejected before any model call
  - _Requirements: 2, 3_

- [x] 4. Watchdog — *done 2026-07-05*
  - [x] 4.1 Counters atomic with ledger write (row lock in `recordUsage` transaction); pre-call cached ≤30s check + post-write cap re-check; trip → security-notifier; manual re-enable endpoint `/api/admin/ai/global-limits/reenable`
  - [x] 4.2 Acceptance verified: crossing write trips within the request; re-enable restores; counters not auto-cleared on re-enable
  - _Requirements: 6_

- [x] 5. Ledger unification (D32) — *done 2026-07-05*
  - [x] 5.1 Real per-call cost via `estimateCost()` over `AIModelPricing`; `estimatedCost: 0.001` placeholder gone
  - [x] 5.2 Reflink `spendUsed` ledger-derived (widened to Decimal(12,6); verified accumulating)
  - [x] 5.3 Semantic actuals mirrored to ledger (embedding/summary/query_embedding feature-tagged `semantic`); local pricing tables deleted
  - _Requirements: 5, 7.3_

- [x] 6. Public visibility flip (D31) — *done 2026-07-05*
  - [x] 6.1 `PublicAccessManager` re-pointed at `AIPublicAccessSettings` (default text_chat)
  - [x] 6.2 Pill visible to anonymous visitors; anonymous text routes to `/api/ai/chat` (public-chat-client); voice affordance stays reflink-only
  - _Requirements: 2.3_

- [x] 7. Admin Access & Spend panel — *done 2026-07-05*
  - [x] 7.1 `AccessAndSpendPanel` on `/admin/ai/rate-limiting`: watchdog status/caps/toggles/re-enable/trip history, public access knobs, per-feature ledger gauges. UI rendered but not yet driven in a browser session (API-level verified).
  - _Requirements: 8_

- [ ] 8. Voice session caps — *with `ai-assistant` (Phase 4 voice work)*
  - [ ] 8.1 Duration caps enforced at token mint for all voice providers
  - _Requirements: 2.4_

## Shipped additions

- **IP exception whitelist (owner request, shipped 2026-07-07):** `AIIPWhitelist` table (migration `20260707070000_ip_whitelist`) + `blacklist-manager` enforcement — whitelisted IPs are never blacklisted, violations against them are ignored, manual blacklisting is refused, and `isBlacklisted()` (the gateway's step-4 check) short-circuits to allowed. Admin: `/api/admin/ai/whitelist` (GET/POST/DELETE) + an "IP Exceptions" card on /admin/ai/security with per-blacklist-row "Add exception" (adding an exception also lifts an existing block). Verified through the admin UI end-to-end (add → listed → violations ignored → manual blacklist refused → remove). Origin story: jest suites were writing REAL blacklist rows (the `@jest/globals` jest-import defeats `jest.mock` hoisting — fixed; suites now hermetic and 16/16 green).

## Follow-ups filed during the Phase 2 build (2026-07-05)

- **Pill anonymous text mode is wired but unverified in-browser.** `floating-ai-interface.tsx`
  routes the public tier through `/api/ai/chat` via `public-chat-client`; the API path is
  fully verified, but the pill UI itself was not driven in a browser session this phase.
  Verify with Playwright when verification task 6.2 lands. Ties to `ai-assistant` 5c.4/5d.
- **Turnstile widget rendering is a deploy-time step.** Dev uses Cloudflare test keys that
  accept any token, so the client sends a placeholder without rendering the widget. Real
  deploy must render the Turnstile widget to produce genuine tokens and swap in real keys
  (documented in CLAUDE.md §Environment).
- **`_debug.usage` reflects only the metered call, not multi-round tool-loop totals** beyond
  what `ctx.meter` receives — acceptable; the ledger row is authoritative.
- **Legacy `/api/ai/openai/token`** is now gateway-wrapped but still slated for hard delete in
  Phase 3.3 (duplicate of `/api/ai/openai/session`).
- **Pre-existing bug (not Phase 2):** `POST /api/admin/semantic/processing/start` with
  `scope: 'all'` throws on `projectAIIndex.upsert({ where: { projectId: undefined } })`
  (`StageBasedProcessingService.batchStoreChunks`). Per-project scope works. Resolves with
  D37 (`ProjectAIIndex` retirement) in Phase 3.6.

## Backlog

Optional bearer keys for MCP (if abuse warrants — `mcp-server` backlog mirrors this); anomaly-detection heuristics beyond current abuse detection; per-country blocks.

**Reflink leak containment / dedup (owner, 2026-07-06):** a leaked reflink must not open premium access to the whole internet — today the bound is only the per-reflink budget + global watchdog. Candidate measures, in rough order of value: (a) bind each reflink to its first N distinct hashed IPs (small allowlist written on first use; excess IPs rejected + owner notified); (b) per-IP sub-limits *within* a reflink (reuse the existing hashed-IP windows keyed `reflinkId:hashedIp`); (c) Turnstile challenge on reflink session start, not just the public tier; (d) owner notification on multi-IP usage spikes via security-notifier. Raw IPs stay unstored (Req 9). Sizing: (a)+(b) are small — schema column + gateway step-4 extension. Do with Phase 4 voice caps (task 8) or earlier if reflinks get distributed while the public tier is live.
