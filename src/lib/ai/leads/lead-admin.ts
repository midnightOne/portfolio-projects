/**
 * Admin-side lead reads/status transitions (conversation-engine Req 15.2,
 * task H3) — thin Prisma helpers consumed by GET/PATCH /api/admin/ai/leads
 * and the sidebar badge. Status lifecycle: new → seen → handled (any
 * direction is allowed — the owner's triage is not a state machine).
 */

import { prisma } from '@/lib/prisma';

export const LEAD_STATUSES = ['new', 'seen', 'handled'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadRow {
  id: string;
  conversationId: string;
  nodeId: string | null;
  graphVersionId: string | null;
  slots: Record<string, string>;
  fitNote: string | null;
  status: string;
  notifiedAt: string | null;
  notifyChannel: string | null;
  notifyError: string | null;
  createdAt: string;
  handledAt: string | null;
}

function toRow(lead: {
  id: string;
  conversationId: string;
  nodeId: string | null;
  graphVersionId: string | null;
  slots: unknown;
  fitNote: string | null;
  status: string;
  notifiedAt: Date | null;
  notifyChannel: string | null;
  notifyError: string | null;
  createdAt: Date;
  handledAt: Date | null;
}): LeadRow {
  return {
    id: lead.id,
    conversationId: lead.conversationId,
    nodeId: lead.nodeId,
    graphVersionId: lead.graphVersionId,
    slots: (lead.slots && typeof lead.slots === 'object' ? lead.slots : {}) as Record<string, string>,
    fitNote: lead.fitNote,
    status: lead.status,
    notifiedAt: lead.notifiedAt?.toISOString() ?? null,
    notifyChannel: lead.notifyChannel,
    notifyError: lead.notifyError,
    createdAt: lead.createdAt.toISOString(),
    handledAt: lead.handledAt?.toISOString() ?? null,
  };
}

export async function listLeads(opts: { status?: LeadStatus; limit?: number } = {}): Promise<LeadRow[]> {
  const leads = await prisma.conversationLead.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 100, 500),
  });
  return leads.map(toRow);
}

/** Sidebar badge: unreviewed leads (Req 15.2 "leads list + badge"). */
export async function countNewLeads(): Promise<number> {
  return prisma.conversationLead.count({ where: { status: 'new' } });
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<LeadRow | null> {
  try {
    // Block K (Req 21.4): handledAt is the retention clock base ("leads until
    // handled + M days") — stamped on entering handled, cleared on reopen so
    // a reopened lead never expires off a stale clock.
    const lead = await prisma.conversationLead.update({
      where: { id: leadId },
      data: { status, handledAt: status === 'handled' ? new Date() : null },
    });
    return toRow(lead);
  } catch {
    return null; // unknown id — the route answers 404
  }
}
