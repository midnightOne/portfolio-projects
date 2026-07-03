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
