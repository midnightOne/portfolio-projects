/**
 * Pill silhouette generator — the "tab" dock aesthetic (ui-system task 3.1,
 * owner revision 2026-07-12: the liquid formula edge is gone; the pill is the
 * plain capsule again, and docking flips the OUTER BOTTOM QUARTERS of its
 * radius from an internal (convex) radius to an external (concave) one whose
 * curve flows into the bottom edge of the screen — a browser-tab foot).
 *
 * Pure function (geometry, tab config, dockProgress) → closed SVG path.
 * Exact cubic-bezier arcs, no sampling, no per-frame animation: the path only
 * changes while the dock morph tweens or the shell resizes. The same path
 * drives the glass `clip-path` and the gradient edge stroke.
 *
 * Corner morph: each bottom corner is ONE cubic bezier whose endpoints and
 * control points interpolate between the convex quarter-arc (radius R, ending
 * inside the pill) and the concave fillet (radius `tabRadius`, ending outside
 * the pill on the screen edge). Mid-morph the corner passes through
 * nearly-straight — reading as the radius "flipping" outward.
 */

import type { PillShapeConfig } from './ai-visual-config';

export interface PillGeometry {
  /** Total shell width, px (content + 2 × bleedX). */
  width: number;
  /** Total shell height, px (bleedTop + content height + bottom pad). */
  height: number;
  /** Horizontal bleed margin (must cover tabRadius + glow), px per side. */
  bleedX: number;
  /** Top bleed margin (glow room), px. */
  bleedTop: number;
  /** Gap under the floating pill; the docked bottom sits at the shell bottom. */
  bottomPad: number;
  /** Capsule corner radius (h/2 for the classic pill; capped for tall content). */
  cornerRadius: number;
}

/** Circle-to-cubic-bezier constant for a quarter arc. */
const K = 0.5522847498307936;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * @param p dock progress: 0 = floating capsule, 1 = tab merged with the
 *          screen edge. The caller eases it (GSAP timeline).
 */
export function pillTabPath(geom: PillGeometry, cfg: PillShapeConfig, p: number): string {
  const t = clamp01(p);
  const x0 = geom.bleedX;
  const y0 = geom.bleedTop;
  const w = geom.width - 2 * geom.bleedX;
  const h = geom.height - geom.bleedTop - geom.bottomPad;
  const x1 = x0 + w;

  // Bottom edge slides from the floating position down to the shell bottom
  // (the container reaches the screen edge in the same timeline).
  const bY = lerp(y0 + h, geom.height, t);

  // Radii. Top corners stay the capsule's; a knob lets iterations tighten
  // them while docked. Bottom corners are the interpolated flip.
  const R = Math.max(2, Math.min(geom.cornerRadius, w / 2, (bY - y0) / 2));
  const topR = R * lerp(1, cfg.dockedTopRadiusScale, t);
  const tabR = Math.min(cfg.tabRadius, geom.bleedX - 1);

  // Bottom-right corner: convex (p=0) → concave into the screen edge (p=1).
  //   convex : S=(x1, bY-R)     C1=(x1, bY-R+K·R)     C2=(x1-R+K·R, bY)     E=(x1-R, bY)
  //   concave: S=(x1, bY-tabR)  C1=(x1, bY-tabR+K·tabR) C2=(x1+tabR-K·tabR, bY) E=(x1+tabR, bY)
  const brSy = bY - lerp(R, tabR, t);
  const brC1y = bY - lerp(R - K * R, tabR - K * tabR, t);
  const brC2x = lerp(x1 - R + K * R, x1 + tabR - K * tabR, t);
  const brEx = lerp(x1 - R, x1 + tabR, t);

  // Bottom-left corner (mirror, traversed right→left along the bottom).
  const blSx = lerp(x0 + R, x0 - tabR, t);
  const blC1x = lerp(x0 + R - K * R, x0 - tabR + K * tabR, t);
  const blC2y = bY - lerp(R - K * R, tabR - K * tabR, t);
  const blEy = bY - lerp(R, tabR, t);

  const n = (v: number) => v.toFixed(2);

  return [
    // start at the left end of the top edge, clockwise
    `M ${n(x0 + topR)} ${n(y0)}`,
    `L ${n(x1 - topR)} ${n(y0)}`,
    // top-right corner
    `C ${n(x1 - topR + K * topR)} ${n(y0)}, ${n(x1)} ${n(y0 + topR - K * topR)}, ${n(x1)} ${n(y0 + topR)}`,
    // right side
    `L ${n(x1)} ${n(brSy)}`,
    // bottom-right corner (the flip)
    `C ${n(x1)} ${n(brC1y)}, ${n(brC2x)} ${n(bY)}, ${n(brEx)} ${n(bY)}`,
    // bottom edge (right → left)
    `L ${n(blSx)} ${n(bY)}`,
    // bottom-left corner (the flip, mirrored)
    `C ${n(blC1x)} ${n(bY)}, ${n(x0)} ${n(blC2y)}, ${n(x0)} ${n(blEy)}`,
    // left side
    `L ${n(x0)} ${n(y0 + topR)}`,
    // top-left corner
    `C ${n(x0)} ${n(y0 + topR - K * topR)}, ${n(x0 + topR - K * topR)} ${n(y0)}, ${n(x0 + topR)} ${n(y0)}`,
    'Z',
  ].join(' ');
}

/** Bounding box of a generated path — used by tests and the playground readout. */
export function pathBounds(path: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, maxX, minY, maxY };
}
