# Portfolio

A portfolio site that is itself the flagship portfolio piece: a content-managed
project showcase wrapped around a voice-and-text AI assistant that speaks *as*
the portfolio, navigates the site while it talks, and is grounded in a semantic
index of the actual content. The same brain is exposed to external AI agents
through a hardened public MCP server.

A visitor-facing tour of the architecture lives at **`/about/ai`** on the site
itself.

## What's inside

- **Three conversation modes, one brain.** Native speech-to-speech voice
  (OpenAI Realtime over WebRTC, Google Gemini Live over WebSocket, both
  client-direct with short-lived session tokens), a cascade voice mode
  (STT → the text pipeline's reasoning model → TTS, with ElevenLabs/OpenAI/
  Gemini as swappable TTS engines), and plain text chat. All three share one
  server-side tool chain and retrieval layer, so every mode gives the same
  grounded answers. Sessions are resumable — connection recovery and deliberate
  provider switching are the same code path, briefed from the server-side
  conversation store.
- **Tiered semantic index (T0–T3).** One portfolio overview chunk, per-project
  summaries, section summaries, and heading-bounded content chunks, each with
  a pgvector embedding. Retrieval is hybrid: vector + full-text + metadata.
  A passive Frame/Index/Details context pipeline keeps the assistant aware of
  what the visitor is looking at without tool calls.
- **Self-navigating UI.** The model expresses navigation *intent* against a
  registry of semantic UI targets; the site animates itself there. No DOM
  access from the model.
- **Voice UX engineering.** Measured per-tool latency medians are injected at
  session mint so the model knows which tool calls to narrate and which to run
  silently; pre-recorded clips in the assistant's own voice cover slow tool
  calls and connection drops, length-fitted to the expected gap, logged
  honestly as clips (never mistaken for model speech in replay).
- **Cost-bounded public AI.** Every AI entry point passes one gateway:
  kill switch → access tier → rate limits → execute → metered write to a
  single usage ledger. Anonymous visitors get bot-challenged, budgeted text
  chat; invitation reflinks carry per-link budgets, device (hashed-IP)
  binding, and per-device sublimits; a global spend watchdog darkens all
  public AI at once and requires manual re-enable.
- **Public MCP server.** `POST /api/mcp` (Streamable HTTP, stateless) exposes
  `search_portfolio`, `get_project`, `list_projects` — the same backend chain
  the assistant uses. Inputs are schema-capped, output is PUBLIC-only enforced
  in SQL, private and nonexistent projects are indistinguishable, every call
  is ledger-metered, and the endpoint shares the global kill switch. Client
  config snippets are on `/about/ai`.
- **Admin CMS.** Rich-text project editing (Tiptap), media pipeline
  (Cloudinary), semantic-index management with per-stage ingestion, AI model/
  voice/spend configuration, conversation browser with step-through replay of
  every turn, tool call, clip, and disruption.
- **Agent-verifiable by design.** A `_debug` telemetry envelope (admin/dev
  only), deterministic fakes (`AI_FAKE_MODE`), a seeded verification fixture,
  and a fake-microphone driver that speaks TTS audio into the real voice
  pipeline let an AI coding agent exercise every feature end-to-end — the
  assistant that helped build the system also tests it.

## Stack

Next.js 15 (App Router, Turbopack dev) · React 19 · TypeScript 5 ·
Prisma 6 + PostgreSQL 16 with pgvector · Tailwind CSS 4 + shadcn/ui ·
Tiptap 3 · NextAuth 4 · OpenAI (`openai`, `@openai/agents` Realtime SDK) ·
Google Gemini Live · ElevenLabs · `@modelcontextprotocol/sdk` · Cloudinary ·
Jest 30.

## Getting started

Prerequisites: Node 18+, PostgreSQL 16 with the pgvector extension
(local install, WSL, or a `pgvector/pgvector:pg16` container).

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, NEXTAUTH_*, provider keys
npx prisma migrate deploy   # single squashed init migration; provisions pgvector + HNSW
npm run db:seed             # base seed (AI model aliases, settings)
npm run seed:fixture        # verification fixture project + reflink
npm run dev                 # http://localhost:3000
```

The fixture project gets its embeddings from the ingestion pipeline, not the
seed — trigger ingestion from the admin semantic dashboard (or via
`POST /api/admin/semantic/processing/start`) before semantic search has
anything to find.

API keys live in env only, never in the database. `GEMINI_API_KEY`
(or `GOOGLE_API_KEY`) enables Gemini voice/TTS, `ELEVENLABS_API_KEY` enables
cascade TTS/STT, `MEDIA_PROVIDER=cloudinary` + `CLOUDINARY_*` enable the media
pipeline (which also stores the voice clips). See `CLAUDE.md` for the full
environment reference and dev-only flags.

## Commands

```bash
npm run dev            # dev server (Turbopack)
npm run build          # production build
npm test               # jest
npm run type-check     # tsc --noEmit
npm run verify         # type-check + check:gateway + check:specs + check:semantic
npm run db:reset       # drop, re-migrate, base seed + fixture
npm run diagnostics    # semantic system health (:quick :t3 :sse :comprehensive)
npm run check:gateway  # static: no cost-incurring route ships without the gateway
npm run check:specs    # spec hygiene checks
npm run check:semantic # fixture semantic state vs expected snapshot
```

## Documentation

- `CLAUDE.md` — working agreement for AI coding agents: environment, database,
  verification loop, conventions. Kept current by definition of done.
- `.kiro/specs/` — the authoritative spec set: system map
  (`00-overview/README.md`), decision registry (D1–D58), and one spec per
  domain (portfolio-core, semantic-content, ai-assistant, access-and-cost,
  mcp-server, verification, …). Specs are source-of-truth over docs.
- `/about/ai` (on the running site) — the visitor-facing architecture story.

Older documents in `docs/` and `Architecture.md` describe earlier generations
of the system; where they disagree with `.kiro/specs/`, the specs win.
