# conversation-engine — Requirements

**Status:** current — **unimplemented** (promoted from `_backlog/conversation-engine.md` on 2026-07-09, owner decision; post-roadmap Phase 6)
**Owner domain:** node-graph conversation templating engine: graph model + versioned storage, runtime evaluator, per-node context/tool/model orchestration, traversal telemetry, admin graph editor, review/annotation loop, golden-scenario testing
**Last verified against code:** 2026-07-09 (spec authored against staging head; nothing implemented yet)
**Registry decisions applied:** D47 (defining), D4, D18 (scoped form-tool exception), D39, D41(b)(d), D45, D46, D48, D49, D50, D55, D56, D58, D59
**Focused designs:** [design-implementation-notes.md](./design-implementation-notes.md) (runtime contracts, pitfalls P1–P35) · [design-ux-and-behavior.md](./design-ux-and-behavior.md) (owner interview 2026-07-09: persona/style policy, scenario behavior specs, UX surfaces, slots, leads, analytics, continuity — source of Reqs 13–18)
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
| `ConversationLead` + notification seam + `/admin/ai/leads` | owner, admin CMS |
| Safety tripwire module (word flags → async investigation → configurable enforcement) + `/admin/ai/safety` | owner; hard enforcement executes via `access-and-cost` |
| `NodeEntryQuestion` analytics + batch jobs (question clustering, conversation summarization) | graph editor, admin transcript view |
| Visitor UX directive surface (chips, topic label, staging) + `job_description_form` client tool | `ai-assistant` pill UI |

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
2. WHEN any turn completes THEN `AIConversation.latestState` SHALL carry the authoritative **`ConversationState` contract** — ONE versioned, Zod-typed snapshot (current node + graph version, pending model swap, slots, visitor profile/flags, agenda progress, summary version, context-set version, last activity) with a `stateVersion` for optimistic concurrency — so resume (Req 2.6), reconnect, provider switch, graph transition, and cross-session resume are all variations of one durable state transition, and the provider session is always a derived cache of this snapshot, never the other way around.
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

## Requirement 13 — Visitor-facing node UX surfaces

**User story:** As a visitor, I want the conversation state to show itself usefully — suggested questions, a screen that follows the topic, a subtle topic label — so that prepared paths are discoverable, not hidden.

1. WHEN a node declares suggested-question chips THEN they SHALL render in/above the pill on node entry and be replaced on transition; a chip tap SHALL send its text as a normal user turn AND carry the `chipId` as evidence, and edges conditioned on that `chipId` SHALL fire deterministically without any classifier involvement (chips are the 100%-reliable rail).
2. WHEN a node declares on-enter staging THEN entering it SHALL execute one staged navigation (open/scroll/highlight) through the existing `UIManager`/`ui_intent`/D59 path — once per entry, never per turn, never a route load during voice, silently skipped on UI-less runtimes.
3. WHEN a node declares a topic label THEN the pill SHALL display it subtly ("Topic: Kiln project"); absent label = hidden indicator.
4. WHEN a node requires structured input (v1: exactly one case — the job-description paste form) THEN it SHALL be a purpose-built client form tool in that node's allowlist, opened via the existing client-tool path, its submission feeding the existing job-analysis pipeline; the generic form-builder stays backlogged (D18).
5. WHEN directives are stripped for the client (Req 11.4) THEN chips, topic label, and staging survive — they are visitor-visible by definition and carry no graph structure.
6. WHEN navigation is driven by conversation THEN the interaction policy is **orient → stage → commit**: an explicit question about content IS commit-level intent (the chosen navigate-while-answering vision stands for topical questions); ambient/on-enter staging is **preview-level** (scroll, highlight — never a context-destroying jump away from what the visitor is reading); low-impact highlights need no consent, big moves outside a question's scope do. The answer leads; movement supports it.
7. WHEN navigation-bearing tools return THEN results SHALL carry a human-readable summary, relevance signal, and source anchors — not a bare `navTarget`; and navigation UX metrics (staging completions vs. cancellations/overrides, repeated clarification turns) SHALL join the coverage view (Req 9.3).

## Requirement 14 — Slot filling and templating

**User story:** As the owner, I want nodes to capture structured facts from the conversation (name, company, work type, timeline) and reuse them downstream, so that later states and lead records are personalized and pre-qualified.

1. WHEN a node declares capture specs THEN a per-turn extractor SHALL fill them from user turns — inside the SAME batched `default-cheap` call that scores edges (one model call per turn, total).
2. WHEN a slot fills THEN its value SHALL be conversation-scoped (readable by all later nodes), persisted in the engine's `latestState` keys, and mirrored as a history event so replay shows when and from what it filled.
3. WHEN guidance fragments or static context items contain `{{slots.name}}` placeholders THEN they SHALL resolve at directive assembly; unresolved placeholders resolve to empty and are noted in the flush event. Slot values are user-provided text entering prompts: they SHALL be delimited, length-capped, and never placed in system-critical instruction sections.
4. WHEN edges condition on slots (`filled` / `missing` / `eq`) THEN slot state SHALL be first-class transition evidence ("job_description captured → offer analysis").

## Requirement 15 — Lead capture and owner notification

**User story:** As the owner, I want qualified conversations to end in a lead record that reaches me, so that a visitor with real business never dead-ends in a chat log I forgot to read.

1. WHEN a capture node's flow completes THEN a `lead_capture` server tool (registry tool, allowlisted only on capture nodes) SHALL write a `ConversationLead` row — slots snapshot, agent fit-note, link to the conversation — with the DB write happening BEFORE any notification attempt; a notification failure never loses the lead.
2. WHEN a lead is created THEN it SHALL be delivered through a pluggable notification seam: the admin surface (leads list + badge at `/admin/ai/leads`, status new/seen/handled, link into replay at the capture turn) always; plus **email as the v1 push channel, dispatched as a tool-shaped action through the seam** (owner decision 2026-07-09: "email IS MCP" — the agentic action language is tool calls, so notify is a tool the harness invokes; further channels later are just more tools behind the same seam).
3. WHEN the agent promises delivery to the visitor THEN the promised timing SHALL be "a couple of days" (guidance content) regardless of actual notification speed — under-promise, over-deliver.
4. WHEN the agent handles identity questions THEN it SHALL never impersonate the owner; the fast-contact path is LinkedIn, the in-conversation path is the message/lead capture above (behavior policy: design-ux-and-behavior §2.6).

## Requirement 16 — Per-node question analytics (data-driven chips, batch-only)

**User story:** As the owner, I want to see what visitors actually asked upon entering each node, so that chips and intent exemplars come from real data instead of intuition — with the storage built to support a dynamic version later.

1. WHEN conversations run THEN the system SHALL do nothing extra in the request path — the first N (default 2) user turns after each `node_transition` are already persisted; sampling is a join, not a write.
2. WHEN the analytics batch runs (admin-triggered AND/OR cron — never during conversations) THEN it SHALL extract those turns into `NodeEntryQuestion` rows keyed by stable node id, embed new rows via `default-embedding` (budget-gated, ledgered), and group near-duplicates (v1: greedy pgvector similarity grouping — the algorithm is deliberately simple and swappable, since iterating on it is the point).
3. WHEN editing a node THEN the inspector SHALL show its question clusters ranked by size with representative phrasings, and one action SHALL promote a real question to a chip (and optionally to an intent-edge exemplar).
4. WHEN suggestions are considered THEN runtime-dynamic suggestion generation SHALL NOT be built in this phase (owner decision) — but the storage schema SHALL not preclude it later.
5. WHEN samples are collected THEN test-tagged conversations SHALL be excluded.

## Requirement 17 — Cross-session continuity and summarization

**User story:** As a returning visitor on my reflink, I want the conversation to pick up where it left off — and as the owner, I want long histories compressed so resumes stay cheap and admin review stays readable.

1. WHEN a visitor returns on the same reflink **from the same device/browser** (client continuity marker present) THEN the pill SHALL resume their latest conversation as if after a brief disruption — the D49 resume path with a returning-visitor trigger. WHEN the same reflink arrives from a NEW device/browser THEN resume SHALL require explicit confirmation with a safe one-line summary ("Continue where you left off — we were discussing the firmware projects — or start fresh?") and never silently expose the prior transcript (forwarded/shared reflink URLs must not leak a previous holder's conversation — Req 21).
2. WHEN the summarization batch runs (daily cron + admin trigger, never in the request path) THEN conversations with new activity SHALL be summarized via the reasoning adapter; the summary is appended to the conversation as a system row AND rendered in the admin transcript view.
3. WHEN a resume happens ≥1 day after last activity THEN the D49 briefing SHALL use latest-summary + last-few-verbatim-turns instead of the full transcript; a same-day resume before the batch ran falls back to the full-transcript briefing.
4. WHEN the agent references remembered context THEN it SHALL do so unceremoniously and honestly ("last time you were looking at the firmware projects") — no reintroduction fanfare, no privacy performance (style policy, design-ux-and-behavior §1/§2.4).

## Requirement 18 — Behavior policy and seed graph

**User story:** As the owner, I want the agent's character and boundaries — terse answering rhythm, register mirroring, the not-a-yes-man nudge, prober deflection, hard honesty about data gaps, no impersonation — expressed as authored graph content backed by engine mechanics, so that the behavior I described survives as testable policy rather than tribal knowledge.

1. WHEN the seed graph is authored THEN it SHALL implement the scenario behavior specs of design-ux-and-behavior §2 (vague browser escalation, prober handling with 1–2-turn humor then redirect, flat refusal of political/religious topics, skeptic honesty + no-weaknesses-indulgence + interview CTA, JD intake form-first, identity/no-impersonation, AI-self showcase from `/about/ai` content, qualify-then-capture, show-while-telling start, navigate-while-answering deep-dives) — each as node guidance/edges, never as hardcoded strings in core libs (D48).
2. WHEN low-effort turns repeat THEN a `turn_quality` condition (consecutive-counter in engine state, heuristic + the batched cheap call) SHALL enable the escalation edges; WHEN probe patterns occur THEN a `probe` condition (pattern + classifier v1; a D41(b)-style watchdog is the designated later upgrade, publishing into the same evidence stream) SHALL enable the prober-handling node.
3. WHEN the seed graph ships THEN every §2 vignette SHALL exist as a golden scenario (Req 10) and pass before the graph serves real traffic.
4. WHEN base instructions are assembled THEN the global style policy (terse rhythm, register mirroring, third-person-about-owner, refusal topics) SHALL live in admin-editable configuration/start-node guidance — content, not code.

## Requirement 19 — Conversation memory and visitor profile (the floating context block)

**User story:** As the owner, I want the harness to maintain a living memory of the conversation — who the visitor seems to be, how they behave, what's been covered, what the agent is working toward — floating at the top of the model's attention every turn, so the model makes multi-dimensional decisions the way I use my own memory files.

1. WHEN passive context is delivered THEN ALL of it (F-I-D state, engine node context, visitor profile, agenda) SHALL form ONE floating block positioned at the conversation **tail**, removed and re-appended every turn even when its content is unchanged — so it never drifts back into history, and cache invalidation is confined to the tail instead of slicing the cached prefix (the cost is paying for the block twice per turn; the win is the long prefix stays cached). Per-provider fidelity is explicit and documented (notes §4/P27): full remove+re-append on OpenAI Realtime (item deletes) and cascade/text (prompt assembly); on Gemini Live — whose stream is append-only, so nothing we created can be deleted, our own block included — the invariant degrades to **versioned supersession**: send only on change, labeled as superseding all previous context blocks, with native sliding-window compression eventually evicting stale copies.
2. WHEN the visitor converses THEN the engine SHALL maintain **profile flags** — register (technical/layman), intent (hiring / browsing / specific role / general inquiry), behavior (cooperative / probing / rude), topics discussed, conversation duration — as engine-owned state: fast flags filled by the existing per-turn batched cheap call; the richer behavioral assessment by the periodic summarizer (19.3). Flags unify with slots (Req 14): same storage, same templating, same edge-condition support — slots are *stated* facts, flags are *inferred* ones.
3. WHEN the behavior summarizer runs THEN it SHALL be a separate cheap-LLM job over **user turns only**, producing a structured response (intent, register, mood, topics), at most once per interval (default 60s), triggered by staleness checks at turn boundaries (serverless has no resident process), fully async — it never blocks or delays a turn — and gateway-metered.
4. WHEN the profile updates THEN it is a **current assessment, not an event log**: each summarization replaces the previous wholesale, so stale judgments decay naturally (rude five minutes ago, fine now → the profile says fine now).
5. WHEN flags reach the model THEN they SHALL be transparent — plain readable text in the floating block, phrased as observations ("the visitor appears technical; interested in hiring for a firmware role"), never hidden steering the model would have to conceal or contradict.
6. WHEN a node declares an **agenda** (e.g. tour-guide goals, Claude-Code-style) THEN it SHALL render into the floating block on entry and persist across turns within the node so the model works through it; nodes without an agenda add nothing. Composition principle (binding): **nodes decide WHAT the agent is doing (mode, task, tools, agenda); flags shade HOW (register, depth, suggestions)** — audience traits are never encoded as graph nodes.

## Requirement 20 — Context lifecycle: rolling window without a hiccup

**User story:** As the owner, I want long conversations pruned live — recent turns verbatim, older material collapsed into a summary — without re-minting the session (no silence, no fresh-model feel), so that a 15-minute conversation doesn't carry 15 minutes of tokens against TPM limits and cost.

1. WHEN a conversation exceeds the rolling window (default: ~5 minutes or N turns of verbatim history, configurable) THEN older verbatim turns SHALL collapse into a running conversation summary; the model's working context is: stable prefix (instructions + running summary) + recent verbatim window + the floating block (Req 19.1).
2. WHEN pruning applies to a **native voice** session THEN it SHALL use in-session provider mechanisms — OpenAI Realtime item deletion + an inserted summary item; Gemini Live's native context-window compression plus an injected summary text — and SHALL NEVER re-mint the session for pruning (the observed janky pattern: re-mint = seconds of silence). Re-mint stays reserved for model swaps (Req 5.3) and recovery (D49).
3. WHEN pruning applies to **cascade/text** THEN the window is applied at prompt assembly with cache-stable ordering: stable prefix first, volatile material (recent turns + floating block) last — this path is where prompt-caching economics bite hardest and the ordering rule pays directly.
4. WHEN a graph transition fires THEN perceived continuity SHALL be preserved: the model feels like the same person you've been talking to for the last five minutes — different motives, modes, and tasks per state; memory and rapport never reset.
5. WHEN the running summary is produced THEN it SHALL be persisted and SHALL be the SAME summary artifact used by cross-session briefings (Req 17.3) and the daily batch (Req 17.2 becomes consolidation/backfill for conversations that ended without one) — one summary pipeline, two triggers, never two competing summaries.

## Requirement 21 — Privacy, consent, and data lifecycle

**User story:** As the owner, I want the assistant to feel trustworthy rather than surveillant — resume, memory, and lead capture must respect the visitor and give both of us control over stored data.

1. WHEN resume is offered cross-device THEN Req 17.1's confirmation rule applies (safe summary, explicit choice); a "start fresh" option SHALL always exist alongside resume.
2. WHEN a visitor asks to be forgotten (or uses a "forget this conversation" affordance) THEN visitor content (transcript, summaries, profile, slots) SHALL be deletable while anonymized operational telemetry (ledger rows, node hit counts) is retained; the admin UI SHALL distinguish operational telemetry from visitor content.
3. WHEN a lead is captured THEN consent SHALL be conversational and explicit ("I'll pass this along to Kirill with your contact — that okay?") before the record is created; leads carry a retention period and a deletion path.
4. WHEN retention is configured THEN defaults SHALL exist (owner-adjustable): raw transcripts retained N days, summaries longer, leads until handled + M days; expiry runs in the existing batch jobs (never the request path).
5. WHEN a reflink is revoked THEN its resume capability dies with it.

## Requirement 22 — Safety tripwire: static word flags → async investigation → configurable enforcement

**User story:** As the owner, I want cheap always-on tripwires over conversation transcripts that escalate to an LLM investigation only when triggered, with enforcement I configure — so abuse is caught without per-turn LLM cost, without blocking conversations, and without hardcoding policy.

1. WHEN transcripts flow through the conversation logging pipeline (voice `/log`, text `/chat` — the telemetry is already there) THEN a **static, non-LLM word-flag scan** (normalized string matching against admin-configured word lists) SHALL run at persist time; it SHALL be cheap enough to run synchronously and SHALL NEVER block or fail the log write — the log is marked successful and the conversation continues regardless.
2. WHEN a word flags THEN an **investigation agent** SHALL launch asynchronously (reasoning adapter, gateway-metered, in-flight-deduplicated per conversation): it analyzes the full conversation and produces a structured verdict — benign / concern severity / recommended action + rationale — persisted and visible in admin (linked from the conversation).
3. WHEN a verdict recommends action THEN the action SHALL come from an admin-configured rule set mapping severity → action: log-only · notify owner (the Req 15 notification seam) · publish evidence into the engine's evidence stream (so graph safety edges/nodes can fire — the owner's observation that this fits the node system) · terminate session · ban reflink. Hard enforcement (terminate/ban) executes through `access-and-cost` surfaces (session validation, reflink revocation) — one owner per concept; the engine only consumes the evidence.
4. WHEN the module is disabled THEN the system SHALL function identically without it (modular, D48 optional composition); configuration (word lists, investigation policy, severity→action map, on/off) lives on an admin page, never in code.
5. WHEN hard enforcement fires on a client-direct voice session THEN the mechanics SHALL be honest: the server revokes what it actually controls (tool execution, log acceptance, session/token validation, mint) and sends a disconnect directive; client compliance is not assumed — server-side denial is the real teeth.
