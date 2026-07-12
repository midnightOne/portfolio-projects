"use client";

/**
 * The shared formula clock (ui-system tasks 3.2/3.6): one time source drives
 * the pill's liquid edge, the gradient rotation, and the viewport breathing
 * layer, so every ambient surface moves in the same "water". Built on the
 * GSAP ticker (D15 — one scheduler, pauses on hidden tabs).
 *
 * Reduced motion is the third enforcement layer here (task 2's GSAP
 * timeScale + globals.css handle tweens/CSS): when `prefers-reduced-motion`
 * is on, the clock stops advancing, freezing every formula-driven surface to
 * a static frame — matching Req 3.2's "reduced/instant alternatives".
 */

import { gsap } from 'gsap';

type ClockListener = (timeSeconds: number) => void;

const listeners = new Set<ClockListener>();
let clockTime = 0;
let tickerAttached = false;
let reduced = false;
let mediaQueryAttached = false;

function ensureMediaQuery() {
  if (mediaQueryAttached || typeof window === 'undefined' || !window.matchMedia) return;
  mediaQueryAttached = true;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  const onChange = (e: MediaQueryListEvent) => {
    reduced = e.matches;
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
}

function tick(_time: number, deltaTime: number) {
  if (!reduced) {
    clockTime += deltaTime / 1000;
  }
  for (const listener of listeners) listener(clockTime);
}

/**
 * Subscribe a per-frame callback to the shared clock. Returns an unsubscribe.
 * Under reduced motion the callback still fires (so state-driven visuals can
 * settle) but the clock value stays frozen.
 */
export function subscribeLiquidClock(listener: ClockListener): () => void {
  ensureMediaQuery();
  listeners.add(listener);
  if (!tickerAttached) {
    tickerAttached = true;
    gsap.ticker.add(tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && tickerAttached) {
      tickerAttached = false;
      gsap.ticker.remove(tick);
    }
  };
}

/** Current clock value, seconds (frozen under reduced motion). */
export function getLiquidTime(): number {
  return clockTime;
}

/** Live reduced-motion state as the clock sees it. */
export function isLiquidClockReduced(): boolean {
  ensureMediaQuery();
  return reduced;
}
