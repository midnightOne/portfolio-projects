/**
 * Publish (Block D1, notes §2.3): validate (error severity BLOCKS, warnings
 * don't) → embed intent exemplars through `default-embedding` with the model
 * id recorded in the version document (P11) → immutable snapshot + activate
 * in one transaction (Req 1.3). Changes apply to NEW conversations only —
 * live ones keep their pinned version (P6).
 *
 * Gateway-wrapped (D33): exemplar embedding is a cost-incurring call; admin
 * is still required explicitly (a valid reflink also clears publicAllowed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { publishGraph } from '@/lib/services/ai/graph-store';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

const PublishSchema = z.object({ note: z.string().max(2000).optional() });

async function handlePOST(
  request: NextRequest,
  _ctx: GatewayContext,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const { id } = await params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const parsed = PublishSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', 'Invalid body'), { status: 400 });
  }

  const result = await publishGraph(id, parsed.data.note);
  if (!result) return NextResponse.json(createApiError('NOT_FOUND', 'Graph not found'), { status: 404 });
  if (!result.ok) {
    return NextResponse.json(
      createApiError('VALIDATION_FAILED', 'Validation errors block publish (warnings do not)', { issues: result.issues }),
      { status: 422 }
    );
  }
  return NextResponse.json(createApiSuccess(result));
}

export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
