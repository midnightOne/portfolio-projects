"use client";

/**
 * Engine visitor surfaces (conversation-engine Req 13.1/13.3, Block G1):
 * suggested-question chips + the pill topic label.
 *
 * Owner-specified choreography (design-ux-and-behavior §9.1, 2026-07-10):
 *  - chips animate OUTWARDS from the text input section and float
 *    aesthetically above it — positionally stable once shown (never move
 *    under the cursor); max three;
 *  - stale chips (node transition) DISINTEGRATE before the new set appears;
 *  - a tapped chip plays a distinct "proper choice" animation while its
 *    siblings disintegrate;
 *  - untapped-sibling behavior is an A/B flag (P37): 'vanish' removes the
 *    whole row after a tap, 'retain' keeps the untapped chips tappable.
 *
 * Self-contained on purpose: relocates into the liquid-pill redesign
 * (ui-system task 3.5) without contract changes. The A/B flag is a
 * render-layer switch only — the engine neither knows nor cares (P37).
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { EngineChip, EngineUx } from '@/lib/ai/engine/types';

/** P37 render-layer A/B flag: localStorage override > env default > 'vanish'. */
export function chipTapMode(): 'vanish' | 'retain' {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pill-chip-tap-mode') : null;
    if (stored === 'vanish' || stored === 'retain') return stored;
  } catch {
    /* storage blocked — fall through to default */
  }
  return process.env.NEXT_PUBLIC_CHIP_TAP_MODE === 'retain' ? 'retain' : 'vanish';
}

interface EngineChipsRowProps {
  ux: EngineUx | null;
  onChipTap: (chip: EngineChip) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

/** Distinct exit animations: chosen chip vs disintegrating siblings (§9.1). */
const chipVariants = {
  exit: (custom: { chosen: boolean; index: number }) =>
    custom.chosen
      ? {
          // "a proper choice": affirm (scale + glow), then lift toward the transcript
          opacity: 0,
          scale: [1, 1.18, 1.05],
          y: [0, -2, -22],
          filter: 'blur(0px)',
          transition: { duration: 0.45, times: [0, 0.4, 1], ease: 'easeInOut' as const },
        }
      : {
          // disintegrate: blur apart with slight per-chip drift
          opacity: 0,
          scale: 0.85,
          y: -8,
          x: (custom.index - 1) * 10,
          filter: 'blur(10px)',
          transition: { duration: 0.32, ease: 'easeIn' as const },
        },
};

export function EngineChipsRow({ ux, onChipTap, disabled, className }: EngineChipsRowProps) {
  const [tappedId, setTappedId] = useState<string | null>(null);
  // 'vanish' mode hides the remainder of the CURRENT set after a tap; any new
  // ux snapshot (transition directive / response envelope) resets the row.
  const [consumedIds, setConsumedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'vanish' | 'retain'>('vanish');

  useEffect(() => setMode(chipTapMode()), []);

  // New surface snapshot → clean slate (replace-on-transition, Req 13.1)
  const uxKey = ux ? ux.chips.map((c) => c.id).join('|') : '';
  useEffect(() => {
    setTappedId(null);
    setConsumedIds(new Set());
  }, [uxKey]);

  // The container renders even when empty so AnimatePresence plays exits.
  const chips = (ux?.chips ?? []).filter((c) => !consumedIds.has(c.id));

  const handleTap = (chip: EngineChip) => {
    if (disabled || tappedId !== null) return;
    setTappedId(chip.id);
    // Let the choice/disintegrate animations read the tapped id, then consume.
    window.setTimeout(() => {
      setConsumedIds((prev) => {
        const next = new Set(prev);
        if (mode === 'vanish') {
          for (const c of ux?.chips ?? []) next.add(c.id);
        } else {
          next.add(chip.id);
        }
        return next;
      });
      setTappedId(null);
    }, 60);
    void onChipTap(chip);
  };

  return (
    <div
      className={cn('flex flex-wrap justify-center gap-2 min-h-0', className)}
      data-testid="engine-chips"
      aria-label="Suggested questions"
    >
      <AnimatePresence mode="popLayout">
        {chips.map((chip, index) => (
          <motion.button
            key={chip.id}
            custom={{ chosen: tappedId === chip.id, index }}
            variants={chipVariants}
            initial={{ opacity: 0, y: 16, scale: 0.85, filter: 'blur(6px)' }}
            animate={{
              opacity: 1,
              y: 0,
              scale: tappedId === chip.id ? 1.12 : 1,
              filter: 'blur(0px)',
              transition: { delay: index * 0.07, duration: 0.3, ease: 'easeOut' },
            }}
            exit="exit"
            onClick={() => handleTap(chip)}
            disabled={disabled}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-colors',
              'bg-background/90 border-border/60 text-foreground hover:bg-accent/20 hover:border-primary/40',
              tappedId === chip.id && 'border-primary bg-primary/10 shadow-[0_0_14px_rgba(59,130,246,0.45)]',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            data-testid="engine-chip"
            data-chip-id={chip.id}
          >
            {chip.label}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface EngineTopicLabelProps {
  label: string | null;
  className?: string;
}

/**
 * Pill topic indicator (Req 13.3): a small grayish line; hidden when the node
 * declares none. Swaps via disintegrate → appear-from-blur (§9.1).
 */
export function EngineTopicLabel({ label, className }: EngineTopicLabelProps) {
  return (
    <AnimatePresence mode="wait">
      {label && (
        <motion.div
          key={label}
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.35 } }}
          exit={{ opacity: 0, filter: 'blur(8px)', transition: { duration: 0.25 } }}
          className={cn('text-[11px] leading-none text-muted-foreground/80 select-none', className)}
          data-testid="engine-topic-label"
        >
          Topic: {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
