# ui-system — Tasks

**Status:** current
**Owner domain:** theming, component layer, GSAP orchestration, wave hero, layout
**Last verified against code:** 2026-07-12 (tab-dock revision session)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Light/dark theme system with tokens, persistence, and flicker-free switching; customized shadcn/ui component layer; GSAP orchestration for modal/filter/theme transitions; highlight/spotlight effects consumed by guided navigation; Three.js wave hero with admin config panel (live preview, per-theme palettes, normalized camera) persisted to `HomepageConfig.waveConfig`; desktop-first responsive layouts with mobile adaptations.

## Open tasks

- [ ] 3. **The liquid pill** (owner vision 2026-07-10, extended 2026-07-11 — recorded in conversation-engine `design-ux-and-behavior.md` §9.3 and `docs/article-notes-design-judgment.md` 2026-07-10 + 2026-07-11 sessions; sequencing: conversation-engine Block G is done, so its chips/topic-label/auto-nav-toggle components exist self-contained against the current pill and relocate here):
  - [x] 3.1 **(REVISED, owner 2026-07-12 after v1 review: liquid/metaball vision killed — "I hate it".)** Bottom-edge docking is now the **tab aesthetic**: floating pill = the classic capsule; docked = the outer bottom quarters of the pill radius animate from an internal (convex) radius to an external (concave) radius whose curve flows into the bottom screen edge (browser-tab foot). Still **NO physics, NO shaders** — exact bezier arcs, zero idle animation (`pill-path.ts` + `PillShell`). — *geometry unit-tested (capsule at p=0, merged bottom + tabRadius flare at p=1, monotonic sweep, clamped to bleed); floating capsule driven in-browser; dock-morph visual pending a visible pane.*
  - [x] 3.2 ~~Liquidy dynamic edge rendering for the floating state~~ — **cancelled by the same 2026-07-12 owner revision**: the floating pill is a static capsule; the only ambient motion on the silhouette is the 3.6 gradient stroke.
  - [x] 3.3 Responsive behavior: desktop/tablet share the docked layout; portrait phone gets a tighter fit that stays fully functional. — *phone dims from config; driven at 375×812: pill fits (371px), compact controls, sidebar = full-screen overlay.*
  - [x] 3.4 Transcript sidebar: chat history becomes a proper right sidebar; expanding = the sidebar slides in while the pill's parts animate into their positions at its bottom; floating/docked pill carries only input + mic/hang-up/sound/settings + a recognizable history affordance (floating speech-boxes icon); on mobile the history overlays full-screen for at-a-glance reading, closes to resume navigating. — *implemented (`TranscriptSidebar` + relocate timeline + history/hang-up buttons); open/close state + overlay mode driven; slide/relocate motion drill pending as above.*
  - [x] 3.5 Relocate the Block G components (chips row, topic label, auto-nav toggle, resume-confirm card) into the new pill/sidebar without contract changes. — *relocated verbatim (chips above shell, label above input, toggle in control row, resume card in shell); component contracts untouched.*
  - [x] 3.6 Ambient edge gradient + the page "breathes" when the agent speaks (owner 2026-07-11): the pill edge carries a flowing, multicolored, slowly-shifting gradient (reference: Siri edge glow on recent iOS; Google Gemini) — subtle at idle, present but never distracting. While the agent is SPEAKING (audio output active) the effect extends to the viewport edges as a soft breathing glow, "as if the page itself is speaking"; it recedes back into the pill when speech ends. Same compute budget as 3.1/3.2: **no shaders, no physics** — CSS/gradient (or lightweight canvas) animation sharing the pill's formula clock; palettes derive from theme tokens (both themes, Req 1.2/1.3); `prefers-reduced-motion` collapses it to a static tint (task 2 layers apply). — *implemented (`AmbientSpeechGlow` on `audioState.isPlaying`, shared clock, `--ai-glow-1…4` tokens verified distinct in both themes, reduced-motion tint path); live speaking drill (fake mic) + glow screenshots pending a visible pane.*
  - [x] 3.7 AI-surface layering & modal coexistence (owner 2026-07-11 — **fixes a live defect**): AI surfaces (pill, transcript sidebar, chips, its own overlays) occupy a dedicated top layer of a centralized z-scale (Req 5.2) ABOVE modal overlays. Required behavior: with a modal open, the pill is fully visible and interactive (typing, mic, chips, sidebar); interacting with any AI surface does NOT dismiss the modal (outside-interaction/focus-trap exceptions scoped to AI surfaces only — a click on the true backdrop still closes it); the modal itself keeps normal behavior (Esc, its own controls, scroll lock for page content). Applies to every modal family (project modals, JD modal, admin dialogs). Hash-modal UI-state publishing (e0b1f8e) unaffected. — **driven end-to-end 2026-07-11**: typed into the pill and toggled the sidebar over an open project modal (modal stayed open, focus held), backdrop press + Esc close, scroll lock + release, z-order pill 80 > modal 52, hash + UIManager/UIStateSync events intact. Mechanism recorded in design.md §5.5.
  - [x] 3.8 Iteration architecture (owner 2026-07-11: "this is an aesthetic task, I expect many iterations"): every tunable visual aspect lives in ONE typed visual-config module; components consume it via a provider/hook so a value change is a one-line edit. — **done**: `ai-visual-config.ts` + provider/hook, zero magic numbers in components; `/admin/ai/pill-visuals` playground (36 sliders, live preview, state/dock scrub, breathing preview) driven: override channel verified live (bleedX 56→90→56 across provider), reset + copy-JSON work. Persistence decision (code = source of truth, localStorage overrides as iteration aid) recorded in design.md §5.1.
  - _Requirements: conversation-engine Req 13 surfaces unchanged; this is presentation only. 3.7 touches modal wiring but changes no modal contracts._
  - _Open verification remainder (D46): visual/motion drills that need a rendering Browser pane — dock/undock morph aesthetics, sidebar slide, agent-speaking breathing via fake mic, both-theme screenshots, throttled-frame profile, OS-level reduced-motion toggle (task 2 note applies). The static geometry, states, and behaviors above were driven via DOM assertions._

- [x] 1. Remove public `test-*` pages (D16/D42) — **done 2026-07-06**
  - [x] 1.1 All 40 test/demo/debug page dirs deleted (38 `test-*` + `theme-demo` + `debug-nav-context`)
  - [x] 1.2 Nothing folded — every subsystem already has its D16 admin playground: wave hero → admin wave config panel with live preview; voice → `/admin/ai/voice-debug`; chat → `/admin/ai/debug`. Theme/animation testbeds judged not worth an admin page (theme switching is exercised by the real UI).
  - _Requirements: Cancelled section; registry D16_

- [x] 2. Reduced-motion audit — **code-audited 2026-07-07: three enforcement layers confirmed**
  - [x] 2.1 Wave: `prefers-reduced-motion` → performance 'low' → static fallback render (no Three.js animation at all — stronger than intensity reduction). Guided navigation: GSAP `globalTimeline.timeScale(0.01)` under reduce (with a live change listener) collapses every orchestrated sequence; `globals.css` disables highlight/spotlight transitions/animations under the media query. A browser drill with the OS-level toggle is noted for the verification spec's live checklist (preview tooling cannot emulate the media query).
  - _Requirements: 3.2_

## Backlog

- Animation debug/dev tooling beyond what exists (deliberately frozen — bespoke observability investment capped per proposal §5).
