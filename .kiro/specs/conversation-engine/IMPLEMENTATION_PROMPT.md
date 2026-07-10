# conversation-engine — Implementation Session Prompt

**Status:** current — hand this file's §Prompt to a fresh implementation session (written 2026-07-09 for the Block A kickoff; reusable for later blocks by swapping the block letter)
**Owner domain:** session bootstrap for implementing this spec
**Last verified against code:** 2026-07-09 (spec finalized + committed; zero implementation exists)

---

## How to use

Paste the prompt below into a new Claude Code session in `portfolio-projects/`. One block per session (roadmap convention). For sessions after the first, replace "Block A" with the next open block and keep everything else. Blocks and their order: A (seams) → B (engine core) → C (model switching) → then D/G/H/I/J/L in parallel (J1 early), K with H/I, E after D, F last.

## Prompt

You are implementing the **conversation-engine** spec (post-roadmap Phase 6) in this repo. The spec is finished and authoritative; your job is execution, not redesign.

**Read in this order before writing any code:**
1. `CLAUDE.md` (repo conventions, dev DB startup, verification loop — note the WSL Postgres keepalive)
2. `.kiro/specs/conversation-engine/requirements.md` (Reqs 1–22; contracts tables)
3. `.kiro/specs/conversation-engine/design.md` (architecture, data model, graph schema)
4. `.kiro/specs/conversation-engine/design-implementation-notes.md` — **normative**: module layout §1, runtime sequences §2, serverless contracts §3, provider fidelity matrix §4, pitfalls P1–P35, and §8 "what NOT to build" (binding scope limits)
5. `.kiro/specs/conversation-engine/design-ux-and-behavior.md` (owner's behavior vision; mechanics-vs-content line)
6. `.kiro/specs/conversation-engine/tasks.md` — your ledger. Execute **Block A only** this session.

**Ground rules (violations are defects):**
- Branch: work on `claude/semantic-content-management-review` (staging). NEVER touch `main` (D1).
- Registry arbitrates conflicts (`.kiro/specs/00-overview/decision-registry.md`). No hardcoded model IDs/prices (D4/D38); aliases only.
- `src/lib/ai/engine/` and `src/lib/ai/safety/` never import from `src/app/**` or components (D48); the engine core receives a `GraphSource` interface and injected deps, never Prisma directly.
- Every task's listed P-numbers are acceptance criteria — a task is not done until each is handled AND tested (e.g., B3: evaluator throwing mid-turn still returns 200 from `/log`; A4: retried POST applies no directive twice).
- Provider work starts from the design-philosophy matrix (notes §4): OpenAI = mutable conversation; Gemini = append-only stream (you cannot delete even your own context blocks — supersede, never retract); cascade/text = you assemble every turn. Write the A2.4 doc-comments as you touch each adapter. Verify provider behavior by DRIVING it (fake-mic panel, `/admin/ai/voice-debug`), never from docs alone — this repo has burned on doc-trusting before (D22 history).
- D46 definition of done per block: `npm run verify` green + the block's e2e assertion exercised in-session (fake-mic drill for voice paths; `_debug` envelope + conversation-log reads for server paths) + ledger updated (`[x]` with a one-line evidence note) + a commit on staging with the standard trailer.
- Engine must be removal-safe at every commit: no active graph → the app behaves exactly as today (Req 2.7). The pre-engine test suite stays green throughout.
- If you hit a genuine spec gap or contradiction, STOP and report it — do not improvise architecture; the spec's "what NOT to build" list (notes §8) is binding.

**Environment notes:** local Postgres runs in WSL and idles out — see CLAUDE.md for the keepalive + recovery commands. `AI_FAKE_MODE` gives you deterministic adapters for tests. Prisma's guardrail blocks `migrate reset` for agents — ask the owner to run it if needed, or use incremental migrations (Block A1 is incremental anyway; hand-verify any pgvector DDL).

**This session (Block A):** A1 schema migration (graph/version/annotation/scenario/lead/question models + SafetyConfig/SafetyInvestigation — all tables now, so later blocks never migrate again), A2 `updateSession()` across adapters + A2.4 philosophy comments, A3 the D55 context buffer with the floating-block invariant (P27), A4 `/log` turn-evidence + `engineDirective` plumbing (inert while no graph is active). End state: `npm run verify` green, a fake-mic session demonstrably accepts a live `updateSession` (instructions + tools) without reconnecting, and a `/log` round-trip carries and applies a synthetic directive exactly once under retry.
