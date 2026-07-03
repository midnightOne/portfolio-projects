# ai-assistant — Requirements

**Status:** current — core implemented; supersedes the client-side-ai spec (Gen-2 client-direct architecture only; the Gen-1 server-orchestrated design is dead and archived)
**Owner domain:** visitor-facing AI: floating pill UI, voice/text conversation via client-direct adapters, unified tool registry, declarative navigation, F-I-D context, conversation persistence, debug/replay
**Last verified against code:** 2026-07-02 (`e2d75b4`)
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

1. WHEN a conversation starts THEN the client SHALL connect **directly** to the provider (WebRTC) using a short-lived token minted by our API (`/api/ai/openai/session`, `/api/ai/elevenlabs/token`, future Google session route), with the system prompt and tool definitions injected **server-side at token mint time**.
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

## Requirement 6 — Passive F-I-D context

**User story:** As a visitor, I want the AI to already know where I am, so that responses are immediate and relevant without orientation tool calls.

1. WHEN the UI state changes THEN `PassiveFIDManager` SHALL push Frame (current page/section), Index (available content map), and Details (focused item) context into the session via `/api/ai/context/fid`, budgeted at Frame ≤ 400, Index ≤ 600, Details ≤ 1000 tokens (D25).
2. WHEN new NAV_CONTEXT is injected THEN prior context items SHALL be **replaced, not appended** (delete-then-add), keeping realtime session context bounded.
3. WHEN F-I-D context suffices THEN the model SHOULD answer without tool calls; tools are for content beyond the current frame.

## Requirement 7 — Grounded content access

**User story:** As a visitor, I want accurate answers about any project, so that I can trust what the assistant says.

1. WHEN content questions exceed current context THEN the model SHALL use `content_search`, `content_get`, `content_getHierarchy`, `content_searchSection`, `content_getRelated` (backed by `semantic-content`'s `ContentSearchService`; PUBLIC visibility only for public sessions).
2. WHEN search results return THEN they SHALL include relevance-ranked chunks with `navTarget`s for follow-up navigation.

## Requirement 8 — Job-spec analysis (reflink)

**User story:** As a recruiter with a reflink, I want to submit a job description, so that I get a grounded match analysis against the owner's real background.

1. WHEN a reflink session submits a job spec THEN analysis SHALL run through the **reasoning model** (D39 — not the realtime voice model), grounded in semantic content, and persist to `AIJobAnalysis` with an admin review view.
2. WHEN a public (non-reflink) session attempts job analysis or file upload THEN the gateway tool allowlist SHALL reject it (`access-and-cost`).

## Requirement 9 — Conversation persistence & telemetry

**User story:** As the owner, I want every conversation durably logged through one path, so that debugging and analytics read reality.

1. WHEN conversation events occur (messages, tool calls, mode switches) THEN adapters SHALL log via `/api/ai/conversation/log` into `conversation-history-manager` — the **canonical and only** persistence path (D26). The Gen-1 managers (`conversation-manager`, `unified-conversation-manager`, `conversation-transport`) are deleted.
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

## Open design exploration (D41 — deliberately not a requirement)

Voice ↔ reasoning orchestration — **narrowed by D45**: the cascade family resolves this for its own path (the reasoning model *is* the agent there; no watchdog needed). Remaining open scope is the **native S2S path only**: (a) reasoning model in-loop for deep tools (already allowed by D39); (b) side-by-side watchdog reasoning LLM feeding grounded context to a weak-tool-calling realtime model (mainly Gemini Live); (c) tool-harness hardening. Keep the D39 seam (unified server tools) so any option layers on without endpoint changes. Prototype in roadmap Phase 4.5; record findings here.

## Cancelled / superseded

Gen-1 server-orchestrated conversation pipeline (`/api/ai/conversation` POST processing, T0–T4 "hierarchical content" duplication, server-to-client "MCP" navigation commands); form-filling client tools (backlog per D18); per-conversation server threads for mode continuity; internal "MCP" naming (D20).
