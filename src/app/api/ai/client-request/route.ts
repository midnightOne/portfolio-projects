/**
 * Client/project-request intake submission (ai-assistant 7.16, split (A)).
 *
 * The pass-to-owner path for prospective clients and free-form visitor
 * messages: writes through `captureLead` (Block H2 — ConversationLead row
 * FIRST, then the ONE notification seam), never the recruiter job-analysis
 * pipeline. The visitor's own form submission is the consent moment
 * (Req 21.3) — `consentConfirmed: true` here attests a deliberate submit
 * click, not a model claim.
 *
 * Gateway-wrapped (D33 posture): no model tokens are spent here, but the
 * route emails the owner, so it gets the kill switch, blacklist, and rate
 * limiting like every other assistant surface. publicAllowed — leaving the
 * owner a message is the public tier's most legitimate conversion (the
 * lead_capture TOOL stays non-public; this route requires the visitor's own
 * typed submission).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { captureLead } from '@/lib/ai/leads/lead-capture';

const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTACT_CHARS = 200;
const MAX_SPEC_CHARS = 20_000;

interface ClientRequestBody {
  message?: string;
  contact?: string;
  specText?: string;
  sessionId?: string;
  reflinkId?: string;
  /** Which surface submitted: the AI intake modal (default) or the homepage contact form. */
  source?: string;
}

async function handlePOST(request: NextRequest, ctx: GatewayContext) {
  try {
    const body: ClientRequestBody = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, MAX_CONTACT_CHARS) : '';
    const specText = typeof body.specText === 'string' ? body.specText.trim().slice(0, MAX_SPEC_CHARS) : '';

    if (message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'A short message describing the request is required.' },
        { status: 400 }
      );
    }
    if (contact.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Contact details are required so the owner can reply.' },
        { status: 400 }
      );
    }

    // Anchor to the live conversation when the pill provided its session id;
    // otherwise fall back to the gateway public sid / a request-scoped id (a
    // form submitted with no conversation still must not be lost).
    const sessionId =
      (typeof body.sessionId === 'string' && body.sessionId.trim()) ||
      ctx.sessionId ||
      `client_request_${ctx.requestId}`;

    const source = body.source === 'contact_form' ? 'contact_form' : 'client_request_form';
    const result = await captureLead({
      sessionId,
      reflinkId: ctx.reflink?.id ?? (typeof body.reflinkId === 'string' ? body.reflinkId : undefined),
      consentConfirmed: true, // the visitor's own submit click (see header)
      fitNote: `${source === 'contact_form' ? 'Contact-form message' : 'Client request submitted via the intake form'}: ${message.slice(0, 160)}${message.length > 160 ? '…' : ''}`,
      slots: { contact, source },
      message,
      specText: specText || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'The request could not be recorded — please try again.' },
        { status: 500 }
      );
    }

    // Honest copy (P25): recorded is certain; whether the owner email SENT
    // depends on the notify outcome — never claim more than happened.
    const emailed = result.notification === 'sent';
    return NextResponse.json({
      success: true,
      leadId: result.leadId,
      message: emailed
        ? 'Your request was recorded and sent to Kirill.'
        : 'Your request was recorded for Kirill — he reviews these regularly.',
    });
  } catch (error) {
    console.error('[client-request] submission failed:', error);
    return NextResponse.json(
      { success: false, error: 'The request could not be recorded — please try again.' },
      { status: 500 }
    );
  }
}

// requirePublicSession is OFF: the homepage CONTACT FORM also submits through
// this route (7.16 closed its demo-stub submit), and an anonymous visitor
// mailing the owner must not need an AI chat session first. Public tier still
// gets the blacklist + the per-IP daily window (gateway step 4), which bounds
// the email/abuse surface per IP.
export const POST = withAIGateway(
  { feature: 'chat', publicAllowed: true, requirePublicSession: false },
  handlePOST
);
