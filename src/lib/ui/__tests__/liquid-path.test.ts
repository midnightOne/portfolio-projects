/**
 * Liquid-pill silhouette generator tests (ui-system tasks 3.1/3.2/3.8).
 *
 * The formula is pure math — these tests pin the geometric contract the
 * shell and playground rely on: closed valid paths, floating-vs-docked
 * endpoints, meniscus spread, wobble bounds, and determinism.
 */

import { liquidPillPath, pathBounds, type LiquidGeometry } from '../liquid-path';
import { DEFAULT_AI_VISUAL_CONFIG, mergeAIVisualConfig, Z_LAYERS } from '../ai-visual-config';

const cfg = DEFAULT_AI_VISUAL_CONFIG.liquidEdge;

const geom: LiquidGeometry = {
  width: 700,
  height: 100,
  bleedX: 56,
  bleedTop: 14,
  bottomPad: 14,
  cornerRadius: 36,
};

describe('liquidPillPath', () => {
  it('produces a closed cubic-bezier path with the configured point count', () => {
    const d = liquidPillPath(geom, cfg, 0, 0);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect((d.match(/ C /g) ?? []).length).toBe(cfg.points);
    // Numeric coordinates only — no NaN leaks into the DOM
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('keeps the floating outline inside the shell box and off the bottom edge', () => {
    const b = pathBounds(liquidPillPath(geom, cfg, 1.234, 0));
    expect(b.minX).toBeGreaterThanOrEqual(0);
    expect(b.maxX).toBeLessThanOrEqual(geom.width);
    expect(b.minY).toBeGreaterThanOrEqual(0);
    // Floating: the silhouette must not touch the shell bottom (that's the
    // docked state's merged edge). Margin covers wobble + Catmull-Rom
    // control-point overshoot (pathBounds reads control points too).
    expect(b.maxY).toBeLessThan(geom.height - geom.bottomPad + cfg.amplitude * 2 + 2);
  });

  it('docks to the very bottom edge with the meniscus spreading horizontally', () => {
    const floating = pathBounds(liquidPillPath(geom, cfg, 0, 0));
    const docked = pathBounds(liquidPillPath(geom, cfg, 0, 1));
    // Merged with the screen edge:
    expect(docked.maxY).toBeCloseTo(geom.height, 0);
    // Wetting flare beyond the floating width on both sides:
    expect(docked.minX).toBeLessThan(floating.minX - cfg.meniscusSpread * 0.5);
    expect(docked.maxX).toBeGreaterThan(floating.maxX + cfg.meniscusSpread * 0.5);
  });

  it('is deterministic for identical inputs (stable across frames)', () => {
    expect(liquidPillPath(geom, cfg, 2.5, 0.4)).toBe(liquidPillPath(geom, cfg, 2.5, 0.4));
  });

  it('animates with time: different t values move the floating edge', () => {
    expect(liquidPillPath(geom, cfg, 0, 0)).not.toBe(liquidPillPath(geom, cfg, 1, 0));
  });

  it('mid-morph drips at the bottom-center before the sides follow (thin neck)', () => {
    const calm = { ...cfg, amplitude: 0 };
    const mid = pathBounds(liquidPillPath(geom, calm, 0, 0.35));
    const start = pathBounds(liquidPillPath(geom, calm, 0, 0));
    // The tip reaches down early…
    expect(mid.maxY).toBeGreaterThan(start.maxY + 2);
    // …while the horizontal spread lags well behind the full meniscus flare.
    expect(mid.minX).toBeGreaterThan(geom.bleedX - cfg.meniscusSpread * 0.6);
  });

  it('honors amplitude: zero amplitude yields a still edge across time', () => {
    const still = { ...cfg, amplitude: 0 };
    expect(liquidPillPath(geom, still, 0, 0)).toBe(liquidPillPath(geom, still, 5, 0));
  });
});

describe('ai-visual-config', () => {
  it('z-layer scale keeps the owner ordering: page < modal < AI < AI overlays', () => {
    expect(Z_LAYERS.nav).toBeLessThan(Z_LAYERS.modalOverlay);
    expect(Z_LAYERS.modalOverlay).toBeLessThanOrEqual(Z_LAYERS.modalContent);
    expect(Z_LAYERS.modalContent).toBeLessThan(Z_LAYERS.aiAmbient);
    expect(Z_LAYERS.aiAmbient).toBeLessThan(Z_LAYERS.aiSidebar);
    expect(Z_LAYERS.aiSidebar).toBeLessThan(Z_LAYERS.aiPill);
    expect(Z_LAYERS.aiPill).toBeLessThan(Z_LAYERS.aiOverlay);
  });

  it('deep-merges partial overrides without disturbing siblings', () => {
    const merged = mergeAIVisualConfig(DEFAULT_AI_VISUAL_CONFIG, {
      liquidEdge: { amplitude: 9 },
      gradient: { states: { speaking: { intensity: 0.1 } } },
    });
    expect(merged.liquidEdge.amplitude).toBe(9);
    expect(merged.liquidEdge.wavelength).toBe(DEFAULT_AI_VISUAL_CONFIG.liquidEdge.wavelength);
    expect(merged.gradient.states.speaking.intensity).toBe(0.1);
    expect(merged.gradient.states.speaking.rotationSpeed).toBe(
      DEFAULT_AI_VISUAL_CONFIG.gradient.states.speaking.rotationSpeed
    );
    expect(merged.gradient.states.idle).toEqual(DEFAULT_AI_VISUAL_CONFIG.gradient.states.idle);
    // Arrays replace wholesale (palettes are positional)
    const palette = mergeAIVisualConfig(DEFAULT_AI_VISUAL_CONFIG, {
      gradient: { palette: ['red'] },
    });
    expect(palette.gradient.palette).toEqual(['red']);
  });

  it('null/undefined override returns the base config', () => {
    expect(mergeAIVisualConfig(DEFAULT_AI_VISUAL_CONFIG, null)).toBe(DEFAULT_AI_VISUAL_CONFIG);
  });
});
