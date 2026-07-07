'use client';

/**
 * Model pricing panel (D38, ai-admin task 3.1 residual)
 *
 * Edits `AIModelPricing` rows — the single rate table `estimateCost()` resolves
 * through. Ledger writes AND pre-flight estimates read these rates, so an edit
 * here changes metered costs system-wide with no deploy. Unknown models price
 * at the most expensive known rate (conservative), so deleting a row never
 * makes a model free.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface PricingRow {
  modelId: string;
  provider: string;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  notes: string | null;
}

const PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs', 'fake'];

const EMPTY_NEW_ROW = { modelId: '', provider: 'openai', inputPerMTokUsd: '', outputPerMTokUsd: '' };

export function ModelPricingPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState(EMPTY_NEW_ROW);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/model-pricing');
      const data = await res.json();
      if (data.success) setRows(data.data);
    } catch (error) {
      console.error('Failed to load model pricing:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (modelId: string, patch: Partial<PricingRow>) => {
    setRows((prev) => prev.map((r) => (r.modelId === modelId ? { ...r, ...patch } : r)));
  };

  const save = async (row: PricingRow) => {
    setBusyModelId(row.modelId);
    try {
      const res = await fetch('/api/admin/ai/model-pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      toast.success('Rates updated', `${row.modelId}: $${row.inputPerMTokUsd}/$${row.outputPerMTokUsd} per MTok`);
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusyModelId(null);
    }
  };

  const remove = async (modelId: string) => {
    setBusyModelId(modelId);
    try {
      const res = await fetch(`/api/admin/ai/model-pricing?modelId=${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      setRows((prev) => prev.filter((r) => r.modelId !== modelId));
      toast.success('Row removed', `${modelId} now prices at the most expensive known rate`);
    } catch (error) {
      toast.error('Delete failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusyModelId(null);
    }
  };

  const add = async () => {
    setAdding(true);
    try {
      const res = await fetch('/api/admin/ai/model-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: newRow.modelId.trim(),
          provider: newRow.provider,
          inputPerMTokUsd: Number(newRow.inputPerMTokUsd),
          outputPerMTokUsd: Number(newRow.outputPerMTokUsd),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Create failed');
      toast.success('Pricing row added', newRow.modelId.trim());
      setNewRow(EMPTY_NEW_ROW);
      await load();
    } catch (error) {
      toast.error('Create failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setAdding(false);
    }
  };

  const rateInput = (row: PricingRow, field: 'inputPerMTokUsd' | 'outputPerMTokUsd') => (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">$</span>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={row[field]}
        onChange={(e) => updateRow(row.modelId, { [field]: e.target.value === '' ? 0 : Number(e.target.value) })}
        className="w-24 h-8 text-xs"
      />
    </div>
  );

  return (
    <Card data-testid="model-pricing-panel">
      <CardHeader>
        <CardTitle>Model pricing (D38)</CardTitle>
        <CardDescription>
          USD per 1M tokens (input / output). The ledger and every pre-flight estimate read
          these rates — an edit here changes metered costs with no deploy. Unpriced models
          meter at the most expensive known rate, never free.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing…
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.modelId} className="flex flex-wrap items-center gap-2">
                <div className="w-72 min-w-0">
                  <Badge variant="outline" className="font-mono text-xs max-w-full truncate">{row.modelId}</Badge>
                  <div className="text-[11px] text-muted-foreground">
                    {row.provider}
                    {row.notes ? ` — ${row.notes}` : ''}
                  </div>
                </div>
                {rateInput(row, 'inputPerMTokUsd')}
                <span className="text-xs text-muted-foreground">in ·</span>
                {rateInput(row, 'outputPerMTokUsd')}
                <span className="text-xs text-muted-foreground">out</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={busyModelId === row.modelId}
                  onClick={() => save(row)}
                  title="Save rates"
                >
                  {busyModelId === row.modelId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-red-600"
                  disabled={busyModelId === row.modelId}
                  onClick={() => remove(row.modelId)}
                  title="Remove row (model then prices at the most expensive known rate)"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {/* Add a new row */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Input
                value={newRow.modelId}
                onChange={(e) => setNewRow((prev) => ({ ...prev, modelId: e.target.value }))}
                className="w-64 h-8 font-mono text-xs"
                placeholder="model id (e.g. gemini-2.5-flash)"
              />
              <Select value={newRow.provider} onValueChange={(v) => setNewRow((prev) => ({ ...prev, provider: v }))}>
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
                type="number"
                min="0"
                step="0.01"
                value={newRow.inputPerMTokUsd}
                onChange={(e) => setNewRow((prev) => ({ ...prev, inputPerMTokUsd: e.target.value }))}
                className="w-24 h-8 text-xs"
                placeholder="$ in/MTok"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newRow.outputPerMTokUsd}
                onChange={(e) => setNewRow((prev) => ({ ...prev, outputPerMTokUsd: e.target.value }))}
                className="w-24 h-8 text-xs"
                placeholder="$ out/MTok"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={adding || !newRow.modelId.trim() || newRow.inputPerMTokUsd === '' || newRow.outputPerMTokUsd === ''}
                onClick={add}
              >
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                <span className="ml-1 text-xs">Add</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
