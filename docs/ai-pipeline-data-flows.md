# AI Pipeline — Data Flows and Mutation Points

> Written 2026-07-09 for the owner's architecture review before the UI-state context
> redesign (ledger 7.1). Every flow lists the classes it passes through and **where the
> data gets mutated**, because that is what decides caching, token burn, and debuggability.
> File references are the owner-of-record for each step; verify against code before
> large changes — this document describes the system as of commit `aa3295e`.

---

## 1. Session mint (server-side prompt assembly — happens once per leg)

```
Pill / FakeMicPanel (client)
  └─> GET /api/ai/openai/session?contextId&reflinkId[&resumeSessionId]
        src/app/api/ai/openai/session/route.ts        [gateway-wrapped, D33]
        ├─ ClientAIModelManager.getProviderConfig('openai')
        │    src/lib/voice/ClientAIModelManager.ts
        │    ├─ DB row voice_provider_configs WHERE is_default=true   (none today)
        │    └─ else OpenAIRealtimeSerializer.getDefaultConfig()
        │         └─ DEFAULT_OPENAI_CONFIG ← OPENAI_REALTIME_MODEL constant
        │              src/types/voice-config.ts
        ├─ MUTATION: systemInstructions = config.instructions
        │    + UIManager tool guidance block
        │    + NAV_CONTEXT handling block
        │    + navigation/search workflows + honesty blocks
        │    + tool latency guidance        src/lib/ai/tool-latency.ts
        │    + start frame (project names/tech)  src/lib/ai/start-frame.ts
        │    + reflink personalization      src/lib/services/ai/reflink-manager.ts
        │    + resume briefing (D49)        src/lib/ai/resume-briefing.ts
        └─> OpenAI POST /v1/realtime/client_secrets  → ephemeral token
```

- The assembled prompt **never reaches the client readably** (owner security pass);
  the agent is created without instructions.
- **Token cost**: this block + tool schemas ≈ **4.2K tokens billed on every response**
  of the session (measured live). It is the largest single per-turn cost. Two copies of
  the guidance exist in the route (GET + POST handlers) — keep them in sync.
- Google mirror: `src/app/api/ai/google/session/route.ts` (`TOOL_GUIDANCE` const,
  single copy, locked into the ephemeral token).

## 2. Connect / session lifecycle (client)

```
ConversationalAgentProvider (per-page: / and /about/ai — route change kills sessions, 7.7)
  src/components/providers/conversational-agent-provider.tsx
  ├─ initializeProvider(): cleanup old adapter → AdapterRegistry.create → adapter.init
  └─ connect(): guards isConnected → adapter.connect(options)

OpenAIRealtimeAdapter.connect()
  src/lib/voice/OpenAIRealtimeAdapter.ts
  ├─ mint fetch (flow 1) → token
  ├─ _createRealtimeSession(inputKind)      ← closes previous session (leak guard),
  │                                            resets token-ack listener flag
  ├─ RealtimeSession.connect (WebRTC: mic | silent | synthetic D53 stream)
  ├─ MUTATION: _legUsage reset; leg start row posted (flow 7)
  ├─ _startDisruptionWatcher (2s poll; 10s grace on 'disconnected'; diagnostics snapshots)
  └─ _armDurationCap(mint.max_session_seconds)
```

Disruption → `_handleDisruption` → close session → reconnect with
`resumeFromSessionId` → mint route builds a **resume briefing** (this is the only
context *compaction* mechanism in the system today).

## 3. Turn flow (audio + usage)

```
mic/synthetic audio ─WebRTC─> OpenAI VAD
  input_audio_buffer.speech_started   → _userSpeechActive=true; speech-start time captured
  input_audio_buffer.speech_stopped   → commit → model turn
  response.done
    ├─ usage {input_tokens, output_tokens}   ← NO total_tokens field!
    ├─ MUTATION: _legUsage += ; usageDelta POST → conversation.total_tokens (live counter)
    ├─ tpm_warning row when one response ≥ 15K tokens
    └─ status cancelled/failed → error row + stall-watchdog re-arm (rate-limit backoff)
  output_audio_buffer.started → clears stall watchdog, stamps turn onset (9b.5)
```

**Realtime billing model**: every `response.done` re-bills the ENTIRE conversation
(system prompt + all items + all audio) as input tokens. Prompt caching discounts
~90% of any unchanged prefix but **cached tokens still count toward TPM**.

## 4. Tool execution

```
model function_call
  └─> RealtimeAgent tool execute wrapper (per-tool, built in _initializeTools)
        OpenAIRealtimeAdapter.ts (~line 403)
        ├─ 20s timeout guard (returns honest timeout string)
        ├─ switch by name → _openaiXXX wrappers → _executeToolCallUnified
        │     ├─ _executeUnifiedTool (base class, IConversationalAgentAdapter.ts)
        │     │    ├─ executionContext 'client' → uiNavigationTools[name](args)
        │     │    │     src/lib/ai/tools/client-tools.ts → UIManager (flow 5)
        │     │    │     MUTATION: success:false → THROW (honesty);
        │     │    │               arrays → {message, steps:[...]}
        │     │    └─ 'server' → POST /api/ai/tools/execute
        │     │          src/app/api/ai/tools/execute/... → UnifiedToolRegistry
        │     │          → BackendToolService (flow 6)
        │     ├─ MUTATION: object → JSON string; searchMetadata STRIPPED (token diet)
        │     └─ MUTATION: "[guidance] …" nudge appended for ui_intent/ui_describe/content_search
        ├─ _armResponseStallWatchdog (10s silence → nudge, max 3/episode)
        └─ _logToolRow: ONE row post-execution (args + exact model payload + success
             + latency, stamped at execution START)
```

- Tool list = `unifiedToolRegistry.getModelExposedToolDefinitions()` —
  `modelExposed:false` hides internal plumbing (searchProjects, loadProjectContext).
- **The tool output string enters the conversation permanently** and re-bills every
  subsequent turn — size discipline here is a TPM lever.

## 5. UI navigation (client tools → UIManager)

```
ui_intent {target}
  └─> UIManager (singleton)  src/lib/navigation/UIManager.ts
        ├─ _normalizeIntentTarget      ← Gemini flattened-schema drift repair
        ├─ plan: project | section | route | modal | element
        │   ├─ _createOpenProjectModalStep: verbatim → slugified → fuzzy DOM match
        │   │     (normalize vs [data-project-id] slugs)
        │   ├─ _planSectionNavigation: runtime DOM-resolved (in-modal scroll in place;
        │   │     behind modal → staged close; not found → honest error)
        │   ├─ _scrollWithReassert (late-render scroll resets)
        │   └─ _createHighlightStep (scoped passage highlight, never fails nav)
        ├─ modal handlers registered per page (homepage/projects)
        └─ NavigationResult {success, message, data(steps)}

navigation complete / FID update
  └─> UIManager._backgroundUpdateCallback → immediate passive context update (flow 5b)
```

### 5b. Passive context (the flow under redesign — ledger 7.1)

```
PassiveFIDManager  src/lib/ai/PassiveFIDManager.ts
  builds FID = { frame, index (route, currentProject, availableProjects,
                 projectSemanticItems), details (briefSummary, intentContent) }
  └─> OpenAIRealtimeAdapter.pushPassiveContext(fid)
        ├─ blip window? → DEFER (latest wins, re-push on recovery)
        ├─ MUTATION: progressive compaction above 12K chars
        ├─ conversation.item.create  "NAV_CONTEXT <token> {json}"  — APPEND-ONLY
        │     (replaceNavContext/delete paths exist but have NO live callers)
        └─ ack: waitForCreatedWithToken (item.added|created; timeout row w/ diagnostics)
```

**Current cost profile**: each push ≈ up to ~3K tokens, appended per navigation,
retained for the whole session, re-billed (cached-cheap, TPM-full) every turn.
`ui_describe` (the pull twin) reads the same PassiveFIDManager state on demand.

### Push vs pull vs owner's original single-entry design (decision notes)

| | push per change (today) | single-entry juggle (original) | pull via ui_describe (7.1) |
|---|---|---|---|
| context growth | grows every navigation | constant ~1 entry | grows only when model navigates |
| cache effect | append-only: perfect prefix | delete busts cache from the OLD entry's position | append-only; pruning (optional) deletes RECENT items = cheap |
| freshness at decision time | stale if UI changed since push | stale by up to one turn | exact at the moment of use |
| spend when NOT navigating | wasted push | wasted push + cache bust | zero |
| latency | none | none | +1 tool round-trip on navigation turns |

The single-entry design is cache-cheap **only while the active entry stays near the
conversation tail**; after a few non-UI turns the delete reaches deeper and the
re-billed suffix grows. Pull's structural advantage is that UI state enters the
context only on demand and always fresh; its real cost is one extra round-trip.

## 6. Semantic retrieval (server tools)

```
content_search {query, uiState, k, maxTier}
  └─> BackendToolService  src/lib/ai/tools/BackendToolService.ts
        ├─ 60ms request cache (effectively off) · scope/filter enhancement
        ├─ ContentSearchService.searchContent (k = max(2k,10))
        │     src/lib/content/ContentSearchService.ts
        │     ├─ query embedding (cache) → pgvector semanticSearch (k*3)
        │     ├─ FTS strict websearch AND → if <3 rows, relaxed OR over significant words
        │     │     both passes: title matches weigh 3x body
        │     ├─ FUSION: both halves → max(semantic+bonus, FT band 0.55–0.90)
        │     ├─ importance ranking → named-project boost (+0.25, tags queryNamedProject)
        │     └─ MMR diversify (2/project cap; LIFTED to ceil(k/2) for named project)
        ├─ UI-state ranking: +0.5 current project, +0.6 query-named project,
        │     +0.4 TOPIC word in title (topic = significant words minus project name)
        ├─ navTarget enhancement (tier-aware: T2→sectionId, T3→parent+highlight snippet)
        └─ items[] {id, project, title, why, navTarget, score, facets}
```

`why` strings are generated per-result (heading match / query-names-project /
tech / content mention) — they are the model's basis for "pick by match, not score".

## 7. Ingestion (content → chunks — one pipeline, no UI/agent divergence)

```
article_content.jsonContent (Tiptap)
  └─ HierarchicalContentParser  src/lib/content/HierarchicalContentParser.ts
       ├─ MUTATION: malformed heading nodes split (first line = title; rest = child
       │    body section) — real Tiptap heading levels flow through (hierarchy)
       └─ sections + anchorIds (slug of clean title — display renderer applies the
            SAME first-line rule: src/components/tiptap/tiptap-display-renderer.tsx)
  └─ SmartContentGenerator.generateScaffoldOnly → T0/T1/T2(placeholder|auto)/T3
  └─ StageBasedProcessingService  src/lib/content/StageBasedProcessingService.ts
       ├─ chunking: save + PURGE stale chunk_ids not in new scaffold
       ├─ summaries: AI T1/T2; parent headings w/o prose → "Covers: <children>"
       ├─ embeddings: input = TITLE + content (heading = the anchor)
       └─ validation
       ⚠ singleton survives HMR — restart the dev server after editing this service
```

## 8. Persistence & telemetry (one route, many shapes)

```
POST /api/ai/conversation/log   src/app/api/ai/conversation/log/route.ts
  ├─ usageDelta          → conversation.total_tokens increment (live counter)
  ├─ transcriptItem      → message row (user rows stamped at SPEECH START;
  │                         assistant rows at turn END by design — latency story)
  ├─ toolName/toolArgs   → tool row (dedupe by id — first write wins, so the row
  │                         is posted once, post-execution, with the result)
  ├─ event {navigation|error} → replayable rows (blips, stalls, tpm warnings,
  │                         cancelled/failed responses, ack timeouts + diagnostics)
  └─ connectionData      → legs (start/end/disruption markers; leg metadata.usage)
GET ?sessionId=…         → full conversation for the admin replay (sorted by timestamp)
```

## 9. Known mutation hazards (why things broke before)

1. **Anything posted pre-execution can never carry results** (route dedupes by id).
2. **Realtime usage has no `total_tokens`** — derive input+output.
3. **Deleting conversation items invalidates the prompt cache from that position**;
   appending never does. Cached tokens still count toward TPM.
4. **HMR**: server singletons (StageBasedProcessingService) and live voice sessions
   (per-page provider remount) both die differently under hot reload — never edit
   while testing voice; restart the server after editing ingestion services.
5. **Two copies** of the OpenAI mint guidance; Gemini flattens oneOf schemas
   (dispatcher-level normalization compensates).
```
