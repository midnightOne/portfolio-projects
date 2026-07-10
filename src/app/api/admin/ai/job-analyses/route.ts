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
      // G3: visitor "email me the result" capture (send ships with H2)
      visitorEmail: a.visitorEmail,
      emailRequestedAt: a.emailRequestedAt,
    })),
  });
}
