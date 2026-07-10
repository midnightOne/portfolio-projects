# Architecture, Modularity, Data-Flow, and UX Review

**Review date:** 2026-07-09  
**Scope:** The current material in `docs/` and `.kiro/specs/`. This is a documentation-and-design review, not a fresh source-code or security audit. Claims marked as implemented are treated as claims in the reviewed material unless they were already explicitly verified there.

## Executive assessment

This is a thoughtful, high-ambition design with several genuinely strong architectural choices: explicit domain ownership, a single server-side tool chain, serverless-aware persistence, a real access/cost boundary, and a clear separation between native speech-to-speech and cascade voice. The decision registry and the domain `requirements` / `design` / `tasks` structure are much better than average.

The risk is not a lack of ideas. It is that the project is trying to operate a public, cost-incurring AI product while its operational truth is split across: a canonical spec tree, historical implementation guides, session handoffs, and claims that have not all been re-verified. The public product should not expand materially until the gateway, ledger, verification, and documentation hierarchy are made enforceable and legible.

My recommendation is to treat the next phase as **product hardening and simplification**, rather than adding more conversation-engine scope. Build one observable request-to-ledger path, one published contract layer, one operator console, and a visitor chat experience that is usable without voice.

## What is already strong

| Area | What is working in the design | Why it matters |
|---|---|---|
| Domain boundaries | Each current spec names an owner and consumes/provides contracts. | This gives future work a place to belong and avoids a single giant “AI system” module. |
| Tool/data-access boundary | `UnifiedToolRegistry` → gateway → `BackendToolService` is intended as the common chain for voice, chat, and MCP. | It is the right seam for authorization, visibility filtering, metering, and auditability. |
| Serverless realism | Durable conversation, semantic-operation, and rate-limit state is specified in Postgres; instance-local cache is explicitly non-authoritative. | This avoids the common Vercel failure mode where correctness depends on one warm process. |
| Content architecture | Heading-bounded T0–T3 content, SQL-enforced visibility, and a staged/resumable ingestion model are sound choices. | They improve retrieval quality and make long indexing work recoverable. |
| Voice direction | Native S2S is retained for responsiveness; cascade is treated as an alternate rendering path, not a separate application. | This is a credible way to support provider choice without multiplying product behavior. |
| Verification intent | Fakes, fixtures, debug envelopes, telemetry correlation, and live-fire checks are explicitly specified. | This is exactly the foundation a cost-incurring AI feature needs. |

## Findings and recommendations

### P0 — Establish one enforceable source of truth

The hierarchy is nearly right, but it is not stated unambiguously enough. `ARCHITECTURE_ALIGNMENT_PROPOSAL.md` calls itself the source of truth for direction, while `00-overview/README.md` says the decision registry is the living copy and that specs supersede the frozen proposal. Meanwhile, `docs/` contains older guides that describe a prior admin-editing architecture and literal provider/model configuration.

This is already producing drift: the documentation index says AI coverage is complete and focuses on OpenAI/Anthropic setup, while current specs document Gemini, native S2S, cascade voice, gateway policies, and MCP. Several old API examples use direct model IDs and endpoint contracts that do not match the alias- and gateway-led architecture.

Adopt the following hierarchy and enforce it in CI:

1. **Normative:** `00-overview/decision-registry.md`, then the owning current domain spec.
2. **Executable truth:** typed contracts, migrations, and automated checks in the repository.
3. **Operational guides:** deployment, runbooks, and user/admin docs; each must declare the spec and release/commit it was verified against.
4. **Historical rationale:** proposals, handoffs, article notes, old guides, and archives; never a source of current API or setup instructions.

Add front matter to every current spec and published guide: `status`, `owner`, `verified_at`, `verified_commit`, and `supersedes` / `superseded_by` where applicable. Move or conspicuously label old guides as historical until refreshed. Do not delete useful history; remove its ability to mislead an operator.

### P0 — Make the gateway and the ledger one reliable transaction boundary

The access-and-cost spec correctly makes the gateway the enforcement point and `AIUsageLog` the authoritative spend ledger. However, the MCP design says ledger writes are deferred until after the response for latency, while the access-and-cost design requires the ledger write and watchdog counters to update atomically in the request that crosses the cap. Those two statements cannot both be the authority for a public spend-control system.

Define a single event contract for every AI activity:

```text
request_id / trace_id
  → authorization decision
  → provider or retrieval operation
  → normalized usage result (including zero-cost retrieval)
  → immutable usage event
  → atomic budget/watchdog projection
  → response / asynchronous delivery work
```

Use an idempotency key for every meterable operation. For work that must not lengthen the response, write a durable transactional outbox record before returning and process the notification/analytics asynchronously. The spend record and cap decision must not be “best effort after the response.” If native realtime provider usage is only finalised later, reserve a conservative maximum at mint, reconcile actual usage when the leg closes, and release the difference. Document that policy explicitly.

Also separate three concepts that are currently easy to conflate:

- **Conversation telemetry:** transcripts, legs, tool traces, clip events.
- **Usage ledger:** immutable, attributable billable or quota-consuming events.
- **Operational projections:** daily counters, reflink spend, rate-limit windows, dashboards.

They can share correlation IDs, but no UI or budget rule should infer one from another opportunistically.

### P0 — Ship the verification spine before new conversational intelligence

The verification spec is excellent in intent but declares most of its infrastructure unimplemented. That means the project’s strongest quality rule—“not done without deterministic e2e and live-fire”—is not yet consistently enforceable.

Prioritize these deliverables before the conversation-engine graph, lead capture, cross-session memory, or dynamic question analytics:

1. A deterministic fixture plus fake reasoning, voice, and embedding adapters.
2. `check:gateway`, `check:models`, `check:specs`, and `check:semantic` as required CI gates.
3. Contract tests for every public tool and visibility/access combination.
4. Playwright flows for anonymous text chat, authorized voice, tool-driven navigation, admin save, and watchdog trip/recovery.
5. A release checklist that includes a deliberately budgeted live-fire run.

Every diagram should name the corresponding trace/correlation ID and test. This turns “the architecture says it works” into “this request followed this path and produced these records.”

### P1 — Turn “one tool chain” into a true modular capability platform

The shared `BackendToolService` seam is the correct start, but it risks becoming a god service if it owns dispatch, authorization, input normalization, retrieval, product-specific jobs, MCP presentation, and error mapping. Sharing implementations does not require all consumers to share one transport shape.

Keep one core application service per capability, then make the registry declarative:

| Layer | Responsibility |
|---|---|
| Capability definition | Canonical input/output schema, visibility constraints, side-effect class, latency/cost class, audit event type. |
| Policy adapter | Resolves caller tier, graph node, provider restrictions, and allowlist; never owned by a UI component. |
| Application service | Performs `search content`, `get project`, `analyze job`, or other business operation. |
| Transport adapter | Converts the capability into internal tool calls, MCP tool shapes, admin APIs, or future HTTP clients. |
| Observation adapter | Emits trace, transcript/tool event, usage event, and safe debug payload. |

This preserves the “one backend chain” promise while allowing MCP ergonomics to differ from voice ergonomics. Generate registry descriptions and JSON schemas from typed source definitions; test providers against those schemas rather than maintaining provider-specific schema repair as undocumented behavior.

Make capability metadata explicit: `publicAllowed`, `requiredTier`, `contentVisibility`, `sideEffects`, `maxInput`, `rateBucket`, `expectedLatency`, `costKind`, and `supportsProviders`. The future conversation engine should select capabilities through this metadata rather than reach into implementation modules.

### P1 — Resolve the three-mode “same brain” promise honestly

Text and cascade can use the same reasoning/tool loop. Native OpenAI/Gemini S2S sessions, however, still use provider-specific generation state, prompting, tool schema dialects, interruption behavior, and memory. They cannot promise byte-for-byte—or even necessarily semantically identical—answers today.

Reframe the promise as **shared policy, source grounding, tools, and measurable behavior parity**. For each mode define a small parity suite:

- same access tier and tool allowlist;
- equivalent grounding sources/citations for canonical questions;
- equivalent visibility and refusal behavior;
- successful navigation/tool result handling;
- bounded latency and interruption behavior;
- no internal reasoning or prompt leakage.

Publish a mode-capability matrix in admin and in the visitor UI. It should show what is available now—text, native voice, cascade, interruption, resume, citations—not merely which provider is selected. This prevents configuration from silently advertising a capability a provider cannot satisfy.

### P1 — Simplify data flow around an explicit conversation state model

The specs carry valuable concepts—F-I-D context, session legs, latest state, graph nodes, resume briefings—but the state ownership is described in several places. Make a single versioned `ConversationState` contract that is the sole authoritative snapshot:

```text
conversation_id, visitor/tier binding, mode, active leg,
policy version, active capability set, context-set version,
navigation state, graph node (when enabled), summary version,
last activity, retention/consent state
```

Treat provider session context as a cache derived from that state, as the voice spec already intends. Give all mutations a `state_version` and use optimistic concurrency/idempotency. That makes reconnect, provider switching, graph transitions, and cross-session resume variations of one durable state transition instead of separate special cases.

F-I-D should be declared consistently as an **optional capability**. The design correctly requires sessions with zero injections to remain useful; the system map should not imply it is a mandatory dependency for every adapter or use case.

### P1 — Protect privacy before auto-resume and lead capture

Cross-session resume “for the same reflink” creates an easy privacy failure: a forwarded or shared invitation URL could reveal the prior visitor’s conversation to a new holder. Lead capture introduces a second sensitive data flow but lacks a retention, consent, notification, or deletion contract.

Before either feature ships, specify and implement:

- explicit “resume previous conversation” confirmation with a safe summary, not automatic transcript exposure;
- a visible “start fresh” and “forget this conversation” action;
- reflink binding/revocation and maximum-device/IP behavior that is explained to the owner;
- data classification, retention periods, deletion path, and export/audit rules for transcripts, summaries, uploads, and leads;
- consent language and delivery-failure behavior for lead notifications;
- an admin view that distinguishes operational telemetry from visitor content.

This is product design as much as compliance: it makes the assistant feel trustworthy rather than surveillant.

### P1 — Make public text chat a first-class accessible interaction

The current public UX policy calls for subtitle-style responses above the pill and no persistent public transcript. That can work for a voice-first moment, but it is a poor primary text-chat experience: visitors cannot scan, reread, copy, verify a claim, or recover after a visual navigation transition. It also makes screen-reader interaction and error recovery fragile.

Keep the pill, but provide an expandable session-local conversation panel in text mode:

- semantic message list with keyboard focus, copy, and retry;
- compact source/project cards and “show me where” actions instead of unsupported bare claims;
- a visible working state (“Searching portfolio…”), cancel control, and recoverable error state;
- mode controls that explain voice availability without making anonymous visitors feel locked out;
- a clear disclosure that the session is temporary or resumable, depending on tier.

For voice, subtitles should remain a live accessibility layer, not the only record of the conversation. Pre-recorded fillers must be captioned or announced appropriately and clearly differentiated in telemetry from model speech.

### P2 — Design AI-guided navigation around visitor control, not choreography

The reviewed voice UX notes already identify the main failure: the system can jump the visitor to a section, recite headings, or change context without adding understanding. The underlying architecture has the right primitives; the missing layer is an interaction policy.

Use a three-step navigation pattern:

1. **Orient:** briefly say what is relevant and offer a clear next action.
2. **Stage:** preview/highlight the destination without immediately taking the visitor away from their current reading position.
3. **Commit:** navigate only after explicit intent, except for low-impact highlights.

The answer should lead; movement should support it. Tools should return a human-readable result summary, confidence/relevance, and source anchors—not just a navigation target. Measure tour completion, cancellation, repeated “what do you mean?” turns, and time to useful project detail, rather than only tool success.

### P2 — Reduce admin cognitive load with one operating model

The admin surface is feature-rich but reads as a collection of system controls: model aliases, providers, rate limits, reflinks, semantic operations, content editing, replay/debug, clips, and future graph authoring. The danger is that the owner needs to understand internal topology to perform a simple operational task.

Organize admin navigation by jobs:

- **Publish content:** projects, rich content, media, semantic index health.
- **Operate assistant:** modes/capabilities, model aliases, access/spend, reflinks.
- **Review quality:** conversations, retrieval quality, scenario runs, incidents.
- **Design journeys:** graph, node content, prompts/chips, leads—only when the engine is ready.

On each page, use a safe default, show current effective policy, explain blast radius, and provide a dry-run/preview wherever an action causes model spend or reindexing. The semantic dashboard in particular should prefer a simple health summary and recommended next action over exposing every low-level operation at once.

## Documentation quality findings

| Finding | Impact | Suggested remediation |
|---|---|---|
| The root docs index and several AI/API guides document an older configuration/editor model, literal model IDs, and outdated endpoint contracts. | An operator or future contributor can configure or call the wrong system. | Refresh from canonical contracts or mark as historical; do not keep them in the “Core Documentation” path. |
| Eight current supporting spec files lack the mandatory status header: the semantic batch/chunking deep dives and UI reference files. | Readers cannot know whether a file is current, historical, or a design reference. | Add the standard metadata, or move historical visual/reference material under `_archive`. |
| Current spec files exceed their own ~50 KB cap: `ARCHITECTURE_ALIGNMENT_PROPOSAL.md` and `ai-assistant/tasks.md`. | Important decision and task information becomes hard to review and easy to drift. | Split by subsystem: retain proposal rationale separately; split task ledger into delivery phases or capability areas. |
| Multiple reviewed files contain encoding corruption (`â€¦`, `Â`, `Ã`). | Diagrams, punctuation, and reader confidence degrade; copying content becomes unsafe. | Normalize the repository to UTF-8, add an encoding check, and render-check key docs. |
| Handoffs, article notes, and current guides coexist in `docs/` without a lifecycle taxonomy. | Temporary instructions look like permanent operations guidance. | Use `docs/runbooks/`, `docs/architecture/`, `docs/handoffs/`, and `docs/history/`; link only current runbooks from the docs index. |
| User-facing API documentation is handwritten even though the system has tiered tools and provider adaptations. | Contract drift will recur as routes change. | Generate/reference public API and tool schemas from typed source, with examples tested in CI. |

## Recommended delivery sequence

| Order | Outcome | Exit criteria |
|---|---|---|
| 1 | Documentation authority reset | Every current doc identifies its owner/status; old API/setup material is archived or redirected; index links only verified current guides. |
| 2 | Gateway/ledger correctness | One correlated, idempotent metering path; atomic cap decisions; deferred work uses an outbox; public abuse and watchdog tests pass. |
| 3 | Verification baseline | Fixture/fakes, required checks, and visitor/admin e2e flows are green in CI; live-fire is a deliberate release gate. |
| 4 | Capability contracts | Typed capability catalogue drives internal tools and MCP adapters; provider parity tests and access matrices exist. |
| 5 | Visitor UX consolidation | Expandable accessible text chat, source cards, clear mode states, controlled navigation, and privacy controls ship. |
| 6 | Admin operating console | Task-based navigation, effective-policy summaries, safe defaults, dry runs, and quality-review workflows ship. |
| 7 | Conversation engine | Add graph editing, lead capture, analytics, and cross-session resume only on top of the durable state, privacy, and verification foundations. |

## Source material reviewed

Primary sources included the system map and decision registry under `.kiro/specs/00-overview/`, the architecture alignment proposal, and the current domain specs for `access-and-cost`, `ai-assistant`, `semantic-content`, `portfolio-core`, `ui-system`, `mcp-server`, `verification`, and `conversation-engine`. I also reviewed the AI data-flow guide, deployment guide, documentation index, legacy AI/API guides, handoffs, and the voice UX notes in `docs/`.

The most important conclusion from those sources is positive but conditional: the architecture can become a compelling flagship portfolio piece if its existing seams are made executable and its visitor experience becomes simpler than its internal system. Right now the design is ahead of the product’s operational clarity; the next work should close that gap.
