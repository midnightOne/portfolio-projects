# CLAUDE.md

Portfolio site that is itself the flagship portfolio piece: Next.js 15 App Router + React 19 + Prisma 6 (Postgres + pgvector) + Tailwind 4 + Tiptap 3, with a client-direct voice/text AI assistant (OpenAI Realtime, ElevenLabs; Google + a cascade STT→LLM→TTS family planned), a T0–T3 semantic RAG index, and a planned hardened public MCP server. Deployed on Vercel serverless.

## Read this first

1. **Specs are authoritative:** [.kiro/specs/00-overview/README.md](.kiro/specs/00-overview/README.md) — system map + spec index. Load only the spec(s) owning the domain you're touching.
2. **Decisions:** [.kiro/specs/00-overview/decision-registry.md](.kiro/specs/00-overview/decision-registry.md) (D1–D46). When spec/code conflict, the registry arbitrates. Never hardcode model IDs or prices (D4/D38); tiers are T0–T3; "MCP" means only the real external server.
3. **Direction & roadmap:** [.kiro/specs/ARCHITECTURE_ALIGNMENT_PROPOSAL.md](.kiro/specs/ARCHITECTURE_ALIGNMENT_PROPOSAL.md) §7 (Phases 0–5; Phase 1 done 2026-07-02).
4. **Git state (D1, amended):** development head = `claude/semantic-content-management-review` (== `feature/semantic-content-management-2`) — this is **staging**, deployed at a non-root domain. `main` is a stale Sept 2025 snapshot kept deliberately as the deployable Vercel fallback; do NOT merge into or base work on `main` — promotion happens only on explicit owner decision.

## Commands

```bash
npm run dev            # dev server (Turbopack), http://localhost:3000
npm run type-check     # tsc --noEmit   (note: strict:false until Phase 5)
npm run build          # production build (ESLint currently bypassed — Phase 5 fixes)
npm test               # jest
npm run diagnostics    # semantic system health (also :quick :t3 :sse :comprehensive)
npm run db:migrate     # prisma migrate dev
npm run db:seed        # base seed
npm run db:setup-pgvector
```

Planned (verification spec, land with their phases): `seed:fixture`, `check:gateway|models|specs|semantic`, `verify`, `livefire:semantic|chat`.

## Environment

`.env` needs: `DATABASE_URL` (Postgres with pgvector), `NEXTAUTH_SECRET`/`NEXTAUTH_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (voice), later `GOOGLE_API_KEY`, `TURNSTILE_*` (Phase 2). API keys live in env only — never DB (D3). Dev-only flags: `DEV_VERIFICATION=true` (debug envelope), `AI_FAKE_MODE=reasoning,voice,embeddings` (test doubles) — both refuse production.

## Verification (D46 — definition of done)

**A feature isn't done until it's been run end-to-end.** The full approach: [.kiro/specs/verification/](.kiro/specs/verification/requirements.md). The loop for an agent session:

1. `npm run verify` (once it exists; today: type-check + build + test) — deterministic suite with fakes.
2. Start the app (`.claude/launch.json` → `dev`) and drive the real UI — pages, admin, AI pill.
3. Act with debug authorization (`DEV_VERIFICATION=true` or admin session): AI responses carry a `_debug` envelope (tier, model/alias, retrieval trace, tool trace, usage + ledger ID, timings) — assert against it.
4. Verify side effects via telemetry reads: conversation log/replay, ledger rows, semantic operation state (admin APIs).
5. Phase completion: `livefire:*` — real data through the real pipeline with capped spend (fixture project; pennies).
6. Report pass/fail against the owning spec's acceptance criteria; check ledger boxes only when Req 8 of the verification spec is satisfied.

Until the harness items exist (they land with Phases 0–3), approximate: seed data, drive the UI via preview tooling, read `/admin/ai/debug` + semantic dashboard, and say explicitly what could not be verified.

## Conventions

- Spec files carry status headers; task ledgers list only open work; update `Last verified against code` when you re-verify a spec.
- One owner per concept — check the spec's contracts table before adding an API or model.
- Future-proofing (registry D47/D48, outlines in `.kiro/specs/_backlog/`): core libs (`src/lib/{ai,voice,navigation,content}`) never import from `src/app/**`; no hardcoded prompts/model IDs in core libs; F-I-D and client tools stay optional per session; conversational policy is assembled in exactly one server-side place. A node-graph conversation engine and platform extraction plug in later through these seams.
- Test selectors: reuse `SemanticIDRegistry` semantic IDs where present; else `data-testid`.
- Hygiene debris (root test scripts, `test-*` pages) is being hard-deleted in Phase 3 — don't add new debris; scratch work goes outside the repo.
- Update this file when commands, env, or the verification flow change — staleness here is a defect (verification spec Req 1.1).
