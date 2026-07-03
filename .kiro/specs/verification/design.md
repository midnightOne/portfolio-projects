# verification — Design

**Status:** current — target design; builds incrementally with each phase (D46)
**Owner domain:** agentic e2e verification infrastructure
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. The loop this enables

```
Agent session:
  read CLAUDE.md → load owning spec → implement
  → npm run verify                       (deterministic: types, lint, unit, check:*, Playwright+fakes)
  → preview_start / browser: drive the UI as a human
  → act (chat message, ingestion, tool call) with debug authorization
  → read _debug envelope + telemetry endpoints → assert side effects
  → (phase completion) npm run livefire:* → real pipeline, capped spend
  → report pass/fail against the spec's acceptance criteria
```

## 2. Debug envelope (Req 4)

Gateway-integrated (`access-and-cost` design §1 gains step 2b: `resolveDebugAuth`):

```jsonc
// appended to authorized responses as "_debug"
{
  "requestId": "...",             // correlates with telemetry reads
  "tier": "public|reflink|admin", "rateLimit": { "remainingMinute": 4, "remainingDay": 96 },
  "model": { "alias": "default-cheap", "resolved": "<provider/model>" },
  "retrieval": [ { "chunkId": "...", "tier": 3, "score": 0.87, "projectSlug": "fixture" } ],
  "toolCalls": [ { "name": "content_search", "args": {...}, "ms": 142, "ok": true } ],
  "usage": { "inputTokens": 812, "outputTokens": 240, "costUsd": 0.0004, "ledgerId": "..." },
  "timings": { "totalMs": 1490, "modelMs": 1180 }
}
```

Authorization: admin session **or** `DEV_VERIFICATION=true` (env; never set in production deployments — deploy checklist + a boot-time warning if set with `NODE_ENV=production`). Unauthorized: field stripped, no behavioral difference, and the attempt is not an error (indistinguishable from normal traffic). Contents are tier-safe by construction: the envelope describes *this request's own* processing only.

## 3. Test doubles (Req 3)

| Fake | Seam | Behavior |
|---|---|---|
| `FakeReasoningAdapter` | D39 adapter interface | Scripted turns: pattern → response and/or tool-call sequence; emits fake `usage`; deterministic |
| `FakeVoiceAdapter` | `IConversationalAgentAdapter` | Text-driven "voice" session: scripted transcripts, real tool round-trips through the registry, real F-I-D consumption, real conversation logging — everything but audio/WebRTC |
| Fake embeddings | embedding call site (`ai-admin` alias `default-embedding`) | `vector = normalize(sha256-derived pseudorandom(content))` — stable per content, exercises pgvector/HNSW/search for real |

Selection: `AI_FAKE_MODE=reasoning,voice,embeddings` consumed by the provider factories/registries. Guard: factory refuses fake mode when `NODE_ENV=production`.

## 4. Fixture (Req 2)

`prisma/seed-fixture.ts` (or `scripts/seed-fixture.ts`): one project ("Verification Fixture") with authored Tiptap JSON — 4 H2 sections, one carousel, one download, one internal link; expectations file (`fixtures/expected-semantic.json`): tier counts, canonical query → expected top chunk. Plus dev admin user (env credentials), one reflink (known code/budget), public tier enabled. `check:semantic` compares DB state to the expectations file after ingestion (works identically under fake or real embeddings — ranking assertions relaxed under fakes).

## 5. Check scripts (Req 6)

Plain Node/TS scripts under `scripts/checks/`, each exiting nonzero with a named-requirement message:

- `check:gateway` — static scan: every route matching cost-incurring patterns imports/wraps `withAIGateway`.
- `check:models` — grep for model-ID patterns outside seed/config/registry.
- `check:specs` — status headers present, no duplicate `Requirement N` per file, no prescriptive T4.
- `check:semantic` — fixture expectations (needs DB).
- `npm run verify` = type-check + lint + unit + `check:*` + `playwright test --grep-invert @livefire`.

## 6. Live-fire (Req 7)

`scripts/livefire/`: each script prints a human/agent-readable report and writes nothing outside the fixture project. Budget-gated via `SemanticBudget` + a hard per-run cap; requires real keys present and explicit invocation. Cadence: per phase completion (recorded in the phase's ledger acceptance), plus on demand when fakes are suspected of drifting.

## 7. Browser-driving conventions (Req 6.3)

The `SemanticIDRegistry` already gives stable semantic IDs to AI-navigable surfaces — reuse those as test selectors wherever they exist (one source of stability for both the AI and the tests, and Playwright coverage doubles as a regression net for `ui_intent` targets). Elsewhere: `data-testid`. Dev admin login: credentials from env, documented in CLAUDE.md — never real credentials.

## 8. What this spec deliberately does not do

No CI ownership (Phase 5, `access-and-cost`-style CI checks fold `npm run verify` in); no synthetic-monitoring/production probes (out of scope for a portfolio); no load testing; no test-only forks inside feature code (fakes live behind existing seams or they don't get built).
