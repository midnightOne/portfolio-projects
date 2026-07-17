"use client";

/**
 * Client/project-request intake modal (ai-assistant 7.16, split (A) of the
 * owner fork — recruiter JD analysis and client project requests are SEPARATE
 * artifacts).
 *
 * The pass-to-owner path: a prospective client (or any visitor with a message
 * for the owner) types or dictates a message, leaves contact details, and can
 * paste a project spec/requirements. Submission goes through
 * `/api/ai/client-request` → `captureLead` (Block H2: row-first, then
 * notifyOwner) — deliberately NOT the recruiter job-analysis pipeline.
 *
 * Consent (Req 21.3): the visitor's own submit click IS the consent moment.
 * The model can dictate into these fields via fill_field, but may trigger
 * submission only with the visitor's explicit confirmation (fill_field's
 * submitConfirmed gate). All fields carry data-semantic-id handles so
 * fill_field resolves them by name.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  subscribeClientRequestForm,
  isClientRequestFormOpen,
  setClientRequestFormOpen,
} from '@/lib/ai/client-request-form';
import { Z_LAYERS } from '@/lib/ui/ai-visual-config';

const MAX_MESSAGE_CHARS = 4000; // mirrors the lead-capture message cap
const MAX_SPEC_CHARS = 20_000; // mirrors the JD form / lead-capture spec cap

interface ClientRequestModalProps {
  reflinkId?: string;
  /** Live conversation session id — anchors the lead to this conversation. */
  getSessionId?: () => string | null | undefined;
  /** Publish assistant-facing context (submission / dismissal) into the floating block. */
  onAssistantContext?: (text: string) => void;
}

type Phase = 'input' | 'submitting' | 'done' | 'error';

export function ClientRequestModal({ reflinkId, getSessionId, onAssistantContext }: ClientRequestModalProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('input');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [specText, setSpecText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    setOpen(isClientRequestFormOpen());
    return subscribeClientRequestForm((next) => {
      setOpen(next);
      if (next) {
        setPhase('input');
        setError(null);
        setOutcome(null);
      }
    });
  }, []);

  const close = useCallback(() => {
    if (phase !== 'done') {
      onAssistantContext?.(
        'The visitor closed the client-request form WITHOUT submitting. Do not reopen it unasked — offer to capture their request conversationally instead (lead_capture, with their consent).'
      );
    }
    setClientRequestFormOpen(false);
  }, [onAssistantContext, phase]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phase === 'submitting') return;
    const trimmedMessage = message.trim();
    const trimmedContact = contact.trim();
    if (trimmedMessage.length < 10) {
      setError('Say a little more about what you need — a sentence or two is plenty.');
      return;
    }
    if (trimmedContact.length < 3) {
      setError('Leave a way to reach you (email, LinkedIn, phone…) so Kirill can actually reply.');
      return;
    }
    setPhase('submitting');
    setError(null);
    try {
      const res = await fetch('/api/ai/client-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          contact: trimmedContact,
          specText: specText.trim() || undefined,
          sessionId: getSessionId?.() ?? undefined,
          reflinkId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Could not send that — please try again.');
      }
      // Honest copy from the server (recorded ≠ emailed, P25).
      setOutcome(typeof data.message === 'string' ? data.message : 'Your request has been passed along.');
      setPhase('done');
      onAssistantContext?.(
        `CLIENT REQUEST SUBMITTED (the visitor sees the confirmation in the modal). Their message and contact were recorded for the owner${specText.trim() ? ', with an attached spec' : ''}. Tell them it has been passed along and the owner typically follows up within a couple of days — do not promise faster contact or speak as the owner.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that — please try again.');
      setPhase('error');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: Z_LAYERS.aiOverlay }}
          onClick={close}
          data-testid="client-request-modal"
          data-ai-surface="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">
                  {phase === 'done' ? 'Request sent' : 'Send Kirill a project request'}
                </h2>
              </div>
              <button
                onClick={close}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
                data-testid="client-request-close"
              >
                <X size={18} />
              </button>
            </div>

            {phase === 'done' ? (
              <div className="p-8 text-center space-y-3" data-testid="client-request-done">
                <Check className="h-10 w-10 text-green-500 mx-auto" />
                <p className="text-sm text-foreground">{outcome}</p>
                <p className="text-xs text-muted-foreground">He typically follows up within a couple of days.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 space-y-3" data-semantic-id="client-request-form">
                <p className="text-sm text-muted-foreground">
                  Describe what you want built or ask anything — it goes straight to Kirill. You can also dictate any
                  field to the assistant.
                </p>
                <div>
                  <label htmlFor="client-request-message" className="block text-sm font-medium mb-1.5 text-foreground">
                    Your message / request *
                  </label>
                  <textarea
                    id="client-request-message"
                    name="client-request-message"
                    data-semantic-id="client-request-message"
                    data-testid="client-request-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
                    placeholder="What do you need? Scope, goals, timeline — or just a question."
                    rows={4}
                    disabled={phase === 'submitting'}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 resize-y"
                  />
                </div>
                <div>
                  <label htmlFor="client-request-contact" className="block text-sm font-medium mb-1.5 text-foreground">
                    How to reach you *
                  </label>
                  <input
                    id="client-request-contact"
                    name="client-request-contact"
                    data-semantic-id="client-request-contact"
                    data-testid="client-request-contact"
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value.slice(0, 200))}
                    placeholder="Email, LinkedIn, phone…"
                    disabled={phase === 'submitting'}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label htmlFor="client-request-spec" className="block text-sm font-medium mb-1.5 text-foreground">
                    Project spec / requirements <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="client-request-spec"
                    name="client-request-spec"
                    data-semantic-id="client-request-spec"
                    data-testid="client-request-spec"
                    value={specText}
                    onChange={(e) => setSpecText(e.target.value.slice(0, MAX_SPEC_CHARS))}
                    placeholder="Paste a spec, requirements doc, or brief here if you have one."
                    rows={5}
                    disabled={phase === 'submitting'}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 resize-y"
                  />
                  {specText.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {specText.length.toLocaleString()} / {MAX_SPEC_CHARS.toLocaleString()}
                    </span>
                  )}
                </div>
                {error && <p className="text-sm text-red-500" data-testid="client-request-error">{error}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={phase === 'submitting'}
                    data-semantic-id="client-request-submit"
                    data-testid="client-request-submit"
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {phase === 'submitting' ? 'Sending…' : 'Send to Kirill'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
