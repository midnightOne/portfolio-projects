# conversation-engine — Design

**Status:** current — **unimplemented** (design for post-roadmap Phase 6; promoted from backlog 2026-07-09)
**Owner domain:** node-graph conversation templating engine (see requirements.md)
**Last verified against code:** 2026-07-09 (Block A landed: `updateSession` on `IConversationalAgentAdapter` + adapters, D55 buffer at `src/lib/ai/context-buffer.ts`, `/log` uiEvidence/engineDirective envelope — the §5 seam table's "state today" column is superseded by conversation-engine/tasks.md Block A evidence notes)
**Focused designs:** [design-implementation-notes.md](./design-implementation-notes.md) — module layout, normative runtime sequences, concurrency/idempotency contracts, provider fidelity matrix, potential-issues catalog (P1–P35). **Implementing sessions must read it before writing code.** · [design-ux-and-behavior.md](./design-ux-and-behavior.md) — owner-interview-sourced visitor UX (chips/staging/topic label), persona & behavior policy, slot filling, lead capture + notification, question analytics, cross-session continuity, seed node catalog (source of Reqs 13–18).

---

## 1. Where the engine sits

The engine is a **policy layer over the existing runtime**, hooked in at exactly the two places conversational policy already lives (D47(a)/(e)): session mint and turn processing. It never talks to providers, tools, or the DB on its own paths — it *decides*, existing seams *apply*.

```
                        ┌───────────────────────────────────────────────┐
                        │ ConversationEngine (src/lib/ai/engine/)       │
                        │  graph loader (active version, cached)        │
                        │  evaluator: (node, turn evidence) → edge?     │
                        │  directive builder: node → {guidance, context │
                        │    set, tool filter, model alias}             │
                        └───────┬───────────────────────────┬───────────┘
              session start     │                           │ per-turn
┌───────────────────────────────▼───┐      ┌────────────────▼────────────────────┐
│ mint routes /api/ai/{openai,      │      │ /api/ai/conversation/log (voice)    │
│ google}/session, cascade, /chat   │      │ /api/ai/chat (text/cascade brain)   │
│  → start-node directive feeds     │      │  → evaluate after user turn persist │
│    context-provider assembly      │      │  → transition: markers + latestState│
└───────────────────────────────────┘      │  → publish context to D55 buffer    │
                                           │  → return engineDirective in the    │
                                           │    response body                    │
                                           └────────────────┬────────────────────┘
                                                            │ (voice only)
                                           ┌────────────────▼────────────────────┐
                                           │ client: BaseConversationalAgent-    │
                                           │ Adapter applies directive via       │
                                           │ updateSession() — instructions,     │
                                           │ context items, tool schema          │
                                           └─────────────────────────────────────┘
```

**The directive return path** is the one genuinely new plumbing decision. Voice is client-direct (the server never holds the provider socket), so the engine's decision must travel back to the browser: the `/api/ai/conversation/log` POST response — which every adapter already awaits per persisted turn — gains an optional `engineDirective` payload; the base adapter applies it through the new `updateSession()` method. This keeps state ownership server-side (the directive is derived, disposable, re-issuable from `latestState`) while the standing WebRTC/WS connection applies it non-disruptively. Directives are **full snapshots** (assembled base + node state, never deltas) carrying a monotonic `seq`; the adapter applies latest-wins at turn boundaries only (notes P4/P8/P19). Cascade and text need no client hop — and do not consume the response field at all: their next turn re-derives everything server-side from `latestState.nodeId` — the same directive object, two application layers (Req 6.1). Security consequence of the client hop (assembled guidance transits the browser, graph structure never does) is analyzed in notes §5 and accepted in Req 11.4.

**Race contract (inherited from D55, accepted):** turn-end evaluation means the model answers turn N under node state decided at turn N−1. Predictive pushes (state entry loads context *before* the follow-up question) make this acceptable; do not make evaluation synchronous/inline with response generation.

## 2. Data model (Prisma sketch — signatures only)

Storage decision (resolves outline §4 "rows vs JSON"): **one immutable JSON document per graph version.** Rationale: the editor loads/saves whole graphs atomically; versioning is a snapshot, not a migration; the evaluator reads one document per conversation; a single admin author needs no row-level concurrency. Rows would buy partial queries and concurrent editing — neither is needed; coverage analytics join traversal markers to node ids *inside* the document. Simpler design wins (registry rule).

```prisma
model ConversationGraph {
  id              String   @id @default(cuid())
  name            String
  description     String?
  status          String   // 'draft' | 'active' | 'archived'
  draftDocument   Json     // working copy (nodes, edges, layout)
  activeVersionId String?  // FK → ConversationGraphVersion
  // timestamps
}

model ConversationGraphVersion {
  id        String @id @default(cuid())
  graphId   String
  version   Int      // monotonic per graph
  document  Json     // immutable snapshot: { nodes: GraphNode[], edges: GraphEdge[], layout }
  note      String?
  createdAt DateTime
}

model GraphAnnotation {
  id             String  @id @default(cuid())
  conversationId String  // AIConversation
  messageId      String? // AIConversationMessage the mark anchors to
  nodeId         String  // node active at that turn
  graphVersionId String
  kind           String  // 'bad_answer' | 'missed_transition' | 'note'
  note           String?
  status         String  // 'open' | 'resolved'
  resolvedByVersionId String?
}

model GraphScenario {
  id            String @id @default(cuid())
  graphId       String
  name          String
  turns         Json   // scripted user turns (+ optional simulated UI events / tool stubs)
  expectedPath  Json   // ordered node ids (+ optional expected edge ids)
  // timestamps
}

model ConversationLead {           // Req 15 — DB row FIRST, notification after (P25)
  id             String @id @default(cuid())
  conversationId String
  nodeId         String?
  graphVersionId String?
  slots          Json    // captured slot snapshot {type, timeline, company, contact, ...}
  fitNote        String? // agent's summary/fit note
  status         String  // 'new' | 'seen' | 'handled'
  notifiedAt     DateTime?
  notifyChannel  String?
  createdAt      DateTime
}

model NodeEntryQuestion {          // Req 16 — written ONLY by the analytics batch, never at runtime (P23)
  id             String @id @default(cuid())
  nodeId         String  // stable across versions (Req 1.5)
  graphId        String
  graphVersionId String
  conversationId String
  messageId      String @unique   // idempotent re-runs
  text           String
  embedding      Unsupported("vector")?  // default-embedding; model id recorded on the batch run
  clusterId      String?
  processedAt    DateTime?
}
```

Conversation-side: traversal telemetry rides `AIConversationMessage` marker rows and `AIConversation.latestState` (Req 7), exactly the D49 mechanics already shipped for legs/disruptions. `latestState` (already `Json?`) is formalized as the **`ConversationState` contract** (Req 7.2) — one Zod-typed, versioned snapshot; the engine's keys within it (merge-written, P18):

```typescript
interface ConversationState {          // authoritative; provider sessions are derived caches
  stateVersion: number;                // optimistic concurrency (generalizes the CAS, P3)
  engine?: {
    nodeId: string; graphVersionId: string;
    lastEvaluatedTurnId: string | null;
    pendingModelSwap?: { alias: string; requestedAt: string };
    slots?: Record<string, string>;    // stated facts (Req 14)
    flags?: {                          // inferred profile (Req 19.2) — same templating/conditions as slots
      register?: 'technical' | 'layman';
      intent?: 'hiring' | 'browsing' | 'specific_role' | 'general';
      behavior?: 'cooperative' | 'probing' | 'rude';
      topics?: string[]; startedAt?: string;
    };
    agendaProgress?: string[];         // Req 19.6
    consecutiveLowEffort?: number;
    summaryVersion?: number;           // running-summary pointer (Req 20.5)
    contextSetVersion?: number;        // last flushed engine context (buffer coherence)
  };
  // legs/mode keys owned by ai-assistant code remain siblings, untouched
}
```

Conversation summaries (Req 17/20.5) are system rows (`markerType: 'conversation_summary'`), not a new table — the in-session running summary and the cross-session briefing summary are the SAME artifact, one pipeline with two triggers (in-session staleness; post-hoc batch backfill). Test tagging reuses the existing session-metadata path (verification spec) — no schema change.

### 2b. Context lifecycle (Reqs 19/20 — mechanics summary; contracts in notes P27–P30)

The D55 buffer gains a binding delivery rule: everything passive (F-I-D, engine context set, profile flags, agenda) merges into ONE **floating block** that is removed and re-appended at the conversation tail every turn — even unchanged — so the cached prefix never invalidates and passive state never drifts into history. Sources publish under their keys as designed; the *injector* owns the block position. Long conversations get a **rolling window**: old verbatim turns collapse into the running summary in-session (OpenAI: item deletes + summary item; Gemini: native context compression + summary text; cascade/text: assembly-time) — never a re-mint, so transitions and pruning are inaudible and the model keeps feeling like the same person (Req 20.4). The **behavior summarizer** (Req 19.3) is the D41(b) watchdog landing in its D55-predicted niche: a supervision source publishing into the same buffer — staleness-triggered at turn boundaries, async, metered, current-assessment-only.

## 3. Graph document schema (TypeScript, owned by `src/lib/ai/engine/types.ts`)

```typescript
interface GraphNode {
  id: string;                    // stable across versions (Req 1.5)
  name: string;
  role: 'start' | 'state' | 'offgraph';   // exactly one start, exactly one offgraph
  guidance: {                    // Req 1.2 — framing, never canned text
    promptFragments: string[];   // appended to base instructions
    talkingPoints?: string[];
    negative?: string[];         // "never claim X"
    navRefs?: { label: string; navTarget: string }[];  // D59 anchors (Req 6.3)
    onEnterSuggestion?: string;  // optional nav/topic suggestion, model-mediated (Req 6.4)
    agenda?: string[];           // Req 19.6 — node's working goals, rendered into the floating block
  };
  contextSet: ContextItemSpec[]; // Req 3.2
  contextBudgetTokens?: number;
  toolAllowlist?: string[];      // registry names; absent = session default (Req 4.4)
  modelAlias?: string;           // D4 alias; absent = keep current (Req 5.1)
  voiceClipCategories?: string[];// D50 hook
  ux?: {                         // Req 13 — visitor-visible surfaces (ride the directive)
    chips?: { id: string; label: string; sendText?: string }[]; // tap = deterministic edge (P22)
    topicLabel?: string;         // pill indicator
    onEnterStaging?: { navTarget: string; highlightText?: string }; // once per entry, ui_intent path
  };
  slots?: {                      // Req 14 — capture specs; values are conversation-scoped
    capture: { name: string; type: 'string'|'enum'|'email'|'company'|'freeform'; hint: string; required?: boolean }[];
  };
}

type ContextItemSpec =
  | { type: 'entity'; entityId: string }              // → T1 summary
  | { type: 'chunk'; chunkId: string }                // specific T2/T3
  | { type: 'search'; query: string; limit?: number } // run at entry (per-state RAG)
  | { type: 'static'; text: string }
  | { type: 'fid-scope'; projectId: string; sectionAnchor?: string };

interface GraphEdge {
  id: string;
  from: string; to: string;
  priority: number;              // evaluation order; first match fires (Req 2.2)
  condition: EdgeCondition;
  purge: 'replace' | 'keep';     // engine-key purge policy (Req 3.6)
}

type EdgeCondition =
  | { type: 'intent'; exemplars: string[]; threshold?: number }  // embedding sim and/or default-cheap classifier
  | { type: 'pattern'; anyOf: string[] }                         // keyword/regex on user turn
  | { type: 'tool_result'; tool: string; predicate: { path: string; op: 'contains'|'eq'|'exists'; value?: unknown } }
  | { type: 'ui_state'; event: 'project_opened'|'section_viewed'|'route_changed'; match?: string }
  | { type: 'chip'; chipId: string }                             // deterministic: chip tap evidence, no classifier (P22)
  | { type: 'slot'; name: string; op: 'filled'|'missing'|'eq'; value?: string }  // Req 14.4
  | { type: 'turn_quality'; consecutiveLowEffort: number }       // vague-browser escalation (Req 18.2)
  | { type: 'probe' }            // injection/off-topic probing (pattern + classifier v1; D41(b) watchdog later)
  | { type: 'pivot' }            // explicit topic-change detection (classifier-backed)
  | { type: 'always' };          // unconditional (start-chain only, resolved at startPolicy)
```

Condition evaluation ladder (cheap-first): `pattern`/`ui_state`/`tool_result` are free and evaluated first; `intent` prefers exemplar-embedding similarity (embeddings are cached per graph version at publish — one-time cost) and falls back to / is confirmable by a `default-cheap` classifier call (gateway-wrapped, Req 11.3); `pivot` is classifier-only. Per-turn classifier calls are batched into **one** call that scores all candidate intent/pivot edges of the current node simultaneously.

## 4. Runtime evaluator

`ConversationEngine.processTurn(conversationId, evidence) → { transition?, directive? }`:

1. Load `{ nodeId, graphVersionId }` from `latestState` (null → engine inactive for this conversation → return nothing).
2. Gather evidence: latest user turn text, tool events this turn (already in the log payload), UI-state events (client includes F-I-D/navigation deltas in the log payload — small addition to the existing `/log` contract).
3. Evaluate current node's outgoing edges by priority; also evaluate the off-graph node's re-entry edges when currently off-graph. At most one fires.
4. On fire: write `node_transition` marker; update `latestState`; publish new node's context set into the D55 buffer (source key `engine`, replace semantics; `purge:'keep'` merges instead); build directive `{ instructions, toolAllowlist, modelAlias? }`.
5. Model alias handling per runtime (Req 5): cascade/text → directive carries alias, next turn uses it; native → alias becomes `latestState.pendingModelSwap`, directive carries everything else; the client schedules re-mint at the next natural pause (VAD silence / turn boundary) through the **existing** `resumeOnProvider` path (D49) — the resume briefing already restores history and now also restores node state (Req 2.6).
6. Debug/test sessions: record `edge_evaluated` events (evaluated-but-not-taken with reasons) as sampled marker rows (Req 7.3).

Session start: `ConversationEngine.startPolicy(runtime, sessionCtx)` returns the start node's directive; mint routes and `/api/ai/chat` feed it into `context-provider`/`start-frame` assembly — when no graph is active, `start-frame.ts` behaves exactly as today (Req 2.7). The static start frame literally becomes the default start node's `contextSet` seed when a graph is first created (ai-assistant task 5d.3 closes here).

## 5. Prerequisite seams built by this spec (in `ai-assistant`'s domain, coordinated tasks)

| Seam | State today (verified 2026-07-09) | Work |
|---|---|---|
| `updateSession()` on `IConversationalAgentAdapter` | **absent** — OpenAI adapter references `session.update` in comments only | Task A2: add to interface + base class; implement OpenAI (`session.update`), Google (`BidiGenerateContentConstrained` session reconfig or documented re-mint fallback), cascade (trivial: next-turn assembly); document per-adapter fidelity |
| D55 context buffer | **absent** — no buffer module exists; NAV_CONTEXT replace mechanics live inline in F-I-D path | Task A3: per-conversation keyed buffer (last-write-wins per source key, TTL, budgeted merge, turn-end flush, flush = D49 history event). Engine is a publisher; F-I-D migrates to publish into it too (its own ai-assistant task) |
| `/log` response envelope | returns `metadata.conversationId` | Task A4: add optional `engineDirective`; base adapter applies it |
| UI-state evidence in `/log` payload | not sent | Task A4: client includes navigation/F-I-D deltas per logged turn (small, additive) |

## 6. Admin editor UI

Route: `/admin/ai/conversation-graphs` (list) and `/admin/ai/conversation-graphs/[graphId]` (editor). Canvas: **React Flow (`@xyflow/react`)** — custom node component (name, role badge, context/tool/model chips, validation badge), custom edge (condition summary label, priority, purge marker). Right-hand inspector panel per selection (Req 8.2/8.3): guidance blocks, context-set builder with entity/chunk search pickers (reuses semantic admin search APIs) and live token meter, registry-enumerated tool picker, alias dropdown (from `/api/admin/ai/model-config` aliases), voice-clip categories. Toolbar: validate, run scenarios (draft), publish (version note dialog), version history (structural diff: nodes/edges added/removed/changed), annotations TODO drawer (Req 9.2), coverage overlay toggle (hit-rate heat on nodes, Req 9.3).

Traversal replay overlay (Req 9.1): conversation browser popup gains node-path chips per message + "show on graph" → editor opens read-only pinned to that `graphVersionId` with the path highlighted step-through.

Admin APIs (all admin-auth, thin over Prisma + validation):

```
GET/POST            /api/admin/ai/graphs                 // list, create
GET/PUT/DELETE      /api/admin/ai/graphs/[id]            // draft read/save, archive
POST                /api/admin/ai/graphs/[id]/publish    // validate → snapshot version → activate
GET                 /api/admin/ai/graphs/[id]/versions   // history (+ ?diff=v1,v2)
POST                /api/admin/ai/graphs/[id]/scenarios/run   // draft or version, against fakes
GET/POST/PATCH      /api/admin/ai/graph-annotations      // review loop
GET                 /api/admin/ai/graphs/[id]/coverage   // aggregates over traversal markers
GET                 /api/admin/ai/graphs/[id]/questions  // NodeEntryQuestion clusters per node (Req 16.3)
POST                /api/admin/ai/engine/batch/questions // trigger analytics batch (also cron)
POST                /api/admin/ai/engine/batch/summaries // trigger summarization batch (also cron)
GET/PATCH           /api/admin/ai/leads                  // leads list + status transitions (Req 15.2)
```

Coverage aggregation queries marker rows (`metadata->>'markerType' = 'node_transition'`) grouped by node/edge ids over a time window, excluding `test`-tagged conversations. Traffic volume is portfolio-scale; if it ever hurts, add a rollup table then — not now.

## 6b. Safety tripwire module (Req 22)

`src/lib/ai/safety/` (core, optional per D48): `scan(text, wordLists) → flags[]` (normalized static matching — no LLM, no network) called inside the persist path of `/log` and `/chat`; on flag, fire-and-forget `investigate(conversationId)` (reasoning adapter, gateway-metered, per-conversation in-flight guard) → `SafetyInvestigation` row `{ conversationId, triggeredBy, verdict: 'benign'|severity, recommendedAction, rationale, actedOn? }` → severity→action executor reads the admin rule set: log-only / owner notification (Req 15 seam) / evidence publication (engine safety edges) / session termination + reflink ban (executed through `access-and-cost` surfaces — the module never revokes anything itself). Config: `SafetyConfig` singleton row (enabled, word lists by category, investigation policy text, severity→action map) edited at `/admin/ai/safety` (route: `GET/PUT /api/admin/ai/safety`, `GET /api/admin/ai/safety/investigations`). Disabled = scan short-circuits; nothing else changes. Enforcement honesty for client-direct voice: notes P35.

## 7. Modularity (D48 — binding)

`src/lib/ai/engine/` is agent-core territory: no imports from `src/app/**` or portfolio components; no hardcoded prompts/content (all guidance comes from the graph document; base instructions from existing config paths); the engine consumes tools via registry enumeration only. Litmus holds: the phone agent (cascade + engine + rag-core) uses this module unchanged — UI-state conditions simply never fire (Req 6.2). The editor UI, admin APIs, and Prisma models are host-layer and may not be imported by the engine core (the core receives loaded graph documents, not Prisma handles — a `GraphSource` interface with the Prisma-backed implementation registered from outside).

## 8. Verification design (D46)

- **Deterministic:** evaluator unit tests per condition type/priority/purge; `check:scenarios` runs `GraphScenario`s through the real engine + `FakeReasoningAdapter` + fake embeddings (intent conditions get deterministic vectors), diffing traversal paths. Runs in `npm run verify`.
- **In-session e2e:** fixture graph over the fixture project; drive text chat and fake-mic voice (D53); assert `_debug.engine`, marker rows via `/api/ai/conversation/log` GET, tool-filter enforcement via a node that narrows tools, context flush events.
- **Live-fire (phase completion):** one real conversation per runtime on the fixture graph incl. a native-session deferred model swap through the D49 re-mint (capped spend, pennies).
- **Removal safety:** full pre-engine suite green with no graph active (Req 2.7 / 12.3).

## 9. External dependencies (per spec-management format)

### Required APIs/modules
```typescript
interface RequiredExternal {
  "context-provider.ts / start-frame.ts": { provider: "ai-assistant"; purpose: "single assembly point the engine feeds (D47(a))" };
  "IConversationalAgentAdapter.updateSession": { provider: "ai-assistant"; purpose: "non-disruptive control-plane application (D47(d)); added by task A2" };
  "D55 context buffer": { provider: "ai-assistant"; purpose: "engine publishes node context sets; added by task A3" };
  "UnifiedToolRegistry.enumerate + /api/ai/tools/execute allowlists": { provider: "ai-assistant"; purpose: "node tool scoping (D47(b))" };
  "conversationHistoryManager: recordSessionMarker / updateLatestState / getResumeBriefing": { provider: "ai-assistant"; purpose: "traversal telemetry + resume (D49)" };
  "resolveModel(alias)": { provider: "ai-admin"; purpose: "per-node model aliases (D4)" };
  "ContentSearchService / ContentEntity / chunk reads": { provider: "semantic-content"; purpose: "context-set assembly, entry-time search items" };
  "withAIGateway": { provider: "access-and-cost"; purpose: "metered classifier calls (D33)" };
  "fakes + fixture + test tagging": { provider: "verification"; purpose: "scenario runner, e2e drills (D46)" };
}
```

### Provided (consumers)
```typescript
interface ProvidedByEngine {
  ConversationEngine: { consumers: ["ai-assistant mint routes", "/api/ai/conversation/log", "/api/ai/chat"]; location: "src/lib/ai/engine/" };
  "admin graph APIs + editor": { consumers: ["admin CMS"]; };
  "node_transition marker semantics + latestState.nodeId": { consumers: ["admin replay/browser", "verification"] };
  "check:scenarios": { consumers: ["verification", "npm run verify"] };
}
```
