'use client';

/**
 * Data retention panel (conversation-engine Block K — Req 21 as amended
 * 2026-07-11). Owner-side retention knobs — the ONLY deletion path in the
 * system: visitor-initiated removal deliberately does not exist (owner
 * ruling: interactions are retained to improve the portfolio and understand
 * visitor interest). Every knob empty = keep forever (the shipped default);
 * expiry runs inside the summaries batch job, and every deletion lands in the
 * audit trail rendered below the knobs.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface RetentionConfig {
  transcriptRetentionDays: number | null;
  summaryRetentionDays: number | null;
  leadRetentionDays: number | null;
}

interface AuditEntry {
  id: string;
  action: string;
  criteria: { cutoffs?: Record<string, string> };
  counts: Record<string, number>;
  initiatedBy: string;
  createdAt: string;
}

const KNOBS: Array<{ key: keyof RetentionConfig; label: string; hint: string }> = [
  {
    key: 'transcriptRetentionDays',
    label: 'Transcripts',
    hint: 'visitor turns + slot fills + derived profile/slots, days after last activity',
  },
  {
    key: 'summaryRetentionDays',
    label: 'Summaries',
    hint: 'running conversation summaries — meant to outlive transcripts',
  },
  {
    key: 'leadRetentionDays',
    label: 'Handled leads',
    hint: 'days after a lead is marked handled',
  },
];

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`)
    .join(', ');
}

export function RetentionPanel() {
  const toast = useToast();
  const [config, setConfig] = useState<RetentionConfig | null>(null);
  const [saved, setSaved] = useState<RetentionConfig | null>(null);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/retention-config');
      if (res.ok) {
        const row = await res.json();
        const cfg: RetentionConfig = {
          transcriptRetentionDays: row.transcriptRetentionDays,
          summaryRetentionDays: row.summaryRetentionDays,
          leadRetentionDays: row.leadRetentionDays,
        };
        setConfig(cfg);
        setSaved(cfg);
        setAudits(row.audits ?? []);
      }
    } catch (error) {
      console.error('Failed to load retention config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/retention-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const row = await res.json();
      if (!res.ok) throw new Error(row.error || 'Save failed');
      const cfg: RetentionConfig = {
        transcriptRetentionDays: row.transcriptRetentionDays,
        summaryRetentionDays: row.summaryRetentionDays,
        leadRetentionDays: row.leadRetentionDays,
      };
      setConfig(cfg);
      setSaved(cfg);
      for (const warning of row.warnings ?? []) toast.error('Check retention order', warning);
      const active = Object.values(cfg).some((v) => v !== null);
      toast.success(
        'Retention saved',
        active ? 'Expiry runs with the daily summaries batch' : 'Everything is kept forever'
      );
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const setKnob = (key: keyof RetentionConfig, raw: string) => {
    if (!config) return;
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? null : Number.parseInt(trimmed, 10);
    setConfig({ ...config, [key]: parsed !== null && Number.isNaN(parsed) ? null : parsed });
  };

  const dirty = !!config && !!saved && JSON.stringify(config) !== JSON.stringify(saved);

  return (
    <Card data-testid="retention-panel">
      <CardHeader>
        <CardTitle>Data retention</CardTitle>
        <CardDescription>
          The only deletion path — visitors cannot request removal (owner ruling 2026-07-11: interactions
          are retained to improve the portfolio and understand what people look for). Empty = keep forever.
          Expiry runs in the summaries batch, never in a conversation; every deletion is audit-logged below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !config ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {KNOBS.map(({ key, label, hint }) => (
                <label key={key} className="space-y-1 text-sm">
                  <span className="font-medium">{label}</span>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    placeholder="keep forever"
                    value={config[key] ?? ''}
                    onChange={(e) => setKnob(key, e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                    data-testid={`retention-${key}`}
                  />
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </label>
              ))}
            </div>

            <Button size="sm" variant="outline" className="h-8" disabled={saving || !dirty} onClick={save} data-testid="retention-save">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              <span className="ml-1.5">Save</span>
            </Button>

            <div className="space-y-2" data-testid="retention-audit-log">
              <p className="text-sm font-medium">
                Deletion audit trail
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  operational telemetry — never expired
                </span>
              </p>
              {audits.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing has ever been deleted.</p>
              ) : (
                <ul className="space-y-1.5">
                  {audits.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                      <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                      <span>{formatCounts(a.counts) || 'no rows'}</span>
                      <span className="text-muted-foreground">by {a.initiatedBy}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
