# access-and-cost — Requirements

**Status:** current — **mostly unimplemented** (libraries exist, enforcement does not); this is the Phase 2 build
**Owner domain:** AI gateway, public access tiers, public text chat, session tokens + bot challenge, rate limiting, reflinks, unified usage ledger, global spend watchdog
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D24, D31, D32, D33, D38, D42, D43
**Contracts:**

| Consumes | From |
|---|---|
| `estimateCost()` pricing module, `default-cheap` alias | `ai-admin` |
| Reasoning adapters for the public chat endpoint | `ai-admin` |
| Tool registry + public tool allowlist enforcement point (`/api/ai/tools/execute`) | `ai-assistant` |
| Admin shell | `admin-cms` |

| Provides | To |
|---|---|
| AI Gateway wrapper (`gateway.ts`) | every cost-incurring route: chat, voice token mints, tools/execute, analyze-job, MCP, semantic regeneration |
| `AIUsageLog` (unified ledger), `AIGlobalLimits`, `AIPublicAccessSettings`, `AIRateLimit*`, `AIReflink`, `AIIPBlacklist` models | all AI specs |
| `POST /api/ai/chat/session`, `POST /api/ai/chat` (public text tier) | AI pill |
| `POST /api/ai/reflink/validate` (canonical, D24), reflink budget status | `ai-assistant` |
| Access & Spend admin panel | owner |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — AI Gateway (D33)

**User story:** As the owner, I want one chokepoint for every cost-incurring call, so that no route can ship unguarded.

1. WHEN any cost-incurring route executes (`/api/ai/chat`, `/api/ai/openai/session`, `/api/ai/elevenlabs/token`, future Google session route, `/api/ai/tools/execute`, `/api/ai/analyze-job`, MCP tool calls, semantic regeneration jobs) THEN it SHALL pass through the gateway wrapper, in this order: **kill switch → access tier → session validation → rate limits → execute + meter**.
2. WHEN the gateway cannot read the limits row or ledger THEN public requests SHALL be rejected (**fail closed**).
3. WHEN a route is added THEN CI/grep checks SHALL prove no unguarded cost-incurring route exists.
4. The existing unwired `withRateLimit` middleware is either wired via the gateway or deleted — enforcement, not library code, is the requirement.

## Requirement 2 — Public access tiers (D31)

**User story:** As the owner, I want anonymous visitors to get useful-but-bounded AI access, so that the showcase is public without being an open wallet.

1. WHEN an anonymous visitor uses AI THEN they SHALL get **text chat** (rate-limited, bot-challenged, watchdog-protected) with a **strict tool allowlist**: `content_search`, `content_get`, `ui_intent`, `ui_describe` only — never file upload, form, or job-spec tools.
2. WHEN a visitor holds a valid reflink THEN tier resolution SHALL grant the reflink's features (voice, job analysis, uploads) and budgets.
3. THE AI pill SHALL be visible to everyone; `publicAIAccess` default changes from `'disabled'` to the text-chat tier, stored in DB-backed `AIPublicAccessSettings` (not JSON config).
4. **Voice is never available publicly** — the expensive modality stays invitation-only; reflink voice tokens carry server-enforced duration caps at mint.

## Requirement 3 — Public chat sessions and bot challenge

**User story:** As the owner, I want scripted abuse to fail before any model call, so that bots cost me nothing.

1. WHEN public chat is used THEN a **signed session token** (HttpOnly cookie, short-lived JWT, bound to the issuing hashed IP) SHALL be required, issued by `POST /api/ai/chat/session`.
2. WHEN a session is issued THEN **Cloudflare Turnstile** verification SHALL gate issuance (admin-toggleable), plus per-IP session-creation caps.
3. WHEN `/api/ai/chat` is called without a valid session token THEN it SHALL be rejected before any model call.
4. WHEN public chat executes THEN it SHALL use the `default-cheap` model alias via the reasoning adapters.

## Requirement 4 — Rate limiting

**User story:** As the owner, I want layered rate limits, so that any single actor is bounded.

1. WHEN requests arrive THEN sliding-window limits SHALL apply keyed on **hashed IP + session ID** (raw IPs never stored), backed by the `AIRateLimit` tables in Postgres (serverless-honest, D43).
2. Configurable dimensions: messages/minute, messages/day, tokens/day per IP; concurrent-session cap per IP.
3. WHEN reflink traffic arrives THEN per-reflink token/spend budgets SHALL additionally apply, deducted from real ledger writes (closing the `estimatedCost: 0.001` placeholder TODO).
4. WHEN abuse patterns trigger THEN the existing blacklist (`AIIPBlacklist`) and security-notifier channels SHALL integrate with gateway decisions.

## Requirement 5 — Unified usage ledger (D32)

**User story:** As the owner, I want one cost record, so that budgets, reflinks, and the watchdog all read the same truth.

1. WHEN any AI spend occurs (voice, chat, tools, embeddings, summaries, MCP) THEN a ledger row SHALL be written to `AIUsageLog`: tokens, computed cost (D38), provider, model, **feature tag** (`chat|voice|tools|semantic|mcp|admin-edit`), hashed IP, session ID, reflink ID.
2. WHEN reflink `spendUsed` or watchdog counters are needed THEN they SHALL derive from ledger writes — no parallel cost systems.

## Requirement 6 — Global spend watchdog

**User story:** As the owner, I want a kill switch, so that a runaway or attack is bounded in dollars.

1. `AIGlobalLimits` (single row) SHALL hold `dailySpendCapUsd`, `monthlySpendCapUsd`, current-day/month counters, `status: active|tripped`, `trippedAt`, `tripReason`, `publicAIEnabled`, `disableReflinksOnTrip`.
2. WHEN each call starts THEN caps are checked (cached ≤ 30s per instance, best-effort); WHEN each ledger write lands THEN counters update atomically and caps re-check — a burst crossing the cap trips within one request.
3. WHEN tripped THEN public AI SHALL disable globally (reflink behavior per `disableReflinksOnTrip`), the admin SHALL be notified via the existing security-notifier, and **re-enable is manual only** (daily reset does not auto-clear a trip).
4. WHEN the visitor sees a tripped state THEN messaging SHALL be friendly ("the assistant is resting"), not an error dump.

## Requirement 7 — Reflinks

**User story:** As the owner, I want invitation links with budgets, so that recruiters get premium access I control.

1. WHEN reflinks are managed THEN admin CRUD (`/api/admin/ai/reflinks*`) SHALL support per-reflink features (voice, job analysis, uploads), token/spend budgets, expiry, usage reset, and personalized context.
2. WHEN a reflink is validated THEN `POST /api/ai/reflink/validate` is the **only** validation endpoint (D24).
3. WHEN a reflink session runs THEN budget status SHALL be queryable (`/api/ai/reflink/budget-status`) and enforcement SHALL read real ledger-derived spend.

## Requirement 8 — Admin Access & Spend panel

**User story:** As the owner, I want the controls in one panel, so that operating the system is simple.

1. WHEN the panel loads (extension of `/admin/ai/rate-limiting`) THEN it SHALL expose: public chat on/off, per-IP/session limit knobs, Turnstile toggle, daily/monthly caps, live spend-vs-cap gauges (from the ledger), trip history, manual re-enable button. Reflink budgets remain on `/admin/ai/reflinks`.

## Requirement 9 — Privacy & security posture

1. All enforcement server-side; client state advisory only. IPs stored hashed. Session tokens IP-bound. PRIVATE content unreachable from public sessions (enforced in service layer). MCP and chat share this gateway so the watchdog covers every entry point. A determined adversary with unlimited IPs is *bounded* (by the watchdog), not stopped — that is the design goal, stated honestly.
