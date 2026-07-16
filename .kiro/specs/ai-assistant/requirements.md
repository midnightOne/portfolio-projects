# ai-assistant — Requirements

**Status:** current — core implemented; supersedes the client-side-ai spec (Gen-2 client-direct architecture only; the Gen-1 server-orchestrated design is dead and archived)
**Owner domain:** visitor-facing AI: floating pill UI, voice/text conversation via client-direct adapters, unified tool registry, declarative navigation, F-I-D context, conversation persistence, debug/replay
**Last verified against code:** 2026-07-16 (post-54ffa09 staff-review fixes; lifecycle, typed-source, and root-layout regressions covered)
**Registry decisions applied:** D17–D26, D39, D41 (open), D3, D4
**Contracts:**

| Consumes | From |
|---|---|
| Access tiers, session tokens, rate limits, reflink validation, usage ledger (every cost-incurring call goes through the AI gateway) | `access-and-cost` |
| `content_search` / `content_get` / hierarchy tools backing data (`ContentSearchService`) | `semantic-content` |
| Reasoning-model adapters for deep tools (job analysis) | `ai-admin` (D39) |
| Animation/highlight primitives for guided navigation | `ui-system` |
| Model registry aliases (`default-realtime`, `default-cheap`) | `ai-admin` (D4) |

| Provides | To |
|---|---|
| `UnifiedToolRegistry` + `/api/ai/tools/execute` (server tool chain) | own adapters, `mcp-server` (curated subset) |
| `UIManager` + `SemanticIDRegistry` + `ui_intent`/`ui_describe` semantics | tools, guided navigation |
| `AIConversation` / `AIConversationMessage` telemetry (single DB-backed path, D26) | admin debug/replay |
| `VoiceProviderConfig` model + voice session endpoints | admin voice config |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Conversational assistant

**User story:** As a visitor, I want to converse with an AI that knows this portfolio, so that I can learn about the owner's background and projects.

1. WHEN the site loads THEN the pill-shaped floating interface SHALL be visible to all visitors (text affordance always; voice affordance only when the access tier allows it — tiers owned by `access-and-cost`).
2. WHEN I ask about the owner or projects THEN the assistant SHALL answer grounded in portfolio content retrieved via the semantic server tools, without fabricating information.
3. WHEN responses reference content THEN the assistant SHALL be able to navigate/highlight the referenced UI (Requirement 5).
4. WHEN the assistant responds THEN current narration SHALL display subtitle-style above the pill (no persistent chat transcript in the public UI).

## Requirement 2 — Client-direct conversation runtime

**User story:** As the owner, I want conversations to run client-direct with ephemeral credentials, so that the serverless deployment stays stateless and secrets never reach the browser.

1. WHEN a conversation starts THEN the client SHALL connect **directly** to the provider (WebRTC or the configured/browser-selected WebSocket transport) using a short-lived token minted by our API, with the system prompt and tool definitions injected **server-side at token mint time**.
2. WHEN text mode is used THEN text messages SHALL flow through the **same adapter session** (`sendMessage`) — there is no separate server-side text pipeline for the pill. (The public no-voice text tier uses the gateway's `/api/ai/chat` with the `default-cheap` alias — owned by `access-and-cost`.)
3. WHEN switching between text and voice THEN the same session SHALL continue (mode continuity = same adapter session, not a server thread).
4. WHEN API keys are involved THEN they SHALL exist only server-side in environment variables (D3); the client receives only ephemeral tokens.

## Requirement 3 — Provider adapter layer

**User story:** As the owner, I want multiple voice providers behind one interface, so that I can switch providers and demonstrate the abstraction.

1. WHEN adapters are implemented THEN they SHALL conform to `IConversationalAgentAdapter` (connect, disconnect, sendMessage, tool-call bridging, transcript events, state).
2. Provider lineup per D22: **OpenAI Realtime (primary), Google Gemini Live (to be added), ElevenLabs (maintained, last priority)**. Provider + model are selected via `VoiceProviderConfig` (DB, admin-editable); model IDs resolve through the registry aliases (D4) — never hardcoded (the ElevenLabs fallback agent ID is removed).
2b. **Cascade family (D45, planned):** a second adapter family — streaming STT → reasoning adapter (D39) → streaming TTS (ElevenLabs first) — SHALL implement the same interface, sharing its brain with text chat so answers are identical across modes, with tool calls executing server-side in the classic LLM. When it ships, ElevenLabs' role shifts to TTS engine and its agent-platform adapter retires (D22 amendment). See `design-voice-adapters.md` §2b.
3. WHEN a provider with weaker tool-calling is active (Google) THEN known limitations SHALL be documented in the adapter and mitigations tracked under the D41 exploration — the adapter interface SHALL NOT fork per provider.
4. WHEN exactly one `ConversationalAgentProvider` exists (D21) THEN both the production pill and all admin debug surfaces SHALL consume it; parallel provider implementations are forbidden.
5. WHEN microphone access succeeds during connection setup THEN the adapter SHALL own that stream immediately. Mint, transport, or capture setup failure—and `disconnect()` during partial setup—SHALL stop owned tracks and close local audio resources regardless of `_isConnected`; teardown SHALL remain effective even when provider close/reporting throws.

## Requirement 4 — Unified tool registry

**User story:** As the owner, I want one tool definition source with explicit execution contexts, so that voice models, the public chat tier, and MCP clients share the same capabilities without clones.

1. WHEN tools are defined THEN they SHALL live in `UnifiedToolRegistry` with explicit `client` or `server` execution context and underscore names (D17).
2. WHEN a server tool executes THEN it SHALL go through `POST /api/ai/tools/execute` (gateway-wrapped, metered) into `BackendToolService` — the **single data-access chain** shared with the MCP server (D39).
3. WHEN a client tool executes THEN it SHALL act through `UIManager`; client tool results are reported back to the model via the server wrapper pattern.
4. THE registry SHALL only advertise tools that can actually execute (D18): handler-less registrations (`fillFormField`, `submitForm`, `animateElement`) are removed; the orphaned `content_navigateTo` definition is deleted (D19).
5. WHEN deep server tools run (job analysis; future deep content reasoning) THEN they MAY internally consult the reasoning model (`default-reasoning`, D39); shallow lookups SHALL stay direct for latency.

## Requirement 5 — Declarative navigation

**User story:** As a visitor, I want the AI to guide me through the portfolio visually, so that explanations come with synchronized navigation.

1. WHEN the model navigates THEN it SHALL use `ui_intent` (declarative: target semantic ID + intent) resolved by `UIManager` against `SemanticIDRegistry`; imperative navigation tools stay deleted (D18).
2. WHEN the model needs UI awareness THEN `ui_describe` SHALL return the current registered UI state.
3. WHEN navigation executes THEN `ui-system` guided-navigation primitives (coordinated ~0.7s sequences, highlight/spotlight with persistent or timed removal) SHALL animate it; user interruptions are honored and reported back to the model.
4. WHEN navigation-from-search is needed THEN `content_search` results carry `navTarget`s and the model chains `ui_intent` (D19).
5. The visitor provider chain SHALL mount once above the route outlet and survive client-side navigation. The root layout SHALL NOT perform a session lookup solely to gate debug affordances; the existing client `SessionProvider` supplies role state so public/static routes are not made dynamic by the AI wrapper.

## Requirement 6 — Passive F-I-D context

**User story:** As a visitor, I want the AI to already know where I am, so that responses are immediate and relevant without orientation tool calls.

1. WHEN the UI state changes THEN `PassiveFIDManager` SHALL push Frame (current page/section), Index (available content map), and Details (focused item) context into the session via `/api/ai/context/fid`, budgeted at Frame ≤ 400, Index ≤ 600, Details ≤ 1000 tokens (D25).
2. WHEN new NAV_CONTEXT is injected THEN prior context items SHALL be **replaced, not appended** (delete-then-add), keeping realtime session context bounded.
3. WHEN F-I-D context suffices THEN the model SHOULD answer without tool calls; tools are for content beyond the current frame.
4. **Push/pull boundary (owner ruling 2026-07-12, task 7.1; principle recorded 7.1d):** the passive push SHALL carry **orientation + pull handles only** — a location line plus per-item ids/heading names (`content_get` handles) — and SHALL NEVER carry content prose (summaries, T2/T3 text, bio material). Content prose travels only via **pull tools** (`ui_details` for the current view, `content_search`/`content_get`/`portfolio_overview` beyond it) or via the conversation engine's budgeted PREPARED CONTEXT. Repeated navigation leaves a cheap location trail, never a re-stuffed payload. This boundary guards the 7.1a diet against regression and keeps the deferred full-PULL experiment cleanly comparable later (same information availability, different delivery).

## Requirement 7 — Grounded content access

**User story:** As a visitor, I want accurate answers about any project, so that I can trust what the assistant says.

1. WHEN content questions exceed current context THEN the model SHALL use `content_search`, `content_get`, `content_getHierarchy`, `content_searchSection`, `content_getRelated` (backed by `semantic-content`'s `ContentSearchService`; PUBLIC visibility only for public sessions).
2. WHEN search results return THEN they SHALL include relevance-ranked chunks with `navTarget`s for follow-up navigation.
3. Search is global and multi-entity by default. Deliberate project narrowing uses `scope.projectId`; deliberate document/article narrowing uses both `scope.entityType` and `scope.entitySlug`. Results and navigation metadata SHALL preserve typed source identity.

## Requirement 8 — Job-spec analysis (reflink)

**User story:** As a recruiter with a reflink, I want to submit a job description, so that I get a grounded match analysis against the owner's real background.

1. WHEN a reflink session submits a job spec THEN analysis SHALL run through the **reasoning model** (D39 — not the realtime voice model), grounded in semantic content, and persist to `AIJobAnalysis` with an admin review view.
2. WHEN a public (non-reflink) session attempts job analysis or file upload THEN the gateway tool allowlist SHALL reject it (`access-and-cost`).

## Requirement 9 — Conversation persistence & telemetry

**User story:** As the owner, I want every conversation durably logged through one path, so that debugging and analytics read reality.

1. WHEN conversation events occur (messages, tool calls, mode switches) THEN they SHALL persist into `conversation-history-manager` — the **canonical and only** persistence path (D26): voice adapters via `/api/ai/conversation/log`, the text tier server-side inside `/api/ai/chat`. The Gen-1 managers (`conversation-manager`, `unified-conversation-manager`, `conversation-transport`) are deleted.
   > **Status: IMPLEMENTED 2026-07-07 (task 2b, same session as the finding).** `/api/ai/chat` persists both turn messages server-side (per-message `text` labels, `_debug`-parity debugInfo, ledger `requestId` cross-ref; log-and-continue on failure); the `/log` POST persists voice transcript items + tool events (per-message `voice` labels per D58, idempotent by adapter item id). Verified live via admin replay on both paths. Historical note: the `/log` POST had been a non-persisting stub since creation and the deleted Gen-1 pipeline was the last writer — found during Phase 3, pattern now codified as D57. D49 (Req 12) leg tagging builds on these writes.
2. WHEN admin views history THEN read-only routes (history, transcript, replay) SHALL serve from the persisted log; all mock analytics/transcript endpoints are deleted, not implemented (D26).

## Requirement 10 — Debug & monitoring

**User story:** As the owner, I want to debug the production behavior, so that what I test is what visitors get.

1. WHEN admin debug surfaces run (`/admin/ai/debug` and related) THEN they SHALL use the production `ConversationalAgentProvider` (D21) and **replay persisted conversation logs** (+ live tail) rather than operating a parallel pipeline.
2. WHEN sessions run THEN debug event emission (context snapshots, tool call traces) SHALL feed the same DB-backed telemetry path.

## Requirement 11 — Security

**User story:** As the owner, I want the assistant hardened, so that public exposure doesn't leak data or budget.

1. System prompts SHALL be injected server-side only; prompt-injection resistant phrasing; no secrets or PRIVATE content in any public session context.
2. Every cost-incurring route consumed by this spec SHALL be gateway-wrapped (`access-and-cost`); tool allowlists per access tier are enforced server-side at execution, not in the client.
3. Voice session tokens SHALL carry server-enforced duration caps at mint time.

## Requirement 12 — Session continuity and recovery (D49)

**User story:** As a visitor, I want the conversation to survive connection issues; as the owner, I want every disruption debuggable after the fact.

1. A logical conversation (`AIConversation`) MAY span multiple provider sessions (**legs**); each leg records provider, model alias, start/end, and end reason.
2. THE canonical store SHALL be sufficient to resume and to review post-hoc: full turn history, tool-call traces (args + results), injected-context state, and a latest-state snapshot (active instructions, tool set, model alias; later the D47 node ID).
3. WHEN a session is disrupted (network drop, provider error, token expiry, watchdog trip, page reload) THEN a `session_disruption` marker SHALL be written into the conversation history at that point, carrying the issue type and diagnostics.
4. WHEN the client reconnects THEN the system SHALL resume the **existing** conversation: mint a new leg (same or different provider/model), brief it from the harness's ground truth (recent turns + state snapshot — never from provider-side memory), write a `session_resumed` marker, and continue appending to the same history.
5. WHEN the owner replays a conversation in admin THEN disruption/resume markers SHALL render inline in the timeline, making recovered conversations debuggable without the owner having been present.
6. Deliberate mid-conversation provider or model switches SHALL use the same resume path (different trigger, same machinery) — this is the tested foundation the D47 engine's model-switching forks stand on.

## Requirement 13 — Pre-recorded voice assets (D50)

**User story:** As a visitor, I want the assistant to sound responsive and graceful even during tool latency or connection loss; as the owner, I want those moments covered by clips in the assistant's own voice.

1. WHEN a server tool/MCP call exceeds a latency threshold THEN the client MAY play a filler clip ("let me check…") from a small rotating, context-tagged pool — stopped instantly when model audio begins or the user speaks.
2. WHEN the connection is lost THEN the client SHALL play connection-state audio ("sorry, connection issues — re-establishing…") **entirely client-side, with no model involvement**, while the D49 resume flow runs; a distinct clip covers resume failure.
3. WHEN a session is starting (token mint + WebRTC handshake) THEN the client MAY play a greeting clip to mask cold-start.
4. Clips SHALL be voice-matched: keyed by (voice, phrase), regenerated via the active provider's TTS when the configured voice changes, managed from admin voice config.
5. WHEN any clip plays THEN a D49 history event SHALL record it, so admin replay distinguishes client clips from model speech.

## Open design exploration (D41 — deliberately not a requirement)

Voice ↔ reasoning orchestration — **narrowed by D45**: the cascade family resolves this for its own path (the reasoning model *is* the agent there; no watchdog needed). Remaining open scope is the **native S2S path only**: (a) reasoning model in-loop for deep tools (already allowed by D39); (b) side-by-side watchdog reasoning LLM feeding grounded context to a weak-tool-calling realtime model (mainly Gemini Live); (c) tool-harness hardening. Keep the D39 seam (unified server tools) so any option layers on without endpoint changes. Prototype in roadmap Phase 4.5; record findings here.

## Cancelled / superseded

Gen-1 server-orchestrated conversation pipeline (`/api/ai/conversation` POST processing, T0–T4 "hierarchical content" duplication, server-to-client "MCP" navigation commands); form-filling client tools (backlog per D18); per-conversation server threads for mode continuity; internal "MCP" naming (D20).
