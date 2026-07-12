# verification — Requirements

**Status:** current — foundation implemented; deterministic voice, correlated telemetry reads, browser e2e, formal live-fire, and remote CI activation remain open (D46: verification ships *with* the feature it verifies, never after)
**Owner domain:** agentic end-to-end verification infrastructure: dev harness, test doubles, seed fixtures, executable acceptance checks, authorized runtime introspection (debug envelope + telemetry access), live-fire runs, CLAUDE.md
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D46 (owner), D43 (serverless-honest), D39/D45 (adapter seams make fakes possible)
**Contracts:**

| Consumes | From |
|---|---|
| Adapter interfaces to fake (`IConversationalAgentAdapter`, reasoning adapter, embedding calls) | `ai-assistant`, `ai-admin` |
| Gateway (debug-envelope authorization + stripping happens there) | `access-and-cost` |
| Conversation logs, ledger, semantic operations (telemetry reads) | `ai-assistant`, `access-and-cost`, `semantic-content` |
| Admin session auth | `portfolio-core` |

| Provides | To |
|---|---|
| `CLAUDE.md`, `.claude/launch.json` | every agent session |
| Fakes, fixture seed, `npm run check:*`, live-fire scripts | all specs' acceptance criteria |
| `_debug` envelope contract + verification telemetry endpoints | agent sessions, admin debugging |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Purpose (owner intent, 2026-07-02)

The agent building a feature must be able to **run it end-to-end in-session, every iteration**: boot the app, drive the UI as a human would, talk to the models, push real data through the real pipeline, and read the system's own telemetry to confirm what happened — through access points that are *authorized for it* and closed to everyone else. Verification-by-construction is the anti-tech-debt mechanism; a feature without its verification path is not done.

## Requirement 1 — Session bootstrap (CLAUDE.md + launch config)

**User story:** As an agent session, I want a repo map and a startable app, so that any session can verify without re-deriving the environment.

1. `CLAUDE.md` at the repo root SHALL document: commands, env matrix, spec map (pointer to `00-overview`), the verification approach (this spec), and per-subsystem verification recipes — kept current as phases land (staleness here is a defect).
2. `.claude/launch.json` SHALL define the dev server so agent tooling can start and drive the app (preview/browser automation).
3. WHEN the dev environment boots THEN a working database SHALL be one command away (Requirement 2).

## Requirement 2 — Dev database + seed fixture

**User story:** As an agent, I want a deterministic dataset, so that pipeline results are assertable, not eyeballable.

1. A reproducible dev database with pgvector SHALL be available (Docker Compose Postgres+pgvector, or a dedicated Neon dev branch — decide at build time; both documented in CLAUDE.md).
2. `npm run seed:fixture` SHALL create the **fixture project**: known Tiptap content with a defined heading structure whose expected semantic output is written down (T0/T1 present, expected T2 count, expected T3 count ± tolerance, expected top hit for a canonical query).
3. WHEN the fixture is ingested THEN assertions against those expectations SHALL be runnable (`npm run check:semantic`).
4. Seeding SHALL also provision: an admin user (dev credentials from env), one reflink with known budget, and public-tier settings — so every access tier is exercisable.

## Requirement 3 — Deterministic test doubles

**User story:** As an agent, I want to run the full stack without live keys or nondeterminism, so that e2e tests are fast, free, and stable.

1. `FakeReasoningAdapter` SHALL implement the D39 interface with scripted responses and scripted tool calls (declared in the test, echoed with provenance), plus fake `usage` so metering paths run.
2. `FakeVoiceAdapter` SHALL implement `IConversationalAgentAdapter` (no WebRTC): drives the pill, tool round-trips, F-I-D injection, transcripts, and conversation logging deterministically.
3. A fake embedding provider SHALL produce **stable deterministic vectors** (content-hash-derived) so vector writes, HNSW queries, and search ranking are exercised without OpenAI calls.
4. Fakes are selected by env/config (`AI_FAKE_MODE`), SHALL never be selectable in production, and live behind the same registries/factories as real providers — zero test-only forks in consumer code.

## Requirement 4 — Authorized runtime introspection (the access points)

**User story:** As an authorized agent or the admin, I want the system to tell me what it actually did inside a response, so that verifying behavior doesn't require log spelunking.

1. WHEN a request is **debug-authorized** THEN AI responses (chat, tools/execute, analyze-job, semantic operations) MAY carry a `_debug` envelope: resolved tier + rate-limit state, model/alias actually used, retrieved chunk IDs + scores (for RAG calls), tool-call trace, token usage + computed cost, ledger row ID, stage timings.
2. Debug authorization SHALL be: an authenticated admin session, OR a dev-environment flag (`DEV_VERIFICATION=true`) — evaluated **in the gateway**; in production without admin auth the envelope is stripped and the request is treated as normal public traffic. This is enforcement-grade (tests attempt to obtain the envelope unauthorized), not a convention.
3. The envelope SHALL never include secrets, raw IPs, other sessions' data, or PRIVATE content beyond what the caller's tier could already access.

## Requirement 5 — Telemetry read access

**User story:** As an authorized agent, I want to query what the system recorded, so that I can verify side effects (logs, ledger, index state) after acting.

1. Admin-gated read endpoints SHALL allow querying, by session/operation ID: conversation logs + tool traces (`ai-assistant` history/replay — exists, formalize), ledger entries (`access-and-cost`), semantic operation results + chunk state (`semantic-content` dashboard APIs — exist).
2. WHEN a verification flow acts (e.g., sends a chat message, runs an ingestion) THEN the recorded telemetry SHALL be retrievable within the same session, correlated by the IDs returned in `_debug`.

## Requirement 6 — Executable acceptance checks

**User story:** As an agent, I want acceptance criteria to be commands, so that "verified" is a pass/fail fact.

1. Ledger acceptance criteria that are grep/query-shaped SHALL become `npm run check:*` scripts as their phase lands — initial set: `check:gateway` (no unguarded cost-incurring route), `check:models` (no model IDs outside seed/config), `check:specs` (status headers, no duplicate requirement numbers, no prescriptive T4), `check:semantic` (fixture expectations, Req 2.3).
2. `npm run verify` SHALL run the full deterministic suite: type-check, lint, unit tests, check scripts, and Playwright-with-fakes.
3. Playwright e2e (with fakes) SHALL cover visitor-critical paths (SSR pages, pill text chat, `ui_intent` navigation, admin login + save round-trip), with stable selectors (semantic IDs / data-testid) and tests tagged by the spec requirement they prove.

## Requirement 7 — Live-fire verification runs

**User story:** As the owner, I want real data through the real pipeline periodically, so that fakes never drift from reality.

1. `npm run livefire:semantic` SHALL ingest the fixture project through **real** embeddings/summaries (cost: pennies; budget-gated) and run the Req 2.3 assertions plus a real `content_search`.
2. `npm run livefire:chat` SHALL exercise the real `default-cheap` chat path (grounding question about the fixture; asserts a ledger row was written and the `_debug` retrieval trace cites fixture chunks).
3. Voice live-fire stays semi-manual: scripted session setup + the agent (or owner) conversing and judging output; the agent CAN evaluate transcript quality and tool-call correctness from the persisted log + `_debug` traces afterward. Cascade voice (D45) adds the shared-brain check (same question, text vs voice, same grounded answer).
4. Live-fire runs are gated by explicit invocation + capped keys/budget (never in CI by default), and SHALL be run at least once per phase completion and before any release-like milestone.

## Requirement 8 — Definition of done (D46, binding on all specs)

1. A task in any spec's ledger MAY be checked `[x]` only when: unit/integration tests pass, relevant `check:*` scripts pass, the feature's e2e path (fakes) runs, and — for phase completion — a live-fire run has validated the real path.
2. WHEN a new feature adds a cost-incurring route, tool, or pipeline stage THEN its verification hooks (`_debug` coverage, telemetry correlation, check script or Playwright tag) SHALL land in the same change.
3. Each spec's tasks.md acceptance criteria SHALL name the concrete verification (script/tag/recipe) once this infrastructure exists.
