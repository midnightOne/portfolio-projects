"use client";

/**
 * AmbientSpeechGlow (ui-system task 3.6) — "as if the page itself is
 * speaking" (owner 2026-07-11).
 *
 * A fixed, pointer-events-none viewport-edge layer that swells while the
 * agent's audio output is active and recedes when it ends. Two stacked
 * gradient layers cross-fade on the shared liquid clock to make the colors
 * flow (compositor-only work: every animated property is opacity), and a
 * slow sine breath modulates the whole layer at `rateBpm`.
 *
 * Reduced motion: the breath and color flow collapse to a fixed gentle tint
 * at `breathing.reducedMotionOpacity` while speaking (0 disables entirely).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { useAIVisualConfig, useIsDarkTheme } from '@/lib/ui/ai-visual-config-context';
import { subscribeLiquidClock, isLiquidClockReduced } from '@/lib/ui/liquid-clock';

const TAU = Math.PI * 2;

export function AmbientSpeechGlow({ speaking }: { speaking: boolean }) {
  const config = useAIVisualConfig();
  const isDark = useIsDarkTheme();

  const rootRef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  /** 0..1 — attack/release envelope of speech presence. */
  const envelopeRef = useRef({ value: 0 });

  const liveConfig = useRef(config);
  liveConfig.current = config;

  // Attack when speech starts, release when it ends (GSAP inherits the
  // global reduced-motion timeScale, so the settle is near-instant there).
  useEffect(() => {
    const breathing = liveConfig.current.breathing;
    const tween = gsap.to(envelopeRef.current, {
      value: speaking ? 1 : 0,
      duration: speaking ? breathing.attackSeconds : breathing.releaseSeconds,
      ease: speaking ? breathing.attackEase : breathing.releaseEase,
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [speaking]);

  useEffect(() => {
    const unsubscribe = subscribeLiquidClock((t) => {
      const root = rootRef.current;
      if (!root) return;
      const { breathing } = liveConfig.current;
      const envelope = envelopeRef.current.value;

      if (isLiquidClockReduced()) {
        root.style.opacity = (envelope * breathing.reducedMotionOpacity).toFixed(3);
        return;
      }

      const breath =
        breathing.floorRatio +
        (1 - breathing.floorRatio) * (0.5 + 0.5 * Math.sin(TAU * (breathing.rateBpm / 60) * t));
      root.style.opacity = (envelope * breathing.amplitude * breath).toFixed(3);

      // Color flow: cross-fade the second layer against the first.
      if (layerBRef.current) {
        layerBRef.current.style.opacity = (0.5 + 0.5 * Math.sin(t * 0.35)).toFixed(3);
      }
    });
    return unsubscribe;
  }, []);

  const palette = useMemo(() => {
    const base = (isDark && config.gradient.paletteDark) || config.gradient.palette;
    return base.length >= 4 ? base : [...base, ...base, ...base, ...base].slice(0, 4);
  }, [config.gradient.palette, config.gradient.paletteDark, isDark]);

  const spread = config.breathing.spread;
  const edgeBackground = (colors: string[]) =>
    [
      `linear-gradient(to bottom, ${colors[0]}, transparent ${spread}px)`,
      `linear-gradient(to top, ${colors[1]}, transparent ${spread}px)`,
      `linear-gradient(to right, ${colors[2]}, transparent ${spread}px)`,
      `linear-gradient(to left, ${colors[3]}, transparent ${spread}px)`,
    ].join(', ');

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: config.zLayers.aiAmbient, opacity: 0 }}
      aria-hidden="true"
      data-testid="ambient-speech-glow"
    >
      <div className="absolute inset-0" style={{ background: edgeBackground(palette) }} />
      <div
        ref={layerBRef}
        className="absolute inset-0"
        style={{
          background: edgeBackground([palette[2], palette[3], palette[0], palette[1]]),
          opacity: 0,
        }}
      />
    </div>
  );
}
