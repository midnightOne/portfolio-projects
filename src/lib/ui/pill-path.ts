/**
 * Pill silhouette generator — the "tab" dock aesthetic (ui-system task 3.1,
 * owner revisions 2026-07-12: the liquid formula edge is gone; the pill is the
 * plain capsule again, and docking flips the OUTER BOTTOM QUARTERS of its
 * radius from an internal (convex) radius to an external (concave) one whose
 * curve flows into the bottom edge of the screen — a browser-tab foot.
 * Second revision, same day: the foot radius MATCHES the top radius and the
 * two arcs meet at mid-height — the concave curve starts exactly where the
 * top corner ends — and the whole flip is deferred to the tail of the dock
 * travel via `shape.dockMorphStart`, so the pill descends as a pure capsule
 * and only transforms when it is almost at the bottom).
 *
 * Pure function (geometry, tab config, dockProgress) → closed SVG path.
 * Exact cubic-bezier arcs, no sampling, no per-frame animation: the path only
 * changes while the dock morph tweens or the shell resizes. The same path
 * drives the glass `clip-path` and the gradient edge stroke.
 *
 * Corner morph: each bottom corner is ONE cubic bezier whose endpoints and
 * control points interpolate between the convex quarter-arc (radius R, ending
 * inside the pill) and the concave fillet (radius = the docked corner radius,
 * ending outside the pill on the screen edge). Mid-morph the corner passes
 * through nearly-straight — reading as the radius "flipping" outward.
 *
 * Docked corner radius: one value drives both the top corners and the foot,
 * `min(dockedHeight/2, w/2, cornerRadius + bottomPad, bleedX - 1)`. For the
 * nominal single-row pill that resolves to dockedHeight/2, so the convex top
 * arc and the concave foot meet at exactly mid-height with a zero-length side
 * between them; taller content (prompt cards, the two-row sidebar layout)
 * caps out and keeps straight sides.
 */

import type { PillShapeConfig } from './ai-visual-config';

export interface PillGeometry {
  /** Total shell width, px (content + 2 × bleedX). */
  width: number;
  /** Total shell height, px (bleedTop + content height + bottom pad). */
  height: number;
  /** Horizontal bleed margin (must cover the docked radius + glow), px per side. */
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
 * The corner radius the silhouette settles on at full dock — exported so the
 * layout code can position a sidebar-docked pill such that the foot tips land
 * exactly on the sidebar edges.
 */
export function dockedCornerRadius(geom: PillGeometry, dockedHeight: number, contentWidth: number): number {
  return Math.max(
    2,
    Math.min(dockedHeight / 2, contentWidth / 2, geom.cornerRadius + geom.bottomPad, geom.bleedX - 1)
  );
}

/**
 * @param p dock progress: 0 = floating capsule, 1 = tab merged with the
 *          screen edge. The caller eases it (GSAP timeline); the corner flip
 *          itself only runs over the [dockMorphStart, 1] tail of it.
 */
export function pillTabPath(geom: PillGeometry, cfg: PillShapeConfig, p: number): string {
  // Remap: the silhouette is a static capsule until the dock travel is almost
  // done, then the whole flip plays out over the remaining tail.
  const start = Math.min(Math.max(cfg.dockMorphStart, 0), 0.95);
  const t = clamp01((clamp01(p) - start) / (1 - start));

  const x0 = geom.bleedX;
  const y0 = geom.bleedTop;
  const w = geom.width - 2 * geom.bleedX;
  const h = geom.height - geom.bleedTop - geom.bottomPad;
  const x1 = x0 + w;

  // Bottom edge slides from the floating position down to the shell bottom
  // (the container reaches the screen edge in the same timeline).
  const bY = lerp(y0 + h, geom.height, t);

  // Radii: R = floating capsule; RD = docked, shared by top corners and foot
  // so both arcs meet at mid-height on the nominal pill (see module doc).
  const R = Math.max(2, Math.min(geom.cornerRadius, w / 2, (bY - y0) / 2));
  const RD = dockedCornerRadius(geom, bY - y0, w);
  const topR = lerp(R, RD, t);

  // Bottom-right corner: convex (t=0) → concave into the screen edge (t=1).
  //   convex : S=(x1, bY-R)    C1=(x1, bY-R+K·R)      C2=(x1-R+K·R, bY)     E=(x1-R, bY)
  //   concave: S=(x1, bY-RD)   C1=(x1, bY-RD+K·RD)    C2=(x1+RD-K·RD, bY)   E=(x1+RD, bY)
  const brSy = bY - lerp(R, RD, t);
  const brC1y = bY - lerp(R - K * R, RD - K * RD, t);
  const brC2x = lerp(x1 - R + K * R, x1 + RD - K * RD, t);
  const brEx = lerp(x1 - R, x1 + RD, t);

  // Bottom-left corner (mirror, traversed right→left along the bottom).
  const blSx = lerp(x0 + R, x0 - RD, t);
  const blC1x = lerp(x0 + R - K * R, x0 - RD + K * RD, t);
  const blC2y = bY - lerp(R - K * R, RD - K * RD, t);
  const blEy = bY - lerp(R, RD, t);

  const n = (v: number) => v.toFixed(2);

  return [
    // start at the left end of the top edge, clockwise
    `M ${n(x0 + topR)} ${n(y0)}`,
    `L ${n(x1 - topR)} ${n(y0)}`,
    // top-right corner
    `C ${n(x1 - topR + K * topR)} ${n(y0)}, ${n(x1)} ${n(y0 + topR - K * topR)}, ${n(x1)} ${n(y0 + topR)}`,
    // right side (zero-length at full dock on the nominal pill)
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
