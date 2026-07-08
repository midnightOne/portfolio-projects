# ai-assistant — Design: Voice Adapters

**Status:** current
**Owner domain:** provider adapter layer, session lifecycle, mode continuity
**Last verified against code:** 2026-07-08 (Phase 4 Block C, task 9 — cascade family shipped; ElevenLabs agent-platform adapter retired)

---

## 1. Adapter contract

`IConversationalAgentAdapter` (interface signatures only — the file is the truth):

- Lifecycle: `init(config)`, `connect(sessionAuth)`, `disconnect()`, connection-state events.
- Conversation: `sendMessage(text)` (text mode over the same session), transcript events (partial/final, user/assistant), audio state (speaking/listening), interruption.
- Tools: provider tool-call events normalized to registry invocations; tool results returned in the provider's expected shape.
- Context: accepts injected context items (F-I-D NAV_CONTEXT) with replace-don't-append semantics. Context injection is **optional** — a session with zero injections must remain fully functional (D48).
- Reconfiguration: `updateSession({instructions?, contextItems?, tools?})` for mid-session policy changes (D47 seam). Native OpenAI Realtime maps to `session.update` — a **control-plane message over the existing connection, not a reconnect**; audio is uninterrupted. The cascade applies changes on the next turn trivially. Session **re-mint is the exception, not the mechanism**: reserved for what providers can't apply live (swapping the actual model or provider on a native session), executed only at a natural conversational pause, expected to be rare.

**State-ownership principle (owner, 2026-07-02):** the server-side harness (conversation log, semantic index, F-I-D/ContextFrameManager, later the D47 engine's graph state) is the **ground truth and the state machine**; the voice model is a rendering/interaction layer whose in-session context is treated as a **cache** of that truth — refreshed by injection (replace-don't-append), steered by instruction updates, never trusted as authoritative state. Caveat to design around: a native realtime session also accumulates its own conversational memory that can only be partially pruned (injected items can be deleted/replaced; the model's dialogue history cannot be rewritten wholesale) — so "purge" on native S2S = replace injected context + re-instruct, and a *hard* reset is a re-mint at a pause. On the cascade, the harness owns the entire message array, so purge/fork/model-swap are exact and per-turn.

Each adapter owns the translation between this contract and its provider SDK. The differences are real (event models, tool schemas, context injection mechanics) — this layer stays hand-rolled by design (proposal §5).

## 2. Providers (D22)

| Provider | Status | Transport | Token route | Notes |
|---|---|---|---|---|
| OpenAI Realtime | **primary, implemented** | WebRTC via `@openai/agents` | `POST /api/ai/openai/session` | Ephemeral session; prompt + tools at mint; model via `default-realtime` alias (D4) |
| Google Gemini Live | **implemented (Phase 4 Block C, task 6)** | raw WebSocket (`BidiGenerateContentConstrained`), no SDK — matches the D39 reasoning adapter's no-SDK convention | `GET /api/ai/google/session` — mints a v1alpha ephemeral `auth_tokens` token with model/instructions/tools/generationConfig **locked** into the token (no `lockAdditionalFields` while a setup is present ⇒ Gemini locks everything named); the client's own post-connect setup message can be a bare model echo since the server enforces the locked config regardless | Tool-calling gaps documented in §2c below, feeding D41 |
| Cascade (D45) | **implemented (Phase 4 Block C, task 9)** | HTTP request/response (v1, non-streaming) | none — rides the `/api/ai/chat` session cookie; STT/TTS via `/api/ai/cascade/*` | STT → the shared text pipeline → TTS; see §2b |
| ElevenLabs Agents | **RETIRED (2026-07-08, D22 amendment)** | — | — | Agent-platform adapter + token route deleted with task 9.4; ElevenLabs remains as a TTS/STT **engine** inside the cascade (`eleven_*`/`scribe_*` model ids in the cascade config) |

Provider/model selection: `VoiceProviderConfig` rows (admin CRUD at `/api/admin/ai/voice-config*`, default flag, import/test endpoints). The client receives resolved config through `ClientAIModelManager` — models by alias, never literal IDs in code.

## 2b. Cascade adapter family (D45 — implemented 2026-07-08, Phase 4 Block C task 9)

**Implementation shape (v1):** `CascadeVoiceAdapter` (client) + `lib/ai/stt.ts`/`tts.ts` (server) + `/api/ai/cascade/{stt,tts}` (gateway-wrapped). v1 is request/response, not streaming — measured ≈4.5–5s to first audio (STT 1.7s + LLM 2.9s + TTS TTFB) vs the 1–1.5s streaming budget below; streaming + sentence-chunked TTS is the optimization path, D50 clips (9b) mask the gap meanwhile. Turn-taking v1 is a conservative energy VAD, half-duplex (no barge-in). Persistence rides the chat route (`transport_mode='voice'` labels); F-I-D injection into the chat body and D49 leg parity are open follow-ups.

**Three modes, one brain (owner framing, 2026-07-08).** The system has exactly three modes of operation, and they stack:
1. **Native speech-to-speech** (OpenAI Realtime, Gemini Flash Live) — the primary interaction model: the provider hears audio and speaks audio directly.
2. **Text-only** — the base text pipeline (reasoning adapter + UnifiedToolRegistry).
3. **Cascade** — built *on top of* the same text-only pipeline as an adapter/extension: streaming STT feeds the text pipeline, streaming TTS renders its answer. Any LLM (± reasoning) × any TTS (ElevenLabs, OpenAI, Google), fully modular; ElevenLabs is the practical default for voice quality but never hardcoded.

Native s2s is the flagship for latency; cascade is the mix-and-match fallback where a specific voice/LLM pairing matters. Both render the *same* grounded answer — mode is a rendering choice, not a different assistant.

A second family behind the **same** `IConversationalAgentAdapter`:

```
mic ──► streaming STT ──► reasoning adapter (D39: OpenAI | Anthropic | Google)
                              │  server-side tool calls (UnifiedToolRegistry — mature classic-LLM tool use)
                              ▼
                          streaming TTS (ElevenLabs Flash first) ──► speaker
```

- **One brain, three renderings:** the cascade shares its LLM pipeline with text chat and native s2s — answers are identical whether read or spoken. Cascade is text-only *plus* STT/TTS (see the three-mode framing above).
- **Tool reliability by construction:** tools execute in the classic LLM server-side; ElevenLabs is a TTS engine here, not an orchestrator — its agent-platform tool-calling problems are out of the loop entirely.
- **Latency budget:** ~1–1.5s to first audio (STT endpointing + LLM TTFT + TTS TTFB, all streamed). Acceptable for portfolio Q&A; the native family stays the low-latency flagship.
- **Turn-taking v1:** push-to-talk or conservative VAD; barge-in (cutting TTS on user speech) is a v2 refinement. This is the known-hard part of cascades — keep it deliberately simple first.
- **STT provider** is a new small adapter surface (ElevenLabs Scribe / Deepgram / OpenAI transcription), configured like other providers (env keys D3, models via registry D4).
- Everything else is untouched: same pill, same F-I-D injection (into the LLM context directly — simpler than realtime context items), same conversation logging, same gateway metering.

Showcase framing: native S2S vs cascade behind one interface, switchable in admin, A/B-able live.

## 2c. Google Gemini Live — tool-calling findings (task 6.3, feeds D41)

Live-fire drilled 2026-07-07 via the C0 synthesized-audio fake-mic driver (`/admin/ai/voice-debug`,
Gemini Live selected) against `gemini-2.5-flash-native-audio-latest` — the **only** model on this
account's key with `bidiGenerateContent` in `supportedGenerationMethods` (`gemini-live-*-preview` and
`gemini-2.0-flash-live-001` model ids from Google's public docs 404 on this account — same "current-gen
only" pattern as the D39 reasoning adapter's Anthropic/OpenAI keys; verify via `ListModels` + the
`Test Configuration` button before assuming a model id is usable, don't hardcode from docs).

**Confirmed working end-to-end:** input/output transcription (streamed word-by-word, accumulated
client-side into one row per turn), `content_search` and `ui_intent` tool calls routed through the same
`UnifiedToolRegistry` → `_executeUnifiedTool` pipeline as OpenAI/ElevenLabs, tool results returned via
`toolResponse.functionResponses`, and full persistence (leg-tagged messages, `[tool:name] ok` rows with
`debugInfo`, one assistant row per finalized turn) — verified via `GET /api/ai/conversation/log?sessionId=`.

**Real bugs found and fixed (this session and the next, via live-fire + a human listening to the
result — several only reproduced on the actual homepage with real portfolio UI state, not the
isolated admin debug page):**
- **`oneOf` union schemas crash the Live API server-side.** `ui_intent`'s polymorphic `target`
  (`{type:'project'|'section'|'route'|'modal'|'element', ...}`) is declared as a JSON-Schema `oneOf` of
  five variants. Gemini's Schema dialect has no `oneOf`/`anyOf` support: the malformed declaration was
  *accepted* at token-mint time but crashed the session (WS close **1011 "Internal error occurred"**)
  the instant the model tried to construct a call against it — reproduced reliably (not a flake) via the
  C0 driver on the live homepage. This is also what caused the "argument schema drift" first suspected as
  a model weakness (`{route:'projects'}`, `{sectionId:'projects'}` guesses) — once the schema was fixed
  the model emitted the exact correct shape (`{type:'section', id:'projects'}`) with no further drift.
  **Fixed**: `stripUnsupportedSchemaKeys` (`lib/ai/reasoning/google-adapter.ts`) now flattens `oneOf`/`anyOf`
  into one permissive merged object schema (properties unioned, same-key enums combined, `required` reduced
  to the intersection across variants — the shared `type`/`id` discriminator). Covered by unit tests in
  `reasoning-adapters.test.ts`. **Any future tool schema using `oneOf`/`anyOf` for Gemini needs this same
  flattening — grep for it before adding one.**
- **No audio output** (owner-reported from actually listening, not caught by any automated drill).
  `_playAudioChunk` created the playback `AudioContext` lazily inside the async WS message handler —
  outside any user-gesture call stack, so browser autoplay policy left it `'suspended'`: every buffer was
  scheduled silently with no error thrown. Input worked (mic capture is gated by the separate getUserMedia
  permission grant), output never did. **Fixed**: the context is now created + resumed as the first
  synchronous statement in `connect()`. Lesson for any future raw-Web-Audio-API playback (not an
  `<audio>` element or WebRTC track): the context must be born inside the click handler's call stack.
- **Internal reasoning leaking into the visible/persisted answer.** Gemini emits its thinking trace as
  `part.thought === true` entries in `serverContent.modelTurn.parts`, in messages with no
  `outputTranscription` alongside them. The adapter's fallback text-accumulation path only checked
  `!sc.outputTranscription`, so it wrongly captured thought text as the spoken answer — this produced
  narration like `"**Initiating the Search**... I've set a maxTier=3..."` instead of a direct response.
  **Fixed**: thought parts route to a separate accumulator, stored as `metadata.reasoning` (never mixed
  into `content`), rendered as a collapsed `<details>` in both the live debug transcript and admin replay.
  New `GoogleLiveConfig.enableReasoning` (default **false**, real-time voice favors latency): off sets
  `thinkingConfig.thinkingBudget: 0` at mint (disables thinking at the source); on sets `includeThoughts: true`.
- **`enum` values must be strings regardless of the property's declared `type`.** Gemini's Schema proto
  enum field is `repeated string`; two registry tools (`content_search.maxTier`, `content_get.includeTiers`)
  declare `type: 'number'` with a numeric `enum`. **Fixed** in the same `stripUnsupportedSchemaKeys`
  sanitizer by coercing enum array values to strings — otherwise `auth_tokens.create` rejects the whole
  tool declaration with a 400.

**Not run:** cross-provider resume onto/from Gemini (5b.4 precedent: OpenAI↔OpenAI exercised the resume
mechanics; Gemini's disruption-watcher/auto-reconnect was not built in this pass — task 6 scope was the
adapter + admin config + tool-calling smoke test, not full D49 parity). Audio *quality* (voice naturalness,
latency feel) was owner-verified by listening; the WS-close-1011/schema findings above came from that same
listen, not from an automated check — worth remembering that some classes of bug only surface with a human
in the loop or by testing against real UI state (see the homepage fake-mic drill note in task 9).

## 3. Session lifecycle

1. Pill activation → access check (`access-and-cost`: tier/reflink) → token mint request.
2. Mint route (gateway-wrapped): resolves tier → builds system prompt (server-side, via context provider) + tool schema (registry, filtered to tier allowlist) → provider token API → short-lived token with **duration cap**.
3. Adapter connects WebRTC; F-I-D begins passive injection; conversation events stream to the log route.
4. Mode switches (text↔voice) reuse the session (`sendMessage` vs audio); no server thread exists.
5. Disconnect (user, cap, or error) → final log flush; admin replay available immediately.

## 4. Session continuity & resume (D49)

```
AIConversation (logical conversation — one visitor interaction)
 ├─ leg 1: {provider, modelAlias, startedAt, endedAt, endReason}
 ├─ messages/turns + tool traces (leg-tagged)
 ├─ [session_disruption]  {issueType: network|provider_error|token_expiry|watchdog|reload, diagnostics}
 ├─ [session_resumed]     {new leg, provider/model, briefing summary}
 ├─ leg 2: {…possibly a different provider…}
 └─ latest-state snapshot {instructions, active tools, model alias, (later) D47 node}
```

Resume flow: disruption detected (adapter connection-state events or heartbeat) → marker written → client requests resume for the conversation ID → gateway re-validates tier/budget → new leg minted (same or different provider — the choice is config/trigger, not architecture) → harness **briefs** the new session from ground truth: state snapshot + a bounded recap of recent turns (the conversation store is authoritative; provider-side memory from leg 1 is gone and never assumed) → `session_resumed` marker → history continues in the same conversation.

Design consequences:
- **One code path, three triggers:** connection recovery, deliberate provider/model switch, and (later) D47 fork-with-model-swap are the same resume operation. Test it as one thing (verification disconnect/resume drill).
- The latest-state snapshot is updated on every `updateSession` and significant turn — cheap writes, and it is exactly what the D47 engine will store its node pointer in.
- Admin replay renders markers inline; a conversation with three legs across two providers reads as one timeline.
- Serverless-honest (D43): all continuity state in Postgres; any instance can resume any conversation.

## 4b. Pre-recorded voice assets (D50 — Phase 4 polish)

A client-side audio asset player in the pill, **independent of the adapters** (it must work precisely when no adapter connection exists):

- **Asset library:** clips keyed `(voiceId, phraseId)`, stored via the `media` pipeline, served statically. Admin manages the phrase list in voice config and regenerates clips through the active provider's TTS on voice change (OpenAI TTS shares realtime voice names; ElevenLabs TTS covers its voices — same voice in clip and live speech).
- **Trigger classes:** tool-latency filler (server tool call > ~1.5s; rotating pool, context tags like *checking/searching/analyzing*; killed the instant model audio or user speech starts — never overlap), connection-state audio (driven by the adapter's connection-state events + the D49 resume flow: disruption clip → retrying → resume-failed apology), cold-start greeting (optional, while token mint + handshake complete).
- **Honest logging:** every playback emits a `clip_played` event into the D49 conversation history — replay must show what the visitor actually heard; a clip is not model speech and must never be mistaken for it when debugging answer quality.
- **D47 hook (later):** nodes may reference their own filler sets; the base feature has no engine dependency.

## 5. Known implementation gaps (tracked in tasks.md)

- `localhost:3000` fallbacks in `voice-config.ts` / `BackendToolService.ts` — replace with env-derived origin.
- `connectionDiagnostics.ts` is a support utility, not a public surface.
- Duplicate `/api/ai/openai/token` route (superseded by `/session`) — delete.
