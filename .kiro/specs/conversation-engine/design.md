# conversation-engine — Design

**Status:** current — **unimplemented** (design for post-roadmap Phase 6; promoted from backlog 2026-07-09)
**Owner domain:** node-graph conversation templating engine (see requirements.md)
**Last verified against code:** 2026-07-09 (seam audit: `updateSession` NOT yet on `IConversationalAgentAdapter`; D55 buffer NOT yet built — both are tasks A2/A3)
**Focused designs:** [design-implementation-notes.md](./design-implementation-notes.md) — module layout, normative runtime sequences, concurrency/idempotency contracts, provider fidelity matrix, potential-issues catalog (P1–P20). **Implementing sessions must read it before writing code.**

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
```

No new conversation-side tables: traversal telemetry rides `AIConversationMessage` marker rows and `AIConversation.latestState` (Req 7), exactly the D49 mechanics already shipped for legs/disruptions. `AIConversation` gains nothing; `latestState` (already `Json?`) adds keys `{ nodeId, graphVersionId, pendingModelSwap? }`. Test tagging reuses the existing session-metadata path (verification spec) — no schema change.

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
  };
  contextSet: ContextItemSpec[]; // Req 3.2
  contextBudgetTokens?: number;
  toolAllowlist?: string[];      // registry names; absent = session default (Req 4.4)
  modelAlias?: string;           // D4 alias; absent = keep current (Req 5.1)
  voiceClipCategories?: string[];// D50 hook
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
  | { type: 'pivot' }            // explicit topic-change detection (classifier-backed)
  | { type: 'always' };          // unconditional (e.g. start → first state)
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
```

Coverage aggregation queries marker rows (`metadata->>'markerType' = 'node_transition'`) grouped by node/edge ids over a time window, excluding `test`-tagged conversations. Traffic volume is portfolio-scale; if it ever hurts, add a rollup table then — not now.

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
