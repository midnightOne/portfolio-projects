# conversation-engine — Tasks

**Status:** current — **all open** (spec promoted 2026-07-09; post-roadmap Phase 6)
**Owner domain:** node-graph conversation engine (see requirements.md)
**Last verified against code:** 2026-07-09 (nothing implemented; seam audit in design §5)

Ordering note: blocks A → F are dependency-ordered; within a block, subtasks are one session's work each where possible. Block A lands in `ai-assistant`'s domain (coordinated here to keep one ledger; mirror one-line pointers in ai-assistant's ledger when A starts). Every block ends with the D46 loop: deterministic suite green + the block's e2e assertion exercised in-session.

**Before writing any code, read [design-implementation-notes.md](./design-implementation-notes.md)** — module layout (§1), normative sequences (§2), concurrency contracts (§3), provider fidelity (§4), and the P1–P20 issues catalog. `P#` references below point into that catalog; a task is not done until its listed P-items are handled and tested. §8 of that file lists what NOT to build — treat it as binding scope.

---

## Block A — Prerequisite seams (ai-assistant domain, engine-driven)

- [ ] A1. Schema migration: `ConversationGraph`, `ConversationGraphVersion`, `GraphAnnotation`, `GraphScenario` (design §2); no changes to conversation tables (`latestState` is already `Json?`). Incremental migration per D54 conventions (re-verify any index DDL by hand).
- [ ] A2. `updateSession()` on `IConversationalAgentAdapter` (D47(d)) — interface + `BaseConversationalAgentAdapter` scaffold returning per-field results (`applied`/`deferred-to-remint`/`unsupported`, notes §4), then per adapter:
  - [ ] A2.1 OpenAI Realtime: `session.update` with FULL replacement semantics — always resend complete assembled instructions and complete tool array (P8); context items via the existing NAV_CONTEXT delete-then-create path; verify via fake-mic drill that an in-flight session accepts new instructions/tool schema without reconnect.
  - [ ] A2.2 Google Live: instructions cannot change mid-session (P7) — fold guidance into a `realtimeInput.text` context item, record `degraded`; verify tool-set mutability at build time and document the re-mint fallback in adapter metadata (fidelity matrix: notes §4).
  - [ ] A2.3 Cascade: next-turn-assembly application — implement as explicit method returning `applied`, not silent absence.
  - _Requirements: 2.3, 4.3; registry D47(d)_
- [ ] A3. D55 context buffer: per-conversation keyed buffer module (last-write-wins per source key, TTL, token-budgeted merge, turn-end flush via `updateSession`/next-turn assembly; every flush a D49 history event). Engine publishes under source key `engine`; migrate NAV_CONTEXT/F-I-D publishing into the buffer in the same task (one injector, D55).
  - _Requirements: 3.1, 3.6, 7.4; registry D55_
- [ ] A4. Turn-evidence + directive plumbing: `/api/ai/conversation/log` POST accepts UI-state deltas in the payload and returns optional `engineDirective` (full snapshot + `seq`; native voice only — cascade/text ignore the field and re-derive from `latestState`, notes §2.2.9); base adapter applies directives latest-wins at turn boundaries, queuing any that arrive mid-response. Inert while no graph is active (Req 2.7).
  - Acceptance: retried `/log` POST produces no second application; out-of-order directives dropped; directive arriving mid-response applied only after response completes. _Handles P4, P19, P20._
  - _Requirements: 2.2, 2.3, 6.1, 11.4_

## Block B — Engine core (runtime evaluator)

- [ ] B1. `src/lib/ai/engine/`: module layout exactly per notes §1 — graph document types + Zod validation (design §3; schemas shared with the editor client), `GraphSource` interface (no Prisma in core) + Prisma-backed `graph-store.ts`, per-instance cache keyed by immutable version id, graph validation rules (Req 1.6 + `always`-cycle detection, P5).
- [ ] B2. Evaluator: condition modules (pattern / ui_state / tool_result free-tier; intent via version-pinned exemplar embeddings with classifier tiebreaker band; pivot), strict priority order, one-transition-per-turn, off-graph state + re-entry, no engine-initiated heuristic transitions (notes §2.2.7). Deps (`embed`, `classify`, `log`) injected for testability. Unit tests against fakes for every condition type, priority tie, purge policy, off-graph cycle, classifier timeout → no transition. _Handles P5, P10, P11._
- [ ] B3. Hook-in per notes §2.1/§2.2: `startPolicy` at all mint routes + `/api/ai/chat` (start node feeds `context-provider`/`start-frame`; static frame remains the no-graph path — closes ai-assistant 5d.3; graph version PINNED at conversation start); `processTurn` at `/log` and `/chat` post-persist inside a swallow-all guard; idempotency gate on `lastEvaluatedTurnId` + CAS on `latestState` (merge-write, never blob replace); `node_transition` markers via `recordSessionMarker` (turn-zero entry marker included); resume briefing re-enters the persisted node (Req 2.6 — extend `getResumeBriefing`).
  - Acceptance: evaluator throwing mid-turn still returns 200 from `/log` with the turn persisted; same-turn replay yields exactly one marker; two concurrent posts yield exactly one transition. _Handles P1, P2, P3, P6, P9, P18._
- [ ] B4. Context-set assembly: typed items → resolved content (entity→T1, chunk, entry-time search, static, fid-scope) in the single assembly point, budget policy per notes §6 (drop whole items, record drops in flush events), runtime PRIVATE-visibility exclusion inside the assembly call for public sessions (Req 11.2), publish to buffer under source key `engine`. _Handles P12, P13._
- [ ] B5. Tool scoping: node allowlist filter layered in `/api/ai/tools/execute` (tier ∩ session ∩ node; node never grants beyond tier) + directive-carried full tool schema for `updateSession` (replacement semantics, P8).
  - _Requirements: 1, 2, 3, 4; registry D47(a)(b), D49, D55_

## Block C — Model switching (voice models)

- [ ] C1. Cascade/text: directive `modelAlias` → next-turn resolution via `resolveModel` (pure data; assert ledger rows show the switch).
- [ ] C2. Native deferred swap: `latestState.pendingModelSwap` (alias never travels in the directive on native — notes §2.2.10), client schedules re-mint at natural pause through `resumeOnProvider` (D49 path unchanged — one code path, third trigger), cancel-on-revert, `session_resumed` marker carries the new alias. Fake-mic drill: guidance/context apply instantly, model swaps at pause, conversation continues coherently.
- [ ] C3. `_debug.engine` envelope: active node, graph version, fired edge, evaluated edges (debug sessions), injected context items, effective tool set, pending swap (Req 7.5).
  - _Requirements: 5, 7.3, 7.5; registry D4, D45, D49_

## Block D — Admin graph editor

- [ ] D1. Graph CRUD + publish APIs (design §6 route table), validation-on-save, publish per notes §2.3 (embed exemplars with recorded model id → snapshot → activate, one transaction; error-severity issues block), version list + structural diff (by stable node/edge id sets). _Handles P6, P11._
- [ ] D2. Editor page: React Flow canvas (custom nodes/edges, persisted layout, validation badges, debounced draft autosave; ids minted once at creation and never regenerated — P15), node inspector (guidance blocks, context-set builder with entity/chunk search pickers + live token meter using the SAME estimator as runtime, registry-enumerated tool picker, alias dropdown, voice-clip categories), edge inspector (condition builder per type, priority, purge, human-readable canvas labels). Model-changing edges visually flagged expensive-on-native (Req 5.5); "changes apply to new conversations" copy on publish (P6); cascade/text-only note on any secrecy-sensitive guidance (notes §5)._
- [ ] D3. Draft/publish UX: publish dialog with note, version history view, re-activate prior version, PRIVATE-content warnings (Req 11.2).
  - _Requirements: 1.3–1.6, 8; registry D47(b), D4_

## Block E — Review, annotation, coverage loop

- [ ] E1. Replay integration: node-path chips in `ConversationReplayViewer` + conversation browser; "show on graph" opens read-only editor pinned to the run's `graphVersionId` with traversal highlighted (Req 9.1).
- [ ] E2. Annotations: mark-turn UI in replay → `GraphAnnotation`; TODO drawer in the editor; resolve links annotation → fixing version (Req 9.2).
- [ ] E3. Coverage: aggregation endpoint over transition markers (window filter, test-excluded), editor overlay: node hit-rates, dead nodes, hot off-graph exits, edge fire counts (Req 9.3).
  - _Requirements: 7, 9_

## Block F — Self-testing, scenarios, verification closure

- [ ] F1. Sandboxed test sessions: `test` tag set once at session start and read by analytics, coverage, AND spend alarms from that single flag (P17); any runtime incl. fake-mic; fully logged with debug-level traversal (evaluated-but-not-taken events, sampled off in production) (Req 10.1, 7.3).
- [ ] F2. Golden scenarios: `GraphScenario` CRUD, record-from-test-session, `check:scenarios` runner against fakes only — scripted classifier scores, stable-vector embeddings, injectable clock (P16) — with readable path diffs + one-action re-baseline; "run scenarios" on draft in the editor pre-publish; wire into `npm run verify` (Req 10.2–10.4).
- [ ] F3. Live-fire drill (phase completion): fixture graph, one conversation per runtime (native via fake-mic, cascade, text) asserting traversal, flush events, tool filtering, native deferred model swap; removal-safety assertion (engine off → pre-engine suite green) (Req 12).
- [ ] F4. Docs closure: CLAUDE.md verification additions (`check:scenarios`), 00-overview index row verified, `_backlog/conversation-engine.md` marked superseded, D47 registry status flipped to implemented when F3 passes.
  - _Requirements: 10, 12; registry D46, D53, D56_

---

## External API integration points

### This system requires (from other specs)
```typescript
// ai-assistant
"context-provider.ts / start-frame.ts": "single assembly point the engine feeds";
"IConversationalAgentAdapter.updateSession": "added in Block A2 (D47(d))";
"D55 context buffer": "added in Block A3";
"POST /api/ai/conversation/log": "turn evidence in, engineDirective out (A4)";
"conversationHistoryManager": "recordSessionMarker / updateLatestState / getResumeBriefing";
"UnifiedToolRegistry": "enumeration with metadata; execute-route allowlists";
// ai-admin
"resolveModel(alias)": "per-node model aliases (D4)"; "reasoning adapters": "default-cheap classifier calls";
// semantic-content
"ContentSearchService / entity & chunk reads": "context-set assembly";
// access-and-cost
"withAIGateway": "every classifier call metered (D33)";
// verification
"FakeReasoningAdapter / fake embeddings / fixture / test tagging": "scenario runner + drills (D46)";
```

### This system provides (for other specs to reference)
```typescript
ConversationEngine: "startPolicy + processTurn (src/lib/ai/engine/)";
"/api/admin/ai/graphs*": "graph CRUD, publish, versions, coverage, scenarios";
"node_transition markers + latestState.nodeId": "replay/browser rendering, resume re-entry";
"check:scenarios": "deterministic traversal regression (npm run verify)";
```
