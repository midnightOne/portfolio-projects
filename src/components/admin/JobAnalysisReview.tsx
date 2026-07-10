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
  /** G3 email capture — the send ships with H2; until then this is the queue. */
  visitorEmail: string | null;
  emailRequestedAt: string | null;
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
                  {/* G3: visitor asked for the result by email — H2 sends it;
                      until then this badge IS the outbox queue. */}
                  {row.visitorEmail && (
                    <Badge variant="outline" className="gap-1" data-testid="email-requested-badge">
                      <Mail size={11} /> {row.visitorEmail}
                    </Badge>
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
                  ? ` · email requested ${new Date(row.emailRequestedAt).toLocaleString()} (send pending — ships with the H2 email channel)`
                  : ''}
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
