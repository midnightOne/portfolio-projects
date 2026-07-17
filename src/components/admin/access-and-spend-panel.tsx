"use client";

/**
 * Access & Spend panel (access-and-cost Req 8): watchdog status + caps, public
 * access knobs, and live spend gauges from the unified ledger. Extends the
 * rate-limiting admin page.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface GlobalLimits {
  status: 'active' | 'tripped';
  trippedAt: string | null;
  tripReason: string | null;
  tripHistory: Array<{ at: string; reason: string; daySpendUsd: number; monthSpendUsd: number }>;
  publicAIEnabled: boolean;
  disableReflinksOnTrip: boolean;
  dailySpendCapUsd: number;
  monthlySpendCapUsd: number;
  daySpendUsd: number;
  monthSpendUsd: number;
}

interface PublicSettings {
  publicTier: 'disabled' | 'text_chat';
  turnstileEnabled: boolean;
  sessionTtlMinutes: number;
  sessionsPerIpPerHour: number;
  messagesPerMinute: number;
  messagesPerDay: number;
  tokensPerDay: number;
  maxHistoryMessages: number;
  mcpEnabled: boolean;
  mcpRequestsPerMinute: number;
  mcpRequestsPerDay: number;
}

interface UsageSummary {
  day: Array<{ feature: string; costUsd: number; tokens: number; calls: number }>;
  month: Array<{ feature: string; costUsd: number; tokens: number; calls: number }>;
  dayTotalUsd: number;
  monthTotalUsd: number;
  recent: Array<{
    id: string; feature: string | null; usageType: string; modelUsed: string | null;
    costUsd: number; endpoint: string | null; timestamp: string;
  }>;
}

function SpendGauge({ label, spend, cap }: { label: string; spend: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, (spend / cap) * 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span data-testid={`gauge-${label.toLowerCase().replace(/\s/g, '-')}`}>
          ${spend.toFixed(4)} / ${cap.toFixed(2)}
        </span>
      </div>
      <div className="h-2 w-full rounded bg-muted">
        <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AccessAndSpendPanel() {
  const { toast } = useToast();
  const [limits, setLimits] = useState<GlobalLimits | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, s, u] = await Promise.all([
        fetch('/api/admin/ai/global-limits').then((r) => r.json()),
        fetch('/api/admin/ai/public-access-settings').then((r) => r.json()),
        fetch('/api/admin/ai/usage-summary').then((r) => r.json()),
      ]);
      setLimits(l);
      setSettings(s);
      setUsage(u);
    } catch (error) {
      console.error('Failed to load access & spend data:', error);
      toast({ title: 'Load failed', description: 'Could not load Access & Spend data', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const saveLimits = async (patch: Partial<GlobalLimits>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/global-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Saved', description: 'Spend limits updated' });
      await load();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (patch: Partial<PublicSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/public-access-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Saved', description: 'Public access settings updated' });
      await load();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reenable = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/global-limits/reenable', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Re-enabled', description: 'Public AI is active again' });
      await load();
    } catch {
      toast({ title: 'Re-enable failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!limits || !settings) {
    return <div className="text-muted-foreground text-sm py-4">Loading Access &amp; Spend…</div>;
  }

  return (
    <div className="space-y-4" data-testid="access-and-spend-panel">
      {/* Watchdog */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Spend Watchdog</CardTitle>
              <CardDescription>One ledger, hard caps, manual re-enable only (D32/Req 6)</CardDescription>
            </div>
            <Badge
              variant={limits.status === 'tripped' ? 'destructive' : 'default'}
              data-testid="watchdog-status"
            >
              {limits.status === 'tripped' ? 'TRIPPED' : 'Active'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {limits.status === 'tripped' && (
            <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm space-y-2">
              <p><strong>Tripped:</strong> {limits.tripReason} ({limits.trippedAt && new Date(limits.trippedAt).toLocaleString()})</p>
              <Button onClick={reenable} disabled={saving} data-testid="watchdog-reenable">
                Re-enable public AI
              </Button>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <SpendGauge label="Today" spend={limits.daySpendUsd} cap={limits.dailySpendCapUsd} />
            <SpendGauge label="This month" spend={limits.monthSpendUsd} cap={limits.monthlySpendCapUsd} />
          </div>
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div>
              <Label htmlFor="dailyCap">Daily cap (USD)</Label>
              <Input id="dailyCap" type="number" step="0.5" min="0" defaultValue={limits.dailySpendCapUsd}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== limits.dailySpendCapUsd) saveLimits({ dailySpendCapUsd: v }); }} />
            </div>
            <div>
              <Label htmlFor="monthlyCap">Monthly cap (USD)</Label>
              <Input id="monthlyCap" type="number" step="5" min="0" defaultValue={limits.monthlySpendCapUsd}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== limits.monthlySpendCapUsd) saveLimits({ monthlySpendCapUsd: v }); }} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={limits.publicAIEnabled} disabled={saving}
                onCheckedChange={(v) => saveLimits({ publicAIEnabled: v })} id="publicAIEnabled" />
              <Label htmlFor="publicAIEnabled">Public AI enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={limits.disableReflinksOnTrip} disabled={saving}
                onCheckedChange={(v) => saveLimits({ disableReflinksOnTrip: v })} id="reflinksOnTrip" />
              <Label htmlFor="reflinksOnTrip">Trip disables reflinks too</Label>
            </div>
          </div>
          {Array.isArray(limits.tripHistory) && limits.tripHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Trip history</h4>
              <ul className="text-sm text-muted-foreground space-y-1" data-testid="trip-history">
                {limits.tripHistory.slice(-5).reverse().map((t, i) => (
                  <li key={i}>{new Date(t.at).toLocaleString()} — {t.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public access knobs */}
      <Card>
        <CardHeader>
          <CardTitle>Public Access</CardTitle>
          <CardDescription>Anonymous text-chat tier, bot challenge, per-IP limits (D31/Req 2–4)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={settings.publicTier === 'text_chat'} disabled={saving}
                onCheckedChange={(v) => saveSettings({ publicTier: v ? 'text_chat' : 'disabled' })} id="publicTier" />
              <Label htmlFor="publicTier">Public text chat</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={settings.turnstileEnabled} disabled={saving}
                onCheckedChange={(v) => saveSettings({ turnstileEnabled: v })} id="turnstile" />
              <Label htmlFor="turnstile">Turnstile bot challenge</Label>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {([
              ['messagesPerMinute', 'Messages / minute (session)'],
              ['messagesPerDay', 'Messages / day (IP)'],
              ['tokensPerDay', 'Tokens / day (IP)'],
              ['sessionsPerIpPerHour', 'Sessions / hour (IP)'],
              ['sessionTtlMinutes', 'Session TTL (minutes)'],
              ['maxHistoryMessages', 'Max history messages'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} type="number" min="1" defaultValue={settings[key]}
                  onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0 && v !== settings[key]) saveSettings({ [key]: v }); }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* MCP server bucket (mcp-server Req 3.1 — own knobs, stricter than pill traffic) */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Server</CardTitle>
          <CardDescription>Public /api/mcp endpoint — dedicated rate bucket, ledger feature &lsquo;mcp&rsquo; (D30)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch checked={settings.mcpEnabled} disabled={saving}
              onCheckedChange={(v) => saveSettings({ mcpEnabled: v })} id="mcpEnabled" />
            <Label htmlFor="mcpEnabled">MCP endpoint enabled</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {([
              ['mcpRequestsPerMinute', 'Requests / minute (IP)'],
              ['mcpRequestsPerDay', 'Requests / day (IP)'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} type="number" min="1" defaultValue={settings[key]}
                  onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0 && v !== settings[key]) saveSettings({ [key]: v }); }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ledger gauges */}
      <Card>
        <CardHeader>
          <CardTitle>Spend by Feature (unified ledger)</CardTitle>
          <CardDescription>
            Today ${usage?.dayTotalUsd?.toFixed(4) ?? '—'} · This month ${usage?.monthTotalUsd?.toFixed(4) ?? '—'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {(['day', 'month'] as const).map((period) => (
              <div key={period}>
                <h4 className="text-sm font-medium mb-2 capitalize">{period === 'day' ? 'Today' : 'This month'}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="py-1">Feature</th><th>Calls</th><th>Tokens</th><th className="text-right">USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usage?.[period] ?? []).map((r) => (
                      <tr key={r.feature} className="border-t border-border">
                        <td className="py-1">{r.feature}</td>
                        <td>{r.calls}</td>
                        <td>{r.tokens}</td>
                        <td className="text-right">${r.costUsd.toFixed(4)}</td>
                      </tr>
                    ))}
                    {(usage?.[period] ?? []).length === 0 && (
                      <tr><td colSpan={4} className="py-2 text-muted-foreground">No spend recorded</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 7.23: internal ledger vs OpenAI Costs API — provider is ground truth */}
      <ReconciliationCard />
    </div>
  );
}

interface ReconciliationDayRow {
  date: string;
  ledgerUsd: number;
  openaiUsd: number;
  driftUsd: number;
}
interface ReconciliationData {
  configured: boolean;
  error?: string;
  days: ReconciliationDayRow[];
  totals: { ledgerUsd: number; openaiUsd: number; driftUsd: number };
  unattributedRows: number;
  notes: string[];
}

/**
 * Spend reconciliation vs OpenAI (7.23). The provider's Costs API is the
 * ground truth; drift means OUR metering missed something (the audit's
 * canonical example: realtime voice responses never reached the ledger
 * before 7.23). Needs OPENAI_ADMIN_API_KEY — the unconfigured state renders
 * honestly instead of guessing.
 */
function ReconciliationCard() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReconciliationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai/spend-reconciliation?days=${days}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? 'Reconciliation failed');
      setReport(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend Reconciliation vs OpenAI</CardTitle>
        <CardDescription>
          Compares the internal ledger against OpenAI&apos;s Costs API per UTC day — the provider number is ground
          truth, drift is a defect in our metering. Requires OPENAI_ADMIN_API_KEY (org Admin key).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            data-testid="reconcile-days"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            data-testid="reconcile-run"
          >
            {loading ? 'Reconciling…' : 'Reconcile'}
          </button>
        </div>

        {error && <p className="text-sm text-red-500" data-testid="reconcile-error">{error}</p>}

        {report && !report.configured && (
          <p className="text-sm text-amber-600 dark:text-amber-400" data-testid="reconcile-unconfigured">
            {report.error}
          </p>
        )}
        {report && report.configured && report.error && (
          <p className="text-sm text-red-500">OpenAI Costs API error: {report.error}</p>
        )}

        {report && report.days.length > 0 && (
          <div data-testid="reconcile-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="py-1">UTC day</th>
                  <th className="text-right">Ledger</th>
                  <th className="text-right">OpenAI</th>
                  <th className="text-right">Drift</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((d) => (
                  <tr key={d.date} className="border-t border-border">
                    <td className="py-1">{d.date}</td>
                    <td className="text-right">${d.ledgerUsd.toFixed(4)}</td>
                    <td className="text-right">${d.openaiUsd.toFixed(4)}</td>
                    <td
                      className={`text-right ${Math.abs(d.driftUsd) > Math.max(0.01, d.openaiUsd * 0.1) ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}
                    >
                      {d.driftUsd >= 0 ? '+' : ''}${d.driftUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-medium">
                  <td className="py-1">Total</td>
                  <td className="text-right">${report.totals.ledgerUsd.toFixed(4)}</td>
                  <td className="text-right">${report.totals.openaiUsd.toFixed(4)}</td>
                  <td className={`text-right ${Math.abs(report.totals.driftUsd) > 0.01 ? 'text-red-500' : ''}`}>
                    {report.totals.driftUsd >= 0 ? '+' : ''}${report.totals.driftUsd.toFixed(4)}
                  </td>
                </tr>
              </tbody>
            </table>
            {report.unattributedRows > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                {report.unattributedRows} ledger row(s) in this window carry spend with NO provider — they are in
                neither column above.
              </p>
            )}
            <ul className="text-xs text-muted-foreground mt-2 list-disc pl-4 space-y-0.5">
              {report.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
