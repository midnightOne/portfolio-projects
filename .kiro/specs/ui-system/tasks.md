# ui-system — Tasks

**Status:** current
**Owner domain:** theming, component layer, GSAP orchestration, wave hero, layout
**Last verified against code:** 2026-07-07 (Phase 3 consolidation session)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Light/dark theme system with tokens, persistence, and flicker-free switching; customized shadcn/ui component layer; GSAP orchestration for modal/filter/theme transitions; highlight/spotlight effects consumed by guided navigation; Three.js wave hero with admin config panel (live preview, per-theme palettes, normalized camera) persisted to `HomepageConfig.waveConfig`; desktop-first responsive layouts with mobile adaptations.

## Open tasks

- [x] 1. Remove public `test-*` pages (D16/D42) — **done 2026-07-06**
  - [x] 1.1 All 40 test/demo/debug page dirs deleted (38 `test-*` + `theme-demo` + `debug-nav-context`)
  - [x] 1.2 Nothing folded — every subsystem already has its D16 admin playground: wave hero → admin wave config panel with live preview; voice → `/admin/ai/voice-debug`; chat → `/admin/ai/debug`. Theme/animation testbeds judged not worth an admin page (theme switching is exercised by the real UI).
  - _Requirements: Cancelled section; registry D16_

- [x] 2. Reduced-motion audit — **code-audited 2026-07-07: three enforcement layers confirmed**
  - [x] 2.1 Wave: `prefers-reduced-motion` → performance 'low' → static fallback render (no Three.js animation at all — stronger than intensity reduction). Guided navigation: GSAP `globalTimeline.timeScale(0.01)` under reduce (with a live change listener) collapses every orchestrated sequence; `globals.css` disables highlight/spotlight transitions/animations under the media query. A browser drill with the OS-level toggle is noted for the verification spec's live checklist (preview tooling cannot emulate the media query).
  - _Requirements: 3.2_

## Backlog

- Animation debug/dev tooling beyond what exists (deliberately frozen — bespoke observability investment capped per proposal §5).
