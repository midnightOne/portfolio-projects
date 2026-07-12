/**
 * Sandboxed test-session flag (conversation-engine Req 10.1, Block F1; P17) —
 * the CLIENT half of the single test-tagging seam.
 *
 * When enabled (an owner/admin affordance — the fake-mic panel toggle, or
 * setting localStorage directly), every runtime's persistence requests carry
 * `test: true`: the base voice adapter adds it to each /log POST and the
 * cascade/text chat clients add it to /chat bodies. The SERVER decides whether
 * to honor it — only an admin-authenticated caller can tag a conversation
 * (Req 10.1 "admin-gated"), so this flag is a request, never authorization.
 *
 * The durable flag lives in ONE place: `AIConversation.metadata.test === true`,
 * written once at conversation creation. Coverage (Req 9.3), question
 * analytics (Req 16.5), spend alarms (ledger watchdog), and debug-level
 * traversal telemetry (edge_evaluated rows, Req 7.3) all read that same flag —
 * P17 forbids parallel exclusion mechanisms.
 */

const STORAGE_KEY = 'pill-test-session';

let current = false;
let hydrated = false;

function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    current = window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    current = false;
  }
}

export function isTestSessionEnabled(): boolean {
  hydrate();
  return current;
}

export function setTestSessionEnabled(enabled: boolean): boolean {
  hydrate();
  current = enabled;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    }
  } catch {
    /* storage blocked — in-memory state still governs this page */
  }
  return current;
}

/** Test-only: reset module state so jsdom tests can re-hydrate. */
export function __resetTestSessionForTests(): void {
  current = false;
  hydrated = false;
}
