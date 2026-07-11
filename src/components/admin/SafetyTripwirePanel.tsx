'use client';

/**
 * Safety-tripwire admin panel (conversation-engine Req 22, task L4).
 * Configuration is data, never code (Req 22.4): word lists by category (the
 * cheap trigger — P34: expect false positives, the investigation absorbs
 * them), the investigation policy text (the smart judge's owner guidance),
 * and the severity→action map (the configured executioner). Below it, the
 * investigations list — every verdict, linked to its conversation.
 *
 * Copy honesty (P35): "terminate session" revokes what the server actually
 * controls (tools, persistence, turns) and asks the client to disconnect —
 * it cannot hang up a client-direct WebRTC call; the wording below says so.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Save, RefreshCw, Trash2, Plus, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const ACTIONS = ['log_only', 'notify_owner', 'publish_evidence', 'terminate_session', 'ban_reflink'] as const;

const ACTION_HELP: Record<(typeof ACTIONS)[number], string> = {
  log_only: 'record the verdict, nothing else',
  notify_owner: 'email the owner through the notification seam',
  publish_evidence: 'stage the verdict as engine evidence — graph safety edges can fire on it next turn',
  terminate_session: 'revoke server resources (tools, turns, persistence) + ask the client to disconnect — cannot force-hang-up a client-direct call',
  ban_reflink: 'deactivate the conversation’s reflink (kills mints + resume) and revoke the session',
};

interface SafetyConfig {
  enabled: boolean;
  wordLists: Record<string, string[]>;
  investigationPolicy: string | null;
  severityActionMap: Partial<Record<(typeof SEVERITIES)[number], (typeof ACTIONS)[number]>>;
}

interface Investigation {
  id: string;
  conversationId: string;
  sessionId: string | null;
  triggeredBy: { words?: string[]; categories?: string[]; role?: string; text?: string } | null;
  status: string;
  verdict: string | null;
  recommendedAction: string | null;
  rationale: string | null;
  actedOn: { action?: string; error?: string; notifyStatus?: string } | null;
  createdAt: string;
  completedAt: string | null;
}

/** Editor-side word lists: category name + one-entry-per-line text. */
type ListDraft = Array<{ category: string; words: string }>;

function toDraft(lists: Record<string, string[]>): ListDraft {
  return Object.entries(lists).map(([category, words]) => ({ category, words: words.join('\n') }));
}

function fromDraft(draft: ListDraft): Record<string, string[]> {
  const lists: Record<string, string[]> = {};
  for (const { category, words } of draft) {
    const name = category.trim();
    const clean = words.split('\n').map((w) => w.trim()).filter(Boolean);
    if (name && clean.length > 0) lists[name] = clean;
  }
  return lists;
}

export function SafetyTripwirePanel() {
  const toast = useToast();
  const [config, setConfig] = useState<SafetyConfig | null>(null);
  const [draft, setDraft] = useState<ListDraft>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const loadInvestigations = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/ai/safety/investigations?limit=30');
      if (res.ok) setInvestigations((await res.json()).investigations ?? []);
    } catch (error) {
      console.error('Failed to load investigations:', error);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/ai/safety');
        if (res.ok) {
          const row = (await res.json()) as SafetyConfig;
          setConfig(row);
          setDraft(toDraft(row.wordLists));
        }
      } catch (error) {
        console.error('Failed to load safety config:', error);
      } finally {
        setLoading(false);
      }
    })();
    loadInvestigations();
  }, [loadInvestigations]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/safety', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          wordLists: fromDraft(draft),
          investigationPolicy: config.investigationPolicy,
          severityActionMap: config.severityActionMap,
        }),
      });
      const row = await res.json();
      if (!res.ok) throw new Error(row.error || 'Save failed');
      setConfig(row);
      setDraft(toDraft(row.wordLists));
      toast.success('Safety config saved', row.enabled ? 'Tripwire is ON' : 'Module is OFF — the system runs without it');
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const verdictBadge = (inv: Investigation) => {
    if (inv.status === 'running') return <Badge variant="outline" className="text-xs">running…</Badge>;
    if (inv.status === 'failed') return <Badge variant="destructive" className="text-xs">failed</Badge>;
    if (inv.verdict === 'benign') return <Badge variant="outline" className="text-xs">benign</Badge>;
    return <Badge variant="destructive" className="text-xs">{inv.verdict}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card data-testid="safety-config-card">
        <CardHeader>
          <CardTitle>Safety tripwire</CardTitle>
          <CardDescription>
            Static word flags scanned at transcript persist time (never blocking a conversation) escalate to
            an async LLM investigation; the verdict executes YOUR severity→action policy. Word matching is
            deliberately naive — false positives are expected and absorbed by the investigation, whose job is
            telling &quot;photo bomb&quot; from a threat. Module off = the system runs identically without it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !config ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  data-testid="safety-enabled-switch"
                />
                <span className="text-sm">
                  Module {config.enabled ? 'on' : 'off'}
                  <span className="text-muted-foreground"> — scan, investigation, and enforcement gates</span>
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">Word lists by category</h4>
                  <p className="text-xs text-muted-foreground">
                    One word or phrase per line; matching is case-insensitive on word boundaries — no fuzzy
                    matching by design.
                  </p>
                </div>
                {draft.map((entry, i) => (
                  <div key={i} className="flex gap-2 items-start" data-testid={`safety-category-${i}`}>
                    <Input
                      value={entry.category}
                      onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, category: e.target.value } : d)))}
                      placeholder="category"
                      className="w-40 h-8 text-sm"
                    />
                    <Textarea
                      value={entry.words}
                      onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, words: e.target.value } : d)))}
                      placeholder={'one word or phrase per line'}
                      className="flex-1 text-sm font-mono min-h-[60px]"
                      rows={Math.min(6, Math.max(2, entry.words.split('\n').length))}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                      title="Remove category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="new category name"
                    className="w-40 h-8 text-sm"
                    data-testid="safety-new-category"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={!newCategory.trim()}
                    onClick={() => {
                      setDraft([...draft, { category: newCategory.trim(), words: '' }]);
                      setNewCategory('');
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    <span className="ml-1">Add category</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Investigation policy</h4>
                <p className="text-xs text-muted-foreground">
                  Owner guidance handed to the investigation agent (what counts as concerning here, what is
                  normal for this site). Optional.
                </p>
                <Textarea
                  value={config.investigationPolicy ?? ''}
                  onChange={(e) => setConfig({ ...config, investigationPolicy: e.target.value || null })}
                  placeholder="e.g. Security-probing questions about the MCP server are a normal showcase topic here; treat only persistent extraction attempts as concerning."
                  className="text-sm min-h-[80px]"
                  data-testid="safety-policy"
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Severity → action</h4>
                <p className="text-xs text-muted-foreground">
                  What executes when a verdict lands. Unset = log only. &quot;Terminate&quot; revokes what the
                  server actually controls — tools, turns, persistence — and asks the client to disconnect; it
                  cannot force-close a client-direct voice call (the token duration cap is the hard backstop).
                </p>
                <div className="space-y-1.5">
                  {SEVERITIES.map((severity) => (
                    <div key={severity} className="flex items-center gap-3">
                      <span className="w-20 text-sm capitalize">{severity}</span>
                      <select
                        value={config.severityActionMap[severity] ?? 'log_only'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            severityActionMap: {
                              ...config.severityActionMap,
                              [severity]: e.target.value as (typeof ACTIONS)[number],
                            },
                          })
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        data-testid={`safety-action-${severity}`}
                      >
                        {ACTIONS.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground flex-1">
                        {ACTION_HELP[config.severityActionMap[severity] ?? 'log_only']}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button size="sm" variant="outline" className="h-8" disabled={saving} onClick={save} data-testid="safety-save">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                <span className="ml-1.5">Save</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="safety-investigations-card">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Investigations</CardTitle>
            <CardDescription>Latest tripwire investigations, newest first.</CardDescription>
          </div>
          <Button size="sm" variant="ghost" className="h-8" onClick={loadInvestigations} disabled={listLoading}>
            {listLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </CardHeader>
        <CardContent>
          {investigations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No investigations yet — the tripwire has not fired.</p>
          ) : (
            <div className="space-y-3">
              {investigations.map((inv) => (
                <div key={inv.id} className="rounded-md border border-border p-3 text-sm space-y-1" data-testid="safety-investigation-row">
                  <div className="flex items-center gap-2 flex-wrap">
                    {verdictBadge(inv)}
                    {inv.actedOn?.action && (
                      <Badge variant="outline" className="text-xs">
                        → {inv.actedOn.action}
                        {inv.actedOn.error ? ' (failed)' : ''}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleString()}
                    </span>
                    <Link
                      href={`/admin/ai/conversations?conversationId=${inv.conversationId}`}
                      className="text-xs text-primary inline-flex items-center gap-1 ml-auto"
                    >
                      conversation <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    tripped by [{(inv.triggeredBy?.words ?? []).join(', ')}] in a {inv.triggeredBy?.role ?? '?'} turn
                    {inv.recommendedAction && inv.recommendedAction !== 'none' ? ` · agent recommended ${inv.recommendedAction}` : ''}
                  </div>
                  {inv.rationale && <div className="text-xs">{inv.rationale}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
