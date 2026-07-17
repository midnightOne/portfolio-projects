'use client';

/**
 * Model alias registry panel (D4, ai-admin task 1.1; N5 category aliases
 * 2026-07-13)
 *
 * Edits the role aliases (`default-chat`, `default-cheap`,
 * `default-classifier`, `default-summarizer`, `default-reasoning`,
 * `default-embedding`, `default-realtime`) that every model reference in the
 * system resolves through. Switching a model is a save here — no deploy.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, PlugZap, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface AliasRow {
  alias: string;
  provider: string;
  modelId: string;
  updatedAt?: string;
}

interface TestOutcome {
  ok: boolean;
  latencyMs: number;
  resolved?: string;
  reply?: string;
  error?: string;
}

const ALIAS_HINTS: Record<string, string> = {
  'default-chat': 'general chat / summaries',
  'default-cheap': 'public text tier (gateway)',
  'default-classifier': 'engine per-turn classifier (edges, slots, probe, flag signals)',
  'default-summarizer': 'engine profile + running-summary jobs',
  'default-reasoning': 'job analysis, MCP deep tools',
  'default-embedding': 'semantic index embeddings',
  'default-realtime': 'native voice sessions',
};

const PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs'];

export function ModelAliasPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<AliasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAlias, setSavingAlias] = useState<string | null>(null);
  const [testingAlias, setTestingAlias] = useState<string | null>(null);
  const [testOutcomes, setTestOutcomes] = useState<Record<string, TestOutcome>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/model-aliases');
      const data = await res.json();
      // default-embedding has its own switch-and-reindex panel (EmbeddingModelPanel)
      if (data.success) setRows(data.data.filter((r: AliasRow) => r.alias !== 'default-embedding'));
    } catch (error) {
      console.error('Failed to load model aliases:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (alias: string, patch: Partial<AliasRow>) => {
    setRows((prev) => prev.map((r) => (r.alias === alias ? { ...r, ...patch } : r)));
  };

  /**
   * 7.23: validate the ENTERED provider/model before saving — one minimal
   * completion through the same adapter the pipeline uses. The outcome shows
   * the real provider error (bad model id, bad key, quota) instead of the
   * pipeline discovering it later.
   */
  const test = async (row: AliasRow) => {
    setTestingAlias(row.alias);
    setTestOutcomes((prev) => {
      const next = { ...prev };
      delete next[row.alias];
      return next;
    });
    try {
      const res = await fetch('/api/admin/ai/model-aliases/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: row.provider, modelId: row.modelId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setTestOutcomes((prev) => ({ ...prev, [row.alias]: data as TestOutcome }));
    } catch (error) {
      setTestOutcomes((prev) => ({
        ...prev,
        [row.alias]: { ok: false, latencyMs: 0, error: error instanceof Error ? error.message : 'Test failed' },
      }));
    } finally {
      setTestingAlias(null);
    }
  };

  const save = async (row: AliasRow) => {
    setSavingAlias(row.alias);
    try {
      const res = await fetch('/api/admin/ai/model-aliases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: row.alias, provider: row.provider, modelId: row.modelId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      toast.success('Alias updated', `${row.alias} → ${row.provider}/${row.modelId}`);
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSavingAlias(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model aliases (D4)</CardTitle>
        <CardDescription>
          Every model reference resolves through these role aliases — switching a model here
          requires no deploy. Consumers fail closed if an alias is missing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading aliases…
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const outcome = testOutcomes[row.alias];
              return (
                <div key={row.alias}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-44">
                      <Badge variant="outline" className="font-mono text-xs">{row.alias}</Badge>
                      <div className="text-[11px] text-muted-foreground">{ALIAS_HINTS[row.alias] ?? ''}</div>
                    </div>
                    <Select value={row.provider} onValueChange={(v) => updateRow(row.alias, { provider: v })}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.modelId}
                      onChange={(e) => updateRow(row.alias, { modelId: e.target.value })}
                      className="w-64 h-8 font-mono text-xs"
                      placeholder="model id"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={savingAlias === row.alias || !row.modelId}
                      onClick={() => save(row)}
                    >
                      {savingAlias === row.alias ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                    </Button>
                    {/* 7.23: validate the model id + connectivity BEFORE saving —
                        one minimal completion through the production adapter. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={testingAlias === row.alias || !row.modelId}
                      onClick={() => test(row)}
                      title="Run one minimal completion against this provider/model"
                      data-testid={`alias-test-${row.alias}`}
                    >
                      {testingAlias === row.alias ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <PlugZap className="h-3 w-3" />
                      )}
                      <span className="ml-1 text-xs">Test</span>
                    </Button>
                  </div>
                  {outcome && (
                    <div
                      className={`ml-44 pl-2 mt-1 text-xs flex items-start gap-1.5 ${outcome.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
                      data-testid={`alias-test-outcome-${row.alias}`}
                    >
                      {outcome.ok ? (
                        <>
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {outcome.resolved} answered in {outcome.latencyMs}ms
                            {outcome.reply ? ` — "${outcome.reply.slice(0, 60)}"` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5 shrink-0" />
                          <span>{outcome.error ?? 'Test failed'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
