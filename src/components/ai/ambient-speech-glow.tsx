"use client";

/**
 * AmbientSpeechGlow (ui-system task 3.6) — "as if the page itself is
 * speaking" (owner 2026-07-11; revision 2026-07-12: the glow is much smaller
 * and oscillates with the ACTUAL audio intensity, not a fixed breath).
 *
 * A fixed, pointer-events-none viewport-edge layer gated by a GSAP
 * attack/release envelope on the speaking signal. Inside the envelope its
 * opacity follows the live agent output level (output-level-meter.ts — the
 * voice adapters tap their playback paths into it), so the edges pulse with
 * the voice. When no audio tap exists (e.g. a preview rig with no session)
 * it falls back to the old slow sine breath at `rateBpm`. Two stacked
 * gradient layers cross-fade on the shared ambient clock to make the colors
 * flow (compositor-only work: every animated property is opacity).
 *
 * Reduced motion: the oscillation and color flow collapse to a fixed gentle
 * tint at `breathing.reducedMotionOpacity` while speaking (0 disables).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { useAIVisualConfig, useIsDarkTheme } from '@/lib/ui/ai-visual-config-context';
import { subscribeAmbientClock, isAmbientClockReduced } from '@/lib/ui/ambient-clock';
import { getAgentOutputLevel } from '@/lib/voice/output-level-meter';

const TAU = Math.PI * 2;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

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
    const unsubscribe = subscribeAmbientClock((t) => {
      const root = rootRef.current;
      if (!root) return;
      const { breathing } = liveConfig.current;
      const envelope = envelopeRef.current.value;

      if (isAmbientClockReduced()) {
        root.style.opacity = (envelope * breathing.reducedMotionOpacity).toFixed(3);
        return;
      }

      // Live audio level when a playback tap exists; sine breath otherwise.
      const level = getAgentOutputLevel();
      const modulation =
        level === null
          ? 0.5 + 0.5 * Math.sin(TAU * (breathing.rateBpm / 60) * t)
          : clamp01(level * breathing.audioLevelGain);
      const presence = breathing.floorRatio + (1 - breathing.floorRatio) * modulation;
      root.style.opacity = (envelope * breathing.amplitude * presence).toFixed(3);

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
