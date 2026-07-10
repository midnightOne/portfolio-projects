/**
 * Auto-navigation consent preference (conversation-engine Req 13.8, Block G2;
 * P36) — the client-side source of truth for the pill's two-state toggle.
 *
 * OFF (the default for every new visitor — owner 2026-07-10): the agent must
 * ask before commit-level navigation ("do you want me to take you there?").
 * ON: the agent may navigate freely, multi-leg tours included, until turned
 * off. Preview-level moves supporting the current answer stay consent-free
 * either way (Req 13.6 unchanged).
 *
 * Flip paths (all converge here): the pill toggle (tap), the
 * `set_auto_navigation` client tool (spoken requests MUST become tool calls —
 * a model that merely SAYS it flipped the toggle while state stays put is a
 * trust bug, P36), and the agent after explicit visitor consent (same tool).
 *
 * Delivery: subscribers fan the value out — the base adapter publishes it
 * into the floating context block (model visibility) and records it as turn
 * evidence (server persistence into ConversationState.prefs); the pill
 * renders the control. localStorage keeps the choice across reloads on the
 * same device (a UX nicety like the continuity marker — never authorization).
 */

const STORAGE_KEY = 'pill-autonav';

type Listener = (enabled: boolean, source: AutoNavSource) => void;
export type AutoNavSource = 'tap' | 'tool' | 'hydrate';

let current = false;
let hydrated = false;
const listeners = new Set<Listener>();

function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    current = window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    current = false;
  }
}

export function getAutoNav(): boolean {
  hydrate();
  return current;
}

export function setAutoNav(enabled: boolean, source: AutoNavSource): boolean {
  hydrate();
  if (current === enabled) return current;
  current = enabled;
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* storage blocked — in-memory state still governs this page */
  }
  for (const listener of listeners) {
    try {
      listener(enabled, source);
    } catch (err) {
      console.warn('[autonav] listener threw:', err);
    }
  }
  return current;
}

export function subscribeAutoNav(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The model-visible policy line (P36: one plain line in the floating block). */
export function renderAutoNavPolicy(enabled: boolean): string {
  return enabled
    ? 'AUTO-NAVIGATION: ON — the visitor has consented to you navigating the site for them (multi-leg tours included) until they turn it off. Still keep moves purposeful; the answer leads, movement supports it.'
    : 'AUTO-NAVIGATION: OFF — always ask before a commit-level navigation ("want me to take you there?"). Scrolling/highlighting that supports what you are currently answering is fine without asking. An explicit question about content counts as consent to show it. You may offer to turn auto-navigation on (it is a visible toggle on the pill; flip it ONLY via the set_auto_navigation tool and ONLY after the visitor clearly agrees).';
}
