/**
 * Notification seam (conversation-engine Req 15.2 — Block G6; design-ux §4).
 *
 * ONE dispatch point for every push notification the assistant produces, in
 * two bindings:
 *   - 'owner'   — pushes TO the owner (H2 lead notifications, later safety
 *                 alerts). Recipient is OWNER_NOTIFY_EMAIL; per Req 15.2 the
 *                 notify step is a tool-shaped action — server code (tools,
 *                 batch jobs) calls notifyOwner(), never a bespoke channel.
 *   - 'visitor' — artifacts TO a visitor-captured address (G3 JD-analysis
 *                 documents now; conversation summaries later). Rate-limited
 *                 to a couple of sends per conversation (Req 13.4).
 *
 * Contract (P25 discipline): the row that motivated the send (lead, email
 * capture) is committed BEFORE this seam runs; every send ATTEMPT lands one
 * AIEmailSend row — sent / failed / skipped_unconfigured / skipped_rate_limited
 * — so failures are visible in admin without ever losing data or failing the
 * caller. This function never throws.
 *
 * The legacy SecurityNotifier email stub (lib/services/ai/security-notifier)
 * predates this seam; when its email path is ever turned on, it should call
 * notifyOwner() rather than grow a second transport.
 */

import { prisma } from '@/lib/prisma';
import { getEmailTransport, type EmailMessage } from './email-transport';

export type NotifyStatus = 'sent' | 'failed' | 'skipped_unconfigured' | 'skipped_rate_limited';

export interface NotifyResult {
  status: NotifyStatus;
  /** AIEmailSend row id (absent only if even the log write failed). */
  sendId?: string;
  providerId?: string;
  error?: string;
}

export interface SendEmailParams {
  channel: 'owner' | 'visitor';
  /** Artifact kind: 'jd_analysis' | 'lead_notification' | … */
  purpose: string;
  /** Required for 'visitor'; 'owner' defaults to OWNER_NOTIFY_EMAIL. */
  to?: string;
  subject: string;
  text: string;
  html?: string;
  /** Conversation scope for the visitor rate limit (AIConversation.sessionId). */
  sessionId?: string | null;
  analysisId?: string | null;
  /** Admin-initiated dispatch (send-now/retry) is owner action, not visitor
   *  volume — it skips the per-conversation cap. */
  bypassRateLimit?: boolean;
  metadata?: Record<string, unknown>;
}

const DEFAULT_VISITOR_LIMIT = 2;

export function visitorEmailLimit(): number {
  const raw = Number(process.env.VISITOR_EMAIL_MAX_PER_CONVERSATION);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_VISITOR_LIMIT;
}

async function recordSend(
  params: SendEmailParams,
  recipient: string,
  status: NotifyStatus,
  extra: { providerId?: string; error?: string; transport?: string }
): Promise<string | undefined> {
  try {
    const row = await prisma.aIEmailSend.create({
      data: {
        channel: params.channel,
        purpose: params.purpose,
        recipient,
        sessionId: params.sessionId ?? null,
        analysisId: params.analysisId ?? null,
        subject: params.subject,
        status,
        providerId: extra.providerId ?? null,
        error: extra.error ?? null,
        metadata: {
          ...(params.metadata ?? {}),
          ...(extra.transport ? { transport: extra.transport } : {}),
          ...(params.bypassRateLimit ? { adminInitiated: true } : {}),
        } as never,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    // The log row is telemetry — its failure must not mask the send outcome.
    console.error('[notify] AIEmailSend log write failed:', error);
    return undefined;
  }
}

export async function sendEmail(params: SendEmailParams): Promise<NotifyResult> {
  try {
    const recipient =
      params.channel === 'owner'
        ? (params.to ?? process.env.OWNER_NOTIFY_EMAIL?.trim() ?? '')
        : (params.to ?? '');

    if (!recipient) {
      const error =
        params.channel === 'owner'
          ? 'OWNER_NOTIFY_EMAIL is not configured'
          : 'no recipient address';
      const sendId = await recordSend(params, '(none)', 'skipped_unconfigured', { error });
      return { status: 'skipped_unconfigured', sendId, error };
    }

    // Visitor rate limit: count SUCCESSFUL sends in this conversation. The
    // count-then-insert has a benign race (two concurrent sends can both pass
    // at the boundary — cap+1, portfolio scale) — no locks per P3 discipline.
    if (params.channel === 'visitor' && !params.bypassRateLimit && params.sessionId) {
      const sent = await prisma.aIEmailSend.count({
        where: { channel: 'visitor', sessionId: params.sessionId, status: 'sent' },
      });
      const limit = visitorEmailLimit();
      if (sent >= limit) {
        const error = `per-conversation limit reached (${sent}/${limit})`;
        const sendId = await recordSend(params, recipient, 'skipped_rate_limited', { error });
        return { status: 'skipped_rate_limited', sendId, error };
      }
    }

    const transport = getEmailTransport();
    if (!transport) {
      const error = 'no email transport configured (RESEND_API_KEY unset)';
      const sendId = await recordSend(params, recipient, 'skipped_unconfigured', { error });
      return { status: 'skipped_unconfigured', sendId, error };
    }

    const message: EmailMessage = {
      to: recipient,
      subject: params.subject,
      text: params.text,
      html: params.html,
      // Replies reach the human, never the bot (Req 15.4).
      replyTo: process.env.OWNER_NOTIFY_EMAIL?.trim() || undefined,
    };

    const outcome = await transport.send(message);
    if (outcome.ok) {
      const sendId = await recordSend(params, recipient, 'sent', {
        providerId: outcome.providerId,
        transport: transport.name,
      });
      return { status: 'sent', sendId, providerId: outcome.providerId };
    }

    const sendId = await recordSend(params, recipient, 'failed', {
      error: outcome.error,
      transport: transport.name,
    });
    return { status: 'failed', sendId, error: outcome.error };
  } catch (error) {
    // Never throws: a notification failure degrades to a logged state (P25).
    const message = error instanceof Error ? error.message : String(error);
    console.error('[notify] sendEmail failed:', error);
    return { status: 'failed', error: message };
  }
}

/** Owner-bound push — the tool-shaped notify action of Req 15.2. */
export async function notifyOwner(
  params: Omit<SendEmailParams, 'channel' | 'to'>
): Promise<NotifyResult> {
  return sendEmail({ ...params, channel: 'owner' });
}
