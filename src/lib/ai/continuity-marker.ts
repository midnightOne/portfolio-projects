/**
 * Same-device continuity marker (Block I3, Req 17.1 / P32). A localStorage
 * hint — deliberately NOT sessionStorage, it must survive browser restarts —
 * that records which conversation this device last held on a reflink.
 *
 * P32 is the whole design: the marker is a UX selector, never auth. Marker
 * matches the server's latest conversation → silent auto-resume ("as if after
 * a brief disruption"); marker absent/mismatched (new device, forwarded URL)
 * → the confirm-with-summary path. Reflink validation remains the sole access
 * control — a stolen marker without the reflink gets nothing, and a missing
 * marker never locks a legitimate visitor out (worst case: one confirmation
 * tap).
 */

const STORAGE_KEY = 'portfolio-ai-continuity';

interface ContinuityStore {
  [reflinkCode: string]: { sessionId: string; at: string };
}

function readStore(): ContinuityStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as ContinuityStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: ContinuityStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full/blocked — the marker is a hint; losing it costs one confirmation tap */
  }
}

export function readContinuityMarker(reflinkCode: string): string | null {
  const entry = readStore()[reflinkCode];
  return typeof entry?.sessionId === 'string' ? entry.sessionId : null;
}

export function writeContinuityMarker(reflinkCode: string, sessionId: string): void {
  const store = readStore();
  const existing = store[reflinkCode];
  if (existing?.sessionId === sessionId) return; // idempotent per turn
  store[reflinkCode] = { sessionId, at: new Date().toISOString() };
  writeStore(store);
}

export function clearContinuityMarker(reflinkCode: string): void {
  const store = readStore();
  if (!(reflinkCode in store)) return;
  delete store[reflinkCode];
  writeStore(store);
}
