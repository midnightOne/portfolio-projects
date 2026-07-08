# ai-assistant — Tasks

**Status:** current
**Owner domain:** visitor AI runtime
**Last verified against code:** 2026-07-08 (owner-driven observability + tool-latency session; task 6.5)
**Ledger regenerated from code truth per D36 — the old client-side-ai tasks.md (141KB, colliding numbering) is archived, not carried.**

---

## Already implemented (verified on branch)

OpenAI Realtime + ElevenLabs adapters behind `IConversationalAgentAdapter` with WebRTC and ephemeral tokens; server-side prompt/tool injection at token mint; `UnifiedToolRegistry` with client/server contexts and `/api/ai/tools/execute`; declarative `ui_intent`/`ui_describe` via `UIManager` + `SemanticIDRegistry` (imperative tools and internal "MCP" library deleted on branch); semantic server tools (`content_search`, `content_get`, `content_getHierarchy`, `content_searchSection`, `content_getRelated`); F-I-D passive context (`PassiveFIDManager`, `ContextFrameManager`, `/api/ai/context/fid`); conversation **read/replay** infrastructure via `conversation-history-manager` (admin history/replay/analytics routes, persisted-log browser) — **but no production path writes to it: `/api/ai/chat` does not persist and `/api/ai/conversation/log` POST has been a non-persisting stub since creation; the deleted Gen-1 pipeline was the last writer (found 2026-07-07, restoration = task 2b)**; pill UI with subtitle narration; admin voice config (`VoiceProviderConfig` CRUD); admin debug surfaces on the production provider (duplicate provider deleted, Phase 3 task 1); admin AI debug page drives `/api/ai/chat` and renders the per-turn `_debug` envelope (system prompt, context string, retrieval/tool traces, usage, timings).

## Open tasks

### Phase 3 — consolidation

- [x] 1. Single conversational-agent provider (D21) — **done 2026-07-06**
  - [x] 1.1 5 admin debug components (`VoiceDebugInterface`, `ContextMonitor`, `ToolCallMonitor`, `ConversationStateInspector`, `AdminDebugTest`) migrated to the production `conversational-agent-provider` (+ `ReflinkSessionProvider`)
  - [x] 1.2 `src/contexts/ConversationalAgentContext.tsx` deleted (no re-export hook existed)
  - [x] 1.3 `/admin/ai/debug` rewritten as a production chat tester over `/api/ai/chat` with live `_debug` inspection + persisted-log browser; replay stays at `/admin/ai/conversations` (verified live against real persisted conversations)
  - _Requirements: 3.4, 10.1_

- [x] 2. Delete Gen-1 conversation stack — **done 2026-07-06**
  - [x] 2.1 All four Gen-1 modules deleted; `/api/ai/conversation` POST pipeline removed; the 8 read routes (analytics/cleanup/debug/export/history/log/replay + admin debug) re-pointed at `conversation-history-manager` — analytics went from mock to real aggregates; transcript mocks (search/transcripts/transcript/[sessionId]) deleted per D26 (zero consumers)
  - [x] 2.2 `context-injector.ts` folded into `context-provider.ts` (generateSessionToken / validateAndFilterContext / generateElevenLabsPrompt); importing routes re-pointed (elevenlabs/token, tools/execute, voice/session-init — the other 2 importers were the deleted load/inject routes)
  - [x] 2.3 `/api/ai/context/{load,inject,cache}` + `/api/ai/context` mock deleted (nothing but dead hooks and admin test-buttons called them; buttons re-pointed at `/api/ai/tools/execute` content_search); `/api/ai/context/fid` kept (F-I-D)
  - [x] 2.4 Salvage pass done:
    - [x] 2.4a `ConversationMessage`/`NavigationCommand` moved into `conversation-history-manager`; `ConversationInput`/`ConversationOptions` were imported but unused — dropped
    - [x] 2.4b `_debug` envelope now exposes `systemPrompt` + `contextString` per turn (gateway + `/api/ai/chat`); verified live (1915/1097 chars on the smoke)
    - [x] 2.4c Noted, not ported (as specified)
  - **Lineage note (do not re-litigate):** the unified manager (created 2025-08-28 "3.1 Build mode-agnostic conversation pipeline") was the intended production text+voice pipeline; it was superseded in Sept 2025 by client-direct adapters + declarative navigation, and its removal was ordered by 2025's own streamlined-architecture requirement (archived `_archive/client-side-ai/requirements.md` — "use production client-side endpoints for accurate testing", "remove redundant conversation managers"). Its intent shipped properly as `/api/ai/chat` (gateway + reasoning adapter + tool loop, Phase 2) and its mode-agnostic ambition lives on in D45/D49. Disqualifiers verified by code review 2026-07-06: instance-memory singleton with `global` workaround (self-documented Vercel mismatch, D43), pre-tool-calling era (`[NavigateTo:…]` regex protocol, no `content_search`/RAG), hardcoded model IDs (D4), no gateway/metering, unfinished placeholders (voice returns `undefined`, hardcoded context sources/suggestions). **Post-deletion finding (owner, 2026-07-07): the unified manager was also the last remaining conversation-persistence writer — its deletion left Req 9.1 unimplemented on the production paths. The deletion stands (the disqualifiers above are unchanged); persistence is restored properly by task 2b, not by resurrecting the manager.**
  - _Requirements: 9.1; design §3_

- [x] 2b. **Restore conversation persistence on the production paths (Req 9.1)** — **DONE 2026-07-07 (same session)**
  - [x] 2b.1 **Text path:** `/api/ai/chat` persists each turn server-side via `conversationHistoryManager` — conversation keyed by the gateway session (public `sid` / reflink id), user + assistant `ConversationMessage`s with `transportMode: 'text'`, and `debugInfo` carrying the same systemPrompt/contextString/tool + retrieval traces as the `_debug` envelope so `/admin/ai/conversations` replay and the `/admin/ai/debug` persisted-log browser show real per-turn data. Token counts/cost mirror the ledger row (store the gateway `requestId` for cross-reference). Persistence failures must not fail the chat response (log-and-continue).
  - [x] 2b.2 **Voice path:** replace the `/api/ai/conversation/log` POST stub with real persistence — transcript items and tool events from the adapters land as messages/metadata on the same `conversationHistoryManager` store (keep the existing debugEventEmitter replay side-channel). The route already receives both batch and per-item formats; persist both.
  - [x] 2b.3 **Modality labels + D49 forward-compatibility (D58):** ONE store, ONE text pipeline regardless of modality. Every message carries a per-MESSAGE label — `transportMode: 'voice'` for all voice transcriptions (user and assistant alike), `'text'` for typed/rendered text; `hybrid` is never a message label. Per-message (not per-turn-pair) because mixed exchanges are intended UX: text-in→spoken-answer, voice-in→text-answer, free interleaving in multimodal mode — that *functionality* is deferred (see Backlog), but storage supports it from day one. Audio is never stored here; debug audio, if ever captured, is a separate `media` file upload referenced from the message. No leg schema in 2b — 5b.1 adds legs/snapshots/markers on top of these writes with no message-row migration.
  - [x] 2b.4 Acceptance verified live 2026-07-07: two public chat turns → replay shows 4 messages, per-message `text` labels, tokens/cost on assistant rows, debugInfo with systemPrompt (1444ch) + ledger id; simulated adapter voice log (individual item + retry + batch with tool_call) → replay shows 3 rows all labeled `voice` incl. `[tool:content_search] ok`, retry deduped by transcriptItemId. Debug tester keys its own conversation (sessionId chip, "New Conversation" rotates it) and its turns appear in the recent-sessions browser — D56.
  - _Requirements: 9.1, 9.2, 10.1_

- [ ] 3. Tool registry cleanup (D18/D19)
  - [ ] 3.1 Unregister `fillFormField`, `submitForm`, `animateElement`; delete `content_navigateTo` definition
  - [ ] 3.2 Merge `src/lib/voice/UINavigationTools.ts` + `src/lib/ai/tools/client-tools.ts` into one client-tool module
  - [ ] 3.3 Agent smoke test: navigation + content search through both providers
  - _Requirements: 4.4_

- [x] 4. Delete mock endpoints (D26) — **done 2026-07-06**
  - [x] 4.1 analytics re-implemented real (admin UI consumes it); search/transcripts/transcript mocks deleted; `/api/admin/ai/voice-analytics*` (Math.random data) deleted with page + dashboard + sidebar link; `/api/ai/context` mock deleted; duplicate `/api/ai/openai/token` deleted with its only consumer (`/admin/ai/voice-test` SDK scratch page)
  - _Requirements: 9.2_

- [ ] 5. Config hygiene — *5.1 agent-ID half done 2026-07-07; two config bugs fixed same day:*
  - [x] 5.0a **Pill ran on fallback voice config (fixed 2026-07-07):** both adapters' client-side branch deliberately skipped the DB and loaded serializer defaults — the admin's `VoiceProviderConfig` never reached visitors. New public read-only surface `GET /api/ai/voice-config?provider=…` (default config, deserialized, env-var pointers stripped; no secrets by design per D3); adapters fetch it in the browser, serializer defaults remain only as a failed-fetch fallback. Verified in-browser: both providers load the real DB rows.
  - [x] 5.0b **Admin couldn't start voice sessions on /admin/ai/voice-debug (fixed 2026-07-07):** the production provider gates on `voice_ai`, and an admin without a reflink resolved to the public 'basic' tier (voiceAI=false). `/api/ai/public-access` is now admin-aware (admin NextAuth session → 'premium' — same decision the gateway already makes; D56: same provider code, server-side tier decision). Also fixed the session-cache staleness: the reflink-session provider revalidates the access level on every mount (the old sessionStorage short-circuit had no TTL, so admin toggles never took effect in an open tab); the stored session is now only a failed-fetch fallback. Verified: admin cookie → premium → voiceAI true → OpenAI mint returns client_secret.
  - [x] 5.0c **Connect dead on voice-debug load (fixed 2026-07-07):** the provider's init effect required a REFLINK session object (`session !== null`), which admin/anonymous sessions never have — the adapter only initialized after a provider toggle forced it. Now gates on session RESOLUTION (`!isLoading`) + `voice_ai`. Browser-verified: Connect enabled on fresh load; the page's integration test reaches 'Successfully switched to openai' (remaining failures are mic-permission, environmental).
  - [x] 5.0d **Config canary disambiguated + tool-stall guard (2026-07-07):** the 'loaded from a fallback' announcement was IN BOTH the DB config AND the code default (identical text incl. 'website2') — the mint log proves the DB path was always used ('Using database OpenAI config: Default'). Now: DB row announces DATABASE, code default announces CODE FALLBACK. The mid-conversation silence (model waits forever on a never-settling tool promise) got a 20s Promise.race timeout in the RealtimeAgent execute wrapper — any hung tool returns a recoverable error string instead of stalling the session. Reflink test panel added to voice-debug (pick/create a tier'd reflink → applies ?ref= → real production reflink flow, D56); browser-verified end-to-end (created PREMIUM test reflink, session ran under it).
  - [x] 5.0e **Voice tool results reached the model as canned strings (fixed 2026-07-07, D57 — found by the first D53 fake-mic drill):** `_addConversationalContext` REPLACED the payload of `ui_intent`/`ui_describe`/`searchProjects`/`loadProjectContext`/`content_search` with "Tool execution successful…" sentences (content_search's `.results` check never matched the API's `.items`), so the realtime model could not ground itself even when it called the right tool — likely the root cause of the 5c.6 "answers from own knowledge" note. Now the real payload is always returned with the nudge appended as `[guidance]`. Verified live: fake-mic question → content_search → fixture-grounded spoken answer (manifest surprise 14).
  - [x] 5.0f **Voice tool calls never persisted (fixed 2026-07-07):** `_logToolCallCompletion` sent an unsupported shape to `/api/ai/conversation/log` (400 on every call since creation, swallowed by fire-and-forget catch). Now sends the route's individual-tool format with a call_id→name map captured at `output_item.added`. Verified live: `[tool:*]` rows land voice-labeled in the store (manifest surprise 15).
  - [x] 5.1a Hardcoded ElevenLabs fallback agent ID removed (adapter reads `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` or fails closed; server-side agent resolution was already dynamic)
  - [ ] 5.1b `localhost:3000` fallbacks: remaining 5 sites are env-first (`NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL`) with dev-only literal defaults — full removal rides the fetch-self cleanup
  - [x] 5.2 Model references resolve via registry aliases — done 2026-07-07 with `ai-admin` task 1 (run-path fully alias/config-resolved; residual config-layer defaults itemized in ai-admin 1.2)
  - _Requirements: 3.2_

- [x] 5b. Conversation continuity (D49) — **DONE 2026-07-07 (Phase 4 Block C; 5b.4 cross-provider live-fire pending a human mic, seam verified)**
  - [x] 5b.1 Schema (`20260707193938_conversation_legs`): `AIConversationLeg` (provider, modelAlias/modelId, providerSessionId, started/ended, endReason incl. superseded), nullable `AIConversationMessage.legId` (no message-row migration), `AIConversation.latestState` snapshot. Manager: `startLeg` (closes dangling legs) / `endLeg` / `getOpenLegId` / `updateLatestState` / `getResumeBriefing` / `getLegs`; voice `/log` writes leg-tag every persisted row.
  - [x] 5b.2 Markers written by `conversationHistoryManager.recordSessionMarker` (system rows, `metadata.markerType`, no modality label); `/log` `connection_event` entries drive leg lifecycle (session_start[+resumed] / session_end / disruption). Admin replay popup renders a legs list + 🔴/🟢 marker steps + per-message leg chips (`conversation-replay.tsx` dead twin DELETED — its step-through playback had no marker/leg support; nothing harvested).
  - [x] 5b.3 Resume flow: adapter-side disruption watcher (2s poll of RTCPeerConnection state — the SDK surfaces no close event; `connectionDiagnostics.ts` inspected per the manifest hold: it is a pre-flight test suite, NO heartbeat logic to harvest — its deletion decision rides `VoiceConnectionTester.tsx` at task 6) → `session_disruption` marker → auto-reconnect (2 attempts) with `resumeFromSessionId` → mint route re-runs the FULL gateway chain and injects `buildResumeBriefing()` (`src/lib/ai/resume-briefing.ts`: snapshot + ≤8-turn recap, one assembly point for all providers) → `session_resumed` marker on the new leg.
  - [x] 5b.4 One code path, two triggers: recovery (drill-verified) and deliberate switch (`resumeOnProvider(provider)` on the conversational-agent provider; ElevenLabs adapter + token route accept `resumeFromSessionId`/`resumeSessionId`). **Cross-provider live-fire NOT run: ElevenLabs requires a real getUserMedia mic — needs the OS-level fake mic (verification 4b) or a human; the OpenAI→OpenAI resume exercises the identical path.**
  - [x] 5b.5 Forced-disconnect drill (verification 7.3b) run live 2026-07-07 with the C0 fake mic: q1 grounded → `forceDropConnection()` → watcher detected, markers written, auto-resume in 1 attempt → model greeted "great to have you back", answered "Your name is Fred" from the briefing → one conversation, 2 legs (leg 1 endReason=disruption), every row leg-tagged. Fixed en route: SDK stops supplied MediaStream tracks on close (transport now gets a clone), and the SDK item field is `itemId` not `id` — the index-based fallback froze the live transcript after every resume (manifest surprise 17).
  - _Requirements: 12_

- [ ] 5c. Conversation-mode intent + mic-less sessions (D51/D52)
  - [x] 5c.1 **Mic-less session start (D52, done 2026-07-03):** `IConversationalAgentAdapter.connect(ConnectOptions)`; OpenAI adapter starts text-only via a silent WebRTC input track (no `getUserMedia`); `startAudioInput()` upgrades text→mic by reconnecting (permission probed first). ElevenLabs rejects text-only. Verified: text-only session connects with no mic, model responds.
  - [x] 5c.2 **Permission UX (D52, done 2026-07-03):** pill offers enable-mic / stay-text-only on a voice request without mic; browser-denied → text-only with retry; text-only indicator chip; typing while disconnected opens a text-only session.
  - [ ] 5c.3 **Mode-intent state machine (D51):** track the visitor's *desired* mode (voice/text) explicitly, decoupled from mic capability. Honor a text-only choice even when mic is granted; when the user wants voice, drive the permission flow. Fixes the 2026-07-03 bug where a typed message produced a spoken realtime answer (intent was inferred, not tracked). — *pill state work, do with 5c.4*
  - [ ] 5c.4 **Text-only routes to the reasoning model, not realtime (D51; depends on `ai-admin` task 4 / D39 adapters):** replace the interim realtime-model text path with the reasoning/chat adapter (or cascade brain, D45). No audio output in text mode. Same grounded answer as voice (shares the D39 server-tool chain).
  - [ ] 5c.5 **Spike — in-session mic toggle (D52 open question):** determine whether a single native realtime session can attach/detach a live mic track *without* reconnecting (start mic-less, stream text via the voice endpoint, later add mic in the same session). If yes, drop the reconnect-based upgrade in 5c.1 and support seamless mode switching; if no, keep "allow mic → open a voice session" (D51(b)). Record findings here.
  - [x] 5c.6 **Minimal chat transcript in the pill (done 2026-07-03, stopgap):** renders `user_speech`/`ai_response` turns as a scrollable message list (`data-testid="chat-transcript"`), auto-scrolls to latest; pill stays expanded after a text submit instead of collapsing (was hiding replies). Deliberately minimal — full chat surface (streaming render, tool-call/citation display, history scrollback, markdown) to be re-iterated with 5c.4 (text-via-reasoning). Note observed here: realtime model answers typed questions from its own knowledge, not `content_search` grounding — a retrieval-wiring issue for 5c.4, not the UI.
  - _Requirements: 3.2; registry D51, D52_

- [ ] 5d. Initial grounding frame at session mint — *fixes the 2026-07-03 ungrounded-answers finding; cheap and high-yield, do early. Additional evidence 2026-07-07 (fake-mic drills): the connect-time `response.create` greeting with no language pin comes out in a random language (German, then Arabic, on consecutive sessions) and the conversation sticks to it — the start frame should pin the response language (default: the visitor's, else English). Note the grounding failure itself turned out to be mostly 5.0e (tool results replaced by canned strings), not only the missing frame.*
  - [ ] 5d.1 Replace the `TODO: Inject actual context from ContextProviderService` in `/api/ai/openai/session` (and the ElevenLabs token route) with a real **start frame**: owner summary, per-project T1 summaries, combined technology/category list — assembled in ONE server-side place (D47 seam (a); `ContextFrameManager` already exists for F-I-D frames, budget ≤ 400 tokens per D25). The dangling `Context ID: <id>` literal goes away.
  - [ ] 5d.2 Acceptance: a fresh session asked an *ambient* question about portfolio content (e.g. "how does the kiln regulate temperature?" with no mention of the portfolio) answers from portfolio facts or searches — not from world knowledge. **Diagnosis evidence (2026-07-03):** tool guidance reaches the model and it calls `content_search` correctly when the question is explicitly portfolio-scoped (verified: grounded FreeRTOS/ESP32 answer via `/api/ai/tools/execute`); with no frame it cannot know a kiln project exists, so it answers generically. Pipeline works — the frame is the missing piece.
  - [x] 5d.1a **(done with access-and-cost Phase 2, 2026-07-05)** Start-frame assembly exists in one place (`src/lib/ai/start-frame.ts`: owner line, per-project T1 summaries, technology list, ≤400 tokens) and feeds the **public text chat** system prompt (`/api/ai/chat`), together with first-person portfolio-voice framing. The realtime mint routes (5d.1 proper) still carry the TODO stub — wire them to the same function.
  - [ ] 5d.3 When the D47 engine lands, this static frame becomes the conversation-start node's context set (see `_backlog/conversation-engine.md` §1b) — keep the assembly behind one function so the engine can replace it.
  - [ ] 5d.4 **Portfolio speaks in first person; lazy queries are conversation state (owner, 2026-07-05).** Observed on the live public tier: "overview" answered with "I found an overview for a project titled Task Management App" — one arbitrary project, search-result voice. Owner requirements: (a) the assistant is *the portfolio speaking* — "here's", never "I found a project"; (b) lazy openers ("what can you tell me?", "overview") at conversation start mean the **whole portfolio** → owner + projects + technologies + "what are you interested in?"; (c) the same word while a project is open (no prior conversation) means *that project*; after real conversation, ask which is meant. The persona + start-frame slice shipped with Phase 2 covers (a)/(b) for fresh chats; (c) — state-dependent disambiguation — belongs to the D47 graph (state → context/framing) and D55 (UI-state pushed context), not to prompt patching. Wire the pill's UI state (current project/route) into the chat request when 5c.4 lands.
  - _Requirements: 5, 6; registry D25, D41(d), D47(a), D55_

### Phase 4 — features

- [x] 6. Google (Gemini Live) adapter (D22)
  - [x] 6.1 `GoogleLiveAdapter` (raw WebSocket, no SDK) implementing `IConversationalAgentAdapter`; `GET /api/ai/google/session`
        mints a gateway-wrapped, duration-capped v1alpha ephemeral `auth_tokens` token with model/instructions/tools locked
        in (D3: no system prompt ever reaches the browser). Resolved holds: `config-validation.ts` (+ test) deleted as a
        redundant shim now that every real caller uses `getSerializerForProvider(...).validate()` directly;
        `VoiceConnectionTester.tsx` + its only dependency `connectionDiagnostics.ts` deleted (unmounted; the D16 playground
        requirement is met by `/admin/ai/voice-debug`, extended with a Gemini button in 6.2).
  - [x] 6.2 Admin voice config support: `GoogleLiveConfigPanel.tsx`, wired into the voice-config CRUD page/list/import-export
        (provider union widened everywhere); a Google connectivity test (`ListModels` filtered to `bidiGenerateContent`)
        added to `/api/admin/ai/voice-config/test`. Smoke-tested `content_search` and `ui_intent` live via the C0 fake-mic
        driver against `gemini-2.5-flash-native-audio-latest` (the only Live-capable model on this account's key —
        `gemini-live-*-preview` ids from Google's docs 404 here); both tools executed through the shared
        `UnifiedToolRegistry` pipeline and persisted leg-tagged, transcript items accumulate correctly across Gemini's
        chunked input/output transcription.
  - [x] 6.3 Tool-calling gaps documented in `design-voice-adapters.md` §2c (feeds D41). **Two owner-reported bugs found
        by actually listening to audio and driving the live homepage (neither reproduced in admin-only testing) were
        root-caused and fixed, superseding the first-pass findings below:** (a) no audio output — the playback
        `AudioContext` was created lazily outside any user-gesture call stack, left `'suspended'` by autoplay policy;
        now created synchronously at the top of `connect()`. (b) reasoning leaking into the visible answer — Gemini's
        `thought:true` parts were captured by the fallback text path; now routed to `metadata.reasoning`, collapsed by
        default, gated by new `GoogleLiveConfig.enableReasoning` (default false → `thinkingBudget:0` at mint).
        (c) **the "argument-shape drift" first suspected as a Gemini weakness was actually caused by our own schema**:
        `ui_intent`'s `oneOf` target union crashed the Live API server-side (WS close 1011) the instant the model tried
        to use it — fixed by flattening `oneOf`/`anyOf` into one permissive merged schema in `stripUnsupportedSchemaKeys`;
        once fixed, the model emitted the exact correct argument shape with no further drift. Gemini's `enum` schema
        field is still genuinely string-only regardless of the property's declared type (separate, real fix, same
        sanitizer). Cross-provider resume onto/from Gemini NOT run (5b.4 precedent: OpenAI↔OpenAI covered the
        mechanics; Gemini's disruption-watcher/auto-reconnect wasn't built — out of this task's scope). Audio quality
        was owner-verified by listening; turn mechanics are fully covered by the C0 driver, now also mounted on the
        live homepage (admin-gated) so navigation tools exercise real UI state instead of only the isolated debug page.
  - _Requirements: 3.2, 3.3_

- [x] 6.4 (added, owner) Conversation debugging/replay depth: navigation and error events persist as labeled rows
      distinct from raw tool JSON (shared `_logEvent()` in `BaseConversationalAgentAdapter`, so all three providers
      get it free); the admin conversation-replay popup rebuilt from a static `window.open()` HTML dump into an
      interactive `ConversationReplayViewer` with Previous/Next stepping (+ arrow keys) through the full timeline.
      Admin conversation list already existed at `/admin/ai/conversations` (flat, unpaginated, limit 50 — untouched).

- [x] 6.5 (added, owner 2026-07-08) Conversation observability + tool-call latency UX:
      - **conversationId surfaced everywhere it's needed.** `/api/ai/conversation/log` now returns the DB conversation
        cuid in `metadata.conversationId` on every persist path; a shared `_postConversationLog()` on the base adapter
        captures it (Google + OpenAI + ElevenLabs routed through it) and fires `AdapterInitOptions.onConversationPersisted`;
        the provider exposes `conversationId`; the Fake-Mic panel (admin **and** homepage) renders it copyable with the
        provider badge. Fixes the owner's "I couldn't find the conversation ID" — verified live: `/log` returns
        `conversationId: cmrbbrrpg…`.
      - **admin transcript browser** at `/admin/ai/conversations` (new `ConversationBrowser` + `GET
        /api/admin/ai/conversations/browse`): lists every stored conversation with provider/model (from the latest D49
        leg), reflink, time, message count, cost; lookup by exact conversationId **or** sessionId, filter by provider,
        content, and date range. **Layout (owner refinement 2026-07-08): three columns — left admin nav | middle
        conversation list | right transcript panel.** The admin view shows the WHOLE selected conversation as a chat
        (new `ConversationTranscriptPanel`, reuses the exported `ReplayStepCard`): every turn + tool call/result +
        nav/error event + reasoning, scrollable, sticky beside the list — NOT the stepped Previous/Next dialog (that
        stepper is reserved for the future homepage over-the-portfolio replay, per owner). The legacy
        `conversation-management.tsx` (its own duplicate list + stepper + analytics/export/cleanup) was UNMOUNTED from
        this page to keep the three-column view clean — the component still exists; its export/cleanup/analytics need a
        new home if wanted. Added a **Conversations** entry to the admin left sidebar (AI Assistant group). Replay route
        + viewer now accept `conversationId` directly. **Browser-verified live** (admin session, 1600px): sidebar link
        present, 25-row list, selecting the "3D work" convo rendered all 6 steps (2 user, 2 tool calls with expandable
        args, 2 AI) in the right panel; no console errors.
      - **tool-call latency / silent-gap UX.** Root-caused: NOT cascade and NOT reasoning — the active config is native
        s2s (`gemini-2.5-flash-native-audio-latest`, `responseModality:'AUDIO'`), reasoning off by default. Tool exec is
        already fast (measured `content_search` 536ms, `getProjectSummary` 431ms on the owner's "3D work" convo
        `cmrbakv2v…`); the felt "hang up" is the model narrating its filler AFTER the tool instead of before, so the
        ~2s round-trip is dead air. Fixes: (a) `/api/ai/tools/execute` defers the ledger meter + reflink-budget re-read
        to `next/server` `after()` and drops the unread `costTracking` from the response + the multi-KB per-call pretty
        log — trims DB round-trips off the hot path; (b) strengthened "speak BEFORE the tool" guidance in the Google
        mint prompt. The **guaranteed** fix is the D50 instant filler clip (fire on tool_call start, cut off on real
        speech) — task 9b. **Instrumentation gap noted:** the persisted assistant-turn timestamp is turn-END (flushed on
        `turnComplete`), which masks the true silence window — capture turn-onset (first audio chunk) for real latency
        telemetry when 9b lands.

- [ ] 7. `BackendToolService` de-stubbing
  - [ ] 7.1 Real profile/contact data from DB (remove hardcoded profile)
  - [ ] 7.2 Persist contact-form submissions; real file processing for reflink uploads
  - _Requirements: 8, Req 1.2_

- [x] 8. Job-analysis productization (with `ai-admin` D39 adapters) — **done 2026-07-07 (Phase 4 Block B; D57 mock removed)**
  - [x] 8.1 `/api/ai/analyze-job` rewritten real: `default-reasoning` adapter (first concrete D39 deep tool), grounded in the semantic store (start frame + `content_search` k=8 over the job spec — same chain as the assistant), strict-JSON analysis with company/position extraction, 20k-char spec cap; persisted to `AIJobAnalysis` (reflink attribution, tokens, cost, ledger cross-ref; persistence failure never fails the response); metered with real usage (ledger prices via estimateCost). Admin review: `/admin/ai/job-analysis` page + `GET /api/admin/ai/job-analyses` (requireAdmin + middleware) + sidebar link. **Verified live 2026-07-07:** anonymous → 403; reflink without `enableJobAnalysis` → 403 FEATURE_DISABLED; enabled reflink → real gpt-4o analysis of a fixture-matched job spec (overallMatch 0.7, PID/thermocouple skills cited at 1.0 with fixture evidence, honest 0.0 for ungrounded Postgres), row persisted with reflinkId + $0.0061, ledger row `usageType='job_analysis'` reflink-attributed; admin API serves it, unauthenticated access redirected by middleware.
  - _Requirements: 8.1_

- [ ] 9. Cascade voice adapter (D45) — *after ai-admin task 4 (reasoning adapters)*
  - [ ] 9.1 STT adapter surface (ElevenLabs Scribe / Deepgram / OpenAI transcription; env keys D3, config in `VoiceProviderConfig`)
  - [ ] 9.2 `CascadeVoiceAdapter` implementing `IConversationalAgentAdapter`: streaming STT → reasoning adapter → ElevenLabs streaming TTS; push-to-talk or conservative VAD in v1
  - [ ] 9.3 Shared-brain check: same question in text mode and cascade voice yields the same grounded answer (verification spec live-fire)
  - [ ] 9.4 Retire the ElevenLabs agent-platform adapter (D22 amendment); admin A/B switch native ↔ cascade
  - _Requirements: 3.2b; design-voice-adapters §2b_

- [ ] 9b. Pre-recorded voice assets (D50 — polish, after task 5b resume flow exists)
  - [ ] 9b.1 Client-side clip player in the pill (adapter-independent); asset storage via `media`; `(voiceId, phraseId)` keying
  - [ ] 9b.2 Admin phrase management + TTS regeneration on voice change
  - [ ] 9b.3 Triggers: tool-latency filler (rotating pool, instant cutoff on model/user audio), D49 connection-state clips (disruption/retrying/failed), optional cold-start greeting
  - [ ] 9b.4 `clip_played` events in conversation history; replay renders clips distinctly from model speech
  - _Requirements: 13_

- [ ] 10. D41 prototyping (time-boxed, optional; native-S2S path only)
  - [ ] 10.1 Evaluate watchdog-LLM / in-loop patterns behind existing seams (relevant mainly if Gemini Live tool-calling underperforms); record findings in this spec; no architecture commitment
  - _Requirements: open exploration section_

## Backlog

Form-filling tools (D18 — needs a real use case); simplified mobile pill variants; multi-language conversations; **mixed-modality exchanges (D58, owner 2026-07-07)** — visitor chooses input and output modality independently (type but hear the answer; speak but read the answer; interleave both in one session) — storage is ready via 2b.3's per-message labels, the UX/adapter work lands with the D51 mode state machine + D45 cascade.
