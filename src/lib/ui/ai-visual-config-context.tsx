"use client";

/**
 * AI visual-config provider (ui-system task 3.8).
 *
 * Components never import numbers from ai-visual-config.ts directly — they
 * call `useAIVisualConfig()` so the admin playground can retune every visual
 * aspect live. Override channel: the playground writes a DeepPartial config
 * JSON to localStorage (AI_VISUAL_OVERRIDE_STORAGE_KEY); this provider merges
 * it over the code defaults and re-merges on `storage` events, so tweaking a
 * slider on /admin/ai/pill-visuals re-renders a pill open in another tab of
 * the same browser instantly. Code stays the source of truth — overrides are
 * an iteration aid local to the admin's browser, never served to visitors.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AI_VISUAL_OVERRIDE_STORAGE_KEY,
  AI_VISUAL_CONFIG_VERSION,
  DEFAULT_AI_VISUAL_CONFIG,
  mergeAIVisualConfig,
  type AIVisualConfig,
  type DeepPartial,
} from './ai-visual-config';

interface AIVisualConfigContextValue {
  config: AIVisualConfig;
  /** Non-null when a live override is active (playground badge / reset). */
  override: DeepPartial<AIVisualConfig> | null;
  /** Playground writer: persists to localStorage and broadcasts. null clears. */
  setOverride: (override: DeepPartial<AIVisualConfig> | null) => void;
}

const AIVisualConfigContext = createContext<AIVisualConfigContextValue>({
  config: DEFAULT_AI_VISUAL_CONFIG,
  override: null,
  setOverride: () => {},
});

function readStoredOverride(): DeepPartial<AIVisualConfig> | null {
  try {
    const raw = window.localStorage.getItem(AI_VISUAL_OVERRIDE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Versioned envelope: a stale override (schema or defaults changed since
    // it was saved) must not shadow current code truth — discard it.
    if (parsed.v !== AI_VISUAL_CONFIG_VERSION || !parsed.override || typeof parsed.override !== 'object') {
      window.localStorage.removeItem(AI_VISUAL_OVERRIDE_STORAGE_KEY);
      return null;
    }
    return parsed.override as DeepPartial<AIVisualConfig>;
  } catch {
    return null;
  }
}

/** Same-tab broadcast (the `storage` event only fires in OTHER tabs). */
const OVERRIDE_EVENT = 'ai-visual-config-override-changed';

export function AIVisualConfigProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverrideState] = useState<DeepPartial<AIVisualConfig> | null>(null);

  useEffect(() => {
    setOverrideState(readStoredOverride());
    const sync = () => setOverrideState(readStoredOverride());
    window.addEventListener('storage', sync);
    window.addEventListener(OVERRIDE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(OVERRIDE_EVENT, sync);
    };
  }, []);

  const setOverride = (next: DeepPartial<AIVisualConfig> | null) => {
    try {
      if (next === null) {
        window.localStorage.removeItem(AI_VISUAL_OVERRIDE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          AI_VISUAL_OVERRIDE_STORAGE_KEY,
          JSON.stringify({ v: AI_VISUAL_CONFIG_VERSION, override: next })
        );
      }
    } catch {
      /* storage blocked — the in-memory override below still applies */
    }
    setOverrideState(next);
    window.dispatchEvent(new Event(OVERRIDE_EVENT));
  };

  const value = useMemo<AIVisualConfigContextValue>(
    () => ({
      config: mergeAIVisualConfig(DEFAULT_AI_VISUAL_CONFIG, override),
      override,
      setOverride,
    }),
    [override]
  );

  return <AIVisualConfigContext.Provider value={value}>{children}</AIVisualConfigContext.Provider>;
}

/** The one way components read visual tunables (zero magic numbers in components). */
export function useAIVisualConfig(): AIVisualConfig {
  return useContext(AIVisualConfigContext).config;
}

/** Playground-facing: current override + writer. */
export function useAIVisualOverride() {
  const { override, setOverride, config } = useContext(AIVisualConfigContext);
  return { override, setOverride, config };
}

/**
 * Live dark-theme flag (class-based theming, D13). Only needed when a custom
 * `paletteDark` override is active — the default palette is CSS-var tokens
 * that re-resolve on theme switch without JS.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}
