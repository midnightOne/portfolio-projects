/**
 * M3 (Req 16 extension, design-ux-and-behavior §9.7): the admin query surface
 * over organic (graph-less) entry questions, BY CONDITION — proto-node keys
 * derived from UI events (project opened, section viewed, route change) by
 * the question-analytics batch. This is the data the first real graph gets
 * designed from. Read-only over rows the batch already wrote (P23 — nothing
 * here spends or touches the request path).
 *
 * Query params: ?event=project_opened|section_viewed|route_changed (optional)
 *               &match=<substring of the key's value> (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { getNodeQuestionClusters } from '@/lib/services/ai/engine-batches';
import { ORGANIC_GRAPH_ID } from '@/lib/services/ai/question-analytics';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

const PROTO_KEY_RE = /^proto:(project_opened|section_viewed|route_changed):(.+)$/;

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const eventFilter = searchParams.get('event');
  const matchFilter = searchParams.get('match')?.toLowerCase() ?? null;

  const nodes = await getNodeQuestionClusters(ORGANIC_GRAPH_ID);
  const protoNodes = nodes
    .map((n) => {
      const parsed = PROTO_KEY_RE.exec(n.nodeId);
      return {
        key: n.nodeId,
        event: parsed?.[1] ?? 'unknown',
        match: parsed?.[2] ?? n.nodeId,
        clusters: n.clusters,
        pending: n.pending,
        total: n.clusters.reduce((s, c) => s + c.count, 0) + n.pending,
      };
    })
    .filter((n) => (!eventFilter || n.event === eventFilter) && (!matchFilter || n.match.includes(matchFilter)))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json(createApiSuccess({ protoNodes }));
}
