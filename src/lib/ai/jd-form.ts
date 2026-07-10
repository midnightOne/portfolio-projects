/**
 * Job-description form modal state (conversation-engine Req 13.4 expanded,
 * Block G3) — the client-side seam between the `job_description_form` client
 * tool (the model opens the modal via the existing client-tool path) and the
 * pill-rendered modal component. Same tiny fan-out pattern as the auto-nav
 * store: one source of truth, subscribers render/react.
 */

type Listener = (open: boolean) => void;

let open = false;
const listeners = new Set<Listener>();

export function isJdFormOpen(): boolean {
  return open;
}

export function setJdFormOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch (err) {
      console.warn('[jd-form] listener threw:', err);
    }
  }
}

export function subscribeJdForm(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
