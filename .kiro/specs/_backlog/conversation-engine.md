# Conversation Templating Engine (node-graph) — Backlog Outline

**Status:** backlog — not scheduled; post-roadmap (after Phases 0–5). Registry decision D47 holds the seam constraints that bind current work. This document is an outline to design against, **not** a spec to implement from; it gets promoted to a full spec (requirements/design/tasks) when scheduled.
**Owner-to-be:** likely a new `conversation-engine` spec consuming `ai-assistant`, `ai-admin`, `semantic-content`.
**Recorded:** 2026-07-02 (owner direction)

---

## 1. Concept

An admin-editable **node graph that scripts the agent's conversational policy** without replacing its intelligence. The owner outlines the questions visitors commonly ask, wires each to the right context, tools, and "my idea of the best answer" material, and defines forks that re-scope the conversation when the topic changes.

- **Node** = a conversation state bundling:
  - guidance: prompt fragment(s), preferred-answer material (owner's framing, not canned text — the model still speaks),
  - context set: which semantic content / F-I-D scope / static snippets are loaded,
  - tool allowlist: which registry tools are active here,
  - model alias: which model runs this node (cheap for small talk, reasoning for deep dives — pure data via D4).
- **Edge / fork** = transition condition (intent match, tool result, explicit user pivot) whose traversal can **purge context** (drop the previous node's injected items — the NAV_CONTEXT replace-don't-append mechanics generalize to this) and **switch model** (alias change; per-turn on the cascade, re-mint-at-a-pause on native realtime — one more reason D45 matters).
- **State ownership (owner-confirmed):** the engine's graph state lives server-side in the harness; node transitions reach the live voice session as *non-disruptive* control-plane updates (`updateSession` → instructions/context/tools) over the standing connection. The voice connection is NOT restarted per transition — most transitions change only guidance/context/tools, which every runtime applies live. Re-mint is reserved for actual model/provider swaps on native sessions, at natural pauses — and rides the **D49 resume path** (session legs, briefing from ground truth, markers), which exists anyway for connection recovery and is battle-tested by then. The engine's current node ID lives in the D49 latest-state snapshot, so a resumed conversation re-enters the graph exactly where it left off.
- One graph serves **all runtimes**: native voice, cascade voice, text chat — because all of them already share the same prompt-assembly point, tool registry, and context-injection contract.

## 1b. Purpose (owner, 2026-07-02 — expanded)

The engine has three jobs, and the second and third matter as much as the first:

1. **Steer a weak model.** The realtime voice model runs most conversations and is not the most intelligent model available — for known questions and known *sequences* of questions, the graph supplies prepared context, tools, and the owner's best-answer framing in advance, so the voice model performs above its weight on the paths that matter.
   - **Context is pushed on state entry, not pulled by the model (owner, 2026-07-03).** Entering a node *proactively* injects that node's context set — the model never has to decide to look things up on graph-covered paths. The conversation-start node injects the baseline grounding frame (owner summary, per-project summaries, combined tech/category list); entering a niche node injects that niche's content automatically. Grounded on evidence: on 2026-07-03 the realtime model answered a kiln question from world knowledge because nothing told it a kiln project existed, yet called `content_search` correctly once the question was portfolio-scoped — the failure was a missing frame, not broken tools. The pre-engine interim (static start frame at session mint, ai-assistant task 5d) becomes the start node's context set when the engine lands; model-initiated `content_search` remains the fallback for off-graph territory.
2. **Self-test scenarios.** The owner plays the client (sandboxed test sessions), walks the flows, and debugs both the conversation *flow* (did it enter the right states, on the right conditions?) and the *answer quality* — then makes surgical edits to the graph for later runs.
3. **Capture and convert bad behavior.** Real conversations that go wrong are recorded with full traversal context; the owner reviews the finished conversation, sees exactly which node was active when the bad answer happened and which conditions did (or didn't) fire, and adds rules/nodes so the next run handles it.

**What this implies (added from engineering experience with eval-driven agent iteration):**

- **Traversal telemetry is first-class, not derived.** Every transition is an event in the D49 conversation history: `{fromNode, toNode, edgeId, condition fired, evidence (utterance/intent/tool result), turn ref, timestamp}` — so admin replay shows the state path inline with the transcript, and "the most recent state" is always the D49 snapshot. In debug/test mode, also record edges *evaluated but not taken* (with why) — that's how you diagnose "why didn't it enter the pricing node?", the most common graph-debugging question. Too verbose for production traffic; sample it or gate it behind debug sessions.
- **Graph versioning.** Surgical edits for later runs means the graph changes over time; every conversation records the graph version it ran under, so reviewing last week's failure isn't confused by this week's fix. Edits create new versions; replay interprets traversal against the version that actually ran.
- **Sandboxed test sessions.** Owner-as-client runs are tagged `test` (excluded from public analytics and spend alarms, still fully logged) — self-testing must be free and consequence-free.
- **Golden scenario tests.** A scripted sequence of user turns + the expected node path = a regression test. After any graph edit, replay the scenario set (against fakes, verification spec) and diff the traversals. This is what makes "surgical edits" safe — an edit that fixes one path can silently break another, and only traversal diffs catch it.
- **Annotation loop in replay.** While reviewing a finished conversation, mark a turn ("bad answer", "missed transition", note attached); annotations queue as graph-edit TODOs, each linked to the node active at that turn; resolving an annotation links it to the graph change that addressed it. That closes the record → review → rule loop the owner described.
- **Coverage view.** Node hit-rates over real traffic: dead nodes (never entered — delete or fix conditions), hot off-graph exits (where conversations most often leave prepared paths — the next place to invest a node).
- **Off-graph is normal, not failure.** Real conversations will constantly step outside the graph. The engine needs an explicit default/off-graph state with graceful re-entry conditions — the graph is a lattice of prepared paths laid over a free conversation, never a cage. A visitor who asks something unanticipated gets the ordinary RAG-grounded agent, and that conversation becomes review material for a future node.
- **Preferred-answer material is grounded framing, not canned text.** Talking points, emphasis, links to semantic content, and negative guidance ("never claim X", "don't promise availability") — the model still speaks; the node biases it. Canned strings would make the voice model *worse* (it would read them flatly and mismatch follow-ups).

## 2. Why the current architecture is already 90% of the runtime

| Engine need | Existing seam |
|---|---|
| Set per-node instructions/context | single server-side assembly point (`context-provider`, post-Phase-3.2) |
| Restrict/extend tools per node | `UnifiedToolRegistry` + per-request allowlists (gateway already filters by tier — node adds one more filter layer) |
| Switch models per node | D4 aliases |
| Reconfigure a live session | `updateSession` primitive on `IConversationalAgentAdapter` (D47 constraint d) |
| Know which tools/capabilities exist to offer as nodes | registry enumeration with metadata (D47 constraint b; capability plugins per D48) |
| Observe transitions for debugging | conversation log + `_debug` envelope (D46) — engine adds node-transition events to the same telemetry |
| Record traversal + resume mid-graph | D49 conversation history (transition events as markers) + latest-state snapshot (current node); test sessions and golden scenarios ride the `verification` harness (fakes, tagged sessions) |

The genuinely new build is: the graph model + storage, the runtime evaluator (which node am I in, which edge fires), and the **admin node editor UI** (React Flow or similar) — the editor is the biggest chunk.

## 3. Industry context (2026)

Graph-scripted conversations over LLM agents are now a mainstream pattern (ElevenLabs Agent Workflows, LangGraph, Voiceflow-style builders, OpenAI Agents SDK handoffs). The differentiators here: admin-editable in the CMS, provider-agnostic across three runtimes (native S2S / cascade / text), and integrated with the portfolio's RAG + F-I-D + capability plugins. As a D48 module it's also the piece with the clearest standalone value (the phone-agent use case is essentially this engine + rag-core + cascade voice).

## 4. Prerequisites before scheduling

Phases 0–3 complete (single provider, single context assembler, registry cleanup), D39 reasoning adapters live, ideally D45 cascade live (model switching per node is trivial there). Then: promote this outline to a full spec, decide graph storage (rows vs JSON), and design the evaluator's interaction with F-I-D (node scope vs page scope).

## 5. Explicitly not now

No graph schema in the DB, no editor UI, no evaluator — only the D47 seam constraints. If a current-phase change would make any row of the table in §2 false, that change is wrong (registry rule).
