# Deployment & Environment Guide

**Status:** current — written 2026-07-08 (roadmap Phase 5.4)
**Context:** the project is currently **out of deployment** (owner, 2026-07-03) and iterates
locally against WSL Postgres. This is the guide for *re-entering* deployment, not a record of a
live one. Target platform stays Vercel serverless (D43).

---

## 1. Environment matrix

Every variable in [.env.example](../.env.example), what it does, and where it matters.
API keys live in env only — never in the database (D3).

### Database

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | always | PostgreSQL 16 **with pgvector**. Local dev: WSL Postgres at `127.0.0.1` (never `localhost` — Node resolves it to `::1`, which WSL2 doesn't forward). The squashed `init` migration self-provisions the `vector` extension and the HNSW index (D54), so any Postgres where the extension is *installable* works: Supabase and Neon ship it; a `pgvector/pgvector:pg16` container works for CI/Docker. |
| `DIRECT_URL` | pooled providers | Direct (non-pooled) connection for Prisma migrations when `DATABASE_URL` goes through a pooler (Supabase pgbouncer, Neon pooled endpoint, Vercel Postgres). |
| `DATABASE_PROVIDER` | optional | Adapter hint for the db scripts (`local` / `supabase` / `vercel`). |

### Auth

| Variable | Required | Notes |
|---|---|---|
| `NEXTAUTH_URL` | always | The site's canonical origin. |
| `NEXTAUTH_SECRET` | always | `openssl rand -base64 32`. Rotating it invalidates admin sessions. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | always | The single admin credential pair (NextAuth credentials provider). |
| `AI_SESSION_SECRET` | optional | Signs the public chat-session JWTs (gateway step 3). Falls back to `NEXTAUTH_SECRET`; set it separately if you want to rotate public AI sessions without logging the admin out. |

### AI providers

All model/voice *selection* is admin-configurable data (D4/D38) — env carries only keys.
A missing key disables that provider's features gracefully; nothing else breaks.

| Variable | Enables |
|---|---|
| `OPENAI_API_KEY` | OpenAI Realtime voice sessions, `default-stt`/`default-tts` engines, embeddings, the default chat/reasoning aliases. |
| `ANTHROPIC_API_KEY` | Anthropic reasoning adapter (admin content editing, deep tools). |
| `GOOGLE_API_KEY` | Gemini Live voice + Gemini TTS (voice clips). `GEMINI_API_KEY` — Google's documented name — is accepted as a fallback everywhere. |
| `ELEVENLABS_API_KEY` | Cascade TTS/STT engine (quality default voice) and voice-clip rendering. |

### Bot challenge — Cloudflare Turnstile (D31)

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Dev value `1x00000000000000000000AA` is Cloudflare's official always-pass **test** key. |
| `TURNSTILE_SECRET_KEY` | Dev value `1x0000000000000000000000000000000AA` (test secret; accepts any token). Session mint fails closed if the challenge is enabled in admin settings but this is unset. |

### Media pipeline

| Variable | Notes |
|---|---|
| `MEDIA_PROVIDER` | `cloudinary` for the real pipeline. Serves project media AND the D50 voice clips (audio rides Cloudinary's `video` resource type); future conversation recordings use the same path. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_FOLDER` | Cloudinary credentials + asset folder. |
| `UPLOAD_DIR`, `MAX_FILE_SIZE`, `MEDIA_BASE_URL` | Local-upload fallback settings (dev without Cloudinary). |

### Misc

| Variable | Notes |
|---|---|
| `ALLOWED_ORIGINS` | CORS allowlist for the public APIs. |
| `API_BASE_URL` | Absolute API base for the few server-side self-calls. |

### Dev-only flags — must be OFF in production (both refuse to run there)

| Variable | Notes |
|---|---|
| `DEV_VERIFICATION` | `true` exposes the `_debug` telemetry envelope on AI responses to unauthenticated callers — the D46 agent-verification loop. The gateway logs a loud warning if it ever sees this with `NODE_ENV=production`. |
| `AI_FAKE_MODE` | Comma list (`reasoning,voice,embeddings`) of provider test doubles; keeps tests/CI free of API spend (embeddings become content-hash vectors, deterministic). |

---

## 2. Fresh-environment bring-up (any environment)

```bash
npm ci                        # postinstall runs prisma generate
npx prisma migrate deploy     # single squashed init: schema + pgvector + HNSW (D54)
npm run db:seed               # base seed: model aliases, settings, admin rows
npm run seed:fixture          # verification fixture project + reflink (dev/CI)
npm run build && npm start    # or `npm run dev`
```

Semantic search needs **ingestion** after seeding (embeddings come from the pipeline, not the
seed): trigger it per-project from the admin semantic dashboard, or
`POST /api/admin/semantic/processing/start` with `scope:'project'`, all four stages `immediate`.

CI (`.github/workflows/ci.yml`) runs exactly this flow against a `pgvector/pgvector:pg16`
service container with `AI_FAKE_MODE` doubles — see that file for the reference environment.

---

## 3. Deploy-time swap list (re-entering production)

Everything that must change relative to the local/dev setup, in order:

1. **Database → cloud.** Provision Supabase or Neon (both ship pgvector), set
   `DATABASE_URL` + `DIRECT_URL`, run the bring-up sequence above. Local WSL Postgres and its
   keepalive workaround stop mattering.
2. **Rotate every credential.** All cloud credentials are stale by decision (owner, 2026-07-03)
   except `OPENAI_API_KEY`. Issue fresh: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`,
   `ELEVENLABS_API_KEY`, Cloudinary keys, `NEXTAUTH_SECRET`, `AI_SESSION_SECRET`,
   `ADMIN_PASSWORD`. Treat the old values as burned.
3. **Turnstile → real.** Create a Turnstile widget for the production domain, set the real
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, **and render the widget in the AI
   pill** — dev sends a placeholder token because the test secret accepts anything; the real
   secret will not. The admin Access & Spend panel toggles the challenge per-tier.
4. **Kill the dev flags.** `DEV_VERIFICATION` and `AI_FAKE_MODE` must be absent/false. Both
   refuse production, but don't rely on the guard.
5. **Vercel re-registration.** Import the repo, set the env matrix above, deploy the staging
   branch to a preview domain first (D1: `main` stays the deployable fallback; promotion is an
   explicit owner decision).
6. **Regenerate voice clips.** Clip assets live in Cloudinary under the configured folder; a
   fresh Cloudinary account/folder means `/admin/ai/voice-clips` → regenerate all voices (one
   ledger row per TTS model). Re-run this any time a session provider's VOICE changes — clips
   are strictly voice-matched (a provider whose voice has no rendered clips plays silence, never
   a wrong voice).
7. **Verify the spend rails before announcing.** On the deployed site: admin → Access & Spend —
   confirm the global watchdog caps, per-tier rate limits, and MCP knobs; run one public chat,
   one voice session, and one MCP `search_portfolio` call and check all three landed in the
   usage ledger.

## 4. What deliberately does NOT change

- Model IDs and prices: admin-managed data (D4/D38) — the deploy carries them in the seeded DB,
  not in env or code.
- The AI gateway chain, kill switch, and ledger: identical in every environment; there is no
  "production mode" for cost enforcement — it is always on.
- `main` stays untouched until the owner explicitly promotes (D1, amended).
