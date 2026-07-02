# ui-system — Design

**Status:** current — describes implemented system
**Owner domain:** theming, component layer, GSAP orchestration, wave hero, layout
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. Structure

```
src/lib/ui/theme.tsx        # theme provider, tokens, persistence (client-side only, D13)
src/components/ui/          # customized shadcn/ui components
src/lib/animation/          # GSAP orchestration utilities, sequence registry, highlight effects
src/components/wave/        # Three.js wave hero + admin config panel components
```

## 2. Theming

Theme provider sets a class/data attribute on `<html>`; CSS custom properties define both palettes; `localStorage` persistence with system-preference default; GSAP-coordinated transition to avoid flicker. All components (public, admin, AI pill, wave colors) read tokens — no component-local colors.

## 3. Animation system (D15)

- **Orchestrator:** GSAP timelines for coordinated transitions (modal open/close, filter reflow, theme change, guided navigation).
- **Registry:** named animation sequences registered centrally; variants selectable at runtime; composition supported; conflicts resolved via priority/override; queue with interruption reporting.
- **Guided-navigation primitives:** ~0.7s coordinated sequences + spotlight/outline/color highlight effects with persistent or timed removal, consumed by `UIManager` (`ai-assistant`). Interaction is deferred during a sequence, honored after; interruptions bubble to the caller.
- **Accessibility:** `prefers-reduced-motion` collapses sequences to instant/fade.

## 4. Wave hero

Three.js scene (plane geometry + shader-driven displacement) rendered behind the hero. Config shape (`waveConfig` JSON on `HomepageConfig`, D12): wave params (amplitude, frequency, speed), transform (position, rotation), camera (normalized so preview == landing page at any resolution), per-theme colors (primary, valley, peak). Admin panel edits with live preview; save via `/api/admin/homepage/wave-config`. Failure fallback: static gradient. Mobile: reduced geometry/frame budget.

## 5. Programmatic UI control

Exported primitives (scroll-to with easing, focus management, modal open/close, highlight application) are plain functions/hooks with no AI knowledge. `ai-assistant`'s `UIManager` + `SemanticIDRegistry` compose them into declarative `ui_intent` handling — that composition is specified in `ai-assistant/design-tools-and-context.md`, not here.

## 6. Reference documents

`design-system-guidelines.md`, `component-specifications.md`, `animation-sequences.md`, `ui-design-mock.md` — carried over from the original spec as visual/detail reference. They predate several implementations; where they conflict with code or this design, code wins (they are reference, not requirements).
