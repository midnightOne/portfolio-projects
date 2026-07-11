'use client';

/**
 * Admin leads surface (conversation-engine Req 15.2, task H3): every
 * ConversationLead the lead_capture tool recorded — slot snapshot, agent fit
 * note, status triage (new / seen / handled), the notification outcome
 * (including the P25 failed-notification badge: the lead is durable even when
 * the push wasn't), and the deep link into conversation replay at the capture
 * turn (same rail as the E2 annotation drawer).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, MailCheck, MailWarning, MailX, MessagesSquare } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import type { LeadRow, LeadStatus } from '@/lib/ai/leads/lead-admin';

const STATUS_FILTERS: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'seen', label: 'Seen' },
  { value: 'handled', label: 'Handled' },
];

const STATUS_BADGE: Record<string, string> = {
  new: 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  seen: 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  handled: 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
};

/** Honest notification state per P25: sent / failed (badged) / not pushed. */
function NotificationState({ lead }: { lead: LeadRow }) {
  if (lead.notifiedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
        <MailCheck className="h-3.5 w-3.5" />
        emailed {new Date(lead.notifiedAt).toLocaleString()}
      </span>
    );
  }
  if (lead.notifyError) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
        title={lead.notifyError}
        data-testid="lead-notify-failed"
      >
        <MailWarning className="h-3.5 w-3.5" />
        notification not delivered — {lead.notifyError.slice(0, 80)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <MailX className="h-3.5 w-3.5" /> no push attempted
    </span>
  );
}

export function LeadsPanel() {
  const toast = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ai/leads${filter === 'all' ? '' : `?status=${filter}`}`);
      const json = await res.json();
      if (json.success) setLeads(json.data.leads);
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const setStatus = async (leadId: string, status: LeadStatus) => {
    setUpdating(leadId);
    try {
      const res = await fetch('/api/admin/ai/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Update failed');
      setLeads((prev) => prev.map((l) => (l.id === leadId ? json.data : l)));
    } catch (error) {
      toast.error('Status update failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card data-testid="leads-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-4 w-4" /> Conversation leads
        </CardTitle>
        <CardDescription>
          Captured by the assistant&apos;s lead_capture tool after explicit visitor consent — the row is
          written before any notification, so a failed email never loses a lead.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                filter === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
              data-testid={`leads-filter-${f.value}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="leads-empty">
            No leads{filter !== 'all' ? ` with status "${filter}"` : ' yet'} — qualified conversations end
            up here once the agent captures them.
          </p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-lg border p-3" data-testid="lead-card">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-xs capitalize ${STATUS_BADGE[lead.status] ?? ''}`}>
                    {lead.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleString()}
                  </span>
                  {lead.nodeId && (
                    <Badge variant="secondary" className="text-[10px]" title={`graph version ${lead.graphVersionId ?? '—'}`}>
                      node: {lead.nodeId}
                    </Badge>
                  )}
                  <span className="ml-auto">
                    <NotificationState lead={lead} />
                  </span>
                </div>

                {lead.fitNote && <p className="mt-2 text-sm">{lead.fitNote}</p>}

                {Object.keys(lead.slots).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" data-testid="lead-slots">
                    {Object.entries(lead.slots).map(([key, value]) => (
                      <span
                        key={key}
                        className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
                        title={value}
                      >
                        <span className="text-muted-foreground">{key}:</span> {String(value).slice(0, 60)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/ai/conversations?conversationId=${encodeURIComponent(lead.conversationId)}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    data-testid="lead-replay-link"
                  >
                    <MessagesSquare className="h-3.5 w-3.5" /> Open conversation replay
                  </Link>
                  <span className="ml-auto flex gap-1.5">
                    {lead.status !== 'seen' && lead.status !== 'handled' && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={updating === lead.id} onClick={() => setStatus(lead.id, 'seen')}>
                        Mark seen
                      </Button>
                    )}
                    {lead.status !== 'handled' && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={updating === lead.id} onClick={() => setStatus(lead.id, 'handled')}>
                        Mark handled
                      </Button>
                    )}
                    {lead.status === 'handled' && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updating === lead.id} onClick={() => setStatus(lead.id, 'new')}>
                        Reopen
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
