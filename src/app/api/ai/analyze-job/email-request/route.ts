/**
 * POST /api/ai/analyze-job/email-request (conversation-engine Req 13.4
 * expanded, Block G3): record the visitor's "email me the result" request
 * against their analysis row. CAPTURE ONLY — the actual send ships with the
 * H2 visitor-bound, rate-limited email channel ("email IS MCP": the send will
 * be a tool-shaped action through the notification seam); the honest UI copy
 * is "you'll receive it", with the owner's under-promise timing rules.
 *
 * Ownership check: the analysis row must belong to the caller's reflink (the
 * same credential that authorized creating it) — an analysisId is not a
 * bearer token. Reflink-gated like the analysis itself (publicAllowed: false).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { prisma } from '@/lib/prisma';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

async function handlePOST(request: NextRequest, ctx: GatewayContext) {
  const body = await request.json().catch(() => null);
  const analysisId = typeof body?.analysisId === 'string' ? body.analysisId : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  if (!analysisId || analysisId.length > 100) {
    return NextResponse.json({ error: 'analysisId is required', code: 'BAD_REQUEST' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const row = await prisma.aIJobAnalysis.findUnique({
    where: { id: analysisId },
    select: { id: true, reflinkId: true },
  });
  // Not found and not-yours answer identically — no existence oracle.
  if (!row || (row.reflinkId && row.reflinkId !== ctx.reflink?.id)) {
    return NextResponse.json({ error: 'Analysis not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  await prisma.aIJobAnalysis.update({
    where: { id: analysisId },
    data: { visitorEmail: email, emailRequestedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    message: 'Email recorded — the result will be sent to you.',
  });
}

// Reflink/admin only, same surface class as the analysis itself. No AI spend —
// gateway is for tiering/rate limits, not metering.
export const POST = withAIGateway({ feature: 'tools', publicAllowed: false }, handlePOST);
