# Canonical Decision Registry

**Status:** current — living copy (frozen rationale in [`../ARCHITECTURE_ALIGNMENT_PROPOSAL.md`](../ARCHITECTURE_ALIGNMENT_PROPOSAL.md))
**Owner domain:** cross-cutting
**Last verified against code:** 2026-07-02 (`e2d75b4`)

Rule: **implemented-and-working beats specced-but-imaginary; where neither is built, the simpler design wins.** When any spec or code contradicts an entry here, this registry wins; fix the spec/code, don't annotate the conflict. Amend this file (with date) when a decision changes.

Status values: ✅ decided · 🔶 decided-not-yet-implemented · ❓ open

## Platform & baseline

| # | St | Decision |
|---|---|---|
| D1 | 🔶 | `feature/semantic-content-management-2` (== `claude/semantic-content-management-review`, `e2d75b4`) is the implementation baseline; Phase 0 merges it into `main`. |
| D2 | ✅ | Stack pinned: Next.js 15.x / React 19 / Prisma 6 / Tailwind 4 / Tiptap 3. No framework migrations in this effort. |
| D3 | ✅ | API keys live in environment variables only; never in the database. |
| D4 | 🔶 | No hardcoded model IDs in code. DB-backed, admin-editable model registry with role aliases: `default-chat`, `default-cheap`, `default-realtime`, `default-embedding`, `default-reasoning`. |
| D5 | 🔶 | TypeScript `strict: true` + ESLint enforced in CI (Phase 5, incremental). |

## Content & CMS

| # | St | Decision |
|---|---|---|
| D6 | ✅ | Tiptap 3 is the only editor; Novel is purged from specs and types. |
| D7 | 🔶 | Publication model = `visibility` (PUBLIC/PRIVATE) only; draft/published `status` column dropped in Phase 3. |
| D8 | ✅ | Single content-save path via `/api/admin/projects/[id]` → `ArticleContent` (`jsonContent` = Tiptap JSON is source of truth). Parallel `/api/content/*` API cancelled. |
| D9 | ✅ | Content versioning descoped to backlog; `ContentVersion` model may stay dormant. |
| D10 | 🔶 | `EnhancedProjectEditor` is the only project editor; legacy editors deleted in Phase 3. |
| D11 | ✅ | `MediaItem` Prisma model is canonical; spec-only fields trimmed; usage-tracking endpoints backlogged. |
| D12 | ✅ | Homepage/wave config: `HomepageConfig` + `/api/admin/homepage/config` + `/api/admin/homepage/wave-config`. ui-system's alternatives cancelled. |
| D13 | ✅ | `/api/ui/themes`, `/api/ui/themes/switch`, `/api/ui/animate` cancelled — theme/animation are client-side concerns. |

## UI & design system

| # | St | Decision |
|---|---|---|
| D14 | ✅ | Desktop-first responsive design. |
| D15 | ✅ | GSAP orchestrates animation; Framer Motion allowed for isolated components; Three.js for the wave hero. |
| D16 | 🔶 | The 29 `src/app/test-*` pages are removed (Phase 3); at most one admin-gated playground per subsystem. |

## AI assistant & tools

| # | St | Decision |
|---|---|---|
| D17 | ✅ | Tool names use underscores exactly as in code: `ui_intent`, `ui_describe`, `content_search`, `content_get`, `content_getHierarchy`, `content_searchSection`, `content_getRelated`. |
| D18 | 🔶 | Declarative `ui_intent` (via `UIManager`) is the only agent-facing navigation. Handler-less tools (`fillFormField`, `submitForm`, `animateElement`) unregistered; form tools backlogged. |
| D19 | 🔶 | Orphaned `content_navigateTo` definition deleted; navigation-from-search = `content_search` results (`navTarget`) + `ui_intent`. |
| D20 | ✅ | Legacy internal "MCP" library stays deleted. The name MCP is reserved for the real external server (D30). |
| D21 | 🔶 | One conversational-agent provider (`src/components/providers/conversational-agent-provider.tsx`); admin debug consumes it and replays persisted logs. `ConversationalAgentContext.tsx` deleted (Phase 3). |
| D22 | 🔶 | Voice providers (owner, 2026-07-02): **OpenAI Realtime primary; Google (Gemini Live) adapter to be added; ElevenLabs maintained, last priority.** WebRTC + ephemeral tokens; provider/model from `VoiceProviderConfig` in DB; hardcoded ElevenLabs agent-ID fallback removed. Google tool-calling weakness → D41. |
| D23 | ✅ | Canonical admin content-AI endpoints: `edit-content`, `improve-content`, `process-prompt`, `suggest-tags` under `/api/admin/ai/`. |
| D24 | ✅ | Canonical reflink validation: `POST /api/ai/reflink/validate`. |
| D25 | ✅ | F-I-D token budgets: Frame ≤ 400, Index ≤ 600, Details ≤ 1000. |
| D26 | 🔶 | One DB-backed telemetry path (`AIConversation`/`AIConversationMessage` + debug event emitter). All mock analytics/transcript endpoints deleted, not finished. |

## Semantic content / RAG

| # | St | Decision |
|---|---|---|
| D27 | 🔶 | Tier model: **T0–T3.** Legacy T0–T4 ingestion pipeline (`src/lib/services/content-ingestion.ts`) deleted in Phase 3. |
| D28 | ✅ | Chunking defaults: `targetChunkSize: 300`, `maxSectionSize: 500`, `minSectionSize: 50`, `sectionBoundaryOverlap: 25`, `splitStrategy: 'paragraph'`, `respectHeadingBoundaries: true`; T1 ≤ 200 / T2 ≤ 150 summary tokens. Live defaults in `ChunkingConfig` (DB); code wins over docs. |
| D29 | 🔶 | Embedding default `text-embedding-3-small` (1536), configurable. Roadmap: **hybrid retrieval** (pgvector + tsvector fusion). Change-detection thresholds: code (`ChangeDetectionConfigService`) is canonical. |
| D37 | 🔶 | **Retire `ProjectAIIndex`** (Phase 3): migrate summary → T1 chunk, keywords → `ContentEntity`/metadata; re-point consumers to `ContentSearchService`; drop `project-indexer.ts`, legacy ingestion, project-indexing routes/page; migration drops `ContextChunk.projectIndexId` then the model. |

## Access, cost & interoperability

| # | St | Decision |
|---|---|---|
| D30 | 🔶 | **Real MCP server ships** (Phase 4): Streamable HTTP `/api/mcp`, read-only `search_portfolio` / `get_project` / `list_projects`, gateway-fronted, own rate bucket, ledger tag `mcp`. Safeguarding is a first-class showcase requirement (owner Q5). Spec: `mcp-server/`. |
| D31 | 🔶 | Public access tiers: anonymous = **text chat** (rate-limited, Turnstile-challenged, watchdog-protected); **voice + job analysis require a reflink**. AI pill visible to everyone; `publicAIAccess` default moves from `'disabled'` to text-chat tier, DB-backed. |
| D32 | 🔶 | **One usage ledger:** `AIUsageLog` records all AI spend (voice, chat, tools, embeddings, summaries, MCP). `SemanticBudget`/`SemanticOperation` stay as pre-flight gate but write actuals to the ledger. Reflink `spendUsed` + watchdog read from the ledger. |
| D33 | 🔶 | **Single AI gateway** wraps every cost-incurring route; the unwired `withRateLimit` is wired or replaced. No route ships unguarded. Spec: `access-and-cost/`. |
| D38 | 🔶 | **Pricing/capabilities are data:** one pricing module/table with a single `estimateCost()`; delete all local pricing constants (10+ files). Token accounting prefers provider `usage`; char/4 only for rough pre-flight estimates. |

## Model orchestration (owner, 2026-07-02)

| # | St | Decision |
|---|---|---|
| D39 | 🔶 | **Reasoning-model adapter layer:** classic/text LLM adapters (OpenAI, Anthropic, Google) behind a common interface, parallel to the voice adapter family. Admin-selectable `default-reasoning` alias powers MCP tools, deep server tools (job matching), and admin editing AI. **Voice agents and MCP clients share one server-tool chain — no endpoint clones.** Deep tools may invoke the reasoning model internally; shallow lookups stay direct for latency. |
| D40 | 🔶 | **Anthropic provider: keep and fix** — capability table corrected (tool use: yes, vision: yes, JSON via tool-forcing), pricing via D38, models via D4 registry. |
| D41 | ❓ | **OPEN: voice ↔ reasoning orchestration.** Candidates: (a) reasoning model in-loop for deep tools only; (b) side-by-side watchdog LLM following the transcript and feeding grounded context to the voice model; (c) harness hardening for weak tool-calling realtime models. Keep tool execution unified (D39) so any option can layer on later. Prototype in Phase 4.5; do not architect ahead of data. |

## Hygiene, hosting & process

| # | St | Decision |
|---|---|---|
| D34 | ✅ | Specs stay modular per domain + `00-overview`; superseded material in `_archive/`. |
| D35 | ✅ | Repo `Architecture.md` regenerated from specs (Phase 1) and kept current. |
| D36 | ✅ | Task ledgers tree-consistent; no duplicate numbering; regenerate numbering on rewrite. |
| D42 | 🔶 | **Hard delete** hygiene debris (owner Q4): root test/debug scripts, root implementation-log `.md`s, `test-*` pages, dead components, one-off diagnostic API routes. Git history is the archive. |
| D43 | ✅ | **Hosting: Vercel.** Serverless-honest state: durable state in Postgres; in-memory caches are per-instance memoization only. Turnstile for bot challenge (host-independent). Cloudflare/OpenNext migration out of scope. |
| D44 | ✅ | **Canonical spec location: `portfolio-projects/.kiro/specs/`**, versioned with the app repo. Old workspace-level tree removed; nested spec-repo git histories zipped to `Portfolio/backups/`. |

*(Numbering note: D1–D36 originate from the second-generation proposal; D37–D44 were added when merging the first-generation audit and the owner's 2026-07-02 decisions. There are no D45+ yet.)*
