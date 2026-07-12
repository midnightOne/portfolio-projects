/**
 * Pill silhouette generator tests (ui-system task 3.1, tab-dock revisions
 * 2026-07-12). Pins the geometric contract the shell and playground rely on:
 * a static capsule when floating AND through most of the dock travel
 * (`dockMorphStart`), the tab foot when docked — its radius matching the top
 * radius and meeting it at mid-height — validity and determinism throughout.
 */

import { pillTabPath, pathBounds, dockedCornerRadius, type PillGeometry } from '../pill-path';
import { DEFAULT_AI_VISUAL_CONFIG, mergeAIVisualConfig, Z_LAYERS } from '../ai-visual-config';

const cfg = DEFAULT_AI_VISUAL_CONFIG.shape;
/** Morph across the full range — isolates shape assertions from the deferral. */
const cfgImmediate = { ...cfg, dockMorphStart: 0 };

const geom: PillGeometry = {
  width: 700,
  height: 100,
  bleedX: 48,
  bleedTop: 14,
  bottomPad: 14,
  cornerRadius: 36,
};

// Docked visible height = content 72 + bottomPad 14 = 86 → docked radius 43
// (under the cornerRadius + bottomPad = 50 and bleedX - 1 = 47 caps).
const RD = dockedCornerRadius(geom, geom.height - geom.bleedTop, geom.width - 2 * geom.bleedX);

describe('pillTabPath', () => {
  it('produces a closed path with no invalid numbers', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const d = pillTabPath(geom, cfgImmediate, p);
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

  it('stays a pure capsule until dockMorphStart — the flip is deferred to the tail', () => {
    const capsule = pillTabPath(geom, cfg, 0);
    for (const p of [0.2, 0.5, cfg.dockMorphStart - 0.01]) {
      expect(pillTabPath(geom, cfg, p)).toBe(capsule);
    }
    expect(pillTabPath(geom, cfg, cfg.dockMorphStart + 0.05)).not.toBe(capsule);
  });

  it('docked: bottom sits on the shell bottom and the feet flare outward by the docked radius', () => {
    expect(RD).toBeCloseTo((geom.height - geom.bleedTop) / 2, 5);
    const docked = pathBounds(pillTabPath(geom, cfg, 1));
    expect(docked.maxY).toBeCloseTo(geom.height, 1);
    expect(docked.minX).toBeCloseTo(geom.bleedX - RD, 1);
    expect(docked.maxX).toBeCloseTo(geom.width - geom.bleedX + RD, 1);
  });

  it('docked: foot radius matches the top radius and the arcs meet at mid-height', () => {
    const d = pillTabPath(geom, cfg, 1);
    // Top arc ends at y0 + RD; the concave foot starts at bottom − RD — the
    // same point, so the right-side line segment is zero-length: mid-height.
    const meetY = geom.bleedTop + RD;
    expect(geom.height - RD).toBeCloseTo(meetY, 5);
    const x1 = geom.width - geom.bleedX;
    expect(d).toContain(`L ${x1.toFixed(2)} ${meetY.toFixed(2)}`);
  });

  it('morph is monotonic: the feet sweep outward and the bottom descends with p', () => {
    let prevMaxX = -Infinity;
    let prevMaxY = -Infinity;
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const b = pathBounds(pillTabPath(geom, cfgImmediate, p));
      expect(b.maxX).toBeGreaterThanOrEqual(prevMaxX - 0.01);
      expect(b.maxY).toBeGreaterThanOrEqual(prevMaxY - 0.01);
      prevMaxX = b.maxX;
      prevMaxY = b.maxY;
    }
  });

  it('clamps the docked radius to the available bleed', () => {
    const tightBleed: PillGeometry = { ...geom, bleedX: 20 };
    const b = pathBounds(pillTabPath(tightBleed, cfg, 1));
    expect(b.minX).toBeGreaterThanOrEqual(0);
    expect(b.maxX).toBeLessThanOrEqual(tightBleed.width);
  });

  it('panel form: small corner radius, glass flush with the shell bottom', () => {
    // PillShell's panel form feeds cornerRadius = shape.panelRadius and
    // bottomPad = 0 — the capsule path becomes a rounded-corner rectangle
    // reaching the shell bottom (sidebar-integrated composer).
    const panelGeom: PillGeometry = { ...geom, bottomPad: 0, cornerRadius: 16 };
    const d = pillTabPath(panelGeom, cfg, 0);
    const b = pathBounds(d);
    expect(b.minX).toBeCloseTo(panelGeom.bleedX, 1);
    expect(b.maxX).toBeCloseTo(panelGeom.width - panelGeom.bleedX, 1);
    expect(b.minY).toBeCloseTo(panelGeom.bleedTop, 1);
    expect(b.maxY).toBeCloseTo(panelGeom.height, 1);
    // Rounded-rect: the top edge starts at x0 + 16, not at mid-width.
    expect(d.startsWith(`M ${(panelGeom.bleedX + 16).toFixed(2)} ${panelGeom.bleedTop.toFixed(2)}`)).toBe(true);
  });

  it('caps the docked radius for taller-than-nominal content', () => {
    // Two-row content: docked height 160 ≫ nominal — the radius stops at
    // cornerRadius + bottomPad (50), then the bleed clamp (47).
    const tall: PillGeometry = { ...geom, height: 174 };
    const rd = dockedCornerRadius(tall, tall.height - tall.bleedTop, tall.width - 2 * tall.bleedX);
    expect(rd).toBe(Math.min(geom.cornerRadius + geom.bottomPad, geom.bleedX - 1));
    const b = pathBounds(pillTabPath(tall, cfg, 1));
    expect(b.minX).toBeCloseTo(tall.bleedX - rd, 1);
    expect(b.maxX).toBeCloseTo(tall.width - tall.bleedX + rd, 1);
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
      shape: { dockMorphStart: 0.5 },
      gradient: { states: { speaking: { intensity: 0.1 } } },
    });
    expect(merged.shape.dockMorphStart).toBe(0.5);
    expect(merged.gradient.states.speaking.intensity).toBe(0.1);
    expect(merged.gradient.states.speaking.rotationSpeed).toBe(
      DEFAULT_AI_VISUAL_CONFIG.gradient.states.speaking.rotationSpeed
    );
    expect(merged.gradient.states.idle).toEqual(DEFAULT_AI_VISUAL_CONFIG.gradient.states.idle);
    expect(merged.breathing).toEqual(DEFAULT_AI_VISUAL_CONFIG.breathing);
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
