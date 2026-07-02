# access-and-cost — Design

**Status:** current — target design (Phase 2 build); existing pieces noted
**Owner domain:** gateway, tiers, public chat, rate limits, reflinks, ledger, watchdog
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. The gateway (`src/lib/ai/gateway.ts`, new)

A wrapper (higher-order handler) applied to every cost-incurring route:

```
withAIGateway(handler, { feature, costKind, publicAllowed, toolContext? })
  1 killSwitch()        // AIGlobalLimits row; ~30s per-instance memo; fail closed for public
  2 resolveTier(req)    // reflink token → validated session | AIPublicAccessSettings tier
  3 validateSession(req)// public: signed HttpOnly JWT bound to hashed IP (skip for reflink)
  4 rateLimit(tier)     // sliding windows: hashed IP + session; reflink budgets additionally
  5 handler(ctx)        // executes; returns usage
  6 meter(usage)        // AIUsageLog write + atomic watchdog counters + post-check caps
```

Wrapped routes: `/api/ai/chat`, `/api/ai/chat/session` (steps 1,4 only), `/api/ai/openai/session`, `/api/ai/elevenlabs/token`, future Google session route, `/api/ai/tools/execute`, `/api/ai/analyze-job`, `/api/mcp` (see `mcp-server`), semantic regeneration starts. Acceptance is a grep-provable invariant: no cost-incurring route without `withAIGateway`.

**Tool allowlist enforcement** lives inside step 2's tier object and is checked again in `/api/ai/tools/execute` at dispatch — public tier: `content_search`, `content_get`, `ui_intent`, `ui_describe`.

## 2. Data models

| Model | Status | Purpose |
|---|---|---|
| `AIUsageLog` | exists — extend | + `feature` tag, `hashedIp`, `sessionId`, computed `costUsd` (D38); single spend record |
| `AIGlobalLimits` | **new** | caps, counters, `status active|tripped`, `trippedAt/Reason`, `publicAIEnabled`, `disableReflinksOnTrip` |
| `AIPublicAccessSettings` | **new** (replaces JSON config in `public-access-manager`) | public tier (default text-chat), Turnstile toggle, session caps |
| `AIRateLimit`, `AIRateLimitLog` | exist | Postgres-backed sliding windows (already serverless-honest) |
| `AIReflink` | exists | features, budgets, expiry; `spendUsed` becomes ledger-derived |
| `AIIPBlacklist` | exists | manual/automatic blocks feeding gateway step 4 |

## 3. Public chat flow

```
Pill (anonymous) → POST /api/ai/chat/session
   Turnstile verify (if enabled) + per-IP issuance cap
   → signed JWT (HttpOnly, short TTL, hashedIp claim)
→ POST /api/ai/chat  { message, history? }
   gateway (full chain) → reasoning adapter, alias default-cheap,
   public tool allowlist → response + usage → ledger
```

Stateless: history rides in the request (bounded) or a conversation row; no server session memory (D43). The voice path never opens for public tier; the pill's voice affordance renders only when tier grants it.

## 4. Watchdog mechanics

- Counters on `AIGlobalLimits` updated in the same transaction as the ledger write; post-write cap check trips the switch inside the request that crossed it.
- Trip → `status='tripped'`, notify via existing `security-notifier`, public AI off; reflinks per config.
- Re-enable: admin button only. Day/month counter resets (cron or lazy on read) never auto-clear a trip.
- Fail closed: unreadable limits row/ledger ⇒ reject public, allow admin.

## 5. Existing code disposition

| Existing | Disposition |
|---|---|
| `src/lib/middleware/rate-limiting.ts` (`withRateLimit`, unwired) | Superseded by gateway step 4 — wire its logic in or delete |
| `rate-limiter.ts` (DB-backed) | Reuse as the sliding-window engine |
| `public-access-manager.ts` (JSON config, default `disabled`) | Replace with `AIPublicAccessSettings` (default text-chat tier, D31) |
| Abuse detection + blacklist + notifications routes | Keep; integrate signals into gateway decisions |
| `/api/ai/rate-limit/status`, `/api/ai/feature-availability`, `/api/ai/public-access`, `/api/ai/upgrade-message` | Re-point to tier/settings models; delete any that only served mocks |
| `estimatedCost: 0.001` placeholder in `/api/ai/tools/execute` | Replaced by step 6 metering with real `estimateCost()` |

## 6. Admin panel

Extend `/admin/ai/rate-limiting` → **Access & Spend**: toggles (public chat, Turnstile), knobs (limits, caps), live gauges (ledger aggregation), trip history + re-enable. Uses admin shell conventions (`admin-cms`).
