/**
 * Liquid-pill silhouette generator (ui-system tasks 3.1/3.2).
 *
 * Owner constraint (2026-07-10, §9.3): NO physics simulation, NO shaders —
 * "a bezier curve based edge that is animated and governed by some formula".
 * This module is that formula: a pure function from (geometry, time, dock
 * progress, config) to a closed SVG path string. The same path drives both
 * the glass surface (`clip-path: path(...)`) and the gradient edge stroke,
 * so the two can never drift apart.
 *
 * Shape model:
 *  - FLOATING (dockProgress 0): a rounded-rect/capsule whose outline points
 *    breathe with a travelling sine field (amplitude/wavelength/speed/wobble).
 *  - DOCKED (dockProgress 1): a water drop wetting the screen edge — rounded
 *    top, flat bottom merged with the viewport edge, concave meniscus curves
 *    flaring `meniscusSpread` outward at each side.
 *  - Both outlines are sampled uniformly by arc length from the same start
 *    point (top-left, clockwise) and paired by index; the morph staggers per
 *    point from the bottom-center outward (`neckStagger`) with the vertical
 *    move leading the horizontal spread — which reads as the metaball
 *    thin-neck-then-merge without simulating anything.
 *
 * Everything is plain math on ~32 points per frame; no allocation-heavy
 * structures, mobile-cheap by construction.
 */

import type { LiquidEdgeConfig } from './ai-visual-config';

export interface LiquidGeometry {
  /** Total shell width, px (content + 2 × bleedX). */
  width: number;
  /** Total shell height, px (bleedTop + content height + bottom pad). */
  height: number;
  /** Horizontal bleed margin the silhouette may spread into. */
  bleedX: number;
  /** Top bleed margin. */
  bleedTop: number;
  /** Space under the body the docked shape wets into (also the bottom wobble margin). */
  bottomPad: number;
  /** Corner radius of the floating body (h/2 = capsule; capped for tall content). */
  cornerRadius: number;
}

interface SamplePoint {
  x: number;
  y: number;
  /** Outward normal. */
  nx: number;
  ny: number;
}

const TAU = Math.PI * 2;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(v: number): number {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

/** Deterministic per-point phase scatter (stable across frames — no Math.random). */
function pointPhase(index: number): number {
  const s = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * TAU;
}

interface Segment {
  length: number;
  /** t ∈ [0,1] along the segment → point + outward normal. */
  at: (t: number) => SamplePoint;
}

function lineSegment(x1: number, y1: number, x2: number, y2: number, nx: number, ny: number): Segment {
  return {
    length: Math.hypot(x2 - x1, y2 - y1),
    at: (t) => ({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, nx, ny }),
  };
}

/** Clockwise arc around (cx,cy) from angle a1 to a2 (radians, screen coords). */
function arcSegment(cx: number, cy: number, r: number, a1: number, a2: number): Segment {
  return {
    length: Math.abs(a2 - a1) * r,
    at: (t) => {
      const a = a1 + (a2 - a1) * t;
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      return { x: cx + nx * r, y: cy + ny * r, nx, ny };
    },
  };
}

/** Quadratic bezier segment; normals approximated from the tangent. */
function quadSegment(
  p0x: number, p0y: number,
  cx: number, cy: number,
  p1x: number, p1y: number
): Segment {
  // Coarse polyline length (shape morph only needs proportional spacing).
  let length = 0;
  let px = p0x, py = p0y;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const mt = 1 - t;
    const x = mt * mt * p0x + 2 * mt * t * cx + t * t * p1x;
    const y = mt * mt * p0y + 2 * mt * t * cy + t * t * p1y;
    length += Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  return {
    length,
    at: (t) => {
      const mt = 1 - t;
      const x = mt * mt * p0x + 2 * mt * t * cx + t * t * p1x;
      const y = mt * mt * p0y + 2 * mt * t * cy + t * t * p1y;
      // Clockwise winding in screen coords → outward normal = (ty, -tx).
      const tx = 2 * mt * (cx - p0x) + 2 * t * (p1x - cx);
      const ty = 2 * mt * (cy - p0y) + 2 * t * (p1y - cy);
      const len = Math.hypot(tx, ty) || 1;
      return { x, y, nx: ty / len, ny: -tx / len };
    },
  };
}

/** Uniform arc-length sampling over an ordered segment chain (closed outline). */
function sampleChain(segments: Segment[], count: number): SamplePoint[] {
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  const points: SamplePoint[] = [];
  let segIndex = 0;
  let segStart = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (segIndex < segments.length - 1 && segStart + segments[segIndex].length < target) {
      segStart += segments[segIndex].length;
      segIndex++;
    }
    const seg = segments[segIndex];
    const t = seg.length === 0 ? 0 : clamp01((target - segStart) / seg.length);
    points.push(seg.at(t));
  }
  return points;
}

/** Floating outline: rounded rect, clockwise from the top-left corner end. */
function floatingSegments(geom: LiquidGeometry): Segment[] {
  const x0 = geom.bleedX;
  const y0 = geom.bleedTop;
  const w = geom.width - 2 * geom.bleedX;
  const h = geom.height - geom.bleedTop - geom.bottomPad;
  const rc = Math.max(2, Math.min(geom.cornerRadius, w / 2, h / 2));
  const x1 = x0 + w;
  const y1 = y0 + h;
  return [
    lineSegment(x0 + rc, y0, x1 - rc, y0, 0, -1),                     // top
    arcSegment(x1 - rc, y0 + rc, rc, -Math.PI / 2, 0),                // top-right
    lineSegment(x1, y0 + rc, x1, y1 - rc, 1, 0),                      // right
    arcSegment(x1 - rc, y1 - rc, rc, 0, Math.PI / 2),                 // bottom-right
    lineSegment(x1 - rc, y1, x0 + rc, y1, 0, 1),                      // bottom (r→l)
    arcSegment(x0 + rc, y1 - rc, rc, Math.PI / 2, Math.PI),           // bottom-left
    lineSegment(x0, y1 - rc, x0, y0 + rc, -1, 0),                     // left
    arcSegment(x0 + rc, y0 + rc, rc, Math.PI, Math.PI * 1.5),         // top-left
  ];
}

/** Docked outline: wetted drop — rounded top, meniscus sides, flat merged bottom. */
function dockedSegments(geom: LiquidGeometry, cfg: LiquidEdgeConfig): Segment[] {
  const x0 = geom.bleedX;
  const y0 = geom.bleedTop;
  const w = geom.width - 2 * geom.bleedX;
  const h = geom.height - geom.bleedTop - geom.bottomPad;
  const rc = Math.max(2, Math.min(geom.cornerRadius, w / 2, h / 2));
  const x1 = x0 + w;
  const bottomY = geom.height;
  const spread = cfg.meniscusSpread;
  const xL = Math.max(1, x0 - spread);
  const xR = Math.min(geom.width - 1, x1 + spread);
  const sideTop = y0 + Math.min(rc * 1.5, h * 0.45); // where the wetting curve takes over

  return [
    lineSegment(x0 + rc, y0, x1 - rc, y0, 0, -1),                     // top (same as floating)
    arcSegment(x1 - rc, y0 + rc, rc, -Math.PI / 2, 0),                // top-right shoulder
    // right meniscus: from the shoulder down-and-out to the contact point
    quadSegment(x1, sideTop, x1 + spread * 0.9, bottomY - cfg.meniscusHeight, xR, bottomY),
    lineSegment(xR, bottomY, xL, bottomY, 0, 1),                      // merged bottom (r→l)
    // left meniscus (mirror)
    quadSegment(xL, bottomY, x0 - spread * 0.9, bottomY - cfg.meniscusHeight, x0, sideTop),
    arcSegment(x0 + rc, y0 + rc, rc, Math.PI, Math.PI * 1.5),         // top-left shoulder
  ];
}

/**
 * Compose the outline for a frame and serialize it as a closed cubic-bezier
 * SVG path (Catmull-Rom smoothing through the sampled points).
 *
 * @param t            formula-clock time, seconds
 * @param dockProgress 0 = floating pill, 1 = fully wetted drop
 */
export function liquidPillPath(
  geom: LiquidGeometry,
  cfg: LiquidEdgeConfig,
  t: number,
  dockProgress: number
): string {
  const count = Math.max(12, Math.round(cfg.points));
  const p = clamp01(dockProgress);
  const floating = sampleChain(floatingSegments(geom), count);
  const docked = sampleChain(dockedSegments(geom, cfg), count);

  const cx = geom.width / 2;
  const halfSpan = Math.max(1, geom.width / 2 - 1);
  const capsuleHalf = Math.max(1, geom.width / 2 - geom.bleedX);

  const xs = new Float64Array(count);
  const ys = new Float64Array(count);

  const stagger = Math.min(0.9, clamp01(cfg.neckStagger));
  const ampScale = 1 + (cfg.dockedAmplitudeScale - 1) * p;
  const xLag = smoothstep(p) * p; // horizontal spread trails the vertical drop

  for (let i = 0; i < count; i++) {
    const f = floating[i];
    const d = docked[i];
    const bottomness = Math.max(0, f.ny);
    const spreadDistance = clamp01(Math.abs(d.x - cx) / halfSpan);

    // Per-point vertical progress: bottom-center leaves first (the neck),
    // outer/top points follow (the merge).
    const delay = stagger * (spreadDistance * 0.75 + (1 - bottomness) * 0.25);
    const eY = smoothstep((p - delay) / (1 - stagger));
    const eX = Math.min(eY, xLag);

    let x = f.x + (d.x - f.x) * eX;
    let y = f.y + (d.y - f.y) * eY;

    // Mid-morph drip tip: the bottom-center bulges down before contact.
    if (bottomness > 0 && p > 0 && p < 1) {
      const centerness = clamp01(1 - Math.abs(f.x - cx) / Math.max(1, capsuleHalf * cfg.neckWidthRatio));
      y += cfg.neckDepth * Math.sin(Math.PI * p) * bottomness * centerness * centerness;
    }

    // Travelling-wave wobble along the floating normal; the merged bottom
    // edge is the screen edge and must not wobble.
    const u = i / count;
    const calm = 1 - eY * bottomness;
    const wave =
      cfg.amplitude * ampScale * calm *
      Math.sin(cfg.wavelength * TAU * u + t * cfg.speed + pointPhase(i) * cfg.wobble);
    x += f.nx * wave;
    y += f.ny * wave;

    // Never escape the shell box (clip-path outside the element is invisible).
    xs[i] = Math.min(geom.width, Math.max(0, x));
    ys[i] = Math.min(geom.height, Math.max(0, y));
  }

  // Catmull-Rom → cubic bezier, closed loop. Control points are clamped to
  // the shell box too — at the merged bottom edge an overshooting control
  // would draw the stroke dipping past the screen edge.
  const cx1 = (v: number) => Math.min(geom.width, Math.max(0, v)).toFixed(2);
  const cy1 = (v: number) => Math.min(geom.height, Math.max(0, v)).toFixed(2);
  let path = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  for (let i = 0; i < count; i++) {
    const i0 = (i - 1 + count) % count;
    const i1 = i;
    const i2 = (i + 1) % count;
    const i3 = (i + 2) % count;
    const c1x = xs[i1] + (xs[i2] - xs[i0]) / 6;
    const c1y = ys[i1] + (ys[i2] - ys[i0]) / 6;
    const c2x = xs[i2] - (xs[i3] - xs[i1]) / 6;
    const c2y = ys[i2] - (ys[i3] - ys[i1]) / 6;
    path += ` C ${cx1(c1x)} ${cy1(c1y)}, ${cx1(c2x)} ${cy1(c2y)}, ${xs[i2].toFixed(2)} ${ys[i2].toFixed(2)}`;
  }
  return path + ' Z';
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
