# verification — Tasks

**Status:** current
**Owner domain:** agentic e2e verification infrastructure
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Sequencing rule (D46): each item lands with or before the phase whose features it verifies — this ledger is deliberately interleaved with the roadmap, not a phase of its own.**

---

## Already implemented (2026-07-02)

`CLAUDE.md` at repo root (session bootstrap + verification recipes); `.claude/launch.json` (dev server for agent preview tooling); `npm run diagnostics` (semantic health, pre-existing); admin conversation history/replay and semantic dashboard APIs (pre-existing telemetry reads, to be formalized in task 5).

## Open tasks

- [x] 1. Dev database + fixture — *done with Phase 0, 2026-07-03*
  - [x] 1.1 **Decision (owner): local Postgres** — project is out of deployment, iterate locally. Implemented as PostgreSQL 16 + pgvector 0.6 in WSL Ubuntu-24.04 (Docker not installed on the dev machine); documented in CLAUDE.md §Dev database incl. the WSL keepalive and 127.0.0.1 gotchas. Full migration history now replays on a fresh DB (misordered/missing migrations repaired: renamed `20241228_*`→`20250923040000_*`, timestamped `add_batch_embedding_jobs`, new `20260703193019_semantic_pipeline_catchup` with real HNSW DDL).
  - [x] 1.2 `npm run seed:fixture` (scripts/seed-fixture.ts): fixture project `verification-fixture-kiln` (deterministic markdown+Tiptap, 4 H2 sections, distinctive vocabulary), reflink `fixture-verify`; admin auth is env-based so no DB user. **Caveat: "public tier on" is impossible today — `publicAIAccess` is hardcoded `'disabled'` (placeholder load/save in PublicAccessManager); unblocks with access-and-cost Phase 2 (D31).** `fixtures/expected-semantic.json` written from a verified-good run.
  - [x] 1.3 `npm run check:semantic` (scripts/check-semantic.ts): 14 assertions — tier counts, embeddings, linkage, T3 title derivation, no-T4, plus a live canonical retrieval query through `ContentSearchService` (`--no-live` to skip). Passing as of 2026-07-03.
  - _Requirements: 2_

- [x] 2. Check scripts, first wave — *done with Phase 2, 2026-07-05*
  - [x] 2.1 `check:gateway` (`scripts/checks/check-gateway.ts`): explicit route list + heuristic scan for cost patterns + justified allowlist
  - [x] 2.2 `check:specs` (`scripts/checks/check-specs.ts`): status headers, duplicate `Requirement N`, prescriptive T4
  - [x] 2.3 `npm run verify` = type-check + check:gateway + check:specs + check:semantic --no-live
  - _Requirements: 6.1, 6.2_

- [x] 3. Debug envelope — *done with Phase 2 gateway, 2026-07-05*
  - [x] 3.1 `resolveDebugAuth` in the gateway (admin session ∨ `DEV_VERIFICATION=true`); production boot-time warning emitted
  - [x] 3.2 Envelope assembly (tier, rateLimit, model/alias, retrieval trace, tool trace, usage+ledgerId, timings) on chat, tools/execute, analyze-job, semantic starts
  - [x] 3.3 Negative test verified: with `DEV_VERIFICATION=false` and no admin session the envelope is absent and behavior unchanged
  - _Requirements: 4_

- [ ] 4. Test doubles — *4.1/4.2 done with Phase 2 (2026-07-05); 4.3/4.4 with Phase 3/voice*
  - [x] 4.1 `FakeReasoningAdapter` behind the D39 factory (`src/lib/ai/reasoning/`); `AI_FAKE_MODE=reasoning` selection + production guard (`src/lib/ai/fake-mode.ts`)
  - [x] 4.2 Fake embedding provider (sha256 unit vectors) behind `default-embedding` (`src/lib/ai/embeddings.ts`); verified deterministic, 1536-dim, unit-norm, production-guarded
  - [ ] 4.3 `FakeVoiceAdapter` behind the adapter registry (post-D21 single provider) — bypasses the provider entirely (deterministic transcripts/tool round-trips, no network)
  - [ ] 4.4 **Synthesized-audio input driver (D53) — dev-only voice e2e:** feed TTS-generated speech into an **emulated microphone track** so an automated agent (no human mic) exercises the *real* provider native-voice path (mic track → STT → model → TTS out). Distinct from 4.3: this drives the real provider, not a fake. Gated to dev/test via `AI_FAKE_MODE`/env, never production. Pairs with the mic-less text path (D52) to give full text-**and**-voice e2e coverage without a human; validates the D51 mode state machine. — *lands with the voice work (ai-assistant task 5c / 6 / 9)*
  - _Requirements: 3_

- [ ] 5. Telemetry read formalization — *with Phase 3 (D26 consolidation)*
  - [ ] 5.1 Query-by-`requestId`/session: conversation log + tool trace, ledger rows, semantic operation state (thin admin endpoints over existing services where missing)
  - _Requirements: 5_

- [ ] 6. Playwright suite — *starts Phase 3 (after test-page deletions), grows per phase*
  - [ ] 6.1 Harness + selector conventions (SemanticIDRegistry IDs, `data-testid`); dev admin login flow
  - [ ] 6.2 Visitor paths: SSR pages, project modal deep-link, pill text chat (fakes), `ui_intent` navigation
  - [ ] 6.3 Admin round-trip: login → edit fixture project → save → change detection triggered
  - [ ] 6.4 Tag tests by spec requirement (`@ai-assistant-R5.1` style)
  - _Requirements: 6.3_

- [ ] 7. Live-fire scripts — *7.2 exercised manually 2026-07-05; formal scripts pending*
  - [ ] 7.1 `livefire:semantic` (real ingestion of fixture, budget-capped, report) — the real ingestion path was run manually this phase (fixture re-embedded, check:semantic green); formalize as a script.
  - [~] 7.2 `livefire:chat` — done ad hoc: real `default-cheap` (gpt-4o-mini) grounding question through the running app produced a grounded answer, a ledger row, and a populated retrieval trace (content_search → content_get). Formalize into `scripts/livefire/`.
  - [ ] 7.3 Voice live-fire recipe (scripted setup + transcript/tool-trace evaluation from persisted logs); cascade shared-brain check added with D45
  - [ ] 7.3b Disconnect/resume drill (D49): kill the connection mid-conversation → resume (same and cross-provider) → assert markers in history, coherent continuation, single admin-replay timeline
  - [ ] 7.4 `check:models` joins the wave here (Phase 3.4 dependency)
  - _Requirements: 7_

- [ ] 8. `npm run check:models` + CI adoption — *Phase 5 folds `npm run verify` into GitHub Actions*
  - _Requirements: 6; roadmap 5.1–5.3_

## Backlog

**Dev DB → Docker Compose (owner, 2026-07-03 — postponed, do when WSL drops become annoying):** replace the WSL Postgres with `pgvector/pgvector:pg16` via `docker-compose.yml` (requires installing Docker Desktop — not present on the dev machine). Kills the WSL idle-shutdown failure class (VM reaps Postgres when the keepalive dies → app 500s "Failed to fetch projects"; recovery in CLAUDE.md); industry-standard, matches future CI. `DATABASE_URL` stays `127.0.0.1:5432`, migrations/seed unchanged.

Production synthetic probes; visual regression; load tests — all out of scope per design §8. `check:modularity` (import-boundary lint enforcing D48 dependency direction: core libs never import from `src/app/**`) — build when D48 extraction gets scheduled, or earlier if boundary violations start appearing in review.
