# ai-assistant — Design: Voice Adapters

**Status:** current
**Owner domain:** provider adapter layer, session lifecycle, mode continuity
**Last verified against code:** 2026-07-07 (Phase 4 Block C, task 6 — Google Gemini Live adapter)

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
| ElevenLabs Agents | implemented, **last priority** | WebRTC via `@elevenlabs/client` | `POST /api/ai/elevenlabs/token` | Maintenance only; hardcoded fallback agent ID removed (config via `VoiceProviderConfig`) |

Provider/model selection: `VoiceProviderConfig` rows (admin CRUD at `/api/admin/ai/voice-config*`, default flag, import/test endpoints). The client receives resolved config through `ClientAIModelManager` — models by alias, never literal IDs in code.

## 2b. Cascade adapter family (D45 — planned, Phase 4)

A second family behind the **same** `IConversationalAgentAdapter`:

```
mic ──► streaming STT ──► reasoning adapter (D39: OpenAI | Anthropic | Google)
                              │  server-side tool calls (UnifiedToolRegistry — mature classic-LLM tool use)
                              ▼
                          streaming TTS (ElevenLabs Flash first) ──► speaker
```

- **One brain, two renderings:** the cascade shares its LLM pipeline with text chat — answers are identical whether read or spoken. Text mode is simply the cascade minus STT/TTS.
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

**Real gaps found (this session, not hypothetical):**
- **Argument schema drift.** Asked to navigate via `ui_intent`, the model called it with
  `{ target: { route: 'projects' } }` instead of the documented `{ target: { type: 'route', id: 'projects' } }`.
  The tool executed "successfully" (empty result, no error) but the shape mismatch means the call is a
  silent no-op rather than a real navigation — worse than an explicit failure. OpenAI/ElevenLabs did not
  exhibit this in prior drills. Candidate fixes for D41: tighter `enum`/`required` constraints in the
  function-declaration schema (Gemini's dialect already strips `additionalProperties`, so schemas are
  looser than intended by the time they reach the model), or a thin server-side shape-normalizer for
  `ui_intent` args specifically before dispatch.
- **Native-audio "thinking" narration leaks into the spoken/transcribed response.** Rather than a direct
  conversational answer, `outputTranscription` carried the model's step-by-step reasoning verbatim
  ("**Initiating the Search**... I've set a `maxTier=3`..."), which is not something a visitor should hear
  a portfolio narrator say. This looks like a "thinking" mode default for this preview model rather than
  an adapter bug — worth an explicit `thinkingConfig` (if the Live API exposes one for this model) or a
  stronger system-instruction constraint ("never narrate your tool-use process") before this ships past
  internal testing.
- **`enum` values must be strings regardless of the property's declared `type`.** Gemini's Schema proto
  enum field is `repeated string`; two registry tools (`content_search.maxTier`, `content_get.includeTiers`)
  declare `type: 'number'` with a numeric `enum`. Fixed in the shared `stripUnsupportedSchemaKeys` sanitizer
  (`lib/ai/reasoning/google-adapter.ts`, also used by `UnifiedToolRegistry.getGoogleToolsArray()`) by
  coercing enum array values to strings — otherwise `auth_tokens.create`/`generateContent` reject the whole
  tool declaration with a 400.

**Not run:** cross-provider resume onto/from Gemini (5b.4 precedent: OpenAI↔OpenAI exercised the resume
mechanics; Gemini's disruption-watcher/auto-reconnect was not built in this pass — task 6 scope was the
adapter + admin config + tool-calling smoke test, not full D49 parity). Audio *quality* (voice naturalness,
latency feel) needs a human listener; turn mechanics are covered by the driver above.

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
