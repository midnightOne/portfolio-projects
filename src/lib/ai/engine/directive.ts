/**
 * Directive assembly: node → what the live session (or next-turn prompt
 * assembly) receives. Delivery strategy per the owner's 2026-07-09 decision:
 * sessions mint with full tools + guidance; node state reaches the model as
 * STRONG appended guidance — the engine-key entry of the D55 floating block —
 * rather than mid-session instruction replacement. Uniform across providers
 * (OpenAI applies it with exact block fidelity, Gemini by supersession,
 * cascade/text at prompt assembly).
 */

import type { EngineDirective, EngineUx, GraphNode, VisitorFlags } from './types';

/** Owner 2026-07-10: at most three chips render (design-ux-and-behavior §9.1). */
const MAX_CHIPS = 3;

/**
 * A node's visitor-visible surface (Req 13, Block G1) — full snapshot: what
 * this returns REPLACES whatever the pill showed before. Chips keep authored
 * order and truncate at three (validation warns at authoring; runtime never
 * renders more). Nodes with no `ux` yield the empty surface, which HIDES
 * chips/label — absence is a valid state, not "keep previous" (P22 stays
 * intact: only authored ids ever appear here).
 */
export function nodeUx(node: GraphNode): EngineUx {
  return {
    chips: (node.ux?.chips ?? []).slice(0, MAX_CHIPS),
    topicLabel: node.ux?.topicLabel ?? null,
  };
}

/** P21: slot values are user-provided text entering prompts — delimited, length-capped, data-not-instructions framing. */
const SLOT_VALUE_CAP = 200;

/** Flags render into templates as plain values (Req 19.2 unification) — engine-inferred, not user-typed, so no P21 delimiting. */
function flagTemplateValue(flags: VisitorFlags, name: string): string | null {
  const value = flags[name as keyof VisitorFlags];
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return String(value).trim() || null;
}

export function resolveSlotTemplates(
  text: string,
  slots: Record<string, string>,
  flags: VisitorFlags = {}
): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const resolved = text.replace(/\{\{(slots|flags)\.([a-zA-Z0-9_]+)\}\}/g, (_m, kind: string, name: string) => {
    if (kind === 'flags') {
      // Req 19.2: flags template like slots — same syntax, inferred source.
      const value = flagTemplateValue(flags, name);
      if (value === null) {
        unresolved.push(`flags.${name}`);
        return '';
      }
      return value;
    }
    const value = slots[name];
    if (typeof value !== 'string' || value.trim() === '') {
      unresolved.push(name);
      return '';
    }
    return `[visitor-stated ${name}: "${value.slice(0, SLOT_VALUE_CAP)}"]`;
  });
  return { text: resolved, unresolved };
}

/**
 * Render a node's guidance block — grounded framing, never canned reply text
 * (Req 1.2). This is the model-visible text; phrase everything as sayable
 * observations/goals (P31 applies to the whole block).
 */
export function renderNodeGuidance(
  node: GraphNode,
  slots: Record<string, string>,
  flags: VisitorFlags = {}
): { text: string; unresolvedSlots: string[] } {
  const lines: string[] = [`CURRENT CONVERSATION STATE: ${node.name}`];
  const unresolvedSlots: string[] = [];
  const resolve = (t: string) => {
    const r = resolveSlotTemplates(t, slots, flags);
    unresolvedSlots.push(...r.unresolved);
    return r.text;
  };

  for (const fragment of node.guidance.promptFragments) lines.push(resolve(fragment));
  if (node.guidance.talkingPoints?.length) {
    lines.push('Talking points:', ...node.guidance.talkingPoints.map((p) => `- ${resolve(p)}`));
  }
  if (node.guidance.negative?.length) {
    lines.push('Never:', ...node.guidance.negative.map((n) => `- ${resolve(n)}`));
  }
  if (node.guidance.navRefs?.length) {
    lines.push('Relevant site locations (navigate per your normal navigation rules):');
    lines.push(...node.guidance.navRefs.map((r) => `- ${r.label}: ${r.navTarget}`));
  }
  if (node.guidance.agenda?.length) {
    // Req 19.6 — the node's working goals, rendered into the floating block
    lines.push('Your current working agenda (work through it naturally):');
    lines.push(...node.guidance.agenda.map((a) => `- ${resolve(a)}`));
  }
  if (node.guidance.onEnterSuggestion) {
    lines.push(`Suggestion (you decide whether/when — Req 6.4): ${resolve(node.guidance.onEnterSuggestion)}`);
  }
  if (node.ux?.onEnterStaging) {
    // Req 13.2 AS AMENDED (owner 2026-07-10): staging is a suggestion to the
    // MODEL — the engine never executes navigation. One staged move at most,
    // via ui_intent, honoring the auto-navigation consent policy in the
    // context block; preview-level (scroll/highlight) over context-destroying
    // jumps unless the visitor asked (Req 13.6).
    const staging = node.ux.onEnterStaging;
    lines.push(
      `Staging suggestion for this state (optional; at most ONE staged move via ui_intent, honoring the AUTO-NAVIGATION policy shown in your context; prefer preview-level moves unless the visitor asked to be taken there): ${staging.navTarget}` +
        (staging.highlightText ? ` — highlight "${staging.highlightText}"` : '')
    );
  }
  return { text: lines.join('\n'), unresolvedSlots };
}

/** The engine-key floating-block text: guidance + resolved context set. */
export function buildEngineContextText(
  node: GraphNode,
  resolvedContext: string | null,
  slots: Record<string, string>,
  flags: VisitorFlags = {}
): { text: string; unresolvedSlots: string[] } {
  const guidance = renderNodeGuidance(node, slots, flags);
  const parts = [guidance.text];
  if (resolvedContext && resolvedContext.trim()) {
    parts.push('', 'PREPARED CONTEXT for this state (grounding material — cite/use it before searching):', resolvedContext);
  }
  return { text: parts.join('\n'), unresolvedSlots: guidance.unresolvedSlots };
}

export function buildTransitionDirective(args: {
  seq: number;
  engineContextText: string;
  /** Full provider-ready tool schema array when the node narrows tools (P8). */
  providerTools?: Array<Record<string, unknown>>;
  /** Rendered visitor profile (J2) — rides the same floating block under its own key (Req 19.1). */
  profileText?: string | null;
  /** Target node's visitor-visible surface (Req 13, G1) — replace-on-transition. */
  ux?: EngineUx;
}): EngineDirective {
  return {
    seq: args.seq,
    contextItems: [
      { key: 'engine', text: args.engineContextText },
      ...(args.profileText ? [{ key: 'profile', text: args.profileText }] : []),
    ],
    ...(args.providerTools ? { tools: args.providerTools } : {}),
    ...(args.ux ? { ux: args.ux } : {}),
  };
}

/**
 * Profile-only directive (J2): fast flags changed but no edge fired — the
 * live native session still gets the current assessment through the same
 * versioned, full-snapshot directive path (cascade/text re-derive it at
 * next-turn assembly instead, notes §2.2.9).
 */
export function buildProfileDirective(args: { seq: number; profileText: string }): EngineDirective {
  return {
    seq: args.seq,
    contextItems: [{ key: 'profile', text: args.profileText }],
  };
}
