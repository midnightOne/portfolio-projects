/**
 * Email transport (conversation-engine Req 15.2 email channel — Block G6;
 * provider decision, owner 2026-07-11: **Resend**).
 *
 * This is the TRANSPORT layer only: one message in, one provider result out.
 * Policy — channels, rate limits, send-log rows, honest failure states —
 * lives in the notification seam (./notify.ts); nothing here reads or writes
 * the database. Swapping providers means swapping this file's fetch call,
 * nothing else (design-ux-and-behavior §4: "the seam makes it swappable").
 *
 * Selection (getEmailTransport):
 *   AI_FAKE_MODE=email  → FakeEmailTransport (deterministic, in-memory record;
 *                         refuses production via fake-mode.ts)
 *   RESEND_API_KEY set  → ResendTransport (https://api.resend.com/emails)
 *   otherwise           → null — a WELL-DEFINED unconfigured state the seam
 *                         records as 'skipped_unconfigured'; captures stay
 *                         durable and admin can dispatch later (P25 spirit).
 *
 * Env (keys live in env only — D3):
 *   RESEND_API_KEY      Resend secret
 *   EMAIL_FROM          sender, e.g. `Portfolio AI <ai@kirill.dev>`. Default is
 *                       Resend's dev-only sender (delivers ONLY to the Resend
 *                       account owner's address) — deploy-time swap to a
 *                       verified domain required for visitor-bound mail.
 */

import { isFakeMode } from '../fake-mode';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Reply-To — the owner's real address on visitor-bound mail, so replying
   *  reaches the human, never the bot (Req 15.4 no-impersonation posture). */
  replyTo?: string;
}

export type EmailSendOutcome =
  | { ok: true; providerId: string }
  | { ok: false; error: string };

export interface EmailTransport {
  readonly name: 'resend' | 'fake';
  send(message: EmailMessage): Promise<EmailSendOutcome>;
}

const DEFAULT_FROM = 'Portfolio AI <onboarding@resend.dev>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

class ResendTransport implements EmailTransport {
  readonly name = 'resend' as const;

  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailSendOutcome> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = typeof body?.message === 'string' ? body.message : `HTTP ${res.status}`;
        return { ok: false, error: `resend: ${detail}` };
      }

      const body = await res.json().catch(() => null);
      const id = typeof body?.id === 'string' ? body.id : 'unknown';
      return { ok: true, providerId: id };
    } catch (error) {
      const reason = error instanceof Error && error.name === 'AbortError'
        ? `timeout after ${SEND_TIMEOUT_MS}ms`
        : error instanceof Error ? error.message : String(error);
      return { ok: false, error: `resend: ${reason}` };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Messages "sent" by the fake transport, observable by tests and drills
 *  within one process. The durable observable is the AIEmailSend row the seam
 *  writes regardless of transport. */
export const fakeSentEmails: EmailMessage[] = [];

class FakeEmailTransport implements EmailTransport {
  readonly name = 'fake' as const;

  async send(message: EmailMessage): Promise<EmailSendOutcome> {
    fakeSentEmails.push(message);
    console.log(`[email:fake] to=${message.to} subject="${message.subject}" (${message.text.length} chars)`);
    return { ok: true, providerId: `fake-${fakeSentEmails.length}` };
  }
}

export function getEmailTransport(): EmailTransport | null {
  if (isFakeMode('email')) return new FakeEmailTransport();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) return new ResendTransport(apiKey);
  return null;
}
