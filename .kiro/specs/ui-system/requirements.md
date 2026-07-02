# ui-system — Requirements

**Status:** current — implemented
**Owner domain:** theming, customized shadcn/ui layer, GSAP animation orchestration, wave hero, global layout, UI control primitives
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D12 (wave config storage), D13 (no server UI APIs), D14 (desktop-first), D15 (GSAP orchestrator), D16 (test pages removed)
**Contracts:**

| Consumes | From |
|---|---|
| `HomepageConfig.waveConfig` persistence (`/api/admin/homepage/wave-config`) | `admin-cms` (endpoint), `portfolio-core` (model) |

| Provides | To |
|---|---|
| Theme system (light/dark, tokens, persistence) | all UI |
| Customized shadcn/ui component layer | all UI |
| GSAP orchestration utilities, animation registry, highlight/spotlight effects | `portfolio-core` transitions, `ai-assistant` guided navigation |
| Wave hero renderer + admin config panel | homepage, homepage composer |
| Programmatic UI control primitives (scroll, focus, modal open/close, highlight) | `UIManager` (`ai-assistant`) |

Supporting reference docs in this folder: `design-system-guidelines.md`, `component-specifications.md`, `animation-sequences.md`, `ui-design-mock.md` (visual reference material — historical mocks, verify against code before reuse).
Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Theming

**User story:** As a visitor, I want light and dark themes, so that I can view the portfolio comfortably.

1. WHEN switching themes THEN the system SHALL transition smoothly (no flicker/layout shift), persist the preference across sessions, and default to the system preference.
2. WHEN themes apply THEN CSS custom properties/design tokens SHALL drive all components (customized shadcn/ui base), maintaining accessible contrast in both modes.
3. WHEN theme changes THEN all domains (public UI, admin, AI pill, wave hero colors) SHALL update consistently without page refresh. Theme is a **client-side concern — there is no server theme API** (D13).

## Requirement 2 — Component layer

**User story:** As a developer, I want a customized shadcn/ui layer, so that interfaces are consistent and uniquely styled.

1. WHEN building UI THEN components SHALL follow shadcn/ui API patterns with the portfolio's customizations, typed, accessible, and tree-shakeable.
2. WHEN interactions occur THEN components SHALL give immediate visual feedback (hover, focus indicators, loading skeletons, validation states) consistent across domains.

## Requirement 3 — Animation orchestration

**User story:** As a visitor, I want polished coordinated animations, so that the portfolio feels professional.

1. WHEN UI state transitions (modals, page sections, filtering, theme) THEN GSAP SHALL orchestrate entrance/exit/coordination (D15); Framer Motion is permitted only for isolated component animation; 60fps target.
2. WHEN `prefers-reduced-motion` is set THEN the system SHALL respect it with reduced/instant alternatives.
3. WHEN new animation variants are added THEN the system SHALL support registration of custom GSAP sequences (plugin-style), composition, priority/override handling for conflicts, and runtime variant selection.
4. WHEN on mobile THEN complex sequences SHALL simplify or become instant.

## Requirement 4 — AI-guided navigation support

**User story:** As the AI assistant, I want animation and highlight primitives, so that guided navigation feels native.

1. WHEN guided navigation runs THEN the system SHALL execute coordinated transition sequences (target ~0.7s) combining preview growth, modal transitions, and background effects, queueable with interruption handling.
2. WHEN content is highlighted THEN the system SHALL provide spotlight/outline/color-change effects with persistent or timed removal.
3. WHEN sequences run THEN user interaction SHALL be deferred during the sequence and honored afterward; interruptions are reported to the caller (`UIManager`).
4. Ownership boundary: this spec owns the **primitives**; `ai-assistant` owns `UIManager`, semantic IDs, and the `ui_intent` tool semantics.

## Requirement 5 — Desktop-first responsive design

**User story:** As a visitor on any device, I want an optimal layout.

1. WHEN layouts are designed THEN desktop-first (D14) with progressive adaptation; desktop interaction patterns (hover, keyboard) prioritized with touch adaptations.
2. WHEN global layout renders (nav, modals, sidebars) THEN z-index/focus management SHALL be centralized, with proper landmarks and keyboard navigation.

## Requirement 6 — Wave hero

**User story:** As the owner, I want a configurable Three.js wave hero, so that the landing page is distinctive.

1. WHEN the homepage hero renders THEN the system SHALL display the Three.js wave animation, hardware-accelerated at 60fps, with graceful fallback to gradient on failure and simplified rendering on mobile.
2. WHEN configuring the wave THEN the admin panel SHALL offer real-time preview of position, rotation, amplitude, frequency, speed, camera, and per-theme color palettes (primary/valley/peak), persisted to `HomepageConfig.waveConfig` via `/api/admin/homepage/wave-config` (D12 — the standalone `WaveConfiguration` table and `/api/wave-config`/`/api/homepage-settings` variants are **cancelled**).
3. WHEN the admin preview and landing page differ in resolution THEN normalized camera positioning SHALL keep the visual identical.

## Requirement 7 — Performance & maintainability

1. WHEN UI ships THEN bundle impact SHALL be minimized; cumulative layout shift kept near zero; animations profiled.
2. WHEN shadcn/ui or GSAP evolve THEN customizations SHALL be structured for upgradability; hooks and patterns documented.

## Cancelled (D13/D16)

`/api/ui/themes`, `/api/ui/themes/switch`, `/api/ui/animate` server endpoints; public `test-*` showcase pages (removed in Phase 3; at most one admin-gated playground per subsystem).
