/**
 * Pill silhouette generator tests (ui-system task 3.1, tab-dock revision
 * 2026-07-12). Pins the geometric contract the shell and playground rely on:
 * a static capsule when floating, the tab foot (internal → external bottom
 * radius) when docked, validity and determinism throughout the morph.
 */

import { pillTabPath, pathBounds, type PillGeometry } from '../pill-path';
import { DEFAULT_AI_VISUAL_CONFIG, mergeAIVisualConfig, Z_LAYERS } from '../ai-visual-config';

const cfg = DEFAULT_AI_VISUAL_CONFIG.shape;

const geom: PillGeometry = {
  width: 700,
  height: 100,
  bleedX: 40,
  bleedTop: 14,
  bottomPad: 14,
  cornerRadius: 36,
};

describe('pillTabPath', () => {
  it('produces a closed path with no invalid numbers', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const d = pillTabPath(geom, cfg, p);
      expect(d.startsWith('M ')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });

  it('is a static capsule when floating — no time parameter, deterministic', () => {
    const a = pillTabPath(geom, cfg, 0);
    const b = pillTabPath(geom, cfg, 0);
    expect(a).toBe(b);
    const bounds = pathBounds(a);
    // Exactly the pill box: no bleed used while floating.
    expect(bounds.minX).toBeCloseTo(geom.bleedX, 1);
    expect(bounds.maxX).toBeCloseTo(geom.width - geom.bleedX, 1);
    expect(bounds.minY).toBeCloseTo(geom.bleedTop, 1);
    expect(bounds.maxY).toBeCloseTo(geom.height - geom.bottomPad, 1);
  });

  it('docked: bottom sits on the shell bottom and the tab feet flare outward by tabRadius', () => {
    const docked = pathBounds(pillTabPath(geom, cfg, 1));
    expect(docked.maxY).toBeCloseTo(geom.height, 1);
    expect(docked.minX).toBeCloseTo(geom.bleedX - cfg.tabRadius, 1);
    expect(docked.maxX).toBeCloseTo(geom.width - geom.bleedX + cfg.tabRadius, 1);
  });

  it('morph is monotonic: the feet sweep outward and the bottom descends with p', () => {
    let prevMaxX = -Infinity;
    let prevMaxY = -Infinity;
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const b = pathBounds(pillTabPath(geom, cfg, p));
      expect(b.maxX).toBeGreaterThanOrEqual(prevMaxX - 0.01);
      expect(b.maxY).toBeGreaterThanOrEqual(prevMaxY - 0.01);
      prevMaxX = b.maxX;
      prevMaxY = b.maxY;
    }
  });

  it('clamps the tab radius to the available bleed', () => {
    const wide = { ...cfg, tabRadius: 500 };
    const b = pathBounds(pillTabPath(geom, wide, 1));
    expect(b.minX).toBeGreaterThanOrEqual(0);
    expect(b.maxX).toBeLessThanOrEqual(geom.width);
  });

  it('honors dockedTopRadiusScale', () => {
    const tight = { ...cfg, dockedTopRadiusScale: 0.5 };
    // Different top corners ⇒ different path; floating unaffected.
    expect(pillTabPath(geom, tight, 1)).not.toBe(pillTabPath(geom, cfg, 1));
    expect(pillTabPath(geom, tight, 0)).toBe(pillTabPath(geom, cfg, 0));
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
      shape: { tabRadius: 40 },
      gradient: { states: { speaking: { intensity: 0.1 } } },
    });
    expect(merged.shape.tabRadius).toBe(40);
    expect(merged.shape.dockedTopRadiusScale).toBe(DEFAULT_AI_VISUAL_CONFIG.shape.dockedTopRadiusScale);
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
