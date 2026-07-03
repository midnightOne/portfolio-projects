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
- **State ownership (owner-confirmed):** the engine's graph state lives server-side in the harness; node transitions reach the live voice session as *non-disruptive* control-plane updates (`updateSession` → instructions/context/tools) over the standing connection. The voice connection is NOT restarted per transition — most transitions change only guidance/context/tools, which every runtime applies live. Re-mint is reserved for actual model/provider swaps on native sessions, at natural pauses. See `ai-assistant/design-voice-adapters.md` §1 state-ownership principle.
- One graph serves **all runtimes**: native voice, cascade voice, text chat — because all of them already share the same prompt-assembly point, tool registry, and context-injection contract.

## 2. Why the current architecture is already 90% of the runtime

| Engine need | Existing seam |
|---|---|
| Set per-node instructions/context | single server-side assembly point (`context-provider`, post-Phase-3.2) |
| Restrict/extend tools per node | `UnifiedToolRegistry` + per-request allowlists (gateway already filters by tier — node adds one more filter layer) |
| Switch models per node | D4 aliases |
| Reconfigure a live session | `updateSession` primitive on `IConversationalAgentAdapter` (D47 constraint d) |
| Know which tools/capabilities exist to offer as nodes | registry enumeration with metadata (D47 constraint b; capability plugins per D48) |
| Observe transitions for debugging | conversation log + `_debug` envelope (D46) — engine adds node-transition events to the same telemetry |

The genuinely new build is: the graph model + storage, the runtime evaluator (which node am I in, which edge fires), and the **admin node editor UI** (React Flow or similar) — the editor is the biggest chunk.

## 3. Industry context (2026)

Graph-scripted conversations over LLM agents are now a mainstream pattern (ElevenLabs Agent Workflows, LangGraph, Voiceflow-style builders, OpenAI Agents SDK handoffs). The differentiators here: admin-editable in the CMS, provider-agnostic across three runtimes (native S2S / cascade / text), and integrated with the portfolio's RAG + F-I-D + capability plugins. As a D48 module it's also the piece with the clearest standalone value (the phone-agent use case is essentially this engine + rag-core + cascade voice).

## 4. Prerequisites before scheduling

Phases 0–3 complete (single provider, single context assembler, registry cleanup), D39 reasoning adapters live, ideally D45 cascade live (model switching per node is trivial there). Then: promote this outline to a full spec, decide graph storage (rows vs JSON), and design the evaluator's interaction with F-I-D (node scope vs page scope).

## 5. Explicitly not now

No graph schema in the DB, no editor UI, no evaluator — only the D47 seam constraints. If a current-phase change would make any row of the table in §2 false, that change is wrong (registry rule).
