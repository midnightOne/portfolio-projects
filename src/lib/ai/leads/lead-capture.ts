/**
 * Lead capture (conversation-engine Req 15.1/21.3, task H2; design-ux §4).
 *
 * The server side of the `lead_capture` registry tool: writes the
 * ConversationLead row FIRST, then pushes through the Req 15.2 notification
 * seam ("email IS MCP" — the notify step is a tool-shaped action the harness
 * invokes, owner 2026-07-09). P25 discipline throughout: a notification
 * failure never loses the lead — the row commits before any send attempt, and
 * the send outcome lands on the row (notifiedAt/notifyChannel/notifyError) so
 * the admin list can badge failures.
 *
 * Consent (Req 21.3) is conversational and explicit — the agent asks the
 * visitor before calling the tool. The `consentConfirmed` parameter makes the
 * model attest to that in the tool call; the transcript is the evidence. A
 * call without the attestation records nothing and tells the model to ask.
 */

import { prisma } from '@/lib/prisma';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';
import { ConversationEngine } from '@/lib/ai/engine/engine';
import { notifyOwner } from './notify';
import { renderEmailShell, escapeHtml } from './email-render';

/** P21-adjacent hygiene: slot values are visitor text — capped, bounded count. */
const SLOT_VALUE_CAP = 200;
const MAX_SLOTS = 20;
const FIT_NOTE_CAP = 2000;
/** 7.16: free-form visitor message/request text (client-request intake). */
const MESSAGE_CAP = 4000;
/** 7.16: pasted project spec/requirements — mirrors the JD form's 20k cap. */
const SPEC_TEXT_CAP = 20_000;

export interface LeadCaptureParams {
  sessionId: string;
  reflinkId?: string;
  /** Model attestation that the visitor explicitly agreed (Req 21.3). */
  consentConfirmed: boolean;
  /** Agent's short fit note: who they are, what they want, why it fits. */
  fitNote: string;
  /** Details stated in conversation — merged OVER the engine-captured slots. */
  slots?: Record<string, unknown>;
  /** 7.16: the visitor's own message/question/request, verbatim, to pass along. */
  message?: string;
  /** 7.16: pasted project spec/requirements text (client-request intake form). */
  specText?: string;
}

export interface LeadCaptureResult {
  success: boolean;
  leadId?: string;
  /** Outcome of the owner push: sent / failed / skipped_* / not_attempted. */
  notification?: string;
  /** Model-facing next-step text (honest per P25: recorded ≠ emailed). */
  message: string;
}

function sanitizeSlots(raw: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_SLOTS) break;
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_]{1,60}$/.test(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim().slice(0, SLOT_VALUE_CAP);
    if (text) out[key] = text;
  }
  return out;
}

function leadEmail(args: {
  leadId: string;
  slots: Record<string, string>;
  fitNote: string;
  conversationId: string;
  message?: string;
  specText?: string;
}): {
  subject: string;
  text: string;
  html: string;
} {
  const who = args.slots.company ?? args.slots.name ?? args.slots.contact ?? args.slots.contact_info ?? 'a visitor';
  const isClientRequest = Boolean(args.message || args.specText);
  const subject = `${isClientRequest ? 'Portfolio client request' : 'Portfolio lead'}: ${who}`.slice(0, 140);
  const slotLines = Object.entries(args.slots).map(([k, v]) => `- **${k}**: ${v}`);
  const bodyMarkdown = [
    isClientRequest ? '## New client request' : '## New conversation lead',
    args.fitNote,
    args.message ? ['### Visitor message', args.message].join('\n\n') : '',
    args.specText
      ? ['### Attached spec / requirements', args.specText.length > 4000 ? `${args.specText.slice(0, 4000)}\n\n… (${args.specText.length.toLocaleString()} chars total — full text on the lead row)` : args.specText].join('\n\n')
      : '',
    slotLines.length ? ['### Details', slotLines.join('\n')].join('\n\n') : '',
    `Review it at /admin/ai/leads (lead ${args.leadId}) — the conversation replay is linked there.`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    subject,
    text: `${args.fitNote}\n\n${args.message ? `Visitor message:\n${args.message}\n\n` : ''}${
      args.specText ? `Spec/requirements (${args.specText.length.toLocaleString()} chars):\n${args.specText.slice(0, 4000)}\n\n` : ''
    }${Object.entries(args.slots)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')}\n\nLead ${args.leadId} · conversation ${args.conversationId}`,
    html: renderEmailShell({
      intro: isClientRequest
        ? 'The portfolio assistant captured a client request to pass along.'
        : 'The portfolio assistant captured a qualified lead.',
      bodyMarkdown,
      footer: `Lead ${escapeHtml(args.leadId)} · conversation ${escapeHtml(args.conversationId)} · sent by the lead_capture tool`,
    }),
  };
}

/**
 * Row first, notify after (P25). Never throws — the tool result is the only
 * surface, and it reports honestly.
 */
export async function captureLead(params: LeadCaptureParams): Promise<LeadCaptureResult> {
  try {
    if (params.consentConfirmed !== true) {
      return {
        success: false,
        message:
          'Lead NOT recorded: explicit visitor consent is required first (Req 21.3). Ask the visitor whether they want their details passed to the owner — e.g. "I\'ll pass this along to Kirill with your contact — that okay?" — then call this tool again with consentConfirmed: true.',
      };
    }
    const fitNote = (params.fitNote ?? '').trim().slice(0, FIT_NOTE_CAP);
    if (!fitNote) {
      return {
        success: false,
        message: 'Lead NOT recorded: fitNote is required — a short summary of who the visitor is, what they want, and why it fits.',
      };
    }
    const message = (params.message ?? '').trim().slice(0, MESSAGE_CAP) || undefined;
    const specText = (params.specText ?? '').trim().slice(0, SPEC_TEXT_CAP) || undefined;

    // The conversation is the anchor (Req 15.1: the lead links to it). Created
    // if this is somehow the very first exchange of a session — a lead must
    // never dangle.
    const conversationId = await conversationHistoryManager.getOrCreateConversationId(
      params.sessionId,
      params.reflinkId
    );

    // Engine-captured slots (stated facts, Req 14) seed the snapshot; the
    // model's own parameters — often fresher within the same turn — win per key.
    const engineState = ConversationEngine.parseEngineState(
      await conversationHistoryManager.readEngineStateRaw(conversationId)
    );
    const slots: Record<string, string> = {
      ...(engineState?.slots ?? {}),
      ...sanitizeSlots(params.slots),
    };

    // ---- 1. The row — durability beats notification (P25) ----
    const lead = await prisma.conversationLead.create({
      data: {
        conversationId,
        nodeId: engineState?.nodeId ?? null,
        graphVersionId: engineState?.graphVersionId ?? null,
        slots: slots as never,
        fitNote,
        message: message ?? null,
        specText: specText ?? null,
        status: 'new',
      },
      select: { id: true },
    });

    // ---- 2. Capture-moment marker — replay shows it (telemetry-only posture) ----
    try {
      await conversationHistoryManager.recordSessionMarker(conversationId, {
        type: 'lead_captured',
        leadId: lead.id,
        evidence: fitNote.slice(0, 120),
      });
    } catch (err) {
      console.warn('[lead-capture] capture marker failed (lead unaffected):', err);
    }

    // ---- 3. The push — through the ONE notification seam (Req 15.2) ----
    const mail = leadEmail({ leadId: lead.id, slots, fitNote, conversationId, message, specText });
    const outcome = await notifyOwner({
      purpose: 'lead_notification',
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      sessionId: params.sessionId,
      metadata: { leadId: lead.id },
    });
    try {
      await prisma.conversationLead.update({
        where: { id: lead.id },
        data:
          outcome.status === 'sent'
            ? { notifiedAt: new Date(), notifyChannel: 'email', notifyError: null }
            : { notifyChannel: 'email', notifyError: outcome.error ?? outcome.status },
      });
    } catch (err) {
      console.warn('[lead-capture] notify-state write failed (lead + send log intact):', err);
    }

    // Honest the moment the row commits (P25): "recorded" never claims "emailed".
    return {
      success: true,
      leadId: lead.id,
      notification: outcome.status,
      message:
        'Lead recorded for the owner. Tell the visitor it has been passed along and that the owner typically follows up within a couple of days — do not promise faster contact or speak as the owner.',
    };
  } catch (error) {
    console.error('[lead-capture] captureLead failed:', error);
    return {
      success: false,
      message: 'Lead capture failed on the server. Apologize briefly and offer the LinkedIn fast path instead.',
    };
  }
}
