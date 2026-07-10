/**
 * Directive assembly: node → what the live session (or next-turn prompt
 * assembly) receives. Delivery strategy per the owner's 2026-07-09 decision:
 * sessions mint with full tools + guidance; node state reaches the model as
 * STRONG appended guidance — the engine-key entry of the D55 floating block —
 * rather than mid-session instruction replacement. Uniform across providers
 * (OpenAI applies it with exact block fidelity, Gemini by supersession,
 * cascade/text at prompt assembly).
 */

import type { EngineDirective, GraphNode } from './types';

/** P21: slot values are user-provided text entering prompts — delimited, length-capped, data-not-instructions framing. */
const SLOT_VALUE_CAP = 200;

export function resolveSlotTemplates(text: string, slots: Record<string, string>): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const resolved = text.replace(/\{\{slots\.([a-zA-Z0-9_]+)\}\}/g, (_m, name: string) => {
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
export function renderNodeGuidance(node: GraphNode, slots: Record<string, string>): { text: string; unresolvedSlots: string[] } {
  const lines: string[] = [`CURRENT CONVERSATION STATE: ${node.name}`];
  const unresolvedSlots: string[] = [];
  const resolve = (t: string) => {
    const r = resolveSlotTemplates(t, slots);
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
  return { text: lines.join('\n'), unresolvedSlots };
}

/** The engine-key floating-block text: guidance + resolved context set. */
export function buildEngineContextText(
  node: GraphNode,
  resolvedContext: string | null,
  slots: Record<string, string>
): { text: string; unresolvedSlots: string[] } {
  const guidance = renderNodeGuidance(node, slots);
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
}): EngineDirective {
  return {
    seq: args.seq,
    contextItems: [{ key: 'engine', text: args.engineContextText }],
    ...(args.providerTools ? { tools: args.providerTools } : {}),
  };
}
