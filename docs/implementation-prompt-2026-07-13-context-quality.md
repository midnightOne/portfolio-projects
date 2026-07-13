# Implementation prompt — profile quality, classifier hardening, fid pull diet (2026-07-13 batch)

Paste this prompt into a fresh implementation session for the portfolio repo.

---

Work in `C:\Users\imidn\Portfolio\portfolio-projects` on branch `claude/semantic-content-management-review` (staging — NEVER touch or merge to `main`). Read `CLAUDE.md` first (dev DB keepalive, commands, D46 verification loop). The authoritative scope is in the specs — read these before writing code; the task text there is richer than this prompt:

- `.kiro/specs/conversation-engine/tasks.md` **Block N (N1–N5)** + `requirements.md` **Req 19.2 / 19.3 / 19.4 / 19.8** (all amended 2026-07-13 — read the amendments, they encode owner rulings).
- `.kiro/specs/ai-assistant/tasks.md` **7.1a + 7.1e + 7.1f** (fid diet + `ui_details` pull tool), **7.11** (resume speech policy), **7.12** (reflink entry field). If you touch mint guidance, the **7.2a** rider (soft probe-deflection line) rides along; otherwise leave 7.2a for its own session.

## Suggested order (dependency-aware)

1. **N3 + N4** (small, pure-module): omission semantics in `applySummarizerProfile` (`src/lib/ai/engine/summarizer.ts`) + quote-frame escaping / injection-as-signal clauses in `summarizer.ts` and `src/lib/ai/engine/cheap-call.ts`. Unit tests both.
2. **N1** split summarizer: two `runSecondaryLLMJob` calls in `runSummarizerJob` (`src/lib/services/ai/engine-runtime.ts` ~line 283) — profile call over VISITOR turns only, summary call over both; window excludes rows before the first user turn and transcription-noise rows. `getTurnsSince` lives in `src/lib/services/ai/conversation-history-manager.ts` ~line 1060.
3. **N2** ordinal grading + hysteresis: `none|weak|clear|strong` per flag from the classifier (never floats — owner ruling), host-side signal ring in `EngineState` (`src/lib/ai/engine/types.ts` — new key, defaulted on parse so pre-existing blobs read cleanly, P18), thresholds before enum flips, rubrics into both secondary prompts, probe-edge hysteresis in `src/lib/ai/engine/conditions/probe.ts` (the regex rail `src/lib/services/ai/probe-patterns.ts` keeps firing immediately).
4. **N5** category aliases: seed `default-classifier` + `default-summarizer` rows (prisma/seed.ts + dev DB), repoint the cheap-call site to `default-classifier` and N1's calls to `default-summarizer`. The existing `ModelAliasPanel` on /admin/ai is the owner UI — no new panel.
5. **7.1a + 7.1e + 7.1f** fid diet + pull tool: compact-text publish in `src/lib/ai/PassiveFIDManager.ts` → `UIManager` seam; keep `briefSummary` + `detailedSummary`, drop `projectSummary`; new client tool `ui_details` in the unified registry (`src/lib/ai/tools/`) reading the retained client-side buffer — zero server round-trip; no-repeat-if-NAV_CONTEXT-unchanged rule in its description. Mind the OpenAI adapter's `_compactFidForTransport` (it compacts the fid JSON pre-publish — the diet may make it dead weight; verify, don't assume).
6. **7.11** resume speech policy: adapter-side — skip the auto `response.create` on reconnects after the first resume in a conversation; briefing instruction "do not speak until the visitor does" in `src/lib/ai/resume-briefing.ts` for that case.
7. **7.12** reflink field on the basic-access notice (pill access-message card in `src/components/ai/floating-ai-interface.tsx`) → existing `?ref=` validation flow via the reflink-session provider. Standalone; can be done any time.

## Hard constraints (owner rulings — do not re-litigate)

- NO content-stripping of classifier inputs ("ignore all instructions" is the evidence, not noise).
- NO float confidences from the models — ordinal labels only; the host does the math.
- The regex probe rail stays untouched as the deterministic layer.
- Blip-resume semantics stay as-built (same conversation = full context); cross-conversation summary-once-at-start stays reflink-only (I3).
- Secondary-LLM prompt verbosity is free (never enters realtime context) — write detailed rubrics, don't economize there.

## Environment & traps

- Dev DB = WSL Postgres; keepalive + recovery commands in CLAUDE.md ("Dev database"). `default-cheap` resolves via `ai_model_aliases` (60s registry cache).
- Global singletons survive HMR — restart the dev server FRESH after adapter/pipeline edits.
- The pill mounts ONLY on `/` and `/about/ai`; never SPA-navigate during a live session; use homepage `#modal=<slug>` hash modals to trigger fid pushes.
- Admin login in a fresh Browser pane: env `ADMIN_USERNAME`/`ADMIN_PASSWORD`, NextAuth csrf→callback flow in PowerShell, inject only the session-token cookie.
- Voice drills without a mic: the Fake Mic panel (`[data-testid="fake-mic-connect"]`) on the admin-gated homepage dev panel; typed-input text-only sessions are the established fallback.
- **The 7.0 ContextDebugPanel is your evidence surface**: block tab (buffer entries + sizes), ledger tab (per-flush deltas + cumulative re-pushed tokens), mint tab (per-section sizes — its accuracy depends on the mint-route `mark()` checkpoints; keep them honest if you touch assembly), fid tab (raw vs published — this becomes the before/after proof for 7.1a).
- New routes: `npm run check:gateway` is content-driven — a read-only admin route needs no `withAIGateway`; anything calling providers does.
- Prisma NOT-json-filter drops key-missing rows — exclude in TS, not SQL, when filtering metadata.

## Definition of done (D46)

`npm run verify` green (type-check + check:gateway + check:specs + check:semantic --no-live + check:scenarios — expect scenario updates if flag semantics change golden behavior suites; use `--rebaseline` only with justification recorded in the ledger). Then drive it live: a fake-mic or text-only session reproducing the two field reports — (a) a recruiter saying "firmware engineering" must NOT flip register technical on one turn; (b) the summarizer must not surface assistant-volunteered topics; (c) `ui_details` answers an on-screen question with no server round-trip and is not re-called in an unchanged view; (d) a second forced resume reconnects silently. Update the Block N / 7.x checkboxes with evidence in the house style, bump spec status headers, run `npm run check:specs`, and commit to staging with `git commit -F -` (PS 5.1 quoting trap).
