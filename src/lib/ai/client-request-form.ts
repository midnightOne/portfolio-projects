/**
 * Client/project-request intake modal state (ai-assistant 7.16, split (A) of
 * the owner fork) — the client-side seam between the `client_request_form`
 * client tool and the pill-rendered modal. Same tiny fan-out pattern as the
 * jd-form store: one source of truth, subscribers render/react.
 *
 * Deliberately SEPARATE from jd-form: the JD form feeds the recruiter
 * job-analysis pipeline (Req 13.4/G3); this intake feeds the pass-to-owner
 * lead path (Req 15.1/21.3, H2). One store per artifact keeps the framing
 * honest on both sides.
 */

type Listener = (open: boolean) => void;

let open = false;
const listeners = new Set<Listener>();

export function isClientRequestFormOpen(): boolean {
  return open;
}

export function setClientRequestFormOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch (err) {
      console.warn('[client-request-form] listener threw:', err);
    }
  }
}

export function subscribeClientRequestForm(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
