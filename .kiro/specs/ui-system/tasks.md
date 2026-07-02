# ui-system — Tasks

**Status:** current
**Owner domain:** theming, component layer, GSAP orchestration, wave hero, layout
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Ledger regenerated from code truth per D36.**

---

## Already implemented (verified on branch)

Light/dark theme system with tokens, persistence, and flicker-free switching; customized shadcn/ui component layer; GSAP orchestration for modal/filter/theme transitions; highlight/spotlight effects consumed by guided navigation; Three.js wave hero with admin config panel (live preview, per-theme palettes, normalized camera) persisted to `HomepageConfig.waveConfig`; desktop-first responsive layouts with mobile adaptations.

## Open tasks

- [ ] 1. Remove public `test-*` pages (D16/D42) — *Phase 3, with the repo-wide hygiene sweep*
  - [ ] 1.1 Delete the ~29 `src/app/test-*` routes (theme/wave/tiptap/animation testbeds)
  - [ ] 1.2 Where a testbed is still genuinely useful, fold it into an admin-gated playground page (at most one per subsystem)
  - _Requirements: Cancelled section; registry D16_

- [ ] 2. Reduced-motion audit — *Phase 3 verification*
  - [ ] 2.1 Verify `prefers-reduced-motion` collapses guided-navigation sequences and wave animation intensity
  - _Requirements: 3.2_

## Backlog

- Animation debug/dev tooling beyond what exists (deliberately frozen — bespoke observability investment capped per proposal §5).
