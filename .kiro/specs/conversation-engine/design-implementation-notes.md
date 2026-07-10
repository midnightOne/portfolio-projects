# conversation-engine — Design: Implementation Notes & Pitfalls

**Status:** current — **unimplemented**; companion to [design.md](./design.md), written so an implementing session can build without re-deriving decisions
**Owner domain:** engine runtime semantics, concurrency contracts, provider fidelity, failure catalog
**Last verified against code:** 2026-07-09 (same seam audit as design.md)

Read order for an implementing session: requirements.md → design.md → **this file** → the task block you're executing. When this file and design.md disagree, this file is more specific and wins; if either disagrees with requirements.md, requirements win.

---

## 1. Module layout (build exactly this; deviations need a written reason in the ledger)

```
src/lib/ai/engine/                      # agent-core (D48): NO imports from src/app/** or components
  types.ts          # GraphDocument, GraphNode, GraphEdge, EdgeCondition, ContextItemSpec,
                    #   EngineDirective, TurnEvidence, TransitionRecord + Zod schemas (single
                    #   source — the editor imports these same schemas for client validation)
  graph-source.ts   # GraphSource interface: getActiveVersion(graphKey), getVersion(id).
                    #   NO Prisma import here — interface only.
  validation.ts     # validateGraph(document) → ValidationIssue[] (Req 1.6 rules + always-cycle
                    #   detection, P5)
  evaluator.ts      # evaluateEdges(node, evidence, deps) → FiredEdge | null. Pure given deps;
                    #   deps = { embed, classify, log } injected (testability, D46)
  conditions/       # one module per condition type; each exports evaluate(cond, evidence, deps)
  directive.ts      # buildDirective(node, graphVersion, sessionCtx) → EngineDirective
  engine.ts         # ConversationEngine: startPolicy(...), processTurn(...) — orchestration only
src/lib/services/ai/
  graph-store.ts    # Prisma-backed GraphSource implementation + graph CRUD used by admin routes
                    #   (registered into the engine from outside core, D48 — see design §7)
src/app/api/admin/ai/graphs/…           # route table in design.md §6; thin: auth → zod → store
src/app/admin/ai/conversation-graphs/   # list page + [graphId] editor page
src/components/admin/graph-editor/      # ReactFlow canvas, NodeInspector, EdgeInspector,
                                        #   VersionHistory, CoverageOverlay, AnnotationsDrawer
scripts/checks/check-scenarios.ts       # golden-scenario runner (Block F2)
```

The engine core receives a loaded `GraphDocument`, a `conversationId`, and injected dependencies. It never opens DB connections itself; `engine.ts` accepts a `GraphSource` and the conversation-history functions as constructor/params. This keeps the phone-agent litmus (design §7) true by construction.

## 2. Runtime sequences (normative)

### 2.1 Session start

1. Mint route (or `/api/ai/chat` first turn) asks `startPolicy(runtime, sessionCtx)`.
2. Engine resolves the active graph: ONE DB read (`ConversationGraph.status='active'` → `activeVersionId` → version doc, per-instance cache keyed by **version id** — immutable, so the cache is never correctness-bearing, D43). No active graph → return `null` → caller uses today's static path unchanged (Req 2.7).
3. Resolve the start node; follow `always` edges up to **3 hops max** (P5); the landing node is the initial state.
4. Build the directive; the caller merges it into existing assembly: `promptFragments` append AFTER the base instructions; context set resolves (§6 budget) and enters the same injection path as the start frame; tool allowlist intersects the session tool set; `modelAlias` (if any) overrides the session's alias **at mint only** (no deferred-swap machinery at session start).
5. Write `latestState.{nodeId, graphVersionId, lastEvaluatedTurnId: null}` and a `node_transition` marker (`fromNode: null`) — so replay shows graph entry even for turn-zero.
6. **The graph version is now pinned for the conversation's lifetime** (P6). Later turns read `graphVersionId` from `latestState` and never re-resolve the active version.

### 2.2 Turn processing (voice `/log`, text `/chat` — same function)

Trigger: after a **user** turn is persisted (assistant turns and tool rows do not trigger evaluation; their content becomes evidence for the *next* user-turn evaluation).

1. Persist the turn exactly as today. Persistence result is already committed before the engine runs.
2. `processTurn(conversationId, evidence)` inside `try/catch`; **any engine error is logged and swallowed — the /log or /chat response succeeds regardless** (P1).
3. Read `latestState`. No `nodeId` → engine inactive for this conversation → return.
4. Idempotency gate (P2): if `latestState.lastEvaluatedTurnId === evidence.turnMessageId`, return (retry replay). 
5. Gather evidence: user utterance text, tool events since the previous user turn (from the just-persisted payload — no extra DB read), UI-state deltas from the request payload (voice) or request body (text).
6. Evaluate current node's outgoing edges by ascending `priority`; when current node is `offgraph`, evaluate its re-entry edges. Cheap conditions first is a *per-edge internal* concern: the engine walks edges strictly in priority order, but all classifier-needing edges are scored in ONE batched call prepared before the walk (P10).
7. First match fires. No match + no prepared-path signal → if current node is not `offgraph` and the node's `guidance` clearly no longer applies is NOT a judgment the engine makes — staying put is the default; only an explicit edge (including edges → offgraph the author draws) moves state. **The engine never transitions on its own heuristics.**
8. On fire, in this order: (a) optimistic-concurrency write of `latestState` (P3) — if the CAS loses, abort the whole transition silently (another instance won); (b) `node_transition` marker via `recordSessionMarker` with `{fromNode,toNode,edgeId,conditionType,evidence-ref,graphVersionId,turnMessageId}`; (c) publish the target node's resolved context set to the D55 buffer under source key `engine` (purge `replace` = overwrite the key; `keep` = merge with previous engine items, still under the one key); (d) build the directive.
9. Response: native voice → attach `engineDirective` (with `seq`, P4) to the `/log` response. Cascade/text → **do not use the response field at all**; the next turn's server-side prompt assembly re-derives everything from `latestState.nodeId` (design §1). One directive shape, two application layers, zero client involvement outside native voice.
10. `modelAlias` on native runtimes is **ignored mid-session** — no pending-swap state, no pause scheduling (owner removed the deferred-swap machinery 2026-07-09; native sessions keep their mint-time model, and deep capability on native comes from server-side reasoning tools, D39). On cascade/text the alias simply rides `latestState` into next-turn resolution.
11. Debug/test sessions only: persist `edge_evaluated` rows for non-fired edges (sampled; hard-off for untagged production traffic) — write AFTER the transition marker so replay ordering is stable.

### 2.3 Publish

1. Validate draft (`validation.ts`); any `error`-severity issue blocks publish (warnings don't).
2. Compute intent-exemplar embeddings for every `intent` condition: batch through the existing embedding path (gateway-wrapped, `default-embedding` alias). Store in the version document as `embeddings: { [edgeId]: { model: string, vectors: number[][] } }` — **the embedding model id is recorded** so a later default-embedding change can detect staleness (P11).
3. Create `ConversationGraphVersion` (next `version` int, full document incl. embeddings + layout) and set `activeVersionId` in ONE transaction. Failure anywhere = nothing published.
4. Live conversations are untouched (P6). New conversations pick up the new version at their next session start.

## 3. Concurrency, idempotency, ordering (serverless truths — D43)

Serverless is not a hosting accident here — it is the owner's stated design philosophy: bootstrap-cheap to run, and itself a showcase of building complex systems within serverless constraints. Every "no resident process / no in-memory state / staleness-triggered job" pattern below is that philosophy expressed, not a workaround to apologize for. It costs extra security thinking (each entry point re-validates from ground truth) — accepted and doable.

- **No in-memory engine state, ever.** Every `processTurn` reconstructs from `latestState` + the request payload. Per-instance caches hold only immutable version documents.
- **CAS on latestState (P3):** transitions write with `updateMany({ where: { id, latestState: path lastEvaluatedTurnId equals <previous value> } })`-style optimistic guard (Prisma JSON filtering; if too awkward, promote `lastEvaluatedTurnId` to a real column in the Block A migration — implementer's call, note it in the ledger). Zero rows updated → concurrent invocation won → abort silently, no marker, no directive.
- **Directive staleness (P4):** every directive carries a monotonically increasing `seq` (use the evaluated turn's message id timestamp or a counter in `latestState`). The client applies only `seq > lastApplied`; out-of-order responses are dropped. The base adapter owns `lastApplied`.
- **Evidence ordering:** voice transcription can persist a user turn after the assistant already answered it. Accepted (design §1 race contract): evaluation follows *persistence* order, and a "late" transition simply lands before the following turn. Never attempt to re-order or wait.
- **Turn-zero double fire:** `startPolicy` sets `lastEvaluatedTurnId: null`; the first `processTurn` must not re-fire the start node's `always` chain — `always` edges are **only** followed during `startPolicy` (condition module rejects them at runtime with a validation-time warning if authored elsewhere).

## 4. Provider fidelity matrix (`updateSession` + context lifecycle, Blocks A2/J4)

Two design philosophies, and every provider-specific decision follows from knowing which one you're inside (each adapter carries a header doc-comment stating its philosophy — task A2.4 — so neither the owner nor an implementing agent ever reasons from the wrong model):

- **OpenAI Realtime: a mutable conversation.** Items are addressable — create, delete, reorder; `session.update` mutates instructions/tools live. The harness can sculpt the context: true floating-block remove+re-append, true pruning (delete old items, insert a summary item).
- **Gemini Live: an append-only stream with provider-side memory management.** Nothing sent can ever be deleted — including our own passive-context block; `systemInstruction` is fixed at mint; the provider offers native sliding-window compression instead of giving us item control. The harness can only *add* and *supersede*, never retract.
- **Cascade/text: we ARE the context manager.** Every turn's prompt is assembled from scratch server-side — all invariants hold trivially and exactly.

| Adapter | instructions | context items | tool set | model | floating block (P27) | pruning (P28) |
|---|---|---|---|---|---|---|
| OpenAI Realtime | ✅ `session.update` — **full replacement** (P8) | ✅ NAV_CONTEXT delete-then-create mechanics | ✅ `session.update` tools — full array (P8) | ❌ fixed for the session (mint-time alias; mid-session swaps removed by owner 2026-07-09) | ✅ true remove+re-append | ✅ item deletes + summary item |
| Google Live | ❌ fixed at mint (P7) → guidance folds into superseding context text; fidelity `degraded` | ⚠️ append-only `realtimeInput.text` — supersede, never delete | ⚠️ verify at build; re-mint fallback documented | ❌ fixed for the session (mint-time alias; mid-session swaps removed by owner 2026-07-09) | ⚠️ versioned supersession: send on change only, labeled "[CURRENT CONTEXT vN — supersedes previous]"; stale copies persist until compression evicts them | ⚠️ native sliding-window compression (configured at mint) + injected summary text; no harness item control |
| Cascade | ✅ next-turn assembly | ✅ same | ✅ same | ✅ next turn | ✅ exact (assembly order) | ✅ exact (assembly window) |
| Text (`/chat`) | ✅ next-turn assembly | ✅ same | ✅ same | ✅ next turn | ✅ exact | ✅ exact |

`updateSession` returns per-field results (`applied` / `deferred-to-remint` / `unsupported` / `superseded`) so the engine's telemetry records what actually reached the model — the `_debug.engine` envelope includes this (Req 7.5 honesty).

## 5. Directive transit trade-off (security clarification — supersedes a too-strong first reading of Req 11.4)

On client-direct native voice, the assembled instructions/context MUST transit the browser: the client is the only party holding the provider connection, exactly as today's NAV_CONTEXT/F-I-D injections already transit it. What this does and does not expose:

- **Never leaves the server:** graph structure, edge conditions, intent exemplars, annotations, coverage — a visitor can never learn *why* the conversation state changed or what other states exist.
- **Transits the browser (accepted):** the current node's assembled guidance + context payload, visible to a devtools user (P20). This is equivalent exposure to the existing injection paths and to what a visitor could extract by prompting the model itself. Mint-time prompt secrecy (D3) still holds for the *base* system prompt.
- Rules for the implementer: the directive is applied by the base adapter and **never rendered, persisted, or logged client-side**; `/log` responses carry a directive only when the requesting session is the conversation's live session (the existing session-auth on `/log` covers this — do not add a second auth path).
- If a specific node ever needs truly-secret guidance, the author's tool is the cascade/text runtime (server-side application) — flag this in the editor's help text, don't build a secrecy mechanism.

## 6. Token budget policy (Req 3.3)

Resolution order per node: `static` items (verbatim) → `entity`/`chunk` reads → `search` execution (entry-time, results capped by `limit`) → `fid-scope` directives (these cost ~0; they narrow an existing budget, not add to it). Enforcement: resolve in the node's authored item order, accumulate token estimates (existing estimator; char/4 acceptable here — pre-flight class), and **drop whole items** from the tail once the budget (default 1200 tokens, editor-overridable per node) is exceeded — never truncate inside an item (a half chunk misleads the model). Every drop is recorded in the flush event so replay explains missing context. The editor's live meter uses the same estimator (import, don't duplicate).

## 7. Potential-issues catalog (P-numbers referenced above and from tasks.md)

- **P1 — Engine failure must never break the conversation.** `processTurn`/`startPolicy` are wrapped; on error: log server-side, return null directive, conversation proceeds on its previous state. A graph bug degrades to "the engine stopped steering," never to a failed turn. Test explicitly (unit: evaluator throws → /log 200).
- **P2 — Double evaluation on retry.** `/log` writes are idempotent today; the engine must be too. Gate on `lastEvaluatedTurnId` (§2.2 step 4). Scenario runner asserts: replaying the same turn twice yields one transition and one marker.
- **P3 — Concurrent invocations.** Two serverless instances can process overlapping requests for one conversation. The CAS (§3) makes exactly one transition win; the loser must not write markers or return directives. Do NOT reach for advisory locks or queues — portfolio scale doesn't justify them.
- **P4 — Stale directive application.** Client may receive directives out of order (parallel fetches). `seq` + latest-wins in the base adapter; dropped directives are harmless because every directive is a full snapshot, not a delta.
- **P5 — `always`-edge loops.** Author error: A→B→A with `always`. Validation errors on any `always` cycle; `startPolicy` additionally hard-caps at 3 hops.
- **P6 — Publish during live conversations.** Conversations pin their version at start (§2.1.6). Consequence to state in the editor UI: "changes apply to new conversations." Do not build mid-conversation migration; if the owner ever needs it, it's a new decision.
- **P7 — Gemini mid-session limits.** See §4. Do not silently skip unsupported fields — record `degraded`/`unsupported` per field and surface in `_debug.engine`.
- **P8 — `session.update` is replacement, not patch.** OpenAI replaces the whole instruction string and whole tool array. The directive must therefore always carry the FULL assembled state (base + node), which also makes P4's snapshot semantics work. Never assemble base instructions client-side — the directive arrives fully assembled from the server.
- **P9 — Transcription-delay ordering.** §3; evaluation follows persistence order, accepted one-turn lag, no reordering logic.
- **P10 — Classifier cost/latency.** All `intent`(classifier-confirmed) + `pivot` edges of the current node are scored in ONE gateway-wrapped `default-cheap` call (JSON-forced: `{edgeId: score}`), hard timeout ~2s; timeout/error → those conditions evaluate false this turn (fail-safe: no transition beats a wrong one). Embedding-similarity intent edges don't need the classifier when similarity clears the threshold (default cosine ≥ 0.82, per-edge overridable) — the classifier is the tiebreaker band, not the default path.
- **P11 — Embedding model drift.** Similarity is only meaningful when exemplars and the runtime utterance embed with the SAME model. Version documents record the embedding model id used at publish (§2.3); runtime utterance embedding uses that recorded id (not the current `default-embedding` alias resolution). If the recorded model is no longer available, intent edges degrade to classifier-only for that graph until re-publish; the editor shows a "re-publish to refresh embeddings" banner whenever the recorded id differs from the current alias resolution.
- **P12 — Runtime budget overflow.** §6 drop-whole-items policy; flush event records drops.
- **P13 — PRIVATE leak through `search` items.** `entity`/`chunk` items are validated at authoring, but `search` items resolve at runtime — the visibility filter MUST live in the assembly call (same service-layer exclusion all retrieval uses), never rely on authoring-time checks alone.
- **P14 — Coverage query cost.** Bounded window (default 30 days), filter marker rows by conversation date + `metadata->>'markerType'`; portfolio scale is fine. If it ever measures slow, add a GIN index on the metadata column in a later migration — do not pre-build rollup tables.
- **P15 — Editor id stability & state loss.** Node/edge ids are generated once at creation (cuid/nanoid) and NEVER regenerated by layout, copy/paste (paste = new ids), or re-import — telemetry joins depend on it (Req 1.5). Draft autosaves (debounced PUT) so a canvas crash loses seconds, not sessions.
- **P16 — Scenario flakiness.** `check:scenarios` runs on fakes only: `FakeReasoningAdapter` for classifier calls (scripted scores), the D46 stable-vector embedding fake (exemplars and utterances embed deterministically), no wall-clock dependence (TTL logic takes an injectable clock). A scenario that needs a live model is not a golden scenario — it's a live-fire drill.
- **P17 — Test-tag leakage.** One tagging seam: the session-metadata flag set at session start. Coverage (Req 9.3), analytics, and spend alarms all read the SAME flag — do not implement three exclusion checks.
- **P18 — `latestState` schema evolution.** The engine adds keys to an existing Json blob other code reads. Reads must be tolerant (missing keys = engine inactive); writes must merge, never replace the whole blob (legs code owns other keys). Add `engineStateVersion: 1` inside the engine's keys for future migrations.
- **P19 — Flush timing vs barge-in.** Buffer flushes and directive application happen at turn boundaries only — never while the model is mid-response (OpenAI rejects some `session.update` fields mid-response; and swapping context mid-utterance produces incoherent answers). The base adapter queues a directive that arrives mid-response and applies it when the response completes.
- **P20 — Directive visibility in devtools.** Accepted trade-off, §5. Do not encrypt/obfuscate — it adds complexity with no real secrecy (the payload must reach the provider in plaintext anyway).
- **P21 — Slot-value prompt injection.** `{{slots.x}}` templates user-provided text into prompts. Rules: values are length-capped (default 200 chars), wrapped in clear delimiters with a "data, not instructions" framing, and permitted only in guidance fragments and `static` context items — never in the base-instruction section or tool schemas. A slot named in a template but not declared anywhere is a validation error.
- **P22 — Chips must stay deterministic.** A chip tap carries `chipId` in the turn evidence; a `chip` condition matches on the id alone — no classifier, no embedding, no fuzzy match on the label text. If a chip's `sendText` is edited, the id (and thus the edge) is unaffected. This is the one transition path with a 100% fire guarantee; don't dilute it.
- **P23 — Batches never touch the request path.** Question sampling costs nothing at runtime (it's a post-hoc join over existing rows); embedding, clustering, and conversation summarization run ONLY in the admin-triggered/cron batch endpoints, budget-gated and ledgered like any semantic operation. If a batch is slow, it is allowed to be slow — do not "optimize" by moving work into conversations (owner explicit).
- **P24 — Same-day resume before summarization ran.** The summary-based briefing (Req 17.3) requires a summary that may not exist yet. Fallback ladder: summary + recent verbatim turns → full-transcript briefing (today's D49 behavior). Never block a resume on generating a summary inline.
- **P25 — Lead durability beats notification.** `ConversationLead` row is committed before any notification attempt; notification failures set a visible failed state on the lead (admin badge still shows it) and may retry via the batch path. The visitor-facing confirmation ("I've recorded it") is honest the moment the row commits — it does not depend on the push channel.
- **P26 — One cheap call per turn, still.** Edge scoring (P10), slot extraction (Req 14.1), turn-quality flagging, probe confirmation, and fast profile flags (Req 19.2) all share the SAME single batched `default-cheap` call with one JSON-forced response shape. Adding a second per-turn model call is a design regression; if the combined prompt grows unwieldy, trim what the current node actually needs (only declared slots, only candidate edges) rather than splitting the call. (The Req 19.3 behavior summarizer is the sanctioned exception: separate call, but staleness-gated to ≥60s intervals and async — never per-turn.)
- **P27 — Floating-block position is a hard invariant where the provider permits it.** The passive block lives at the conversation tail: remove + re-append EVERY turn, even bit-identical. Never edit it in place, never leave last turn's copy while adding a new one (duplication), never let it sit mid-history (prefix-cache invalidation on every change + positional drift out of the model's attention). Cost model accepted: the block's tokens are paid ~twice per turn; the long prefix stays cached. Per provider: cascade/text = literal message ordering at assembly (exact); OpenAI Realtime = delete-item + create-item (exact); **Gemini Live = the invariant is unimplementable** (append-only stream — we cannot delete our own block) → versioned supersession instead: send ONLY on change, prefixed "[CURRENT CONTEXT vN — supersedes all previous context blocks]", trusting the model to prefer the latest and native compression to evict stale copies eventually. Consequences accepted on Gemini: stale copies bill until evicted, and positional drift returns — which is precisely why the block re-sends on every *change* rather than every turn there (re-sending unchanged blocks would multiply copies with zero benefit, the inverse of the OpenAI economics). **Deferred refinement (owner, 2026-07-09 — roadmap note, NOT v1):** a finer Gemini strategy exists — send only the *changed categories* of the block, track the provider's compression window, and when a category's last-sent copy falls out of the window, proactively re-send that category's current data. It reduces token waste further but requires modeling Gemini's eviction behavior (stateful bookkeeping that can silently drift from provider reality). Build versioned supersession first; revisit this only if v1 proves lossy in practice (model visibly "forgets" current context on long Gemini sessions) — evidence before machinery.
- **P28 — Rolling-window fidelity is per-provider; re-mint is never the pruning tool.** OpenAI Realtime: `conversation.item.delete` old turn items + insert one summary item (verify at build: deletion limits, ordering, and whether deleted items still bill — the D22 lesson: never trust the docs, drive it). Gemini Live: no item deletion — configure native context-window compression (sliding window) at mint and inject the running summary as text; accept coarser control. Cascade/text: pure assembly-time windowing, trivial. If a provider can't prune in-session at all, the conversation simply runs longer un-pruned until a natural re-mint (recovery/provider switch) — degraded cost, correct behavior; NEVER introduce a pruning re-mint with its audible silence.
- **P29 — Summarizer scheduling in serverless.** There is no resident per-conversation process. The "every minute" cadence is implemented as a staleness check during turn processing: if `now - lastSummaryAt > interval`, fire the summarizer async (fire-and-forget with an in-flight guard in `ConversationState` so concurrent turns don't double-fire) and continue the turn immediately. The summary that lands applies at the NEXT flush — one-turn lag, same accepted race contract as D55. A conversation that goes silent gets its final summary from the batch job (Req 17.2), not from a timer.
- **P30 — Profile is an assessment, not a ledger.** Each summarizer output REPLACES the previous profile wholesale (last-write-wins under its buffer key). Never append assessments or keep a mood history in the block — that's how "the user was rude five minutes ago" haunts a now-friendly conversation. History stays in the transcript for the owner; the model gets only the current read.
- **P31 — Flags must survive being asked about.** The block is model-visible text; a visitor can ask "what do you know about me?" and the model may honestly answer from it ("you mentioned hiring for a firmware role"). Phrase flags as neutral observations, never as instructions to manipulate ("push contact NOW") — anything in the block should be sayable aloud without embarrassing the owner. Manipulative steering belongs nowhere; tonal guidance belongs in node guidance, not the profile.
- **P32 — Continuity marker is a hint, not auth.** The same-device resume marker (localStorage) only selects between auto-resume and confirm-with-summary UX; reflink validation remains the sole access control. A stolen marker without the reflink gets nothing; a valid reflink without the marker gets the confirmation path, never a silent transcript. Marker absence must never lock a legitimate visitor out of resuming — worst case is one extra confirmation tap.
- **P33 — Tripwire scan never touches the critical path.** The word-flag scan (Req 22.1) is pure in-process string matching — no LLM, no network, no DB read beyond the already-loaded config; it runs inside persist and its failure (or a triggered flag) never fails or delays the log write. The investigation launch is fire-and-forget with a per-conversation in-flight guard in `ConversationState` (same pattern as the summarizer, P29) — a flood of flagged turns produces ONE running investigation, not a stampede of reasoning-model calls.
- **P34 — Word matching on voice transcripts will false-positive; that's fine by design.** Transcripts carry STT artifacts, homophones, and innocent contexts ("bomb" in "photo bomb"). Normalize conservatively (case-fold, word boundaries) and do NOT chase cleverness (no fuzzy matching, no leetspeak decoding — word lists are owner-tuned data). The architecture absorbs false positives because the static scan never enforces anything: enforcement flows only from the LLM investigation's verdict, whose whole job is telling "photo bomb" from a threat. Cheap trigger, smart judge, configured executioner — keep the three roles separate.
- **P35 — You cannot hang up a client-direct call; revoke the resources instead.** The server holds no WebRTC socket, so "terminate session" means: mark the conversation/reflink revoked in DB → session validation, `/api/ai/tools/execute`, `/log` acceptance, and future mints all fail closed → send a disconnect directive on the next `/log` response for a compliant client to act on. A malicious client that ignores the directive keeps an open provider connection ONLY until the ephemeral token's duration cap expires, with no tools, no persistence, and no re-mint — neutered, not fooled. Never claim stronger termination than this in admin UI copy.

## 8. What NOT to build (scope guardrails)

- No mid-conversation graph-version migration (P6), no advisory locks/queues (P3), no directive encryption (P20), no rollup tables (P14), no engine-initiated heuristic transitions (§2.2.7), no client-side policy assembly (P8), no second navigation path (Req 6.3), no per-node canned reply text (Req 1.2), no graph schema in Prisma rows (design §2 decision), no speculative multi-graph routing (exactly one active graph; "which graph applies" logic is a future decision, not this spec), no Gemini compression-window tracking (the per-category delta refinement in P27 is deferred until v1 supersession shows real loss — owner-flagged as roadmap, not v1), **no mid-session model switching on native voice** (owner removed it 2026-07-09: no `pendingModelSwap`, no pause scheduling, no swap-driven re-mint — node `modelAlias` is cascade/text data plus mint-time input on native; if you find leftover swap machinery from earlier blocks, delete it, don't extend it).
