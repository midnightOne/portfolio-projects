"use client";

/**
 * PillShell (ui-system tasks 3.1/3.6) — the pill's silhouette and ambient
 * gradient edge.
 *
 * Owner revision 2026-07-12: the liquid formula edge is gone. The silhouette
 * is the classic capsule; docking flips the outer bottom quarters of the
 * radius from internal to external — the "tab" foot curving into the screen
 * edge (pill-path.ts). The path is STATIC at rest: it rebuilds only while
 * the dock morph tweens or the shell resizes, never per idle frame.
 *
 * What still animates per frame (shared ambient clock, compositor-cheap):
 * the slowly rotating multicolor gradient stroke (Siri/Gemini reference,
 * task 3.6), whose intensity/rotation follow the agent state. Under
 * prefers-reduced-motion the clock freezes and the stroke holds a static
 * tint at `gradient.reducedMotionIntensity`.
 *
 * All tunables come from useAIVisualConfig() (task 3.8 — zero magic numbers
 * here).
 */

import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { cn } from '@/lib/utils';
import { useAIVisualConfig, useIsDarkTheme } from '@/lib/ui/ai-visual-config-context';
import { pillTabPath, type PillGeometry } from '@/lib/ui/pill-path';
import { subscribeAmbientClock, getAmbientTime, isAmbientClockReduced } from '@/lib/ui/ambient-clock';
import type { AgentVisualState } from '@/lib/ui/ai-visual-config';

export interface PillShellProps {
  /** Drives gradient intensity/rotation (idle / listening / thinking / speaking). */
  agentState: AgentVisualState;
  /** 0 = floating, 1 = docked tab; read every frame (GSAP tweens the source object). */
  getDockProgress?: () => number;
  /** True while the phone breakpoint applies (tighter bleed). */
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PillShell({
  agentState,
  getDockProgress,
  compact = false,
  className,
  children,
}: PillShellProps) {
  const config = useAIVisualConfig();
  const gradientId = useId().replace(/[:]/g, 'pil');

  const shellRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const basePathRef = useRef<SVGPathElement>(null);
  const edgeUseRef = useRef<SVGUseElement>(null);
  const glowUseRef = useRef<SVGUseElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);

  const dims = compact ? config.dimensions.phone : config.dimensions.desktop;

  // Mutable per-frame state — deliberately outside React.
  const frameState = useRef({
    width: 0,
    height: 0,
    angle: 0,
    lastShapeKey: '',
    style: { ...config.gradient.states.idle },
  });

  // Config values the frame loop reads (kept fresh without re-subscribing).
  const liveConfig = useRef(config);
  liveConfig.current = config;
  const liveDims = useRef(dims);
  liveDims.current = dims;
  const dockRef = useRef(getDockProgress);
  dockRef.current = getDockProgress;

  // Smoothly tween the gradient style toward the active state's targets.
  useEffect(() => {
    const target = config.gradient.states[agentState] ?? config.gradient.states.idle;
    const tween = gsap.to(frameState.current.style, {
      intensity: target.intensity,
      rotationSpeed: target.rotationSpeed,
      strokeWidth: target.strokeWidth,
      glowWidth: target.glowWidth,
      glowOpacity: target.glowOpacity,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [agentState, config]);

  // One frame of the visual pipeline (also called synchronously on measure so
  // the silhouette exists before the first ticker frame — e.g. hidden tabs,
  // where rAF is paused, must still show a correct static pill). The shape
  // path rebuilds only when dock progress or size changed.
  const lastTimeRef = useRef(0);
  const renderFrame = useCallback((t: number) => {
    const fs = frameState.current;
    if (fs.width <= 0 || fs.height <= 0) return;
    const cfg = liveConfig.current;
    const dim = liveDims.current;
    const reduced = isAmbientClockReduced();
    const dock = dockRef.current ? dockRef.current() : 0;

    const shapeKey = `${dock.toFixed(4)}|${fs.width}x${fs.height}`;
    if (shapeKey !== fs.lastShapeKey) {
      fs.lastShapeKey = shapeKey;
      const geom: PillGeometry = {
        width: fs.width,
        height: fs.height,
        bleedX: dim.bleedX,
        bleedTop: dim.bleedTop,
        bottomPad: dim.bleedTop,
        cornerRadius: dim.height / 2,
      };
      const d = pillTabPath(geom, cfg.shape, dock);
      if (glassRef.current) glassRef.current.style.clipPath = `path("${d}")`;
      basePathRef.current?.setAttribute('d', d);
    }

    // Gradient rotation + state styling.
    const dt = Math.max(0, t - lastTimeRef.current);
    lastTimeRef.current = t;
    if (!reduced) fs.angle = (fs.angle + fs.style.rotationSpeed * dt) % 360;
    gradientRef.current?.setAttribute('gradientTransform', `rotate(${fs.angle.toFixed(2)} 0.5 0.5)`);

    const intensity = reduced ? cfg.gradient.reducedMotionIntensity : fs.style.intensity;
    if (edgeUseRef.current) {
      edgeUseRef.current.setAttribute('stroke-width', fs.style.strokeWidth.toFixed(2));
      edgeUseRef.current.setAttribute('opacity', intensity.toFixed(3));
    }
    if (glowUseRef.current) {
      glowUseRef.current.setAttribute('stroke-width', fs.style.glowWidth.toFixed(2));
      glowUseRef.current.setAttribute(
        'opacity',
        (reduced ? cfg.gradient.reducedMotionIntensity * 0.4 : fs.style.glowOpacity).toFixed(3)
      );
    }
  }, []);

  // Track shell size; render immediately on every measure.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => {
      const rect = shell.getBoundingClientRect();
      frameState.current.width = rect.width;
      frameState.current.height = rect.height;
      frameState.current.lastShapeKey = ''; // force a path rebuild
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      }
      renderFrame(getAmbientTime());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [renderFrame]);

  // The frame loop (gradient rotation; shape rebuild only during the morph).
  useEffect(() => subscribeAmbientClock(renderFrame), [renderFrame]);

  // Palette: dark override applies only when a custom dark palette is set;
  // the default palette is var(--ai-glow-N) tokens, which re-resolve on theme
  // switch by themselves (Req 1.2/1.3).
  const isDark = useIsDarkTheme();
  const stops = useMemo(() => {
    const palette = (isDark && config.gradient.paletteDark) || config.gradient.palette;
    return palette.map((color, i) => ({
      color,
      offset: palette.length === 1 ? 0 : i / (palette.length - 1),
    }));
  }, [config.gradient.palette, config.gradient.paletteDark, isDark]);

  return (
    <div
      ref={shellRef}
      className={cn('relative', className)}
      style={{
        paddingLeft: dims.bleedX,
        paddingRight: dims.bleedX,
        paddingTop: dims.bleedTop,
        paddingBottom: dims.bleedTop,
      }}
    >
      {/* Glass surface clipped to the pill/tab silhouette */}
      <div
        ref={glassRef}
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        data-testid="pill-glass"
      />
      {/* Gradient edge: one path, two strokes */}
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full overflow-visible pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient ref={gradientRef} id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {stops.map((stop, i) => (
              <stop key={i} offset={stop.offset} style={{ stopColor: stop.color }} />
            ))}
          </linearGradient>
        </defs>
        <path ref={basePathRef} id={`${gradientId}-path`} fill="none" />
        <use
          ref={glowUseRef}
          href={`#${gradientId}-path`}
          stroke={`url(#${gradientId})`}
          strokeLinejoin="round"
          fill="none"
        />
        <use
          ref={edgeUseRef}
          href={`#${gradientId}-path`}
          stroke={`url(#${gradientId})`}
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {/* Content sits above the glass, inside the bleed margins */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
