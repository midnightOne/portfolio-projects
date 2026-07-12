"use client";

/**
 * Pill Visuals Playground (ui-system task 3.8 — this subsystem's one D16
 * admin playground slot; the wave-config panel is the pattern).
 *
 * Live-tweaks every tunable of the AI pill: tab-dock shape, gradient,
 * breathing, dimensions, morph timing. Changes write a config override to
 * localStorage through the AIVisualConfigProvider, so the preview here AND a
 * homepage pill open in another tab of this browser re-render instantly.
 *
 * Persistence decision (recorded in ui-system design.md): CODE stays the
 * source of truth — overrides are an iteration aid local to the admin's
 * browser and are never served to visitors. "Copy JSON" hands the tuned
 * values back for a one-line edit in ai-visual-config.ts.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, RotateCcw, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  AIVisualConfigProvider,
  useAIVisualOverride,
} from '@/lib/ui/ai-visual-config-context';
import {
  DEFAULT_AI_VISUAL_CONFIG,
  type AIVisualConfig,
  type AgentVisualState,
} from '@/lib/ui/ai-visual-config';
import { PillShell } from '@/components/ai/pill-shell';
import { AmbientSpeechGlow } from '@/components/ai/ambient-speech-glow';

// ---------------------------------------------------------------------------
// Slider schema — every tunable, one declaration each (task 3.8)
// ---------------------------------------------------------------------------

interface SliderSpec {
  path: string; // dot path into AIVisualConfig
  label: string;
  min: number;
  max: number;
  step: number;
}

const SHAPE_SLIDERS: SliderSpec[] = [
  { path: 'shape.dockMorphStart', label: 'Dock morph start (0..0.95)', min: 0, max: 0.95, step: 0.01 },
  { path: 'shape.panelRadius', label: 'Sidebar panel radius (px)', min: 4, max: 32, step: 1 },
];

const GRADIENT_STATE_SLIDERS = (state: AgentVisualState): SliderSpec[] => [
  { path: `gradient.states.${state}.intensity`, label: 'Intensity', min: 0, max: 1, step: 0.05 },
  { path: `gradient.states.${state}.rotationSpeed`, label: 'Rotation (°/s)', min: 0, max: 120, step: 1 },
  { path: `gradient.states.${state}.strokeWidth`, label: 'Edge width (px)', min: 0.5, max: 6, step: 0.25 },
  { path: `gradient.states.${state}.glowWidth`, label: 'Glow width (px)', min: 0, max: 30, step: 1 },
  { path: `gradient.states.${state}.glowOpacity`, label: 'Glow opacity', min: 0, max: 1, step: 0.02 },
];

const BREATHING_SLIDERS: SliderSpec[] = [
  { path: 'breathing.amplitude', label: 'Peak opacity', min: 0, max: 1, step: 0.02 },
  { path: 'breathing.spread', label: 'Spread (px)', min: 10, max: 400, step: 2 },
  { path: 'breathing.audioLevelGain', label: 'Audio-level gain', min: 0.5, max: 8, step: 0.1 },
  { path: 'breathing.rateBpm', label: 'Fallback breaths/min', min: 4, max: 30, step: 0.5 },
  { path: 'breathing.attackSeconds', label: 'Attack (s)', min: 0.1, max: 4, step: 0.1 },
  { path: 'breathing.releaseSeconds', label: 'Release (s)', min: 0.1, max: 5, step: 0.1 },
  { path: 'breathing.floorRatio', label: 'Floor between breaths', min: 0, max: 1, step: 0.05 },
  { path: 'breathing.reducedMotionOpacity', label: 'Reduced-motion tint', min: 0, max: 0.6, step: 0.02 },
];

const MORPH_SLIDERS: SliderSpec[] = [
  { path: 'morph.dockDuration', label: 'Dock duration (s)', min: 0.2, max: 2.5, step: 0.05 },
  { path: 'morph.undockDuration', label: 'Undock duration (s)', min: 0.2, max: 2.5, step: 0.05 },
  { path: 'morph.sidebarDuration', label: 'Sidebar slide (s)', min: 0.15, max: 1.5, step: 0.05 },
  { path: 'morph.pillRelocateDuration', label: 'Pill relocate (s)', min: 0.15, max: 1.5, step: 0.05 },
];

const DIMENSION_SLIDERS: SliderSpec[] = [
  { path: 'dimensions.desktop.maxWidth', label: 'Desktop max width (px)', min: 420, max: 960, step: 4 },
  { path: 'dimensions.desktop.height', label: 'Desktop base height (px)', min: 56, max: 120, step: 2 },
  { path: 'dimensions.desktop.bleedX', label: 'Desktop bleed X (px)', min: 16, max: 100, step: 2 },
  { path: 'dimensions.desktop.bleedTop', label: 'Desktop bleed top (px)', min: 4, max: 40, step: 1 },
  { path: 'dimensions.phone.maxWidth', label: 'Phone max width (px)', min: 300, max: 480, step: 4 },
  { path: 'dimensions.phone.height', label: 'Phone base height (px)', min: 48, max: 96, step: 2 },
  { path: 'dimensions.phone.bleedX', label: 'Phone bleed X (px)', min: 10, max: 60, step: 2 },
  { path: 'sidebar.width', label: 'Sidebar width (px)', min: 300, max: 560, step: 4 },
];

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj
  );
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cursor[keys[i]];
    if (!next || typeof next !== 'object') cursor[keys[i]] = {};
    cursor = cursor[keys[i]] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

// ---------------------------------------------------------------------------

function SliderRow({ spec, config, onChange }: {
  spec: SliderSpec;
  config: AIVisualConfig;
  onChange: (path: string, value: number) => void;
}) {
  const value = Number(getPath(config, spec.path) ?? 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{spec.label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{value.toFixed(spec.step < 0.1 ? 2 : spec.step < 1 ? 2 : 0)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(spec.path, v)}
        min={spec.min}
        max={spec.max}
        step={spec.step}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function PlaygroundInner() {
  const { config, override, setOverride } = useAIVisualOverride();

  const [previewState, setPreviewState] = useState<AgentVisualState>('idle');
  const [previewBreathing, setPreviewBreathing] = useState(false);
  const [dockPreview, setDockPreview] = useState(0);
  const dockRef = useRef(0);
  dockRef.current = dockPreview;
  const [copied, setCopied] = useState(false);
  const [gradientTab, setGradientTab] = useState<AgentVisualState>('idle');

  const handleChange = (path: string, value: number) => {
    // The whole edited config becomes the override — idempotent to merge,
    // one Reset away from code truth.
    const next = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
    setPath(next, path, value);
    setOverride(next as unknown as AIVisualConfig);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const dirty = useMemo(
    () => override !== null && JSON.stringify(config) !== JSON.stringify(DEFAULT_AI_VISUAL_CONFIG),
    [override, config]
  );

  return (
    <div className="space-y-4" data-testid="pill-visuals-playground">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOverride(null)}
          disabled={!dirty}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          data-testid="pill-visuals-reset"
        >
          <RotateCcw size={14} /> Reset to code defaults
        </button>
        <button
          onClick={copyJson}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
          data-testid="pill-visuals-copy"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />} Copy JSON
        </button>
        {dirty && (
          <span className="text-xs text-amber-500">
            Live override active (this browser only — code stays the source of truth)
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Tweaks apply instantly to the preview below AND to a homepage pill open in another tab of this
        browser. Visitors never see overrides — hand tuned values back via “Copy JSON” for a config edit.
      </p>

      {/* Live preview */}
      <Section title="Live preview">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          {(['idle', 'listening', 'thinking', 'speaking'] as AgentVisualState[]).map((s) => (
            <button
              key={s}
              onClick={() => setPreviewState(s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-colors',
                previewState === s
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
              data-testid={`pill-visuals-state-${s}`}
            >
              {s}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs">Breathing preview</Label>
            <Switch checked={previewBreathing} onCheckedChange={setPreviewBreathing} data-testid="pill-visuals-breathing" />
            {previewBreathing && <Volume2 size={13} className="text-primary animate-pulse" />}
          </div>
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Dock morph scrub (0 = floating, 1 = wetted)</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{dockPreview.toFixed(2)}</span>
          </div>
          <Slider value={[dockPreview]} onValueChange={([v]) => setDockPreview(v)} min={0} max={1} step={0.01} data-testid="pill-visuals-dock-scrub" />
        </div>
        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20 px-8 pt-16 pb-0">
          <div className="mx-auto" style={{ maxWidth: config.dimensions.desktop.maxWidth }}>
            <PillShell agentState={previewState} getDockProgress={() => dockRef.current}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex-1 text-lg text-muted-foreground select-none">Ask me about my work…</span>
                <div className="w-12 h-12 rounded-full bg-primary flex-shrink-0" />
              </div>
            </PillShell>
          </div>
        </div>
        {previewBreathing && <AmbientSpeechGlow speaking />}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Tab-dock shape (3.1)">
          <div className="grid gap-3 sm:grid-cols-2">
            {SHAPE_SLIDERS.map((s) => (
              <SliderRow key={s.path} spec={s} config={config} onChange={handleChange} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            The floating pill is the plain capsule; docking flips the outer bottom corners outward
            into feet that match the top radius and meet it at mid-height. The flip only plays over
            the tail of the dock travel (after “morph start”) — scrub the dock slider above to
            preview it.
          </p>
        </Section>

        <Section title="Edge gradient per state (3.6)">
          <div className="flex gap-2 mb-2">
            {(['idle', 'listening', 'thinking', 'speaking'] as AgentVisualState[]).map((s) => (
              <button
                key={s}
                onClick={() => setGradientTab(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                  gradientTab === s
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {GRADIENT_STATE_SLIDERS(gradientTab).map((s) => (
              <SliderRow key={s.path} spec={s} config={config} onChange={handleChange} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Palette colors are theme tokens (<code>--ai-glow-1…4</code> in globals.css) so both themes
            stay consistent; edit them there or via a custom <code>gradient.palette</code> override.
          </p>
        </Section>

        <Section title="Page glow while speaking (3.6)">
          <div className="grid gap-3 sm:grid-cols-2">
            {BREATHING_SLIDERS.map((s) => (
              <SliderRow key={s.path} spec={s} config={config} onChange={handleChange} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            In a live session the glow oscillates with the agent&apos;s actual audio level (× gain).
            This preview has no audio playing, so it shows the fallback breath instead.
          </p>
        </Section>

        <Section title="Morph timing & dimensions (3.1/3.3/3.4)">
          <div className="grid gap-3 sm:grid-cols-2">
            {MORPH_SLIDERS.map((s) => (
              <SliderRow key={s.path} spec={s} config={config} onChange={handleChange} />
            ))}
            {DIMENSION_SLIDERS.map((s) => (
              <SliderRow key={s.path} spec={s} config={config} onChange={handleChange} />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

export function PillVisualsPlayground() {
  return (
    <AIVisualConfigProvider>
      <PlaygroundInner />
    </AIVisualConfigProvider>
  );
}
