/**
 * GET/PATCH /api/admin/ai/leads (conversation-engine Req 15.2, task H3;
 * design.md §6 route table) — leads list + status transitions for
 * /admin/ai/leads and the sidebar badge. Admin-auth only (Req 11.1); thin:
 * auth → zod → lib/ai/leads/lead-admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { listLeads, countNewLeads, setLeadStatus, LEAD_STATUSES } from '@/lib/ai/leads/lead-admin';

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as { role?: string })?.role === 'admin';
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  const url = request.nextUrl;
  // Lightweight badge read: count of unreviewed leads, no rows.
  if (url.searchParams.get('countOnly') === 'true') {
    return NextResponse.json(createApiSuccess({ newCount: await countNewLeads() }));
  }
  const statusRaw = url.searchParams.get('status');
  const status = LEAD_STATUSES.find((s) => s === statusRaw);
  if (statusRaw && !status) {
    return NextResponse.json(createApiError('BAD_REQUEST', `status must be one of ${LEAD_STATUSES.join(', ')}`), { status: 400 });
  }
  const leads = await listLeads({ status });
  return NextResponse.json(createApiSuccess({ leads, newCount: leads.filter((l) => l.status === 'new').length }));
}

const PatchSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(LEAD_STATUSES),
});

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(createApiError('UNAUTHORIZED', 'Admin access required'), { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(createApiError('BAD_REQUEST', 'Invalid JSON body'), { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(createApiError('BAD_REQUEST', parsed.error.errors[0]?.message ?? 'Invalid body'), { status: 400 });
  }
  const lead = await setLeadStatus(parsed.data.leadId, parsed.data.status);
  if (!lead) {
    return NextResponse.json(createApiError('NOT_FOUND', 'Lead not found'), { status: 404 });
  }
  return NextResponse.json(createApiSuccess(lead));
}
