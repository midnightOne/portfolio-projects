# CLAUDE.md

Portfolio site that is itself the flagship portfolio piece: Next.js 15 App Router + React 19 + Prisma 6 (Postgres + pgvector) + Tailwind 4 + Tiptap 3, with a client-direct voice/text AI assistant (OpenAI Realtime, ElevenLabs; Google + a cascade STT→LLM→TTS family planned), a T0–T3 semantic RAG index, and a planned hardened public MCP server. Deployed on Vercel serverless.

## Read this first

1. **Specs are authoritative:** [.kiro/specs/00-overview/README.md](.kiro/specs/00-overview/README.md) — system map + spec index. Load only the spec(s) owning the domain you're touching.
2. **Decisions:** [.kiro/specs/00-overview/decision-registry.md](.kiro/specs/00-overview/decision-registry.md) (D1–D46). When spec/code conflict, the registry arbitrates. Never hardcode model IDs or prices (D4/D38); tiers are T0–T3; "MCP" means only the real external server.
3. **Direction & roadmap:** [.kiro/specs/ARCHITECTURE_ALIGNMENT_PROPOSAL.md](.kiro/specs/ARCHITECTURE_ALIGNMENT_PROPOSAL.md) §7 (Phases 0–5; Phase 1 done 2026-07-02).
4. **Git state (D1, amended):** development head = `claude/semantic-content-management-review` (== `feature/semantic-content-management-2`) — this is **staging**. `main` is a stale Sept 2025 snapshot kept deliberately as the deployable Vercel fallback; do NOT merge into or base work on `main` — promotion happens only on explicit owner decision.
5. **Deployment state (owner, 2026-07-03):** the project is currently **out of deployment**; iterate locally. All cloud credentials are stale except `OPENAI_API_KEY` (fresh, for testing). Cloud DB (Supabase/Neon), Vercel registration, and other provider keys get re-provisioned only when deploying again.

## Dev database (local — verification spec task 1.1)

Local PostgreSQL 16 + pgvector 0.6 runs inside **WSL Ubuntu-24.04**; `DATABASE_URL` points at `postgresql://postgres:...@127.0.0.1:5432/portfolio_dev` (use `127.0.0.1`, not `localhost` — Node resolves `localhost` to `::1`, which WSL2 doesn't forward).

- **Start it** (WSL idles out and takes Postgres with it — a keepalive process is required):
  ```powershell
  Start-Process -WindowStyle Hidden wsl -ArgumentList '-d','Ubuntu-24.04','--','sleep','infinity'
  # postgres auto-starts with the distro (systemd service)
  ```
- **Reset + reseed (one command):** `npm run db:reset` — `prisma migrate reset` (drops, re-applies the single `init` migration, runs the base seed via the `prisma.seed` hook) then seeds the fixture. The `init` migration self-provisions the pgvector extension **and** the HNSW index, so no hand steps (D54). Note: Prisma's AI-agent guardrail blocks `migrate reset` when an assistant runs it; it works normally in your own terminal.
- Migrations are a single squashed `init` (`20260703220000_init`). Fresh clone → `npx prisma migrate deploy` → `npm run db:seed && npm run seed:fixture` also works. If you change `schema.prisma`, add a new incremental migration as usual — but re-verify any pgvector/HNSW DDL by hand, since Prisma emits vector indexes as btree.
- **If the app suddenly 500s with "Failed to fetch projects / tags":** WSL idled out and dropped Postgres. Recover: `Start-Process -WindowStyle Hidden wsl -ArgumentList '-d','Ubuntu-24.04','--','sleep','infinity'` then `wsl -d Ubuntu-24.04 -u root -- service postgresql start`. (Migration squash D54 won't fix this — it's a WSL-lifecycle issue, not a schema one.)
- Alternative path (not chosen; Docker not installed): Docker Compose with `pgvector/pgvector:pg16`. A cloud dev branch (Neon/Supabase) is the deploy-time option.

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
npm run seed:fixture   # verification fixture project + reflink (scripts/seed-fixture.ts)
npm run check:semantic # assert fixture semantic state vs fixtures/expected-semantic.json (--no-live skips the OpenAI query)
npm run check:gateway  # static: no cost-incurring route ships without withAIGateway (D33)
npm run check:specs    # spec hygiene: status headers, duplicate Requirement N, prescriptive T4
npm run verify         # umbrella: type-check + check:gateway + check:specs + check:semantic --no-live
```

**Fixture needs ingestion to get embeddings.** `npm run seed:fixture` creates the fixture *project* but not its chunk embeddings — those come from the ingestion pipeline. After a fresh `db:reset`/`seed:fixture`, ingest the fixture per-project (POST `/api/admin/semantic/processing/start` with `scope:'project'`, `projectId`, all four stages `immediate`) before `check:semantic`'s live query will pass. `scope:'all'` currently throws (pre-existing `ProjectAIIndex` bug, resolves with D37 Phase 3.6) — use per-project.

Planned (verification spec, land with their phases): `check:models`, `livefire:semantic|chat`.

## Environment

`.env` needs: `DATABASE_URL` (Postgres with pgvector), `NEXTAUTH_SECRET`/`NEXTAUTH_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (voice), later `GOOGLE_API_KEY`. API keys live in env only — never DB (D3). Dev-only flags: `DEV_VERIFICATION=true` (debug envelope), `AI_FAKE_MODE=reasoning,voice,embeddings` (test doubles) — both refuse production. Optional `AI_SESSION_SECRET` for public chat JWTs (falls back to `NEXTAUTH_SECRET`).

**Turnstile (Phase 2, D31):** dev uses Cloudflare's official always-pass **test keys** — `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`. The secret accepts any response token, so the client sends a placeholder without rendering the widget. **Deploy-time swap:** set real Turnstile keys AND render the Turnstile widget in the pill to produce genuine tokens. The admin Access & Spend panel toggles the challenge on/off. Session mint fails closed if Turnstile is enabled but the secret is unconfigured.

## Verification (D46 — definition of done)

**A feature isn't done until it's been run end-to-end.** The full approach: [.kiro/specs/verification/](.kiro/specs/verification/requirements.md). The loop for an agent session:

1. `npm run verify` (once it exists; today: type-check + build + test) — deterministic suite with fakes.
2. Start the app (`.claude/launch.json` → `dev`) and drive the real UI — pages, admin, AI pill.
3. Act with debug authorization (`DEV_VERIFICATION=true` or admin session): AI responses carry a `_debug` envelope (tier, model/alias, retrieval trace, tool trace, usage + ledger ID, timings) — assert against it.
4. Verify side effects via telemetry reads: conversation log/replay, ledger rows, semantic operation state (admin APIs).
5. Phase completion: `livefire:*` — real data through the real pipeline with capped spend (fixture project; pennies).
6. Report pass/fail against the owning spec's acceptance criteria; check ledger boxes only when Req 8 of the verification spec is satisfied.

Until the harness items exist (they land with Phases 0–3), approximate: seed data, drive the UI via preview tooling, read `/admin/ai/debug` + semantic dashboard, and say explicitly what could not be verified.

## Owner judgment log (article source)

[docs/article-notes-design-judgment.md](docs/article-notes-design-judgment.md) records the owner's design/UX decisions and intuitions as raw material for the portfolio article. **When the owner expresses a design judgment, UX decision, or architectural intuition in a session, append it there** — follow the file's conventions (💡 owner / 🤝 collaborative attribution, lightly cleaned quotes, an *Angle:* note for the article, registry pointer, per-session sections). It is also useful *input*: read it when a task involves judgment calls the owner has already reasoned about — it encodes their intuition. Not a spec; never normative.

## Conventions

- Spec files carry status headers; task ledgers list only open work; update `Last verified against code` when you re-verify a spec.
- One owner per concept — check the spec's contracts table before adding an API or model.
- Future-proofing (registry D47/D48, outlines in `.kiro/specs/_backlog/`): core libs (`src/lib/{ai,voice,navigation,content}`) never import from `src/app/**`; no hardcoded prompts/model IDs in core libs; F-I-D and client tools stay optional per session; conversational policy is assembled in exactly one server-side place. A node-graph conversation engine and platform extraction plug in later through these seams.
- Test selectors: reuse `SemanticIDRegistry` semantic IDs where present; else `data-testid`.
- Hygiene debris (root test scripts, `test-*` pages) is being hard-deleted in Phase 3 — don't add new debris; scratch work goes outside the repo.
- Update this file when commands, env, or the verification flow change — staleness here is a defect (verification spec Req 1.1).
