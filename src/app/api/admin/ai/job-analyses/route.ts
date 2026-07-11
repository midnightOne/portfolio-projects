/**
 * Admin: job-analysis review (ai-assistant task 8 / Req 8.1).
 * GET — recent AIJobAnalysis rows with reflink attribution for the review view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const limitParam = parseInt(request.nextUrl.searchParams.get('limit') ?? '25', 10);
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25;

  const analyses = await prisma.aIJobAnalysis.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reflink: { select: { code: true, name: true, recipientName: true } },
    },
  });

  // G6: latest send attempt per analysis (the honest email state — the badge
  // reads this, never guesses from emailRequestedAt alone).
  const sends = await prisma.aIEmailSend.findMany({
    where: { analysisId: { in: analyses.map((a) => a.id) }, purpose: 'jd_analysis' },
    orderBy: { createdAt: 'desc' },
    select: { analysisId: true, status: true, error: true, createdAt: true, recipient: true },
  });
  const latestSend = new Map<string, (typeof sends)[number]>();
  for (const s of sends) {
    if (s.analysisId && !latestSend.has(s.analysisId)) latestSend.set(s.analysisId, s);
  }

  return NextResponse.json({
    analyses: analyses.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      companyName: a.companyName,
      positionTitle: a.positionTitle,
      jobSpecification: a.jobSpecification,
      analysisResult: a.analysisResult,
      tokensUsed: a.tokensUsed,
      costUsd: a.costUsd ? Number(a.costUsd) : null,
      metadata: a.metadata,
      reflink: a.reflink,
      sessionId: a.sessionId,
      // G3: visitor "email me the result" capture; G6: latest send state
      visitorEmail: a.visitorEmail,
      emailRequestedAt: a.emailRequestedAt,
      emailSend: latestSend.has(a.id)
        ? {
            status: latestSend.get(a.id)!.status,
            error: latestSend.get(a.id)!.error,
            recipient: latestSend.get(a.id)!.recipient,
            at: latestSend.get(a.id)!.createdAt,
          }
        : null,
    })),
  });
}
