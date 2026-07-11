/**
 * JD-analysis email delivery (Block G6 — closes the G3 "capture only" gap,
 * Req 13.4: "email me the result" through the Req 15.2 notification seam).
 *
 * Composes the visitor-facing compatibility document into an email and
 * dispatches it on the rate-limited visitor channel. Two callers:
 *   - POST /api/ai/analyze-job/email-request (visitor asks from the modal)
 *   - POST /api/admin/ai/job-analyses/[id]/send-email (owner send-now/retry —
 *     bypasses the visitor cap; admin action is owner volume)
 *
 * The address capture is committed before this runs and survives any send
 * outcome (P25); honest state lives in the AIEmailSend row either way.
 */

import { prisma } from '@/lib/prisma';
import { sendEmail, type NotifyResult } from './notify';
import { renderEmailShell } from './email-render';

export async function sendJdAnalysisEmail(
  analysisId: string,
  options: { bypassRateLimit?: boolean } = {}
): Promise<NotifyResult> {
  const row = await prisma.aIJobAnalysis.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      sessionId: true,
      visitorEmail: true,
      positionTitle: true,
      companyName: true,
      analysisResult: true,
    },
  });

  if (!row) return { status: 'failed', error: 'analysis not found' };
  if (!row.visitorEmail) return { status: 'failed', error: 'no captured email address' };

  const result = row.analysisResult as { document?: unknown } | null;
  const document = typeof result?.document === 'string' ? result.document.trim() : '';
  if (!document) {
    // Pre-G3 rows have no visitor-facing document — nothing worth mailing.
    return { status: 'failed', error: 'analysis has no compatibility document' };
  }

  const role = row.positionTitle
    ? `${row.positionTitle}${row.companyName ? ` at ${row.companyName}` : ''}`
    : 'your role';
  const subject = `Compatibility analysis — ${role}`;
  const intro = `Here is the compatibility analysis you requested from the AI assistant on Kirill Prymachov's portfolio.`;
  const canReply = Boolean(process.env.OWNER_NOTIFY_EMAIL?.trim());
  const footer =
    `This document was written by the portfolio's AI assistant, grounded in Kirill's real project data — ` +
    `an automated assessment, not a statement from Kirill himself.` +
    (canReply ? ' Reply to this email to reach him directly.' : '');

  return sendEmail({
    channel: 'visitor',
    purpose: 'jd_analysis',
    to: row.visitorEmail,
    subject,
    text: `${intro}\n\n${document}\n\n—\n${footer}`,
    html: renderEmailShell({ intro, bodyMarkdown: document, footer }),
    sessionId: row.sessionId,
    analysisId: row.id,
    bypassRateLimit: options.bypassRateLimit,
  });
}
