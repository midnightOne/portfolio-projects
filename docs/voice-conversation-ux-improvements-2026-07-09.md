# Voice conversation UX — improvement suggestions (2026-07-09)

**Source:** owner review of voice session `cmrdzlwcf0001w5dctm00yiwn` (Gemini Live leg, 31 msgs) + code analysis of the harness (mint route TOOL_GUIDANCE, start frame, `content_search`/`content_get`, NAV_CONTEXT/F-I-D, conversation-engine spec).
**Status:** suggestions, not a spec. Where a suggestion belongs to an owning spec, the pointer is given. The three transcript complaints each get: observed behavior → root cause in the harness → fixes (interim prompt/tool fixes vs. conversation-engine-era fixes).

---

## 1. "Can you just show me around?" → one hop to the projects section, then stalled

**Observed:** the model executed a single `ui_intent` (route: projects), said "let's start by looking at some of the featured projects," and immediately handed the wheel back ("Is there anything specific you're hoping to see?"). A tour request became a single navigation.

**Root cause:** the harness has no concept of a tour. `TOOL_GUIDANCE` (google/session route) covers search honesty, latency, and navigation mechanics — but nothing describes multi-stop behavior, so the model's safest interpretation of "show me around" is one hop. Note the material for a tour already exists: the start frame carries every project's T1 summary plus the technology list, and `ui_describe` exposes the section inventory. The model has the map; it was never told a tour is an itinerary, not a destination.

**Fixes:**

- **S1 (interim, prompt — cheap, do now).** Add a `GUIDED TOUR` block to `TOOL_GUIDANCE`:
  - "Show me around" / "give me a tour" means a **standing multi-stop itinerary**, not one navigation. Announce the route in one sentence (e.g. "I'll walk you through the main sections, then two featured projects"), then advance **one stop per conversational beat**: navigate, narrate the stop from its summary (start frame T1s for projects), and offer a short check-in ("more here, or next stop?").
  - The tour stays open across turns: after answering a side question, offer to resume where the tour left off.
  - A sensible default route: hero/intro → projects grid → 2–3 featured projects (pick from the start frame) → about → contact.
- **S2 (engine-era).** A tour is precisely a conversation-engine node (spec Req 1, 3, 6): a `tour` node entered by an intent-match edge from the start node, whose context set = all T1 summaries + section anchors, whose guidance = itinerary + per-stop talking points, with on-enter navigation *suggestions* (Req 6.4 — the model decides, never forced). Side-question → off-graph → re-entry edge resumes the tour: exactly the "lattice, not a cage" semantics already specced (Req 2.5). S1's prompt text becomes this node's guidance verbatim — nothing thrown away.

---

## 2. "Show me the highlights" → headings recited, zero substance

**Observed:** the model navigated to `feature-highlights` and said the section "will show you the main features… covering product management, the shopping experience, and payment processing" — i.e., it read the headings back. Nothing about what any highlight actually *is*.

**Root cause (three layers, all verified in code):**

1. **The search payload is thin for T2 results.** `ContentSearchService` builds `oneLiner` as the T1 content only when the matched chunk *is* tier 1; for a tier-2 (headings) chunk it falls back to the bare title (`ContentSearchService.ts:1508–1510`), and the 240-char `snippet` of a headings chunk is… heading text. The model was handed exactly what it spoke.
2. **No "get before you present" rule.** Nothing in `TOOL_GUIDANCE` tells the model that presenting a section requires `content_get` first; if anything, the latency-awareness section nudges toward fewer round-trips.
3. **Landing on a section teaches the model nothing.** NAV_CONTEXT/F-I-D after navigation carries `visibleSections` (ids) and `projectSummary` — not the visible section's content. Post-navigation, the model still knows only the headings.

**Fixes:**

- **S3 (tool payload — highest leverage, do now).** Give every T2/section result a real `gist`: the nearest T1 summary for that section group, or the first ~200 chars of its child T3 content. One added field, zero extra round-trips — this is the "tools sized for the dumbest consumer" doctrine (judgment log §16) applied to `content_search`. A realtime voice model will speak whatever the result hands it; hand it substance. (Owner spec home: `semantic-content` / tool contracts in `ai-assistant`.)
- **S4 (prompt).** Add a `PRESENTING CONTENT` rule to `TOOL_GUIDANCE`: *before describing a section you navigated to, if all you hold is headings/titles, call `content_get` on the result id and speak from the content — never narrate a heading list as if it were the content.* Per the measured latency table `content_get` is in the act-silently band, so this costs nothing perceptible.
- **S5 (harness, D55-aligned).** "What's on screen is in the model's head": when `ui_intent` lands on a section, push that section's budgeted T2+T3 content into the context buffer as part of the NAV_CONTEXT refresh (replace-don't-append, engine-owned key later). This is the conversation-engine's push-on-entry (Req 3.1) triggered by *navigation* instead of node entry — building it now against the D55 buffer means the engine inherits it rather than replacing it. After S5, the model can converse about any visible section with zero tool calls.

---

## 3. "Show me more in-depth" → silent jump to a different section

**Observed:** while parked on `feature-highlights`, a deictic follow-up ("show me more in-depth") was treated as a fresh search; the top hit was `performance-and-scalability` and the model navigated there without a word of confirmation. The owner's expectation: "more in-depth" refers to *what we were just discussing*; and when an utterance is genuinely ambiguous, clarify first, then navigate.

**Root cause:** no guidance covers anaphora/ellipsis, and the existing guidance actively biases toward decisive action ("NAVIGATE FROM ANYWHERE", act-silently latency rules) with honesty rules about *relevance* only, not *ambiguity*. Semantically, "more in-depth" genuinely gravitates to technical-depth sections, so unscoped search will reliably reproduce this failure. `content_search` accepts `uiState` for context-aware ranking, but whatever same-section bias exists did not beat the semantic score here.

**Fixes:**

- **S6 (prompt — do now).** Add a `FOLLOW-UPS AND AMBIGUITY` block to `TOOL_GUIDANCE`:
  - Bare follow-ups ("more", "go deeper", "tell me more", "show me more in-depth") refer to the **current topic/section**. Deepen in place: `content_get` the current section's chunks, or search scoped to the current project and section. Do not navigate away on a bare follow-up.
  - If leaving the current section genuinely seems right, **say where you're going and why before going**, or ask a one-line clarifying question ("Deeper into the highlights, or the technical architecture?"). Trigger condition, stated concretely so a voice model can apply it: *the utterance names no new topic AND the top result's navTarget is not the section you're on* → clarify instead of navigating.
  - This is the ambiguity sibling of the existing RELEVANCE HONESTY rule and should sit next to it.
- **S7 (retrieval).** Deictic-query handling in the tool chain (`BackendToolService`): when the query contains no content nouns and `uiState.currentProject`/current section are present, auto-scope the search (or heavily boost same-section/child chunks) before the semantic score gets a vote. Also worth verifying with a debug session that the voice model actually *passes* `uiState` on these calls — the schema makes it optional.
- **S8 (engine-era).** This is what the specced `explicit-pivot detection` edge condition (Req 2.4) is for: a conversation parked in a section node *stays there* unless an edge detects a real pivot; an ambiguous utterance fires no edge, the node's guidance says "deepen or clarify," and the failure mode becomes structurally impossible rather than prompt-discouraged.

---

## 4. The graph chaperone — how the engine relates to all of this

The owner's framing in this review — *"I don't want it rigid; the user leads, the system provides context so the model entertains better"* — is already the conversation-engine spec's stated semantics, worth affirming explicitly:

- Off-graph is normal operation, never an error; the graph is "a lattice, not a cage" (Req 2.5).
- Prepared context **biases**, it never walls off RAG (Req 3.5); node tool allowlists can't remove baseline retrieval (Req 3.5/4.1).
- No canned verbatim replies — nodes carry grounded framing only (Req 1.2).
- Navigation suggestions on node entry are guidance the model may decline (Req 6.4).

All three transcript failures map onto engine features (tour node → S2; push-on-entry context → S5 generalized by Req 3.1; pivot-vs-deepen → S8). **But none of the fixes should wait for Phase 6.** The prompt fixes (S1, S4, S6) are a single-file edit to `TOOL_GUIDANCE` in the mint route(s); the payload fixes (S3, S7) improve the shared tool chain that text chat and MCP consumers also use; S5 rides the D55 buffer the engine lists as its own prerequisite. Everything here becomes engine *input* (node guidance text, context-set mechanics, edge conditions) rather than throwaway work — which is also the argument for doing the cheap versions first and letting real transcripts tell us what the graph's first nodes should be.

## 5. Minor observation (not owner-raised)

The "Let me take a look." clip played 4× in ~90 seconds — identical wording each time. Suggest rotating among 3–4 equivalent clips per category (the D50 clip system already keys by `(voice, phrase)`, so a category → phrase-list indirection is small), and suppressing the clip entirely for tool calls the latency table classifies as instant.

## 6. Suggested order of attack

| # | Change | Where | Size |
|---|--------|-------|------|
| S6 | Follow-up/ambiguity guidance | `TOOL_GUIDANCE` (google + openai mint routes) | prompt edit |
| S4 | "content_get before presenting" rule | same | prompt edit |
| S1 | Guided-tour guidance | same | prompt edit |
| S3 | `gist` on T2 search results | `ContentSearchService` formatter | small code |
| S7 | Deictic auto-scoping + verify uiState is passed | `BackendToolService` / debug session | small code |
| S5 | Section content pushed on navigation (D55) | NAV_CONTEXT/F-I-D pipeline | medium; engine prereq anyway |
| S2/S8 | Tour node, pivot edges | conversation-engine Phase 6 | already specced |

The three prompt edits (S6/S4/S1) are one session including a fake-mic verification pass (D53) replaying this exact transcript's asks: "show me around", "show me the highlights", "show me more in-depth" — each now has a concrete expected behavior to assert against.
