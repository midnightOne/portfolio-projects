"use client";

/**
 * LiquidPillShell (ui-system tasks 3.1/3.2/3.6) — the liquid silhouette
 * around the pill's content.
 *
 * Rendering strategy (owner budget: no shaders, no physics, mobile-cheap):
 * one formula-generated bezier path per frame (liquid-path.ts) drives
 *  - the glass surface: a backdrop-blurred div clipped with `clip-path: path()`,
 *  - the ambient edge: the SAME path as an SVG stroke with a slowly rotating
 *    multicolor gradient (Siri/Gemini reference) — one base <path> updated per
 *    frame, referenced twice via <use> for the crisp edge + the soft glow.
 *
 * All tunables come from useAIVisualConfig() (task 3.8 — zero magic numbers
 * here). The frame loop runs on the shared liquid clock, which freezes under
 * prefers-reduced-motion — the silhouette and gradient then hold a static
 * frame at `gradient.reducedMotionIntensity`.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { cn } from '@/lib/utils';
import { useAIVisualConfig, useIsDarkTheme } from '@/lib/ui/ai-visual-config-context';
import { liquidPillPath, type LiquidGeometry } from '@/lib/ui/liquid-path';
import { subscribeLiquidClock, getLiquidTime, isLiquidClockReduced } from '@/lib/ui/liquid-clock';
import type { AgentVisualState } from '@/lib/ui/ai-visual-config';

export interface LiquidPillShellProps {
  /** Drives gradient intensity/rotation (idle / listening / thinking / speaking). */
  agentState: AgentVisualState;
  /** 0 = floating, 1 = docked; read every frame (GSAP tweens the source object). */
  getDockProgress?: () => number;
  /** True while the phone breakpoint applies (tighter bleed). */
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function LiquidPillShell({
  agentState,
  getDockProgress,
  compact = false,
  className,
  children,
}: LiquidPillShellProps) {
  const config = useAIVisualConfig();
  const gradientId = useId().replace(/[:]/g, 'liq');

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
    lastKey: '',
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
  // where rAF is paused, must still show a correct static pill).
  const lastTimeRef = useRef(0);
  const renderFrame = useCallback((t: number) => {
    const fs = frameState.current;
    if (fs.width <= 0 || fs.height <= 0) return;
    const cfg = liveConfig.current;
    const dim = liveDims.current;
    const reduced = isLiquidClockReduced();
    const dock = dockRef.current ? dockRef.current() : 0;

    const geom: LiquidGeometry = {
      width: fs.width,
      height: fs.height,
      bleedX: dim.bleedX,
      bleedTop: dim.bleedTop,
      bottomPad: dim.bleedTop,
      cornerRadius: dim.height / 2,
    };

    // Skip identical frames (reduced motion / settled dock).
    const key = `${t.toFixed(3)}|${dock.toFixed(4)}|${fs.width}x${fs.height}`;
    if (key !== fs.lastKey) {
      fs.lastKey = key;
      const d = liquidPillPath(geom, cfg.liquidEdge, t, dock);
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
      frameState.current.lastKey = ''; // force a path rebuild
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      }
      renderFrame(getLiquidTime());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [renderFrame]);

  // The frame loop.
  useEffect(() => subscribeLiquidClock(renderFrame), [renderFrame]);

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
      {/* Glass surface clipped to the liquid silhouette */}
      <div
        ref={glassRef}
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        data-testid="liquid-pill-glass"
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
