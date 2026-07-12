/**
 * AI visual configuration — the single source of every tunable visual aspect
 * of the liquid pill and its satellite surfaces (ui-system task 3.8; owner
 * 2026-07-11: "this is an aesthetic task, I expect many iterations, so
 * architect it in a way that allows us to change the animations, the sizes,
 * the edge, and the other important visual aspects of it easily").
 *
 * Rules of the module:
 *  - NO component may hardcode a value that lives here. Components consume the
 *    config through `useAIVisualConfig()` (ai-visual-config-context.tsx); the
 *    z-layer scale is also importable statically for non-React call sites.
 *  - Code is the source of truth (decision recorded in ui-system design.md):
 *    the admin playground applies live overrides through the provider and can
 *    export the result as code, but nothing persists server-side — the public
 *    render path never fetches visual config.
 *  - Everything is plain serializable data so the playground can diff/export.
 */

// ---------------------------------------------------------------------------
// Z-layer scale (Req 5.2 — centralized z-index management)
// ---------------------------------------------------------------------------

/**
 * The stacking contract for the whole app (owner 2026-07-11: "the AI UI
 * should be always on top"): page chrome < modal layer < AI layer < AI-owned
 * overlays. Radix dialogs and the project/JD/admin modal families read the
 * modal band; every AI surface (pill, transcript sidebar, chips, ambient
 * glow) sits ABOVE the modal band so a modal never covers or deadens it.
 */
export const Z_LAYERS = {
  /** Page-level chrome: sticky nav, header. */
  nav: 40,
  /** Modal band: Radix dialog overlays + content, project modals. */
  modalOverlay: 50,
  modalContent: 52,
  /** Ambient speech glow — above modals so the page "speaks" over them, below interactive AI. */
  aiAmbient: 70,
  /** Transcript sidebar (slides under the pill's edge). */
  aiSidebar: 78,
  /** The pill itself + chips + topic label. */
  aiPill: 80,
  /** AI-owned overlays: JD intake modal, access-message card. */
  aiOverlay: 90,
} as const;

export type ZLayerName = keyof typeof Z_LAYERS;

// ---------------------------------------------------------------------------
// Liquid edge (tasks 3.1/3.2)
// ---------------------------------------------------------------------------

export interface LiquidEdgeConfig {
  /** Control points sampled around the silhouette (more = smoother, costlier). */
  points: number;
  /** Peak outward/inward displacement of the floating edge, px. */
  amplitude: number;
  /** Full waves around the perimeter (integer keeps the loop seamless). */
  wavelength: number;
  /** Radians/second the wave field advances — the shared formula clock rate. */
  speed: number;
  /** 0..1 per-point phase scatter; 0 = perfectly regular wave, 1 = organic wobble. */
  wobble: number;
  /** Amplitude multiplier while docked (the wetted drop sits calmer). */
  dockedAmplitudeScale: number;
  /** Extra horizontal spread of the wetting meniscus at full dock, px per side. */
  meniscusSpread: number;
  /** Height of the meniscus contact curve above the screen edge, px. */
  meniscusHeight: number;
  /**
   * Stagger window (0..1 of the dock morph) between the bottom-center points
   * leaving first and the outer points following — this produces the
   * thin-neck-then-merge reading (§9.3: metaball aesthetic, no physics).
   */
  neckStagger: number;
  /** Fraction of pill width that droops into the neck bump early in the morph. */
  neckWidthRatio: number;
  /** How far the neck tip reaches down, px, before the merge completes. */
  neckDepth: number;
}

// ---------------------------------------------------------------------------
// Ambient gradient + breathing (task 3.6)
// ---------------------------------------------------------------------------

export type AgentVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface GradientStateStyle {
  /** Stroke opacity of the pill-edge gradient in this state (0..1). */
  intensity: number;
  /** Gradient rotation speed, degrees/second. */
  rotationSpeed: number;
  /** Stroke width of the visible gradient edge, px. */
  strokeWidth: number;
  /** Width of the soft glow stroke behind it, px (0 disables). */
  glowWidth: number;
  /** Glow opacity (0..1). */
  glowOpacity: number;
}

export interface GradientConfig {
  /**
   * Palette as CSS color stops. Theme-token-derived by default (Req 1.2/1.3):
   * anything `var(--…)` resolves against the active theme at render time.
   * Order matters — stops are distributed evenly around the gradient.
   */
  palette: string[];
  /** Optional dark-theme palette override; null = same palette both themes. */
  paletteDark: string[] | null;
  /** Per-state styling. */
  states: Record<AgentVisualState, GradientStateStyle>;
  /** Static tint opacity under prefers-reduced-motion (gradient frozen). */
  reducedMotionIntensity: number;
}

export interface BreathingConfig {
  /** Peak opacity of the viewport-edge glow while the agent speaks (0..1). */
  amplitude: number;
  /** How far the glow reaches into the viewport, px. */
  spread: number;
  /** Breaths per minute while speaking. */
  rateBpm: number;
  /** Seconds for the glow to swell in when speech starts. */
  attackSeconds: number;
  /** Seconds for the glow to recede when speech ends. */
  releaseSeconds: number;
  /** GSAP ease names for attack/release. */
  attackEase: string;
  releaseEase: string;
  /** Floor opacity between breaths (keeps presence without pulsing to zero). */
  floorRatio: number;
  /** Under prefers-reduced-motion: fixed opacity while speaking (0 = disabled). */
  reducedMotionOpacity: number;
}

// ---------------------------------------------------------------------------
// Dimensions & morph timing (tasks 3.1/3.3/3.4)
// ---------------------------------------------------------------------------

export interface PillDimensions {
  /** Max content width of the pill, px. */
  maxWidth: number;
  /** Base silhouette height of the collapsed input row, px. */
  height: number;
  /** Horizontal bleed margin for edge wobble/meniscus, px per side. */
  bleedX: number;
  /** Top bleed margin for edge wobble, px. */
  bleedTop: number;
  /** Floating rest distance from the bottom edge, px. */
  floatingBottom: number;
  /** Hero-position distance from the bottom edge (vh units). */
  heroBottomVh: number;
}

export interface ResponsiveDimensions {
  /** Desktop + tablet share the docked layout (task 3.3). */
  desktop: PillDimensions;
  /** Portrait phone: tighter but fully functional. */
  phone: PillDimensions;
  /** Viewport width below which the phone dimensions apply, px. */
  phoneBreakpoint: number;
}

export interface MorphConfig {
  /** Dock (float → wetted drop) duration, seconds, and GSAP ease. */
  dockDuration: number;
  dockEase: string;
  /** Undock duration/ease. */
  undockDuration: number;
  undockEase: string;
  /** Sidebar slide-in/out duration, seconds, and ease. */
  sidebarDuration: number;
  sidebarEase: string;
  /** Pill reposition (center → sidebar foot) duration, seconds. */
  pillRelocateDuration: number;
  pillRelocateEase: string;
  /** Hero ↔ pinned float reposition duration, seconds. */
  positionDuration: number;
  positionEase: string;
}

export interface SidebarConfig {
  /** Sidebar width on desktop, px. */
  width: number;
  /** Viewport width below which the sidebar becomes a full-screen overlay, px. */
  overlayBreakpoint: number;
  /** Backdrop blur/tint strength for the mobile overlay (0..1 tint alpha). */
  overlayTint: number;
}

// ---------------------------------------------------------------------------
// The config object
// ---------------------------------------------------------------------------

export interface AIVisualConfig {
  liquidEdge: LiquidEdgeConfig;
  gradient: GradientConfig;
  breathing: BreathingConfig;
  dimensions: ResponsiveDimensions;
  morph: MorphConfig;
  sidebar: SidebarConfig;
  zLayers: typeof Z_LAYERS;
}

export const DEFAULT_AI_VISUAL_CONFIG: AIVisualConfig = {
  liquidEdge: {
    points: 32,
    amplitude: 2.6,
    wavelength: 6,
    speed: 0.9,
    wobble: 0.55,
    dockedAmplitudeScale: 0.45,
    meniscusSpread: 46,
    meniscusHeight: 22,
    neckStagger: 0.55,
    neckWidthRatio: 0.3,
    neckDepth: 18,
  },
  gradient: {
    // Theme tokens (globals.css defines both palettes — Req 1.2/1.3); raw
    // colors are allowed here for playground experiments via paletteDark.
    palette: ['var(--ai-glow-1)', 'var(--ai-glow-2)', 'var(--ai-glow-3)', 'var(--ai-glow-4)'],
    paletteDark: null,
    states: {
      idle:      { intensity: 0.45, rotationSpeed: 12, strokeWidth: 1.5, glowWidth: 6,  glowOpacity: 0.14 },
      listening: { intensity: 0.8,  rotationSpeed: 28, strokeWidth: 2,   glowWidth: 10, glowOpacity: 0.24 },
      thinking:  { intensity: 0.65, rotationSpeed: 45, strokeWidth: 1.5, glowWidth: 8,  glowOpacity: 0.18 },
      speaking:  { intensity: 0.95, rotationSpeed: 20, strokeWidth: 2.5, glowWidth: 14, glowOpacity: 0.3 },
    },
    reducedMotionIntensity: 0.35,
  },
  breathing: {
    amplitude: 0.5,
    spread: 120,
    rateBpm: 11,
    attackSeconds: 1.1,
    releaseSeconds: 1.6,
    attackEase: 'power2.out',
    releaseEase: 'power2.inOut',
    floorRatio: 0.45,
    reducedMotionOpacity: 0.18,
  },
  dimensions: {
    desktop: {
      maxWidth: 672,
      height: 76,
      bleedX: 56,
      bleedTop: 14,
      floatingBottom: 24,
      heroBottomVh: 30,
    },
    phone: {
      maxWidth: 420,
      height: 64,
      bleedX: 28,
      bleedTop: 10,
      floatingBottom: 12,
      heroBottomVh: 24,
    },
    phoneBreakpoint: 640,
  },
  morph: {
    dockDuration: 0.85,
    dockEase: 'power3.inOut',
    undockDuration: 0.7,
    undockEase: 'power2.inOut',
    sidebarDuration: 0.55,
    sidebarEase: 'power3.out',
    pillRelocateDuration: 0.55,
    pillRelocateEase: 'power3.inOut',
    positionDuration: 0.7,
    positionEase: 'power2.out',
  },
  sidebar: {
    width: 400,
    overlayBreakpoint: 768,
    overlayTint: 0.55,
  },
  zLayers: Z_LAYERS,
};

/** Deep-merge a partial override onto the defaults (playground live tweaks). */
export function mergeAIVisualConfig(
  base: AIVisualConfig,
  override: DeepPartial<AIVisualConfig> | null | undefined
): AIVisualConfig {
  if (!override) return base;
  return deepMerge(base, override) as AIVisualConfig;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function deepMerge(base: unknown, override: unknown): unknown {
  if (
    base === null || override === null ||
    typeof base !== 'object' || typeof override !== 'object' ||
    Array.isArray(base) || Array.isArray(override)
  ) {
    return override === undefined ? base : override;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = deepMerge((base as Record<string, unknown>)[key], value);
  }
  return out;
}

/** localStorage key the admin playground writes live overrides to. */
export const AI_VISUAL_OVERRIDE_STORAGE_KEY = 'ai-visual-config-override';
