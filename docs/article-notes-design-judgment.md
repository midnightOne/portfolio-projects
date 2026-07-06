# Article Source: Design Decisions & Judgment Log

**Purpose:** raw material for the portfolio article about the portfolio itself — the owner's design decisions, intuitions, and UX judgment as expressed during the 2026-07-02 architecture-alignment session, with pointers to where each decision landed in the specs (`.kiro/specs/00-overview/decision-registry.md`, D1–D50).
**Attribution convention:** each entry marks what the owner brought (💡) versus what emerged in collaboration with the AI assistant (🤝). Quotes are lightly cleaned from voice dictation and are paraphrases, not verbatim.
**Audience:** the owner, writing the article. Not a spec; nothing here is normative.

---

## 1. Process judgment: how the migration itself was run

**💡 Ask-then-autonomy.** The owner front-loaded every open decision ("If you have any additional questions before starting, ask them here — because once you start, I want you to run this migration agentically"), answered five open architecture questions plus hosting and git strategy in one pass, then let the agent execute a ~40-file spec rewrite unattended. *Article angle: the productivity of separating decision-making from execution when working with agents — ambiguity is resolved up front, not mid-flight.*

**💡 Two proposal generations, merged rather than picked.** Recognizing that two AI-generated audit documents from different runs would each have unique good points ("they are essentially the same, but generated over different runs — one might have good points the other is missing"), and directing a merge instead of choosing one. *Angle: treating AI outputs as drafts to be reconciled, not oracles.*

**💡 Spec-first, code later.** The entire session produced zero feature code — by design. Decisions became a registry (D1–D50); the registry became rewritten specs; code phases come after, one session each, with the specs as context. *Angle: spec-driven development sized for agent context windows (each spec ≤ ~50KB, one owner per concept, honest status headers) — 2026-style constitution files done deliberately.*

## 2. The five answers (Q1–Q5) — architecture triage

**💡 Q1, Anthropic: keep and fix, not delete.** Cheap to keep, needed for a credible multi-provider showcase — and the frozen capability table claiming Claude had no tool use or vision was factually wrong, so the fix was owed anyway. → D40.

**💡 Q2, the reasoning-model split (the load-bearing answer).** Three distinct intuitions in one answer:
- The realtime voice model is for fast speech, *not* deep thinking — MCP and deep endpoints (job-description ↔ candidate matching) deserve their own admin-selectable model. → D39's `default-reasoning` alias.
- "Since we will allow MCP, I don't want to create clones of all the endpoints. I want to unify and make the chain straightforward" — voice tools and external MCP clients must share one backend chain. → the single `BackendToolService` chain, exposed twice, implemented once.
- **Restraint:** "before we overcomplicate the architecture, I feel like we should probably add adapters first" — and explicitly flagging the voice↔reasoning hand-off as *not ready to decide*. → D41 recorded as an open question with preserved seams, instead of a premature architecture. *Angle: knowing which decisions you're not ready to make is itself a design skill; the spec literally contains a decision whose content is "don't decide yet, but keep these seams."*

**💡 Q3, provider priority from scar tissue.** ElevenLabs demoted to last priority based on direct experience ("it was very hard to make the tool calls for ElevenLabs work"), OpenAI voice primary, Google voice to be added — with the honest caveat that Google's realtime tool-calling is weak and would need harness work or a watchdog. → D22. *Angle: provider strategy driven by lived integration pain, not marketing.*

**💡 Q4, hard delete.** Git history is the archive; no `docs/history/` shuffling for ~23 scripts, ~36 log files, 29 test pages. → D42. *Angle: hygiene decisiveness.*

**💡 Q5, MCP with security as the point.** "It has to be safeguarded very well — for two reasons: the actual security, and to showcase my ability to implement open endpoints in a secure way." Security posture as a *feature with an audience*, not a checkbox. → D30/D43-adjacent hardening; the MCP spec's hardening checklist doubles as the visitor-facing explanation. *Angle: the same table that gates the endpoint becomes the marketing copy — honesty as showcase.*

## 3. Risk management calls

**🤝 Hosting: boring-correct beats consolidation.** Owner's real question ("most of my other work is on Cloudflare — is migrating a good idea?") answered with a recommendation to stay on Vercel (Next.js SSR first-class, OpenNext risk mid-refactor, Turnstile works anywhere); owner accepted. → D43. *Angle: resisting infrastructure consolidation appeal when it stacks risk onto an already-large refactor.*

**💡 Staging over merge.** Rejected the proposal's own Phase 0 (merge to `main`): "I still want main as a fallback that is deployable on Vercel. We will use the current branch as staging, deployed but not at the root domain." → D1 amended. *Angle: never give up a known-good deployable state mid-migration; promotion is a decision, not a side effect.*

## 4. The cascade fork (the standout intuition)

**💡 Independently deriving the industry's native-vs-cascade dichotomy.** The owner noticed that ElevenLabs "under the hood basically uses the same" (an LLM + TTS) and proposed forking the runtime: native realtime voice models on one side; classic LLM on the other, usable as text *or* with a voice layered on top — "chain them so that the answers are the same," and predicted it "should make the tool calls easier" given the ElevenLabs tool-call pain. That is precisely the speech-to-speech vs. STT→LLM→TTS cascade split the industry converged on, derived from first principles plus scar tissue. → D45: `CascadeVoiceAdapter` behind the same interface; ElevenLabs demoted from orchestrator to TTS engine, which removes tools from its hands entirely. *Angle for the article: the best abstraction insight of the whole system — one brain, two renderings; identical answers in text and voice; and the tool-reliability problem dissolved by moving where tools execute rather than fixing where they fail.* (🤝 the latency/turn-taking cost accounting and the "keep native as the flagship, A/B both" framing were collaborative.)

## 5. State ownership (the correcting question)

**💡 "The harness is the ground truth; the voice model is mainly a voice model and a live client."** Asked whether session re-mint was really necessary for context switching, expressing skepticism about restarting voice connections mid-conversation ("I'm not sure it's a very stable thing to do") and proposing instead that the harness/state machine feed the model proper information over the standing connection. Correct on the architecture: `session.update` is a control-plane message, not a reconnect; re-mint is the exception (model/provider swaps at natural pauses). → the state-ownership principle in `ai-assistant/design-voice-adapters.md`. (🤝 the caveat that native sessions retain partially-prunable dialogue memory — so hard purges are approximate on native, exact on the cascade — was the assistant's addition.) *Angle: treating the model's in-session context as a cache of server truth — the same discipline as any distributed system, applied to LLM sessions.*

## 6. Resumable conversations (D49) — reasoning chain worth quoting

**💡 The chain:** "We need reconnection anyway (connection issues force it) → which basically means restarting the session → if we have this functionality, that means we can also re-mint the session with a different provider, even." Recovery machinery and deliberate provider/model switching unified into one code path — capability discovered inside a requirement rather than added as scope. *Angle: the cheapest features are the ones your failure handling already implies.*

**💡 Designing for one's own absence.** The store must serve review "even if I was not in that conversation": full history, tool traces, graph traversal, latest state — and disruptions written *into the conversation timeline* as markers ("at this point the conversation encountered an issue, the type of issue, and then was restarted"). → D49's session legs + `session_disruption`/`session_resumed` markers rendered inline in admin replay. *Angle: observability as UX for the operator — a conversation that failed and recovered reads as one debuggable story.*

## 7. The conversation engine (D47) — steering + flywheel

**💡 Purpose, in the owner's framing:** not just steering. (1) The voice model "is not the most intelligent model, we need to steer it heavily" — prepared context, tools, and best-answer framing for known questions *and known sequences of questions*. (2) "Test out scenarios with myself as the client" — self-play as QA. (3) "Record the bad behavior and review it to add new rules later" — every bad real conversation becomes graph-edit material. *Angle: an admin-editable node graph as an iteration flywheel — run → review traversal + answers → surgical edit → rerun — which is eval-driven prompt engineering given a UI.*

**💡 Forks that purge and switch.** Nodes that change context *and* model when the topic changes — per-node model selection as pure data (cheap model for small talk, reasoning model for deep dives). (🤝 traversal telemetry details — edges-considered-but-not-taken, graph versioning, golden scenario regression tests, annotation loop, coverage heat-map, off-graph-is-normal semantics — were assistant additions layered on the owner's purpose statement.)

**💡 Clarifying the boundary of "canned":** context and framing go to the model; the model always speaks. Which set up —

## 8. Pre-recorded voice assets (D50) — the UX empathy entry

**💡 The insight:** some moments have no model to speak. "Sorry, I'm encountering connection issues, please wait while we attempt to re-establish — which is the literal audio file played from the front end while there is no actual connection with the model." Plus latency fillers ("let me check…") in the agent's own voice while long tool/MCP calls run. *Angle for the article: this is voice-UI craft — the worst moment of the experience (dead air during a dropped connection) covered by the only mechanism that can possibly work there, a client-side clip in the assistant's voice. Pairs with D49: the clip plays over the resume flow.* (🤝 assistant additions: instant filler cutoff on model/user audio, `(voice, phrase)` keying with TTS regeneration on voice change, cold-start greeting, and logging every clip as a `clip_played` history event so replay never mistakes a clip for model speech.)

## 9. The platform vision (D48) — where generic ends

**💡 Modularity as a second showcase.** "It's a way better showcase of engineering skills to have modular architecture you can reuse in different projects" — the agent subsystem itself as a GitHub-worthy artifact, usable in someone else's website "as a test or a business proposition."

**💡 Concrete use cases as boundary probes:** a phone agent with no UI (scripts + node graph + RAG); a drop-in Q&A widget with no UI navigation; the same drop-in *with* per-site custom navigation hooks. And the composability rule stated crisply: "if we omit the passive UI state, the model should still be able to talk and use RAG." Custom features (job/CV comparison) as optional tools, discovered by the engine — never built-in. *Angle: the owner posed the right question ("where does the generic system end and the project-dependent business logic lie?") and supplied the probes that answer it.* (🤝 the litmus-test phrasing "would the phone agent need it?", MCP-as-southbound-bridge for foreign databases, and don't-extract-until-a-second-consumer-exists were collaborative sharpenings of the owner's adapter/bridge intuition.)

## 10. Agentic verification (D46) — treating the AI as a user persona

**💡 The requirement:** "Access points that are authorized for you to agentically test end-to-end all of the functionality you are building on every iteration, so that we don't accrue tech debt" — plus telemetry "either into the same response when you are authorized, or through the telemetry backend," plus "document this approach in CLAUDE.md for transparency and repeatability in different sessions." *Angle — arguably the article's most distinctive section: designing the system with the AI collaborator as a first-class user, with its own authorization model (`_debug` envelope gated in the gateway, stripped for everyone else), its own fixtures and fakes, and its own onboarding doc. Verification as definition-of-done, enforced by making acceptance criteria executable.* (🤝 the mechanism inventory — fakes behind adapter seams, content-hash embedding vectors, fixture expectations file, `check:*` scripts, live-fire runs with capped spend — was assistant-designed to the owner's requirement.)

## 11. Cross-cutting themes (candidate article structure)

1. **Scar tissue → architecture.** ElevenLabs tool-call pain (2025) resurfacing as the cascade fork and provider demotion (2026).
2. **Name the open question; protect its seams.** D41/D47/D48 are decisions *about not deciding*, each with constraints that keep the future option cheap.
3. **One mechanism, many triggers.** Recovery-resume == provider switch (D49); voice tools == MCP tools (D39); semantic IDs serve the AI navigator and the test suite alike.
4. **Server is truth; sessions are caches.** F-I-D replace-don't-append, state snapshots, briefed resumes.
5. **Design for your own absence.** Disruption markers, traversal logs, conversation replay, annotations — the admin panel as a time machine.
6. **The AI agent as user persona.** Authorized introspection, CLAUDE.md as onboarding, verification as DoD.
7. **Fallback-first risk management.** `main` untouched, staging on a branch, kill switches that fail closed, watchdog with manual re-enable only.
8. **Security as showcase.** The MCP hardening checklist that is simultaneously the test plan and the About-page copy.

---

# Session 2026-07-03 — Phase 0 execution & voice/text UX decisions

## 12. Conversation mode is what the user wants, not what the device allows (D51)

**💡 The trigger observation:** watching an automated test, the owner saw a *typed* question get answered *out loud* by the realtime voice model — and immediately generalized: "we definitely have to state manage to understand what the user actually wants and what mode of conversation to use." The rule set: user wants text → text, **even if the mic is available and permitted**; user wants voice → help them with permissions; text-only runs on the reasoning model, not the realtime model. *Angle: mode is intent state, not capability detection — most voice products get this wrong by treating "mic available" as "voice wanted."*

**💡 Graceful degradation ladder for mic permissions:** prompt with a real choice (enable mic / stay text-only) → browser-denied fallback with retry → if a mid-session upgrade turns out impossible, be honest and tell the user to allow the mic and start a voice session. Plus the engineering question asked precisely: *can* one realtime session start mic-less, stream text through the voice endpoints, and attach a live mic later without restarting? Filed as a spike (D52) rather than assumed either way.

## 13. The agent as a voice user: TTS through an emulated microphone (D53)

**💡** "You are definitely not going to talk with the model over microphone" — so give the AI collaborator a dev-only adapter that feeds TTS-generated audio into an emulated mic track, exercising the **real** provider voice path (STT → model → TTS) end-to-end, not a mock. *Angle: extends the D46 "AI as user persona" principle from text to voice — the test harness speaks so the human doesn't have to.*

## 14. Migrations: knowing when history is worthless (D54)

**💡** "All of the current data is mock data so we can collapse all of the migrations into a fresh seed because there is no production database and there is nothing to migrate from." And the operational follow-through: the DDL that Prisma can't express (pgvector, HNSW) must be **automated, not documented** — "we might clear and re-seed the db a lot during development." *Angle: migration history is a liability ledger, not an asset, until there's production data; and any manual step in a loop you'll run daily is a bug.*

## 15. The unified passive-context pipeline (D55) — fragmentation caught early

**💡 The owner's analysis, in sequence:** (1) an inline watchdog LLM adds latency; (2) a parallel watchdog misses the race — the voice model may answer before the passive content arrives; (3) passive context provision is about to exist in three places (per graph state, per UI state, per user query) "and it's starting to get fragmented"; (4) therefore unify **on the pipeline level rather than the function level** — an async buffer that collects the most recent context from all sources and injects/updates the voice model's context at turn end. *Angle: spotting an architecture smell (N context providers, each with its own injection path) before the third instance exists, and choosing bus-style unification over yet another abstraction function.*

**🤝 Assistant judgment layered on (owner asked for it):** accept the race as a *contract* — reactive sources are one turn behind by design, and the fix is making sources *predictive* (graph-state entry pushes content before the question) rather than making reactive sources synchronous; the watchdog is dominated as a retrieval mechanism by the cheaper classifier and the deterministic graph, and its durable role is supervision/QA writing into the same buffer; the buffer's mechanics are a generalization of the already-proven NAV_CONTEXT replace-don't-append pattern; and every buffer flush becomes a D49 history event so admin replay shows what the model knew, and when it learned it.

## 16. Grounding failure diagnosed before being architected around (task 5d)

**💡 The hypotheses, stated as competing:** "maybe the lightweight model is even dumber than I thought... or maybe the pipeline is broken and the system prompt is not getting to it... but also maybe the context injection system is not working." And the design intuition stated before the diagnosis confirmed it: "for a fresh chat there already should be some context injected — the summary about the owner, summaries of all the projects, a short list of categories and tools — so that the model knows to ground itself." **The live experiment proved the intuition exactly:** tool guidance reaches the model and it calls `content_search` correctly on portfolio-scoped questions; the mint route's context injection is a TODO stub, so the model simply doesn't know the content exists. *Angle: the owner held three hypotheses simultaneously and asked for evidence instead of building the fix for the wrong one — the cheap fix (inject the frame) beat both proposed heavy fixes (watchdog, classifier), which were demoted to hedges.*

**💡 Context pushed on state entry, not pulled by the model.** The connection to the D47 graph, in the owner's words: "if this is just the start of conversation, we provide the summaries; but if we are getting into some niche territory, the passive context system might provide proper niche content automatically upon entering that state without relying on the model to ask." *Angle: don't trust a weak model's judgment about when to look things up — make lookup a property of conversation state.*

## 17. The portfolio speaks in first person (public chat voice + lazy queries) — 2026-07-05 session

**💡 The observed failure, owner's account:** asked the public text tier "what can you tell me?" and then "overview", and got "I found an overview for a project titled Task Management App" — one arbitrary project, presented like a search result. "It looks weird because it feels like the AI should be the extension of the portfolio itself speaking from its perspective." The expected answer to both lazy openers is the same: *the owner has done this work, these projects, these technologies — what are you interested in?*

**💡 Lazy queries carry state-dependent intent.** The owner's decomposition: "overview" at conversation start on the homepage means the whole portfolio; the same word while a specific project is open (with no prior conversation) means *that project*; and after a real conversation the agent may need to ask which one is meant. "You should be ready for the users to pose lazy questions and understand the proper intent." *Angle: ambiguous one-word queries aren't a prompt problem, they're a conversation-state problem — the same insight that motivates the D47 node graph (state determines context and framing) and D55 (predictive context pushed on state entry), now confirmed by a real public-tier transcript.*

**💡 Scope discipline, again:** recognizing this as "a substantial task … connected to our later graph-based conversation feature and the in-depth context provision system" and directing that, if now is not the time, the insight be recorded as added context on the owning tasks rather than half-built. The cheap immediate slice (persona framing + start-frame grounding so broad queries get portfolio-level answers) ships now; state-dependent disambiguation waits for D47/D55. *Angle: the same ask-then-autonomy pattern applied mid-phase — triage the insight into "fix the prompt now" vs. "feed the graph later."*

## Appendix: decision → registry map for citations

| Owner idea (this session) | Registry | Spec home |
|---|---|---|
| Reasoning-model layer, unified tool chain | D39 | ai-admin, ai-assistant |
| Keep+fix Anthropic | D40 | ai-admin |
| Hand-off left open | D41 | ai-assistant |
| Voice priority (OpenAI > Google > ElevenLabs) | D22 | ai-assistant |
| Hard delete hygiene | D42 | (Phase 3) |
| Hardened public MCP | D30 | mcp-server, access-and-cost |
| Vercel stays | D43 | 00-overview |
| Specs live with the code | D44 | 00-overview |
| Cascade fork | D45 | ai-assistant |
| Agentic verification + CLAUDE.md | D46 | verification |
| Conversation node-graph engine | D47 | _backlog/conversation-engine.md |
| Modular platform boundaries | D48 | _backlog/agentic-platform.md |
| Resumable conversations, markers | D49 | ai-assistant |
| Pre-recorded voice clips | D50 | ai-assistant |
| Staging-not-merge | D1 (amended) | 00-overview |
| Mode = user intent, text on reasoning model | D51 | ai-assistant (task 5c) |
| Mic-less sessions + permission UX ladder | D52 | ai-assistant (task 5c) |
| Agent voice e2e via TTS→emulated mic | D53 | verification (task 4.4) |
| Fresh-init migrations, automated DDL | D54 | semantic-content (task 7) |
| Unified passive-context pipeline (buffer, turn-end) | D55 | ai-assistant |
| Start-frame grounding (owner+projects summaries) | task 5d | ai-assistant |
| Portfolio speaks first-person; lazy-query intent is conversation state | task 5d / D47 / D55 | ai-assistant |
