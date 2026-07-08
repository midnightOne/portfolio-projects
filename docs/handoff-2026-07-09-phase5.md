# Handoff 2026-07-09 — review Block C tail, finish Block D, execute Phase 5

You are resuming a long-running architecture-migration project on the Portfolio
repo. Your job this session has THREE phases: (1) critically REVIEW the last
session's work from Git, (2) finish Phase 4 BLOCK D (the last Phase 4 item,
small), then (3) execute PHASE 5 (CI & quality). Read CLAUDE.md at the repo
root FIRST, then the specs it points to. Do not trust this prompt over the
code — verify claims against the diff.

## REPO / GROUND RULES

- Working repo: `C:\Users\imidn\Portfolio\portfolio-projects` (the outer
  Portfolio dir is NOT the repo). Branch:
  `claude/semantic-content-management-review` (STAGING). NEVER merge into or
  touch `main` (D1 amended) — it's the deployable Vercel fallback. Commit per
  logical unit; do not push unless asked — and note Phase 5.1 (CI) only
  ACTIVATES after a push, so build the workflows locally and ask the owner
  before pushing anything.
- Local dev DB = WSL Postgres (keepalive gotcha in CLAUDE.md: WSL idles out
  and drops Postgres mid-session → restart `sleep infinity` +
  `service postgresql start`). Use 127.0.0.1, never localhost.
- Specs are authoritative (`.kiro/specs`); `00-overview/decision-registry.md`
  arbitrates. Never hardcode model IDs/prices (D4/D38).
- Definition of done (D46): type-check + build + test + check:* + the
  feature's e2e path exercised live.
- NEVER run `npm run build` / `rm -rf .next` / full `npm test` while a dev
  server is serving. Deleting ONE stale `.next/types/app/api/...` folder after
  removing a route is safe (tsc-only input).
- `prisma migrate dev` refuses non-interactive when a warning needs
  confirmation (e.g. adding a unique constraint) — hand-write the migration
  folder + `migrate deploy` instead. Stop the dev server before
  `prisma generate` (Windows DLL lock).
- `ClientAIModelManager` caches provider config 15 min per instance — restart
  the dev server after DB config-row edits, and patch rows BEFORE the server's
  first read when drilling config-driven behavior. A config value violating a
  zod bound (e.g. `maxSessionSeconds` floor 30) makes deserialize THROW and
  routes silently fall back to serializer defaults — check the server log for
  "using fallback" before trusting a drill.
- PS 5.1 scripted file rewrites mangle BOM-less UTF-8 — use the Edit tool, or
  explicit UTF-8 encodings with .NET File APIs.
- Admin login for live verification (NextAuth credentials, in the preview
  browser context): `fetch('/api/auth/csrf')` → POST csrfToken +
  username=admin + password=admin2025 + json=true to
  `/api/auth/callback/credentials`.
- Voice e2e without a mic: the C0 fake-mic driver on `/admin/ai/voice-debug`
  (and the homepage dev panel) drives OpenAI / Gemini / Cascade sessions;
  turns + tool rows persist and are replayable via
  `/api/ai/conversation/replay?conversationId=`. Audio QUALITY still needs
  human ears.

═══════════════════════════════════════════════════════════════════════════
## PHASE 1 — REVIEW THE LAST SESSION (6 commits on top of ad18d82)
═══════════════════════════════════════════════════════════════════════════

Review `git diff ad18d82..a6f0c22` (commits 1b7b87e, 712ff31, 956357b,
7de7b21, 2139411, a6f0c22). All type-check/check:gateway/check:specs green and
live-fired via the fake-mic driver, BUT the following deserve a skeptical
second pass:

1. **Cascade adapter** (`712ff31`, `src/lib/voice/CascadeVoiceAdapter.ts`):
   energy-VAD + MediaRecorder segmentation was only ever driven with the
   SYNTHETIC mic. The REAL-microphone path (echo of the assistant's own TTS
   re-triggering VAD despite half-duplex suspension, threshold sanity on real
   ambient noise) is untested. Also: the chat route's new `modality` body
   field and `conversationId` in the response — confirm no public-tier
   information leak (it's the same id the /log path already returns).
   Public-tier cascade (session-cookie mint path) was never driven — only
   admin. v1 gaps are documented in the 9.2/9b ledger entries — confirm the
   ledger matches the code.
2. **Gemini speech_start/speech_end** (`956357b`,
   `GoogleLiveAdapter._playAudioChunk`): speech_end fires when
   `_activeSources` drains — if the WS stalls mid-turn, scheduled audio can
   drain BETWEEN chunks, producing spurious end/start pairs (each start
   also stops clips and resets the one-clip-per-gap budget). Check whether
   this matters in practice (listen or instrument a drive with artificial
   network throttling).
3. **Duration caps across auto-resume** (`7de7b21`,
   `OpenAIRealtimeAdapter`): `_armDurationCap` arms in connect() — verify the
   D49 auto-resume path re-arms (a resumed leg should get a FRESH cap, and the
   old timer must not fire mid-resumed-leg). Also `_endReason` reset
   semantics if disconnect throws.
4. **Reflink IP containment** (`7de7b21`, gateway step 4): binding check
   fails OPEN on DB error (deliberate — reflink already validated, windows
   still bound damage); confirm you agree, and confirm the
   `AIReflink.boundIpHashes` push race note (can overshoot maxIps by ~1
   under concurrency) is acceptable. `ai_rate_limits` window rows now grow
   with `reflinkId:hashedIp` cardinality — check there's cleanup/TTL.
5. **Prompt-leak fix** (`2139411`): the public voice-config route strips
   `instructions`/`tools`. Verify no admin UI regressed (admin CONFIG editing
   goes through `/api/admin/ai/voice-config*`, unaffected — confirm). The
   OpenAI RealtimeAgent is now created WITHOUT instructions; a full OpenAI
   conversation drive after this change is the missing live check (the mint
   injection was verified, an actual multi-turn convo was not).
6. **Anticipatory clips** (`a6f0c22`,
   `src/lib/voice/ClipPlayer.ts` + conversational-agent-provider): the
   one-clip-per-gap budget resets ONLY on model speech_start — if a turn
   errors and the model never speaks, the next tool call gets no clip until
   speech happens. Decide if that's fine. Clips now come from Cloudinary CDN —
   offline dev = no clips (graceful no-op, but confirm). Tool medians ride
   the PUBLIC clip manifest — sanity-check that's harmless info.
7. **Cross-cutting**: `getOrCreateConversationId` now relies on the UNIQUE
   `sessionId` (migration `20260708044500`) with adopt-on-conflict — grep for
   any other conversation-creation path that bypasses it. The tool-latency
   SQL (`lib/ai/tool-latency.ts`) regex-casts `processingTime` from JSONB —
   verify it can't throw on adversarial metadata (it's admin-written today,
   but the mint path calls it on every voice session).

Report review findings (bugs, risks, or "all clean") before proceeding.

═══════════════════════════════════════════════════════════════════════════
## PHASE 2 — FINISH PHASE 4: BLOCK D (roadmap 4.6 + mcp-server task 5)
═══════════════════════════════════════════════════════════════════════════

Small but visitor-facing — this closes Phase 4:

- **About/AI page**: the architecture explanation as a portfolio piece —
  three modes one brain (native s2s / text / cascade, D45), the T0–T3
  semantic index + hybrid retrieval (D29), F-I-D + chunking highlights, the
  gateway/ledger/watchdog cost story, the D50 clip + latency-aware filler
  system, **the public MCP URL with copy-paste client configs** (Claude
  Desktop / generic Streamable HTTP JSON), and the mcp-server hardening
  checklist rewritten as PROSE (it's a showcase, not a compliance doc).
  `docs/article-notes-design-judgment.md` holds the owner's narrative angles
  — use it as input; it is not normative.
- **README refresh**: cross-check every claim against code (stack versions,
  commands, feature list). The current README predates most of Phase 2–4.
- **CLAUDE.md env section**: add `GEMINI_API_KEY` (accepted as GOOGLE_API_KEY
  fallback), Cloudinary/MEDIA_PROVIDER (clips + future conversation
  recordings), and correct anything else stale (verification Req 1.1 makes
  CLAUDE.md staleness a defect).
- Closes `mcp-server` task 5 — update that spec's ledger + stamp.

Acceptance (roadmap 4.6): "Visitor-facing explanation exists and matches
reality." Verify the page renders (both themes, ~1600px and mobile width, no
sidebar overflow) and that the MCP config snippets actually work against
`POST /api/mcp` (drive one with a real client call or raw JSON-RPC).

═══════════════════════════════════════════════════════════════════════════
## PHASE 3 — PHASE 5: CI & QUALITY (roadmap §7 Phase 5, D5)
═══════════════════════════════════════════════════════════════════════════

**IMPORTANT RULE FLIP:** until now the jest baseline (~34–35 failing suites)
was protected pre-existing debt — "do not regress, do not fix". Phase 5.3 is
where that debt DIES. From this phase on, failing tests are work items, not
baseline.

Order matters (each numbered item = commit-able unit, ledger-stamped in the
`verification` spec or the roadmap):

- **5.3 Test triage FIRST** (it unblocks honest CI): repair or delete each
  failing suite. Known clusters: OpenAIRealtimeAdapter (8F/4P jsdom
  mic-permission — environmental; either mock the mic surface or mark the
  suite node-env-limited), PassiveFIDManager + stale Gen-1 expectations,
  ClientAIModelManager teardown. Jest-mock gotcha from Phase 3: importing
  `jest` from '@jest/globals' defeats `jest.mock` hoisting — real modules
  load and tests write REAL DB rows; use the global `jest`. Include tests in
  `tsc`. ADD coverage where Phase 4 built load-bearing logic with none:
  gateway step-4 containment (binding + per-IP windows), ledger watchdog,
  `tool-latency` guidance bucketing, `ClipPlayer` fit/one-per-gap selection,
  `voice-clips` target resolution. Acceptance: `npm test` fully green.
- **5.2 Strictness ramp**: `strict: true` in tsconfig, incremental
  (per-flag or per-directory ramp is allowed by D5 — but the end state this
  session should be `strict: true` compiling). Expect the bulk of errors in
  the older admin components and adapters; do not weaken types to silence
  errors — fix or locally annotate with a reason.
- **5.1 CI**: GitHub Actions workflow — typecheck, lint, test, build on PR;
  remove `eslint.ignoreDuringBuilds` from next.config and fix what surfaces.
  CI needs Postgres+pgvector for the test/build path — use a
  `pgvector/pgvector:pg16` service container + `prisma migrate deploy` +
  seed; `AI_FAKE_MODE=reasoning,voice,embeddings` keeps provider spend out of
  CI. The workflow can only be PROVEN after a push — prepare everything,
  verify locally (`act` is not installed; a full local `npm run build` +
  `npm test` + lint pass is the local proxy), and ask the owner before
  pushing.
- **5.4 Deployment/environment guide**: the env matrix as a doc — every var
  in `.env.example` explained (DB/pgvector, NextAuth, provider keys incl.
  GEMINI_API_KEY, ELEVENLABS_API_KEY, Cloudinary + MEDIA_PROVIDER, Turnstile
  test-vs-real keys, AI_SESSION_SECRET, dev-only flags), plus the
  deploy-time swap list (real Turnstile widget, key rotation, Supabase/Neon,
  clip regeneration after voice changes). Note: the project is OUT of
  deployment — this is the guide for re-entry, not a deploy.
- **5.5 Optional** (only if everything above is green and time remains):
  Auth.js v5 migration — individually approvable, ask the owner first.

Per-block: update every touched spec's ledger + "Last verified against code"
stamp, append surprises to `00-overview/phase3-cleanup-manifest.md`, append
owner design judgments to article-notes if any arrive mid-session.

STOP at any numbered-item boundary with everything green and committed rather
than starting work you can't verify. Finish with: what shipped, what
live-fire/CI proved, the new jest/tsc/lint state (before → after counts),
surprises appended, ledgers updated — and if Phase 5 completes, say plainly
that the roadmap is DONE and the remaining owner decisions are deploy-time
(push, CI activation, key rotation, Vercel re-registration).
