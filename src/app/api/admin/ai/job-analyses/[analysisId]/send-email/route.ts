/**
 * POST /api/admin/ai/job-analyses/[analysisId]/send-email (Block G6):
 * owner-initiated dispatch/retry of the JD compatibility document to the
 * visitor-captured address — the P25 retry path for sends that were skipped
 * (provider unconfigured at request time) or failed. Admin action is owner
 * volume, so it bypasses the visitor per-conversation cap; every attempt
 * still lands an AIEmailSend row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { sendJdAnalysisEmail } from '@/lib/ai/leads/jd-email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { analysisId } = await params;
  if (!analysisId || analysisId.length > 100) {
    return NextResponse.json({ error: 'analysisId is required' }, { status: 400 });
  }

  const result = await sendJdAnalysisEmail(analysisId, { bypassRateLimit: true });
  const httpStatus =
    result.status === 'sent'
      ? 200
      : result.status === 'skipped_unconfigured'
        ? 503 // provider not configured — set RESEND_API_KEY
        : result.error?.startsWith('resend')
          ? 502 // transport rejected the send
          : 400; // no captured address / no document on this row

  return NextResponse.json(
    { status: result.status, providerId: result.providerId, error: result.error },
    { status: httpStatus }
  );
}
