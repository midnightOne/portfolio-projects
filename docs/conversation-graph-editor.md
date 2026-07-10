# Conversation Graph Editor

**Where:** `/admin/ai/conversation-graphs` (admin login required)

The graph editor lets you script *prepared conversational paths* for the portfolio's AI assistant without touching code. You describe conversation **states** (nodes) and the **conditions** that move a visitor between them (edges); the engine then steers every runtime — native voice (OpenAI Realtime, Gemini Live), cascade voice, and text chat — from the same graph.

A graph is a lattice, not a cage: when no edge matches, the conversation simply stays where it is or runs "off-graph" with full default behavior (RAG search, default tools). The engine biases the model toward your prepared material; it never walls off anything.

---

## Quick start

1. Open **AI Assistant → Conversation Graphs** in the admin sidebar.
2. **Create** a graph. It is seeded with the two required nodes:
   - a **start** node, pre-loaded with a snapshot of the current portfolio start frame as its first context item,
   - an **offgraph** node (the explicit "outside prepared territory" state — required, and normal operation).
3. Click a node to edit it in the right-hand inspector. Drag between node handles — or select a node and press **+ Edge** — to add a transition.
4. Watch the toolbar: your draft **autosaves** about a second after every change, and validation runs on each save (error/warning counts appear next to the graph name; offending nodes and edges get badges on the canvas).
5. When the graph is ready, hit **Publish**. Publishing creates an immutable version and makes it live **for new conversations** — live conversations always finish on the version they started under.

Only one graph is active at a time. Publishing (or re-activating a version of) one graph automatically demotes any other active graph to draft status.

---

## Concepts

### Nodes — what the agent is doing

A node bundles everything that defines one conversation state:

| Field | What it does |
|---|---|
| **Role** | `start` (entry state, exactly one), `state` (ordinary), `offgraph` (the fallback state, exactly one). |
| **Guidance** | Prompt fragments appended to the base instructions, talking points, negative guidance ("never claim X"), an agenda (working goals the model visibly works through), navigation references, an optional on-enter suggestion. Guidance is *framing* — the editor deliberately has no field for canned verbatim replies; scripted lines make voice models worse. |
| **Context set** | Typed items injected when the node is entered (see below). |
| **Tool allowlist** | Optional narrowing of which tools the model may call in this state. Enumerated live from the tool registry. Empty = session default. A node can only *narrow* within the session's tier — it can never grant a tool the tier forbids, and enforcement is server-side. |
| **Model alias** | Optional model role for this state (`default-cheap`, `default-reasoning`, …). Applies **per turn on cascade/text**; on native voice it participates **at session mint only** and is ignored mid-session — the editor labels model-changing edges accordingly. |
| **Voice-clip categories** | Which filler/transition clip categories are active in this state. |
| **Visitor UX** | Chips, topic label, on-enter staging (see "Visitor-facing surfaces"). |
| **Slot capture specs** | Structured facts to extract from user turns (name, company, timeline…), usable downstream. |

### Context sets — push, don't wait for lookups

Entering a node proactively injects its context so the model doesn't have to decide to search. Item types:

- **entity** — a project or content entity → its summary (picker lists all entities).
- **chunk** — a specific content chunk by id.
- **search** — a stored query executed against the semantic index *at node entry* (per-state retrieval).
- **static** — an owner-authored snippet, verbatim. Supports `{{slots.name}}` templating.
- **fid-scope** — narrows the on-screen context focus to a project/section (~zero tokens).

Each node has a token budget (default 1200). The inspector's live meter shows the static-item estimate against it; at runtime, items resolve in your authored order and **whole items drop** once the budget is exceeded — never a truncated half-item. Drops are recorded and visible in debug telemetry.

Content visibility is enforced at runtime: PRIVATE entities/chunks are excluded for public sessions no matter what the graph references. The editor warns you (yellow, non-blocking) when a node references PRIVATE or since-deleted content.

### Edges — when to move

Each edge carries a condition, a priority (ascending — lowest evaluated first, at most **one** edge fires per turn), and a purge policy (`replace` = drop the previous node's injected context on transition, `keep` = merge).

Condition types:

| Type | Fires when | Cost |
|---|---|---|
| `chip` | The visitor taps a specific suggestion chip. Matches the chip's stable **id**, never its label — this is the 100%-deterministic rail onto prepared paths. | free |
| `pattern` | The user turn matches a keyword/regex. | free |
| `ui_state` | A UI event occurred (project opened, section viewed, route changed). Never fires on UI-less runtimes. | free |
| `tool_result` | A tool result this turn satisfies a predicate (exists / contains / equals at a path). | free |
| `slot` | A captured slot is filled / missing / equals a value ("job description captured → offer analysis"). | free |
| `intent` | The turn is semantically similar to your exemplar phrases. Exemplars are embedded **at publish** with the embedding model recorded, so matching stays consistent even if the default embedding model later changes. A cheap classifier acts as tiebreaker in the ambiguous band. | embeddings at publish; occasional cheap classifier |
| `turn_quality` | N consecutive low-effort turns ("cool" … "what else") — powers the vague-browser escalation. | shared cheap call |
| `probe` | Injection/off-topic probing detected ("ignore your instructions…"). | pattern + shared cheap call |
| `pivot` | Explicit topic change detected. | shared cheap call |
| `always` | Unconditional — followed **only at session start** to chain past the start node. Never fires mid-conversation; the validator warns if you author one outside the start chain. | free |

All classifier-needing conditions on a node share **one** batched cheap-model call per turn, together with slot extraction — cost does not grow per edge.

### Visitor-facing surfaces

Three node fields are visible to the visitor:

- **Chips** — suggested questions rendered at the pill on node entry, replaced on transition. A tap sends the text as a normal turn *and* fires matching `chip` edges deterministically. Chip ids are stable: relabel freely without breaking edges.
- **Topic label** — a subtle pill indicator ("Topic: Kiln project"). Empty = hidden.
- **On-enter staging** — one staged navigation (scroll/highlight) executed once per entry through the normal navigation path. Preview-level by design: it never yanks the visitor away from what they're reading.

---

## Drafts, publishing, and versions

- **The draft never serves traffic.** Edit freely; autosave preserves work-in-progress even when it's temporarily invalid. Validation results ride back on every save.
- **Publish** validates first — **errors block, warnings don't** — then embeds any intent-edge exemplars (metered, fractions of a cent), snapshots the whole graph as an immutable version, and activates it atomically. The publish dialog takes a version note; write one, your future self reviewing conversations will thank you.
- **Changes apply to new conversations only.** A conversation is pinned to the version it started under for its whole life — replay and annotations always interpret against the exact graph that ran.
- **Versions panel** (toolbar → *Versions*) lists every published version with notes and node/edge counts. Pick any two to see a **structural diff** (added/removed/changed nodes and edges, joined by stable ids — canvas re-layouts don't count as changes). **Re-activate** any previous version instantly: the live pointer moves, your draft keeps its in-progress edits.
- **Archive** a graph to take it out of service; its versions and telemetry are kept so old conversations stay reviewable. **Duplicate** creates a fresh copy under new ids (a new lineage — the copy's analytics never mix with the original's).

## Validation reference

Errors (block publish): missing/duplicate start or offgraph node, duplicate ids, edges pointing at missing nodes, `always`-edge cycles, tools not in the registry, model aliases not in the registry, `{{slots.x}}` templates referencing a slot no node captures, schema violations (e.g. an intent edge with no exemplars).

Warnings (publish proceeds): nodes unreachable from start, `always` edges outside the start chain, static context exceeding the node budget, PRIVATE/missing content references, model-changing edges (the Req 5.4 native-voice note).

## Good to know

- **Native voice vs. text application:** on native voice, node changes reach the live session as non-disruptive control-plane updates — the connection never restarts on a transition. On cascade/text, the next turn is simply assembled under the new state. Same policy, two delivery mechanisms; you author once.
- **Sensitive guidance:** assembled guidance for native voice transits the visitor's browser (like all live context injection). Graph *structure* — your edges, conditions, exemplars — never leaves the server. If a node's guidance must never be client-visible, that node's content belongs on cascade/text runtimes.
- **Engine off = site unchanged.** Archive the active graph and the assistant behaves exactly as it does today, static start frame and all. The engine is a layer, not a rewrite.
- **Deleting nodes/edges** is an explicit inspector action (the Delete key is deliberately inert on the canvas — no accidental policy changes while panning).
- **Debugging a live graph:** admin/debug sessions get an `engine` section in the response debug envelope — active node, graph version, which edge fired (and which were evaluated but didn't, with reasons like `exemplar similarity 0.593 below band`), injected context, dropped items, and the effective tool set.

## Coming later (already specced, not yet built)

- **"What visitors actually asked" panel** — per-node clusters of real entry questions with one-click promote-to-chip (waits on the question-analytics batch).
- **Golden scenarios** — record a test walk-through, pin the expected node path, and run it as a regression check before publish.
- **Replay integration & coverage** — traversal paths highlighted on the graph from any conversation replay; per-node hit rates, dead nodes, and hot off-graph exits as an editor overlay.
