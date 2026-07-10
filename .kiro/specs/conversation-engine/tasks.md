# conversation-engine — Tasks

**Status:** current — **all open** (spec promoted 2026-07-09; post-roadmap Phase 6)
**Owner domain:** node-graph conversation engine (see requirements.md)
**Last verified against code:** 2026-07-09 (nothing implemented; seam audit in design §5)

Ordering note: blocks A → B → C are strictly dependency-ordered; D, G, H, I, J, L all depend on B and can proceed in parallel after it (D4 additionally needs I1; J1 should land early since H1/I3 write into the `ConversationState` contract); K rides with H/I; E depends on D; F closes the phase and depends on everything except L (safety is modular and may land after go-live). Within a block, subtasks are one session's work each where possible. Block A lands in `ai-assistant`'s domain (coordinated here to keep one ledger; mirror one-line pointers in ai-assistant's ledger when A starts). Every block ends with the D46 loop: deterministic suite green + the block's e2e assertion exercised in-session.

**Before writing any code, read [design-implementation-notes.md](./design-implementation-notes.md)** — module layout (§1), normative sequences (§2), concurrency contracts (§3), provider fidelity (§4), and the P1–P20 issues catalog. `P#` references below point into that catalog; a task is not done until its listed P-items are handled and tested. §8 of that file lists what NOT to build — treat it as binding scope.

---

## Block A — Prerequisite seams (ai-assistant domain, engine-driven)

- [ ] A1. Schema migration: `ConversationGraph`, `ConversationGraphVersion`, `GraphAnnotation`, `GraphScenario` (design §2); no changes to conversation tables (`latestState` is already `Json?`). Incremental migration per D54 conventions (re-verify any index DDL by hand).
- [ ] A2. `updateSession()` on `IConversationalAgentAdapter` (D47(d)) — interface + `BaseConversationalAgentAdapter` scaffold returning per-field results (`applied`/`deferred-to-remint`/`unsupported`, notes §4), then per adapter:
  - [ ] A2.1 OpenAI Realtime: `session.update` with FULL replacement semantics — always resend complete assembled instructions and complete tool array (P8); context items via the existing NAV_CONTEXT delete-then-create path; verify via fake-mic drill that an in-flight session accepts new instructions/tool schema without reconnect.
  - [ ] A2.2 Google Live: instructions cannot change mid-session (P7) — fold guidance into a `realtimeInput.text` context item, record `degraded`; verify tool-set mutability at build time and document the re-mint fallback in adapter metadata (fidelity matrix: notes §4).
  - [ ] A2.3 Cascade: next-turn-assembly application — implement as explicit method returning `applied`, not silent absence.
  - [ ] A2.4 **Design-philosophy doc-comment at the top of every adapter** (owner request 2026-07-09): OpenAI = "mutable conversation — items are addressable, sculpt freely"; Gemini = "append-only stream — nothing sent can be deleted (our own context blocks included), supersede don't retract, native compression manages the window"; Cascade = "we assemble every turn — all invariants exact". Keep in lockstep with the notes §4 matrix so provider-specific work always starts from the right mental model.
  - _Requirements: 2.3, 4.3, 19.1; registry D47(d)_
- [ ] A3. D55 context buffer: per-conversation keyed buffer module (last-write-wins per source key, TTL, token-budgeted merge, turn-end flush via `updateSession`/next-turn assembly; every flush a D49 history event). Engine publishes under source key `engine`; migrate NAV_CONTEXT/F-I-D publishing into the buffer in the same task (one injector, D55). **The injector implements the floating-block invariant from day one**: one merged block at the conversation tail, removed + re-appended every turn even when unchanged (Req 19.1). _Handles P27._
  - _Requirements: 3.1, 3.6, 7.4, 19.1; registry D55_
- [ ] A4. Turn-evidence + directive plumbing: `/api/ai/conversation/log` POST accepts UI-state deltas in the payload and returns optional `engineDirective` (full snapshot + `seq`; native voice only — cascade/text ignore the field and re-derive from `latestState`, notes §2.2.9); base adapter applies directives latest-wins at turn boundaries, queuing any that arrive mid-response. Inert while no graph is active (Req 2.7).
  - Acceptance: retried `/log` POST produces no second application; out-of-order directives dropped; directive arriving mid-response applied only after response completes. _Handles P4, P19, P20._
  - _Requirements: 2.2, 2.3, 6.1, 11.4_

## Block B — Engine core (runtime evaluator)

- [ ] B1. `src/lib/ai/engine/`: module layout exactly per notes §1 — graph document types + Zod validation (design §3; schemas shared with the editor client), `GraphSource` interface (no Prisma in core) + Prisma-backed `graph-store.ts`, per-instance cache keyed by immutable version id, graph validation rules (Req 1.6 + `always`-cycle detection, P5).
- [ ] B2. Evaluator: condition modules (pattern / ui_state / tool_result / **chip** deterministic-by-id free-tier; intent via version-pinned exemplar embeddings with classifier tiebreaker band; **slot / turn_quality / probe** / pivot via the shared cheap call), strict priority order, one-transition-per-turn, off-graph state + re-entry, no engine-initiated heuristic transitions (notes §2.2.7). The single per-turn cheap call covers edge scoring + slot extraction + turn-quality + probe (P26). Deps (`embed`, `classify`, `log`) injected for testability. Unit tests against fakes for every condition type, priority tie, purge policy, off-graph cycle, classifier timeout → no transition. _Handles P5, P10, P11, P22, P26._
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
- [ ] D2. Editor page: React Flow canvas (custom nodes/edges, persisted layout, validation badges, debounced draft autosave; ids minted once at creation and never regenerated — P15), node inspector (guidance blocks with `{{slots.x}}` placeholder validation against declared slots — P21, context-set builder with entity/chunk search pickers + live token meter using the SAME estimator as runtime, registry-enumerated tool picker, alias dropdown, voice-clip categories, **UX panel: chips / topic label / on-enter staging target picker**, **slot capture specs**), edge inspector (condition builder per type incl. chip/slot/turn_quality/probe, priority, purge, human-readable canvas labels). Model-changing edges visually flagged expensive-on-native (Req 5.5); "changes apply to new conversations" copy on publish (P6); cascade/text-only note on any secrecy-sensitive guidance (notes §5)._
- [ ] D4. "What visitors actually asked" panel in the node inspector: `GET /graphs/[id]/questions` clusters ranked by size, representative phrasings, one-click promote-to-chip (and optional promote-to-intent-exemplar) (Req 16.3). Depends on Block I1._
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
- [ ] F3. Seed graph + behavior suite: author the seed node catalog (design-ux-and-behavior §8) with the owner; every §2 vignette (vague-browser escalation, prober 1–2-turn deflection + flat political/religious refusal, skeptic honesty + interview CTA, wanderer re-entry tone, JD form-first intake, identity/no-impersonation + LinkedIn fast path, AI-self showcase, qualify-then-capture, show-while-telling start, navigate-while-answering deep-dive) exists as a golden scenario and passes before the graph serves real traffic (Req 18.3).
- [ ] F4. Live-fire drill (phase completion): seed graph on real content, one conversation per runtime (native via fake-mic, cascade, text) asserting traversal, flush events, tool filtering, chips rendering + deterministic chip-edge fire, a slot fill → lead capture → notification, native deferred model swap; removal-safety assertion (engine off → pre-engine suite green) (Req 12).
- [ ] F5. Docs closure: CLAUDE.md verification additions (`check:scenarios`, batch triggers), 00-overview index row verified, `_backlog/conversation-engine.md` marked superseded, D47 registry status flipped to implemented when F4 passes.
  - _Requirements: 10, 12, 18; registry D46, D53, D56_

## Block G — Visitor UX surfaces (after B; parallel to D)

- [ ] G1. Directive UX payload + pill rendering: chips (render on entry, replace on transition, tap → user turn + `chipId` evidence), topic indicator, applied via the same directive path on voice and next-turn payload on text (Req 13.1/13.3/13.5). _Handles P22._
- [ ] G2. On-enter staging: engine directive carries the staging spec; client executes ONCE per entry through `UIManager`/`ui_intent` (D59 staged sequences; skipped on UI-less runtimes; never a route load during voice) (Req 13.2).
- [ ] G3. `job_description_form` client tool: purpose-built paste form (scoped D18 exception), opened via the existing client-tool path, submission feeds the existing job-analysis pipeline; allowlisted only where a node declares it (Req 13.4; behavior: design-ux-and-behavior §2.5).
- [ ] G4. Content prerequisite: verify the `/about/ai` article is ingested into the semantic index (AI-self node's context source, design-ux-and-behavior §2.7); ingest if missing.
  - _Requirements: 13; registry D18 (scoped), D59_

## Block H — Slots & leads (after B; parallel to D)

- [ ] H1. Slot pipeline: capture specs in the node schema, extraction inside the shared per-turn cheap call (P26), conversation-scoped values in `latestState` (merge-write, P18) + history events on fill, `{{slots.x}}` templating at directive assembly with delimiting/length-cap/placement rules (P21), `slot` edge conditions (Req 14).
- [ ] H2. `ConversationLead` + `lead_capture` server tool (registry tool, node-allowlisted, conversational consent before the write — Req 21.3): DB row committed before any notification (P25); notification seam (`lib/ai/leads/notify.ts`) with admin channel always on + push = **email, invoked as a tool call** (owner decision 2026-07-09: "email IS MCP" — the agent's language is tool calls; the notify step is a server-side tool/function whose transport is an email provider; no separate push architecture) (Req 15.1/15.2).
- [ ] H3. `/admin/ai/leads`: list with slot snapshots, status new/seen/handled, failed-notification badge, link into replay at the capture turn (Req 15.2).
  - _Requirements: 14, 15_

## Block I — Batch analytics & continuity (after B; independent of D–H)

- [ ] I1. Question analytics batch: admin/cron endpoint scans since last run, joins `node_transition` markers to their next N user turns, writes `NodeEntryQuestion` (idempotent on messageId), embeds via `default-embedding` (budget-gated, ledgered, embedding-model id recorded), greedy pgvector similarity clustering — deliberately simple/swappable; test-tagged conversations excluded (Req 16; P17, P23). NO runtime-dynamic suggestions (Req 16.4).
- [ ] I2. Summarization batch: daily cron + admin trigger, **reusing the J3 summarizer module** (one summary pipeline, two triggers — Req 20.5): backfills/consolidates `conversation_summary` system rows for conversations that ended without a running summary; rendered in the admin transcript view (Req 17.2). _Handles P23._
- [ ] I3. Returning-visitor resume: same-reflink lookup; same-device continuity marker → auto-resume via the D49 path (third trigger); **new device/browser → confirmation with a safe one-line summary + always-offered "start fresh"** (Req 17.1, 21.1); stale-resume briefing = latest summary + recent verbatim turns, with full-transcript fallback when no summary exists yet (Req 17.3). _Handles P24, P32._
  - _Requirements: 16, 17, 21.1; registry D49_

## Block J — Conversation memory & context lifecycle (after A3/B; parallel to D–I)

- [ ] J1. `ConversationState` typed contract (design §2): Zod schema over `latestState`, `stateVersion` optimistic concurrency generalizing the B3 CAS, engine keys (node, slots, flags, agendaProgress, summaryVersion, contextSetVersion), merge-write preserved (P18). Migrate B3/H1 ad-hoc keys onto it.
- [ ] J2. Visitor profile: fast flags in the shared per-turn cheap call (P26); profile rendered into the floating block as transparent observations (Req 19.5, P31); flags unified with slots for templating + edge conditions (Req 19.2); agenda rendering on node entry (Req 19.6).
- [ ] J3. Behavior summarizer: separate cheap-LLM job over user turns only, structured output (intent/register/mood/topics), staleness-triggered at turn boundaries (≥60s interval, async fire-and-forget with in-flight guard — P29), gateway-metered; output REPLACES the profile wholesale (P30) and appends/updates the running `conversation_summary` row (Req 19.3/19.4, 20.5).
- [ ] J4. Rolling window: window config (minutes/turns), running-summary collapse of old verbatim turns; per-provider pruning — OpenAI item-delete + summary item, Gemini native compression at mint + summary text, cascade/text assembly-time with cache-stable ordering (Req 20.1–20.3; P28 — verify provider behavior by driving it, never docs alone). NEVER a re-mint for pruning.
- [ ] J5. Continuity assertion: fake-mic drill spanning ≥2 graph transitions + ≥1 pruning event — transcript-verified that the model references pre-transition/pre-prune conversation naturally (Req 20.4); `_debug.engine` exposes window state + profile + last summarizer run.
  - _Requirements: 7.2, 19, 20; registry D41(b), D49, D55_

## Block K — Privacy & data lifecycle (with H/I; before F closes)

- [ ] K1. Resume confirmation UX (I3 covers mechanics): pill copy for confirm-with-summary, "start fresh", and "forget this conversation" affordances; forget deletes visitor content (transcript, summaries, profile, slots, leads on request) while retaining anonymized telemetry (Req 21.2).
- [ ] K2. Retention: owner-configurable defaults (transcripts N days, summaries longer, leads until handled + M), expiry executed inside the existing batch jobs (P23); reflink revocation kills resume (Req 21.4/21.5).
- [ ] K3. Admin separation: leads/transcript views labeled visitor content vs. operational telemetry; deletion actions audit-logged (Req 21.2).
  - _Requirements: 21_

## Block L — Safety tripwire (after B; independent; modular — shippable last without blocking F)

- [ ] L1. `src/lib/ai/safety/`: static word-flag scan (normalized string matching, config-driven) wired into the persist path of `/log` and `/chat` — synchronous, never blocks/fails the write (P33); conservative normalization, no cleverness (P34); disabled config = short-circuit (Req 22.1/22.4).
- [ ] L2. Investigation agent: async fire-and-forget with per-conversation in-flight guard (P33), reasoning adapter, gateway-metered; structured verdict (benign/severity/recommended action/rationale) → `SafetyInvestigation` row, linked from the conversation in admin (Req 22.2).
- [ ] L3. Enforcement executor: admin-configured severity→action map — log-only / owner notification (H2 seam) / evidence publication into the engine stream (graph safety edges can fire) / session termination + reflink ban via `access-and-cost` surfaces, honest client-direct mechanics (P35: revoke resources + disconnect directive, never claim more) (Req 22.3/22.5).
- [ ] L4. `/admin/ai/safety` page + `GET/PUT /api/admin/ai/safety` + investigations list: word lists by category, investigation policy text, severity→action map, module on/off; e2e drill: flagged word in a fake-mic conversation → log succeeds, investigation fires once, verdict lands, configured action executes.
  - _Requirements: 22; registry D33, D48_

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
