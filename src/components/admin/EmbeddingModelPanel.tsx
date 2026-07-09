'use client';

/**
 * Embedding model panel (owner, 2026-07-09).
 *
 * Surfaces what the `default-embedding` alias resolves to and what the stored
 * chunk vectors were actually embedded with (drift = semantic search is
 * unreliable), and offers the switch: pick a supported model → consent dialog
 * (chunk count + estimated cost) → the API repoints the alias AND re-embeds
 * the whole corpus in one operation.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface Candidate {
  provider: string;
  modelId: string;
  label: string;
  estimate: { chunks: number; estimatedTokens: number; estimatedCostUsd: number };
}

interface EmbeddingStatus {
  current: { provider: string; modelId: string } | null;
  stored: Array<{ model: string; chunks: number }>;
  drift: boolean;
  candidates: Candidate[];
}

export function EmbeddingModelPanel() {
  const toast = useToast();
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai/embedding-model');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        if (data.current) setSelected(`${data.current.provider}/${data.current.modelId}`);
      }
    } catch (error) {
      console.error('Failed to load embedding model status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCandidate = status?.candidates.find((c) => `${c.provider}/${c.modelId}` === selected);
  const isCurrent = !!status?.current && selected === `${status.current.provider}/${status.current.modelId}`;

  const performSwitch = async () => {
    if (!selectedCandidate) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/admin/ai/embedding-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedCandidate.provider,
          modelId: selectedCandidate.modelId,
          confirm: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Switch failed');
      toast.success(
        'Embedding model switched',
        `${data.reindex.chunks} chunks re-embedded with ${data.switchedTo.modelId} in ${(data.reindex.tookMs / 1000).toFixed(1)}s (~$${data.reindex.costUsd.toFixed(4)})`
      );
      await load();
    } catch (error) {
      toast.error('Switch failed', error instanceof Error ? error.message : 'Unknown error');
      await load(); // surface any resulting drift immediately
    } finally {
      setSwitching(false);
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Embedding model
          {status?.drift && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> drift
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Semantic search compares query vectors against stored chunk vectors — both must come from
          the same model, so switching re-embeds the entire corpus (with your consent).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading embedding status…
          </div>
        ) : !status ? (
          <div className="text-sm text-muted-foreground">Failed to load status.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Active:</span>{' '}
                <span className="font-mono text-xs">
                  {status.current ? `${status.current.provider}/${status.current.modelId}` : 'not configured'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Stored vectors:</span>{' '}
                {status.stored.length === 0 ? (
                  <span className="text-xs">none</span>
                ) : (
                  status.stored.map((s) => (
                    <span key={s.model} className="mr-2 font-mono text-xs">
                      {s.model} ({s.chunks})
                    </span>
                  ))
                )}
              </div>
            </div>
            {status.drift && (
              <p className="text-xs text-destructive">
                Stored vectors don&apos;t match the active model — semantic ranking is unreliable until a
                re-embed completes. Re-run the switch below with the active model to repair.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="w-96 h-8">
                  <SelectValue placeholder="Pick an embedding model" />
                </SelectTrigger>
                <SelectContent>
                  {status.candidates.map((c) => (
                    <SelectItem key={`${c.provider}/${c.modelId}`} value={`${c.provider}/${c.modelId}`}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={isCurrent && !status.drift ? 'outline' : 'default'}
                className="h-8"
                disabled={!selectedCandidate || switching || (isCurrent && !status.drift)}
                onClick={() => setConfirming(true)}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                {isCurrent ? (status.drift ? 'Re-embed corpus' : 'Active') : 'Switch & re-embed'}
              </Button>
            </div>
          </div>
        )}

        <Dialog open={confirming} onOpenChange={(open) => !switching && setConfirming(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Re-embed the entire corpus?</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    {isCurrent ? 'Re-embedding with' : 'Switching to'}{' '}
                    <span className="font-mono text-xs">{selectedCandidate?.label}</span> will regenerate
                    embeddings for <strong>{selectedCandidate?.estimate.chunks} chunks</strong> (~
                    {selectedCandidate?.estimate.estimatedTokens.toLocaleString()} tokens, estimated $
                    {selectedCandidate?.estimate.estimatedCostUsd.toFixed(4)}).
                  </p>
                  <p>
                    Semantic search quality degrades while the re-embed runs, and the operation is metered
                    to the spend ledger. This cannot be interrupted from the UI.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" disabled={switching} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button disabled={switching} onClick={performSwitch}>
                {switching ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Re-embedding…
                  </>
                ) : (
                  'Yes, re-embed everything'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
