'use client';

/**
 * Admin review view for persisted job analyses (ai-assistant task 8 / Req 8.1;
 * G3 additions: owner work-preferences editor, visitor email capture, the
 * visitor-facing compatibility document). Rendered inside AdminLayout by
 * src/app/admin/ai/job-analysis/page.tsx.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface AnalysisRow {
  id: string;
  createdAt: string;
  companyName: string | null;
  positionTitle: string | null;
  jobSpecification: string;
  analysisResult: {
    overallMatch?: number;
    strengths?: string[];
    gaps?: string[];
    recommendations?: string[];
    skillsMatch?: Array<{ skill: string; match: number; evidence: string[] }>;
    experienceMatch?: Array<{ area: string; match: number; relevantProjects: string[] }>;
    document?: string;
  };
  tokensUsed: number | null;
  costUsd: number | null;
  metadata: { provider?: string; modelId?: string };
  reflink: { code: string; name: string | null; recipientName: string | null } | null;
  sessionId: string | null;
  /** G3 email capture; G6 latest send state through the notification seam. */
  visitorEmail: string | null;
  emailRequestedAt: string | null;
  emailSend: { status: string; error: string | null; recipient: string; at: string } | null;
}

/** Honest one-word email state for the badge/description (G6). */
function emailStateLabel(send: AnalysisRow['emailSend']): string {
  if (!send) return 'not sent yet';
  switch (send.status) {
    case 'sent':
      return `sent ${new Date(send.at).toLocaleString()}`;
    case 'failed':
      return `send failed — ${send.error ?? 'unknown error'}`;
    case 'skipped_unconfigured':
      return 'not sent — email provider unconfigured (set RESEND_API_KEY)';
    case 'skipped_rate_limited':
      return 'not sent — conversation email limit reached';
    default:
      return send.status;
  }
}

/**
 * Owner work-preferences editor (conversation-engine Req 13.4 expanded, G3):
 * plain text the JD analysis judges preferred-work fit against. Kept out of
 * the semantic index by design — GET/PUT /api/admin/ai/owner-preferences.
 */
function OwnerPreferencesPanel() {
  const [text, setText] = useState('');
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/admin/ai/owner-preferences')
      .then((res) => res.json())
      .then((data) => {
        setText(typeof data.workPreferences === 'string' ? data.workPreferences : '');
        setState('idle');
      })
      .catch(() => setState('error'));
  }, []);

  const save = async () => {
    setState('saving');
    try {
      const res = await fetch('/api/admin/ai/owner-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workPreferences: text }),
      });
      if (!res.ok) throw new Error('save failed');
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
    }
  };

  return (
    <Card data-testid="owner-preferences-panel">
      <CardHeader>
        <CardTitle className="text-base">Work preferences (fed to every analysis)</CardTitle>
        <CardDescription>
          What you want to work on, deal-breakers, preferred domains/stack — the analysis judges
          preferred-work fit against this, paraphrased and never quoted verbatim. Server-side only;
          never enters the public search index.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={state === 'loading'}
          placeholder="e.g. Prefers embedded/firmware and AI-systems work; enjoys greenfield architecture; not interested in pure CRUD maintenance roles…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-y"
          data-testid="owner-preferences-text"
        />
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={state === 'loading' || state === 'saving'}>
            {state === 'saving' ? 'Saving…' : 'Save'}
          </Button>
          {state === 'saved' && <span className="text-xs text-green-600">Saved.</span>}
          {state === 'error' && <span className="text-xs text-red-600">Failed — try again.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function MatchBadge({ value }: { value?: number }) {
  if (typeof value !== 'number') return null;
  const pct = Math.round(value * 100);
  const variant = pct >= 75 ? 'default' : pct >= 50 ? 'secondary' : 'destructive';
  return <Badge variant={variant}>{pct}% match</Badge>;
}

export function JobAnalysisReview() {
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // G6: per-row owner-initiated send state (send-now / retry via the seam)
  const [sending, setSending] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/job-analyses?limit=50');
      if (!res.ok) throw new Error(`Failed to load analyses (${res.status})`);
      const data = await res.json();
      setRows(data.analyses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendNow = async (id: string) => {
    setSending(id);
    setSendNote(null);
    try {
      const res = await fetch(`/api/admin/ai/job-analyses/${id}/send-email`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setSendNote({
        id,
        ok: data.status === 'sent',
        text: data.status === 'sent' ? 'Sent.' : (data.error ?? data.status ?? 'send failed'),
      });
      await load();
    } catch {
      setSendNote({ id, ok: false, text: 'Request failed — try again.' });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="job-analysis-review">
      <div className="flex justify-end">
        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* G3 (Req 13.4 expanded): the owner work-preferences record fed to every
          JD analysis — server-side only, deliberately not a content chunk so it
          never leaks through retrieval (P13). */}
      <OwnerPreferencesPanel />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No job analyses yet.</p>
      )}

      {rows.map((row) => {
        const isOpen = expanded === row.id;
        const a = row.analysisResult ?? {};
        return (
          <Card key={row.id} data-testid={`analysis-${row.id}`}>
            <CardHeader className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : row.id)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {row.positionTitle ?? 'Untitled position'}
                  {row.companyName ? ` — ${row.companyName}` : ''}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <MatchBadge value={a.overallMatch} />
                  {/* G3: visitor asked for the result by email; G6 sends it
                      through the notification seam — badge shows honest state,
                      button is the owner send-now/retry path (P25). */}
                  {row.visitorEmail && (
                    <>
                      <Badge
                        variant={row.emailSend?.status === 'sent' ? 'default' : 'outline'}
                        className="gap-1"
                        data-testid="email-requested-badge"
                      >
                        <Mail size={11} /> {row.visitorEmail}
                        {row.emailSend?.status === 'sent' ? ' ✓' : ''}
                      </Badge>
                      {row.emailSend?.status !== 'sent' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sending === row.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            sendNow(row.id);
                          }}
                          data-testid="email-send-now"
                        >
                          {sending === row.id ? 'Sending…' : 'Send email'}
                        </Button>
                      )}
                    </>
                  )}
                  {row.reflink && (
                    <Badge variant="outline">
                      {row.reflink.recipientName ?? row.reflink.name ?? row.reflink.code}
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>
                {new Date(row.createdAt).toLocaleString()} · {row.metadata?.modelId ?? '—'} ·{' '}
                {row.tokensUsed ?? '—'} tokens · ${row.costUsd?.toFixed(4) ?? '—'}
                {row.emailRequestedAt
                  ? ` · email requested ${new Date(row.emailRequestedAt).toLocaleString()} — ${emailStateLabel(row.emailSend)}`
                  : ''}
                {sendNote?.id === row.id && (
                  <span className={sendNote.ok ? 'text-green-600' : 'text-red-600'}>
                    {' '}
                    · {sendNote.text}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            {isOpen && (
              <CardContent className="space-y-4 text-sm">
                <section>
                  <h3 className="font-medium mb-1">Job specification</h3>
                  <pre className="whitespace-pre-wrap rounded bg-muted p-3 max-h-64 overflow-auto text-xs">
                    {row.jobSpecification}
                  </pre>
                </section>
                {a.document && (
                  <section>
                    <h3 className="font-medium mb-1">Compatibility document (what the visitor saw)</h3>
                    <div className="whitespace-pre-wrap rounded bg-muted p-3 max-h-64 overflow-auto text-xs">
                      {a.document}
                    </div>
                  </section>
                )}
                {(['strengths', 'gaps', 'recommendations'] as const).map((key) =>
                  a[key]?.length ? (
                    <section key={key}>
                      <h3 className="font-medium mb-1 capitalize">{key}</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        {a[key]!.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null
                )}
                {a.skillsMatch?.length ? (
                  <section>
                    <h3 className="font-medium mb-1">Skills match</h3>
                    <ul className="space-y-1">
                      {a.skillsMatch.map((s, i) => (
                        <li key={i}>
                          <span className="font-medium">{s.skill}</span> — {Math.round(s.match * 100)}%
                          {s.evidence?.length ? (
                            <span className="text-muted-foreground"> ({s.evidence.join('; ')})</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {a.experienceMatch?.length ? (
                  <section>
                    <h3 className="font-medium mb-1">Experience match</h3>
                    <ul className="space-y-1">
                      {a.experienceMatch.map((e, i) => (
                        <li key={i}>
                          <span className="font-medium">{e.area}</span> — {Math.round(e.match * 100)}%
                          {e.relevantProjects?.length ? (
                            <span className="text-muted-foreground"> ({e.relevantProjects.join(', ')})</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
