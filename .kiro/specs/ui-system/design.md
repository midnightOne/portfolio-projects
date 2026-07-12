# ui-system — Design

**Status:** current — describes implemented system
**Owner domain:** theming, component layer, GSAP orchestration, wave hero, layout
**Last verified against code:** 2026-07-12 (tab-dock revision session)

---

## 1. Structure

```
src/lib/ui/theme.tsx        # theme provider, tokens, persistence (client-side only, D13)
src/components/ui/          # customized shadcn/ui components
src/lib/ui/animation.ts     # GSAP orchestration utilities, sequence registry, highlight effects
src/components/wave/        # Three.js wave hero + admin config panel components
src/lib/ui/ai-visual-config*.ts(x)  # AI-pill visual config: single tunables source + provider (task 3.8)
src/lib/ui/pill-path.ts     # capsule + tab-dock silhouette generator (task 3.1, rev 2026-07-12)
src/lib/ui/ambient-clock.ts # shared ambient clock (GSAP ticker; freezes under reduced motion)
src/lib/voice/output-level-meter.ts # agent output-audio level taps (drives the speech glow)
src/components/ai/pill-shell.tsx / transcript-sidebar.tsx / ambient-speech-glow.tsx
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

## 5. The AI pill (task 3, owner vision 2026-07-10/11; tab-dock revision 2026-07-12)

Presentation-layer redesign of the AI pill; conversation-engine contracts (Req 13
surfaces, chips, resume, mic flow, JD form) unchanged.

### 5.1 Iteration architecture (3.8)

Every tunable visual aspect lives in ONE typed module, `src/lib/ui/ai-visual-config.ts`
(`AIVisualConfig`): tab-dock shape params, gradient palette + per-state
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

### 5.2 The silhouette (3.1/3.3) — tab dock (owner revision 2026-07-12)

The liquid formula edge shipped 2026-07-11 was killed by the owner on first review
("I hate it"). The silhouette is the classic capsule again, and docking is the **tab
aesthetic**: the outer bottom quarters of the pill radius animate from an internal
(convex) radius to an external (concave) one whose curve flows into the bottom screen
edge — a browser-tab foot, sharp horn tips where the fillets meet the baseline.

Same-day second revision (owner): the foot radius is **derived, not configured** — it
matches the top radius and the two arcs meet at exactly mid-height (the concave curve
starts where the top corner ends; zero-length side between them on the nominal pill).
`dockedCornerRadius` = min(dockedHeight/2, w/2, cornerRadius + bottomPad, bleedX − 1);
taller content (prompt cards, the two-row sidebar layout) caps out and keeps straight
sides. And the flip is **deferred**: `shape.dockMorphStart` (default 0.8) remaps dock
progress so the pill descends as a pure capsule and only transforms in the tail of the
travel ("the pill flows as a pill most of the time and when it's almost at the bottom —
the shape transforms").

`src/lib/ui/pill-path.ts` is a pure function (geometry, `shape` config, dockProgress) →
closed SVG path from exact cubic-bezier arcs — no sampling, and **no idle animation**:
the path rebuilds only while the dock morph tweens or the shell resizes. Each bottom
corner is one cubic whose endpoints/controls interpolate between the convex quarter-arc
(radius = capsule R) and the concave fillet (radius = the derived docked radius);
mid-morph the corner passes through nearly-straight — the radius visibly "flips"
outward. Unit tests pin the contract (`pill-path.test.ts`).

`PillShell` applies the path to the glass surface (`clip-path: path()` on a
backdrop-blurred div) and to an SVG stroke pair (crisp edge + wide soft glow) with a
rotating multicolor gradient (Siri/Gemini reference, task 3.6 — kept). Palette = theme
tokens `--ai-glow-1…4` (globals.css, both themes). The gradient rotation rides
`ambient-clock.ts` — one shared GSAP-ticker clock for pill edge + breathing layer,
frozen under reduced motion. Frame zero renders synchronously on measure (hidden tabs
must still show a correct static pill). Desktop/tablet share the docked layout; the
phone breakpoint gets tighter dimensions (`dimensions.phone`).

Dock state machine (in `floating-ai-interface.tsx`): hero (floating, 30vh) ↔ docked
(position 'pinned', container bottom 0, dockProgress 1) ↔ sidebar (pill relocated to the
transcript sidebar's foot). One GSAP timeline tweens container geometry and dockProgress
together. The container's geometry is GSAP-owned — inline `transition: none` guards it
(a global `[data-testid]:hover` transition rule in mcp-animations.css used to chase the
writes; that selector overreach was removed the same session).

Override hygiene (learned 2026-07-12): playground overrides are stored in a versioned
envelope (`AI_VISUAL_CONFIG_VERSION`); a version mismatch discards the override — a
liquid-era override had survived the schema swap in the owner's browser and silently
shadowed the new defaults.

### 5.3 Transcript sidebar (3.4/3.5) — co-existence revision 2026-07-12

`TranscriptSidebar`: chat history is a right sidebar (desktop; slides in via GSAP) or a
full-screen overlay (below `sidebar.overlayBreakpoint`). **Desktop co-existence** (owner
2026-07-12): the sidebar never covers the page — the page content is pushed narrower by
`sidebar.width` (GSAP tween on `document.body` padding-right, same duration/ease as the
slide), "as if the window were resized". Body padding is exclusively the sidebar's: the
modal scroll-lock compensates the scrollbar on `documentElement` (§5.5), so the two
never fight. On phones there is no room to co-exist, so the history temporarily covers
the screen and stays one tap from closed (history toggle in the pill / the X).

**The pill becomes an integrated PANEL at the sidebar's foot** (same revision, second
iteration — the floating capsule inside a rectangular panel wasted the corners, and the
first fix's docked-tab form still spent too much width on outlines): in expanded mode
the shell morphs to a rounded-corner rectangle close to the sidebar's own shape
(`shape.panelRadius`, default 16; `PillShell panel` prop tweens cornerRadius and
collapses the bottom pad so the glass reaches the shell bottom), inset 8 px from the
sidebar/viewport edges — only the corners give up space. Stack inside the sidebar, top
to bottom: **chips above the shell → topic line → the classic input line with a
paper-plane send button on the right → the remaining buttons and switches** on the line
below in pill-form order (status indicators, sound, auto-nav, settings, history,
hang-up, then a compact mic — the send button owns the input row's end in this form).
One JSX definition per piece; the two layouts only compose them differently.

`mode: 'expanded'` still means "sidebar open" — the wrapper contract is unchanged. Block
G components relocated as-is with no contract changes: `EngineChipsRow` floats above the
shell inside the pill container (§9.1 choreography intact), `EngineTopicLabel` sits above
the input, the auto-nav toggle stays in the control row, the resume-confirm card and mic
prompts render inside the shell.

### 5.4 Ambient speech presence (3.6) — audio-reactive revision 2026-07-12

`AmbientSpeechGlow`: fixed, pointer-events-none viewport-edge layer on `zLayers.aiAmbient`.
Speaking signal = `state.audioState.isPlaying` from the conversational-agent provider
(speech_start/speech_end) gates a GSAP attack/release envelope. Inside the envelope the
opacity **oscillates with the actual audio intensity** (owner 2026-07-12; the glow is
also much smaller — `spread` 120 → 44): `src/lib/voice/output-level-meter.ts` is a
provider-agnostic singleton the visual layer polls per ambient-clock frame; each voice
adapter taps its playback path into it (OpenAI = the WebRTC audio element's MediaStream
via a meter-only AudioContext; Google Live / cascade = an AnalyserNode on their playback
GainNodes). Level × `breathing.audioLevelGain`, floored by `floorRatio`; instant attack,
~180 ms release in the meter. With NO tap registered (preview rigs, no session) it falls
back to the old sine breath at `rateBpm`. Two gradient layers cross-fade for color flow —
every animated property is opacity (compositor-only). Reduced motion: fixed gentle tint
at `reducedMotionOpacity`; the shared clock freezing also stills the pill edge and
gradient rotation (third enforcement layer beside task 2's GSAP timeScale + globals.css
media query).

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
