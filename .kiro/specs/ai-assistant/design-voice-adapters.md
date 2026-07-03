# ai-assistant — Design: Voice Adapters

**Status:** current
**Owner domain:** provider adapter layer, session lifecycle, mode continuity
**Last verified against code:** 2026-07-02 (`e2d75b4`)

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
| Google Gemini Live | **planned (Phase 4.3)** | WebRTC/WebSocket per SDK | new session route, same gateway pattern | Weaker tool-calling expected — document gaps, feed D41; adapter must not fork the interface |
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

## 3. Session lifecycle

1. Pill activation → access check (`access-and-cost`: tier/reflink) → token mint request.
2. Mint route (gateway-wrapped): resolves tier → builds system prompt (server-side, via context provider) + tool schema (registry, filtered to tier allowlist) → provider token API → short-lived token with **duration cap**.
3. Adapter connects WebRTC; F-I-D begins passive injection; conversation events stream to the log route.
4. Mode switches (text↔voice) reuse the session (`sendMessage` vs audio); no server thread exists.
5. Disconnect (user, cap, or error) → final log flush; admin replay available immediately.

## 4. Known implementation gaps (tracked in tasks.md)

- `localhost:3000` fallbacks in `voice-config.ts` / `BackendToolService.ts` — replace with env-derived origin.
- `connectionDiagnostics.ts` is a support utility, not a public surface.
- Duplicate `/api/ai/openai/token` route (superseded by `/session`) — delete.
