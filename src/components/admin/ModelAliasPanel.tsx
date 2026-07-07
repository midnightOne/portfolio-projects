'use client';

/**
 * Model alias registry panel (D4, ai-admin task 1.1)
 *
 * Edits the five role aliases (`default-chat`, `default-cheap`,
 * `default-reasoning`, `default-embedding`, `default-realtime`) that every
 * model reference in the system resolves through. Switching a model is a save
 * here — no deploy.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface AliasRow {
  alias: string;
  provider: string;
  modelId: string;
  updatedAt?: string;
}

const ALIAS_HINTS: Record<string, string> = {
  'default-chat': 'general chat / summaries',
  'default-cheap': 'public text tier (gateway)',
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

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/model-aliases');
      const data = await res.json();
      if (data.success) setRows(data.data);
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
            {rows.map((row) => (
              <div key={row.alias} className="flex flex-wrap items-center gap-2">
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
