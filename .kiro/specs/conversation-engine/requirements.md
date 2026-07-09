# conversation-engine — Requirements

**Status:** current — **unimplemented** (promoted from `_backlog/conversation-engine.md` on 2026-07-09, owner decision; post-roadmap Phase 6)
**Owner domain:** node-graph conversation templating engine: graph model + versioned storage, runtime evaluator, per-node context/tool/model orchestration, traversal telemetry, admin graph editor, review/annotation loop, golden-scenario testing
**Last verified against code:** 2026-07-09 (spec authored against staging head; nothing implemented yet)
**Registry decisions applied:** D47 (defining), D4, D39, D41(d), D45, D46, D48, D49, D50, D55, D56, D58, D59
**Contracts:**

| Consumes | From |
|---|---|
| `IConversationalAgentAdapter` + `updateSession` control-plane primitive (added by task A2 of this spec — D47(d)) | `ai-assistant` |
| Single server-side context assembly point (`context-provider.ts` + `start-frame.ts`) — the engine feeds/replaces it, never bypasses it (D47(a)) | `ai-assistant` |
| D55 context buffer (per-conversation keyed buffer, replace-don't-append, turn-end flush) — prerequisite; built as ai-assistant work if not landed before this spec starts | `ai-assistant` |
| `UnifiedToolRegistry` enumeration with metadata + `/api/ai/tools/execute` per-request allowlists (D47(b)) | `ai-assistant` |
| Conversation store: `AIConversation`/`AIConversationLeg`/`AIConversationMessage`, marker rows, `latestState` snapshot, resume briefing (D49/D58) | `ai-assistant` |
| Model registry aliases + reasoning adapters (D4/D39); cheap intent classification via `default-cheap` | `ai-admin` |
| `ContentSearchService`, `ContentEntity`, T0–T3 chunks (node context sets; RAG fallback) | `semantic-content` |
| AI gateway wrapping for every cost-incurring evaluation call (D33) | `access-and-cost` |
| Fakes (`FakeReasoningAdapter`, fake embeddings), fixture project, tagged test sessions, `_debug` envelope (D46) | `verification` |

| Provides | To |
|---|---|
| `ConversationEngine` runtime service (session-start policy, per-turn edge evaluation, engine directives) | `ai-assistant` mint routes, `/api/ai/conversation/log`, `/api/ai/chat` |
| `ConversationGraph`/`ConversationGraphVersion`/`GraphAnnotation`/`GraphScenario` models + admin CRUD/publish APIs | admin CMS |
| Admin graph editor UI (`/admin/ai/conversation-graphs`) | owner |
| Traversal telemetry semantics (`node_transition` markers, `latestState.nodeId`) | admin replay/browser, `verification` |
| Golden-scenario runner (`check:scenarios`) | `verification` |

Overview: [`../00-overview/README.md`](../00-overview/README.md) · Origin outline: [`../_backlog/conversation-engine.md`](../_backlog/conversation-engine.md) (superseded by this spec; §1b purpose statement remains the rationale record)

---

## Requirement 1 — Graph model and versioned storage

**User story:** As the owner, I want conversational policy expressed as a versioned node graph, so that I can script prepared paths without touching code and review past conversations against the exact graph they ran under.

1. WHEN a graph is defined THEN it SHALL consist of **nodes** (conversation states) and **edges** (transition conditions), where each node bundles: guidance (prompt fragments + preferred-answer material), a context set, a tool allowlist, an optional model alias, and optional D50 voice-clip set — and each edge carries: source/target node, a typed condition, a priority, and a context purge policy.
2. WHEN a node's guidance is authored THEN it SHALL be grounded framing (talking points, emphasis, negative guidance, links to semantic content) — the system SHALL NOT support canned verbatim reply text as a node output (outline §1b: canned strings make voice models worse).
3. WHEN a graph is edited THEN edits SHALL apply to a **draft**; publishing SHALL create an immutable `ConversationGraphVersion` snapshot and atomically make it the active version. Draft state never serves live traffic.
4. WHEN a conversation starts under the engine THEN it SHALL be stamped with the graph version id it runs under, and that version SHALL remain the interpretation context for replay even after later edits.
5. WHEN a graph is stored THEN nodes and edges SHALL live inside one versioned JSON document per graph version (storage decision — see design §2; resolves the outline §4 rows-vs-JSON question in favor of the simpler design per the registry rule). Node and edge ids SHALL be stable across versions so telemetry and annotations stay joinable.
6. WHEN a graph is validated (on save and before publish) THEN the system SHALL report: missing/multiple start nodes, unreachable nodes, edges with no condition, per-node context-set token-budget overflows, tool names absent from the registry, and model aliases absent from the registry (D4).

## Requirement 2 — Runtime state ownership and evaluation

**User story:** As the owner, I want the engine's state to live server-side in the harness and drive live sessions through non-disruptive control-plane updates, so that one evaluator serves every runtime and the voice connection never restarts on a transition.

1. WHEN a conversation is active THEN the current node id SHALL be owned **server-side**: persisted in the D49 `latestState` snapshot and never authoritative on the client.
2. WHEN a user turn completes (voice transcript persisted via `/api/ai/conversation/log`; text turn handled in `/api/ai/chat`) THEN the engine SHALL evaluate the current node's outgoing edges in priority order and fire at most one transition per turn.
3. WHEN a transition changes only guidance, context, or tools THEN it SHALL reach the live session as a non-disruptive control-plane update (`updateSession` on the adapter for native voice; next-turn prompt assembly for cascade/text) — the provider session SHALL NOT be restarted.
4. WHEN edge conditions are evaluated THEN the supported condition types SHALL include at minimum: intent match (classifier and/or exemplar-embedding similarity), keyword/pattern match, tool-result predicate (e.g. `content_search` topic hit), UI-state event (navigation/F-I-D change, e.g. visitor opened project X), and explicit-pivot detection. Condition evaluation that costs money (classifier calls) SHALL go through the AI gateway (D33) using the `default-cheap` alias.
5. WHEN no edge fires THEN the conversation SHALL remain in its current node; WHEN the conversation leaves prepared territory THEN an explicit **off-graph** default state SHALL apply (baseline instructions, full RAG behavior, default tool set) with re-entry edges evaluated every turn — off-graph is normal operation, never an error (outline: the graph is a lattice, not a cage).
6. WHEN a conversation resumes after a disruption or deliberate provider/model switch (D49) THEN the new leg's briefing SHALL re-enter the graph at the persisted node id — the engine state survives leg boundaries.
7. WHEN the engine is disabled or no graph is active THEN all runtimes SHALL behave exactly as today (static start frame, default tools, model from session config) — the engine is a layer, not a rewrite; removal-safety is a permanent property.

## Requirement 3 — Context orchestration (push-on-entry, purge-on-exit, RAG fallback)

**User story:** As the owner, I want entering a node to proactively inject that node's prepared context and leaving it to purge what no longer applies, so that the realtime model performs above its weight on known paths without having to decide to look things up.

1. WHEN a node is entered THEN its context set SHALL be published into the D55 context buffer under an engine-owned source key, replacing the previous node's engine-injected items (replace-don't-append; NAV_CONTEXT mechanics generalized), and flushed to the model at turn end.
2. WHEN a context set is authored THEN it SHALL support typed items: **entity** (a project/`ContentEntity` → its T1 summary), **chunk** (a specific T2/T3 chunk by id), **search** (a stored query executed against `ContentSearchService` on entry — per-state retrieval augmentation), **static** (owner-authored snippet), and **fid-scope** (narrow F-I-D Details to a project/section).
3. WHEN a node's context set is assembled THEN it SHALL respect a per-node token budget (default aligned with D25 discipline; validation warns on overflow) and SHALL be assembled in the single server-side assembly point (D47(a)) — never client-side.
4. WHEN the conversation-start node is entered THEN its context set SHALL subsume the current static start frame (`start-frame.ts` becomes the default start-node context set — ai-assistant task 5d.3); the pre-engine behavior is the fallback when no graph is active.
5. WHEN the visitor asks something outside any node's prepared context THEN model-initiated `content_search` SHALL remain fully available (subject to the node's tool allowlist, which SHALL NOT remove baseline retrieval tools in off-graph or start states) — prepared context biases, it never walls off RAG.
6. WHEN an edge's purge policy says so THEN traversal SHALL drop the previous node's injected items before the new node's items apply; purge SHALL only ever affect engine-injected buffer keys — F-I-D/UI-state sources and conversation history are never purged by the engine.

## Requirement 4 — Per-node tool scoping

**User story:** As the owner, I want each conversation state to expose exactly the tools that state needs, so that specific capabilities (e.g. job analysis, contact intake) activate only where they make sense.

1. WHEN a node declares a tool allowlist THEN it SHALL be one more filter layered on the existing chain — tier allowlist (gateway) ∩ session tools ∩ node allowlist — enforced server-side in `/api/ai/tools/execute`; the node layer SHALL never *grant* a tool the tier forbids.
2. WHEN the editor offers tools for a node THEN the list SHALL come from live `UnifiedToolRegistry` enumeration with metadata (D47(b)) — including capability-plugin tools registered from outside core libs (D48) — never from a hardcoded list.
3. WHEN a transition changes the tool set on a native voice session THEN the new set SHALL be applied via `updateSession` (tool schema update) without reconnecting; cascade/text apply it at next turn's request assembly.
4. WHEN a node omits an allowlist THEN the session default tool set applies (allowlist is opt-in narrowing/extension within tier bounds, not a mandatory field).

## Requirement 5 — Per-node model selection (voice models)

**User story:** As the owner, I want nodes to run on the model class they warrant — cheap for small talk, reasoning for deep dives — so that cost and capability track conversation state.

1. WHEN a node declares a model alias THEN it SHALL be a D4 registry alias (never a model id); omitting it means "keep the session's current model".
2. WHEN a model-changing transition fires on a **cascade** (D45) or **text** runtime THEN the next turn SHALL run on the new alias — pure data, no session surgery.
3. WHEN a model-changing transition fires on a **native S2S** runtime THEN guidance/context/tool changes SHALL apply immediately via `updateSession`, and the model swap SHALL be deferred to a natural pause, executed as a re-mint riding the D49 resume path (new leg, harness briefing, `session_resumed` marker) — one code path with D49 recovery/switch, not a third mechanism.
4. WHEN a deferred model swap is pending THEN the pending state SHALL be visible in `latestState` and debug telemetry, and a transition back to the original alias before the pause SHALL cancel it.
5. WHEN graphs are authored THEN model-changing edges SHALL be visually flagged in the editor as expensive-on-native (re-mint) so the owner uses them deliberately.

## Requirement 6 — One graph, all runtimes; navigation integration

**User story:** As a visitor on any interface — native voice, cascade voice, or text chat — I want the same guided conversation quality, so that the owner maintains one policy, not three.

1. WHEN a graph is active THEN the same graph and evaluator SHALL serve native voice, cascade voice, and text chat sessions; runtime differences SHALL be confined to the directive application layer (updateSession vs per-turn assembly), never to policy.
2. WHEN edges use UI-state conditions THEN navigation events and F-I-D frame changes (visitor opened project X, scrolled to section Y) SHALL be available to the evaluator as transition evidence on runtimes that have a UI (voice/text on-site); graphs SHALL remain valid on UI-less runtimes (conditions that need a UI simply never fire — D48 optional-composition).
3. WHEN a node's guidance references site locations THEN it SHALL reference semantic-content anchors/`navTarget`s (D59 chunk↔anchor contract) so the model can navigate/highlight per existing `ui_intent` mechanics; the engine SHALL NOT introduce a second navigation path.
4. WHEN a node declares an optional on-enter navigation suggestion THEN it SHALL surface as guidance to the model (which decides, per D59 rules), never as an unconditional forced UI action.

## Requirement 7 — Traversal telemetry and conversation storage

**User story:** As the owner, I want every conversation to record exactly which states it entered, on what evidence, under which graph version, so that reviewing a bad answer shows me the node that produced it.

1. WHEN a transition fires THEN a `node_transition` marker row SHALL be written into the D49 conversation history (via `recordSessionMarker` mechanics): `{fromNode, toNode, edgeId, conditionType, evidence (utterance/intent/tool result ref), graphVersionId, timestamp}` — inline with the transcript, per-message modality rules untouched (markers are system rows, D58).
2. WHEN any turn completes THEN `AIConversation.latestState` SHALL carry the current `nodeId` + `graphVersionId` (+ pending model swap if any), so resume (Req 2.6) and "where is this conversation" reads are one snapshot read.
3. WHEN a session runs in debug/test mode THEN the engine SHALL additionally record edges **evaluated but not taken** (with the reason) — the "why didn't it enter the pricing node?" diagnostic; this verbosity SHALL be sampled or off for ordinary production traffic.
4. WHEN context is flushed or purged by the engine THEN the flush SHALL be visible in conversation history (D55 flush events), so replay shows what the model knew and when.
5. WHEN the `_debug` envelope (D46) is present THEN it SHALL gain an `engine` section: active node, graph version, fired edge (or none), evaluated edges (debug sessions), context items injected this turn, node tool allowlist in effect.

## Requirement 8 — Admin graph editor

**User story:** As the owner, I want a visual node editor in the admin panel, so that I can outline states, wire transition conditions, attach context/tools/models to states, and publish changes safely.

1. WHEN I open `/admin/ai/conversation-graphs` THEN I SHALL see graph list + create/duplicate/archive; opening a graph SHALL show a canvas editor (React Flow or equivalent) with pan/zoom, node/edge creation, drag layout (layout persisted with the draft).
2. WHEN I select a node THEN an inspector SHALL edit: name/description, guidance text blocks, preferred-answer material with links/references into semantic content (entity/chunk pickers with search), the typed context set (Req 3.2) with a live token-budget meter, the tool allowlist (registry-enumerated with descriptions, Req 4.2), the optional model alias (registry aliases only), and optional voice-clip category set (D50).
3. WHEN I select an edge THEN an inspector SHALL edit: condition type + parameters (intent exemplars, patterns, tool predicates, UI-state events), priority, purge policy, and target node — with human-readable condition summaries rendered on the canvas.
4. WHEN I save THEN validation (Req 1.6) SHALL run and annotate offending nodes/edges on the canvas; WHEN I publish THEN a new immutable version SHALL activate atomically with a version note; a version history view SHALL list versions with structural diff summaries and allow re-activating a previous version.
5. WHEN I edit THEN the editor SHALL operate on the draft only; concurrent live conversations continue on the active version untouched.
6. WHEN the editor needs data THEN all reads/writes SHALL go through admin-authenticated APIs; no engine authoring surface is ever public.

## Requirement 9 — Review, annotation, and coverage loop

**User story:** As the owner, I want to review finished conversations against the graph, mark bad moments, and see which nodes real traffic actually hits, so that recorded bad behavior converts into new rules.

1. WHEN I replay a conversation (existing `ConversationReplayViewer` / conversation browser) THEN node transitions SHALL render inline with the transcript, each message attributable to the node active when it was produced, and a "show on graph" action SHALL open the graph (correct version) with the traversal path highlighted.
2. WHEN I mark a turn during review ("bad answer", "missed transition", free note) THEN an annotation SHALL be stored linked to {conversation, message, active node, graph version} and queued in a graph-edit TODO list visible in the editor; resolving an annotation SHALL link it to the graph version that addressed it.
3. WHEN I view coverage THEN the system SHALL show per-node hit rates over a selectable window of real (non-test) traffic: dead nodes (never entered), hot off-graph exits (most frequent last-node-before-off-graph), and edge fire counts — the "where to invest the next node" view.

## Requirement 10 — Golden scenarios and sandboxed self-testing

**User story:** As the owner, I want to walk the flows as a fake client and pin expected traversals as regression tests, so that surgical graph edits don't silently break other paths.

1. WHEN I start a test session (admin-gated, any runtime — including fake-mic voice per D53) THEN it SHALL be tagged `test`: excluded from public analytics, coverage (Req 9.3), and spend alarms, but fully logged with debug-level traversal telemetry (Req 7.3). Test sessions run the production pipeline (D56) — never a parallel engine.
2. WHEN I save a golden scenario THEN it SHALL capture a scripted sequence of user turns + the expected node path (recordable from a finished test session's actual traversal, then edited).
3. WHEN scenarios run (`npm run check:scenarios`) THEN they SHALL execute against fakes (D46 — deterministic, no spend), diff actual vs expected traversal per scenario, and fail with a readable path diff; the editor SHALL offer "run scenarios" against the current draft before publish.
4. WHEN a scenario's expectation is stale after a deliberate graph change THEN the diff output SHALL support one-action re-baselining to the new actual path.

## Requirement 11 — Security and access

**User story:** As the owner, I want the engine to add zero new public attack or leak surface, so that scripting conversations never weakens the existing posture.

1. WHEN engine APIs exist THEN graph CRUD, publishing, annotations, scenarios, and coverage SHALL be admin-authenticated only; the public runtimes receive engine *effects* (assembled context, tool filters) and never graph structure.
2. WHEN a context item references PRIVATE-visibility content THEN it SHALL be excluded at assembly time for public sessions (same service-layer rule as all retrieval); the editor SHALL warn when a node references PRIVATE content.
3. WHEN edge evaluation calls a model (intent classifier) THEN the call SHALL be gateway-wrapped, ledgered, and use `default-cheap`; a graph SHALL NOT be able to trigger unmetered spend.
4. WHEN prompts/guidance are assembled THEN assembly SHALL happen exclusively server-side (D47(e)) and graph **structure** (nodes, edges, conditions, exemplars) SHALL never leave the server. On client-direct native voice, the *assembled* directive necessarily transits the browser as an apply-to-provider payload (same exposure class as existing NAV_CONTEXT/F-I-D injection — analyzed in design-implementation-notes §5/P20); it SHALL never be rendered, persisted, or logged client-side, and no secrecy mechanism (encryption/obfuscation) SHALL be built around it.

## Requirement 12 — Verification (D46)

**User story:** As the implementing agent, I want the engine verifiable end-to-end in-session, so that "done" means exercised, not written.

1. WHEN engine work lands THEN it SHALL ship with: `_debug.engine` envelope coverage (Req 7.5), traversal markers readable via existing conversation log APIs, `check:scenarios` in the deterministic suite, and fake-backed evaluator unit tests (condition types, priority, off-graph, purge).
2. WHEN the phase completes THEN a live-fire drill SHALL run: a real graph on the fixture project, one conversation per runtime (native voice via fake-mic D53, cascade, text), asserting traversal path, context flushes, tool filtering, and — on native — a deferred model swap riding the D49 resume path.
3. WHEN the engine is off THEN the pre-engine test suite SHALL still pass unchanged (Req 2.7 removal-safety is an asserted property, not an intention).
