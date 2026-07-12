# ui-system — Design

**Status:** current — describes implemented system
**Owner domain:** theming, component layer, GSAP orchestration, wave hero, layout
**Last verified against code:** 2026-07-11 (liquid pill session)

---

## 1. Structure

```
src/lib/ui/theme.tsx        # theme provider, tokens, persistence (client-side only, D13)
src/components/ui/          # customized shadcn/ui components
src/lib/ui/animation.ts     # GSAP orchestration utilities, sequence registry, highlight effects
src/components/wave/        # Three.js wave hero + admin config panel components
src/lib/ui/ai-visual-config*.ts(x)  # liquid-pill visual config: single tunables source + provider (task 3.8)
src/lib/ui/liquid-path.ts   # formula-driven silhouette generator (tasks 3.1/3.2)
src/lib/ui/liquid-clock.ts  # shared formula clock (GSAP ticker; freezes under reduced motion)
src/components/ai/liquid-pill-shell.tsx / transcript-sidebar.tsx / ambient-speech-glow.tsx
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

## 5. The liquid pill (task 3, owner vision 2026-07-10/11)

Presentation-layer redesign of the AI pill; conversation-engine contracts (Req 13
surfaces, chips, resume, mic flow, JD form) unchanged.

### 5.1 Iteration architecture (3.8)

Every tunable visual aspect lives in ONE typed module, `src/lib/ui/ai-visual-config.ts`
(`AIVisualConfig`): liquid-edge formula params, gradient palette + per-state
intensity/rotation, breathing amplitude/spread/rate/attack/release, pill dimensions per
breakpoint, dock/sidebar/relocate morph durations + eases, and the z-layer scale.
Components consume it only through `useAIVisualConfig()` (`ai-visual-config-context.tsx`)
— zero magic numbers in component code.

**Persistence decision:** CODE stays the source of truth. The admin playground
(`/admin/ai/pill-visuals`, this subsystem's one D16 slot; wave-config panel pattern)
writes a `DeepPartial<AIVisualConfig>` override to localStorage; the provider merges it
live (storage event + same-tab custom event), so a homepage pill in another tab of the
admin's browser re-renders instantly. Overrides are an iteration aid local to that
browser — never served to visitors, no DB fetch on the public render path. "Copy JSON"
hands tuned values back for a config edit. (Rejected alternative: HomepageConfig-style
persistence à la D12 — it would put a config fetch on every public page load for a
surface the owner tunes with an agent in the loop anyway.)

### 5.2 The silhouette (3.1/3.2/3.3)

`src/lib/ui/liquid-path.ts` is a pure function (geometry, config, t, dockProgress) →
closed cubic-bezier SVG path (owner budget: formula-driven beziers, NO physics, NO
shaders). Floating = rounded-rect whose outline points breathe with a travelling sine
field; docked = wetted-drop (flat bottom merged with the screen edge, quadratic meniscus
curves flaring outward). Both outlines are sampled uniformly by arc length and paired by
index; the morph staggers per point from the bottom-center outward with the vertical
move leading the horizontal spread — the metaball thin-neck-then-merge read without
simulation. Unit tests pin the geometric contract (`liquid-path.test.ts`).

`LiquidPillShell` applies the same path to the glass surface (`clip-path: path()` on a
backdrop-blurred div) and to an SVG stroke pair (crisp edge + wide soft glow) with a
rotating multicolor gradient (Siri/Gemini reference). Palette = theme tokens
`--ai-glow-1…4` (globals.css, both themes). One `<path>` is updated per frame; two
`<use>` strokes reference it. The frame loop rides `liquid-clock.ts` — one shared GSAP
ticker clock for pill edge + ambient layer; frame-key memoization skips identical frames.
Frame zero renders synchronously on measure (hidden tabs must still show a correct
static pill). Desktop/tablet share the docked layout; the phone breakpoint gets tighter
dimensions (`dimensions.phone`).

Dock state machine (in `floating-ai-interface.tsx`): hero (floating, 30vh) ↔ docked
(position 'pinned', container bottom 0, dockProgress 1) ↔ sidebar (pill relocated to the
transcript sidebar's foot). One GSAP timeline tweens container geometry and dockProgress
together. The container's geometry is GSAP-owned — inline `transition: none` guards it
(a global `[data-testid]:hover` transition rule in mcp-animations.css used to chase the
writes; that selector overreach was removed the same session).

### 5.3 Transcript sidebar (3.4/3.5)

`TranscriptSidebar`: chat history is a right sidebar (desktop; slides in via GSAP) or a
full-screen overlay (below `sidebar.overlayBreakpoint`); the pill relocates to its foot,
keeping only input + mic/hang-up/sound/settings + the speech-boxes history affordance.
`mode: 'expanded'` now means "sidebar open" — the wrapper contract is unchanged. Block G
components relocated as-is with no contract changes: `EngineChipsRow` floats above the
shell inside the pill container (§9.1 choreography intact), `EngineTopicLabel` sits above
the input, the auto-nav toggle stays in the control row, the resume-confirm card and mic
prompts render inside the shell.

### 5.4 Ambient speech presence (3.6)

`AmbientSpeechGlow`: fixed, pointer-events-none viewport-edge layer on `zLayers.aiAmbient`.
Speaking signal = `state.audioState.isPlaying` from the conversational-agent provider
(speech_start/speech_end). GSAP attack/release envelope × sine breath at `rateBpm`; two
gradient layers cross-fade for color flow — every animated property is opacity
(compositor-only). Reduced motion: fixed gentle tint at `reducedMotionOpacity`; the
shared clock freezing also stills the pill edge and gradient rotation (third enforcement
layer beside task 2's GSAP timeScale + globals.css media query).

### 5.5 Z-layer scale & modal coexistence (3.7, Req 5.2)

`Z_LAYERS` (ai-visual-config.ts) is the app's stacking contract: nav 40 < modalOverlay 50
< modalContent 52 < aiAmbient 70 < aiSidebar 78 < aiPill 80 < aiOverlay 90 (JD modal,
access card). dialog.tsx, enhanced-dialog.tsx, animation.ts's runtime overlay/card-growth,
the pill, sidebar, glow, and JD modal all read it; the dev fake-mic panel stays above
everything by design.

**Coexistence mechanism (the owner's "AI UI always on top" ruling):** Radix dialogs run
NON-modal (`modal={false}` default in both wrappers) so there is no body pointer-events
lock and no focus trap. The Content element itself is the full-viewport scrim (page
content stays dimmed + pointer-blocked; consumer className/style now land on an inner
panel div). Dismissal paths: Esc (Radix DismissableLayer, unchanged), the close button,
and a pointerdown on the true backdrop (Content handler → hidden `DialogPrimitive.Close`).
Outside interactions are re-scoped: events originating inside `[data-ai-surface]`
(pill root, transcript sidebar, JD modal, access card, dev panel) `preventDefault` the
dismissal; `onFocusOutside` always prevents, so focusing the pill input never closes a
modal. Scroll lock + scrollbar compensation are re-implemented in the wrappers (nesting-
safe counters); `aria-modal="true"` is set manually so PAGE content keeps modal semantics
for assistive tech — the AI layer is deliberately presented as a separate companion
surface. Accepted tradeoff (recorded): keyboard Tab can reach scrim-covered page content
(no focus trap); pointer cannot. Admin sheets (sheet.tsx) stay modal — no AI surface
exists on admin pages. Hash-modal publishing (e0b1f8e) is untouched and was re-verified
(UIManager modal stack + UIStateSync events fire; hash clears via history.back).

## 6. Programmatic UI control

Exported primitives (scroll-to with easing, focus management, modal open/close, highlight application) are plain functions/hooks with no AI knowledge. `ai-assistant`'s `UIManager` + `SemanticIDRegistry` compose them into declarative `ui_intent` handling — that composition is specified in `ai-assistant/design-tools-and-context.md`, not here.

## 7. Reference documents

`design-system-guidelines.md`, `component-specifications.md`, `animation-sequences.md`, `ui-design-mock.md` — carried over from the original spec as visual/detail reference. They predate several implementations; where they conflict with code or this design, code wins (they are reference, not requirements).
