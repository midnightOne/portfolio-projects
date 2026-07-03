# ai-assistant — Tasks

**Status:** current
**Owner domain:** visitor AI runtime
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36 — the old client-side-ai tasks.md (141KB, colliding numbering) is archived, not carried.**

---

## Already implemented (verified on branch)

OpenAI Realtime + ElevenLabs adapters behind `IConversationalAgentAdapter` with WebRTC and ephemeral tokens; server-side prompt/tool injection at token mint; `UnifiedToolRegistry` with client/server contexts and `/api/ai/tools/execute`; declarative `ui_intent`/`ui_describe` via `UIManager` + `SemanticIDRegistry` (imperative tools and internal "MCP" library deleted on branch); semantic server tools (`content_search`, `content_get`, `content_getHierarchy`, `content_searchSection`, `content_getRelated`); F-I-D passive context (`PassiveFIDManager`, `ContextFrameManager`, `/api/ai/context/fid`); conversation logging via `conversation-history-manager`; pill UI with subtitle narration; admin voice config (`VoiceProviderConfig` CRUD); admin debug surfaces (currently on the duplicate provider — see task 1).

## Open tasks

### Phase 3 — consolidation

- [ ] 1. Single conversational-agent provider (D21)
  - [ ] 1.1 Migrate admin debug components (`VoiceDebugInterface`, `ContextMonitor`, `ToolCallMonitor`, …) to `components/providers/conversational-agent-provider.tsx`
  - [ ] 1.2 Delete `src/contexts/ConversationalAgentContext.tsx` + `src/hooks/useConversationalAgent.ts` re-export
  - [ ] 1.3 Debug pages functional against persisted-log replay
  - _Requirements: 3.4, 10.1_

- [ ] 2. Delete Gen-1 conversation stack
  - [ ] 2.1 Remove `conversation-manager.ts`, `unified-conversation-manager.ts`, `conversation-transport.ts`, `context-manager.ts`; remove the `/api/ai/conversation` POST pipeline (keep read-only history/transcript/replay re-pointed at `conversation-history-manager`)
  - [ ] 2.2 Fold `context-injector.ts` into `context-provider.ts`; update its 5 importing routes
  - [ ] 2.3 Audit `/api/ai/context/{load,inject,cache}` + `/api/ai/context` — delete anything not called by adapters or F-I-D
  - _Requirements: 9.1; design §3_

- [ ] 3. Tool registry cleanup (D18/D19)
  - [ ] 3.1 Unregister `fillFormField`, `submitForm`, `animateElement`; delete `content_navigateTo` definition
  - [ ] 3.2 Merge `src/lib/voice/UINavigationTools.ts` + `src/lib/ai/tools/client-tools.ts` into one client-tool module
  - [ ] 3.3 Agent smoke test: navigation + content search through both providers
  - _Requirements: 4.4_

- [ ] 4. Delete mock endpoints (D26)
  - [ ] 4.1 Remove `/api/ai/conversation/{analytics,search,transcripts}` mocks, `/api/admin/ai/voice-analytics*`, `/api/ai/context` mock, duplicate `/api/ai/openai/token`
  - _Requirements: 9.2_

- [ ] 5. Config hygiene
  - [ ] 5.1 Remove hardcoded ElevenLabs fallback agent ID; `localhost:3000` fallbacks → env-derived origin
  - [ ] 5.2 Model references resolve via registry aliases (with `ai-admin` task set, D4)
  - _Requirements: 3.2_

- [ ] 5b. Conversation continuity (D49) — *design lands with the Phase 3 persistence consolidation (task 2); full resume in Phase 4 alongside adapter work*
  - [ ] 5b.1 Schema: session legs on `AIConversation` (provider, model alias, timestamps, end reason); leg-tagged messages/traces; latest-state snapshot storage
  - [ ] 5b.2 Marker events (`session_disruption`, `session_resumed`) written by `conversation-history-manager`; admin replay renders them inline
  - [ ] 5b.3 Resume flow: disruption detection → gateway re-validation → new leg mint → harness briefing (snapshot + bounded recap) → continue same history
  - [ ] 5b.4 Cross-provider resume exercised (OpenAI leg → ElevenLabs/cascade leg); deliberate model-switch uses the same path
  - [ ] 5b.5 Verification: forced-disconnect drill (kill connection mid-conversation → resume → markers present, context coherent) — joins `verification` live-fire recipes
  - _Requirements: 12_

### Phase 4 — features

- [ ] 6. Google (Gemini Live) adapter (D22)
  - [ ] 6.1 Session/token route (gateway-wrapped, duration-capped) + adapter implementing `IConversationalAgentAdapter`
  - [ ] 6.2 Admin voice config support; smoke test `ui_intent` + `content_search`
  - [ ] 6.3 Document tool-calling behavior/gaps → feed D41 exploration notes
  - _Requirements: 3.2, 3.3_

- [ ] 7. `BackendToolService` de-stubbing
  - [ ] 7.1 Real profile/contact data from DB (remove hardcoded profile)
  - [ ] 7.2 Persist contact-form submissions; real file processing for reflink uploads
  - _Requirements: 8, Req 1.2_

- [ ] 8. Job-analysis productization (with `ai-admin` D39 adapters)
  - [ ] 8.1 Analysis via `default-reasoning` alias; persist `AIJobAnalysis`; admin review view
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

Form-filling tools (D18 — needs a real use case); simplified mobile pill variants; multi-language conversations.
