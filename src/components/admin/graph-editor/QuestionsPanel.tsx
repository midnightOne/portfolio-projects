"use client";

/**
 * "What visitors actually asked here" (task D4 / Req 16.3): the node
 * inspector's window into the Block I1 analytics — clusters ranked by size
 * with representative phrasings, one action promoting a real question to a
 * chip and (optionally) to an intent-edge exemplar. Data-picked chips replace
 * intuition-picked ones IN THE EDITOR, never at runtime (Req 16.4 — no
 * dynamic suggestions).
 *
 * The panel also carries the admin trigger for the analytics batch itself
 * (P23: batches run from here or cron, never inside conversations).
 */

import React from 'react';
import type { GraphEdge, GraphNode } from '@/lib/ai/engine/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RefreshCw, MessageSquarePlus, GitBranchPlus } from 'lucide-react';
import { newChipId } from './graph-editor-utils';

interface QuestionCluster {
  clusterId: string;
  count: number;
  representative: string;
  samples: string[];
  lastAskedAt: string;
}

interface NodeQuestions {
  nodeId: string;
  clusters: QuestionCluster[];
  pending: number;
}

interface QuestionsPanelProps {
  graphId: string;
  node: GraphNode;
  /** All draft edges — exemplar promotion targets are intent edges FROM this node. */
  edges: GraphEdge[];
  /** Node display names for edge-target labels. */
  nodeNames: Record<string, string>;
  onNodeChange: (node: GraphNode) => void;
  onEdgeChange: (edge: GraphEdge) => void;
}

export function QuestionsPanel({ graphId, node, edges, nodeNames, onNodeChange, onEdgeChange }: QuestionsPanelProps) {
  const [data, setData] = React.useState<NodeQuestions[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [batchRunning, setBatchRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai/graphs/${graphId}/questions`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      setStatus('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [graphId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runBatch = async () => {
    setBatchRunning(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/ai/engine/batch/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        const r = json.data;
        setStatus(
          `Batch: ${r.transitionsScanned} transitions → +${r.rowsInserted} rows, ${r.rowsEmbedded} embedded, ${r.rowsClustered} clustered${r.notes?.length ? ` — ${r.notes.join('; ')}` : ''}`
        );
        await load();
      } else {
        setStatus(json.error?.message ?? 'Batch failed');
      }
    } catch {
      setStatus('Batch failed');
    } finally {
      setBatchRunning(false);
    }
  };

  const intentEdges = edges.filter((e) => e.from === node.id && e.condition.type === 'intent');

  const promoteToChip = (text: string) => {
    const label = text.length > 48 ? `${text.slice(0, 45)}…` : text;
    const chips = [...(node.ux?.chips ?? []), { id: newChipId(), label, sendText: text.length > 48 ? text : undefined }];
    onNodeChange({ ...node, ux: { ...(node.ux ?? {}), chips } });
  };

  const promoteToExemplar = (edgeId: string, text: string) => {
    const edge = intentEdges.find((e) => e.id === edgeId);
    if (!edge || edge.condition.type !== 'intent') return;
    if (edge.condition.exemplars.includes(text)) return;
    onEdgeChange({ ...edge, condition: { ...edge.condition, exemplars: [...edge.condition.exemplars, text] } });
  };

  const mine = data?.find((n) => n.nodeId === node.id);

  return (
    <div className="space-y-2" data-testid="questions-panel">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium">What visitors actually asked here</Label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Real entry questions from the analytics batch (test sessions excluded). Promote one to a chip or an
            intent exemplar.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px] shrink-0"
          onClick={runBatch}
          disabled={batchRunning}
          title="Run the question analytics batch now (scan → embed → cluster)"
          data-testid="run-questions-batch"
        >
          <RefreshCw className={`h-3 w-3 mr-0.5 ${batchRunning ? 'animate-spin' : ''}`} />
          {batchRunning ? 'Running…' : 'Run batch'}
        </Button>
      </div>

      {status && <p className="text-[11px] text-muted-foreground" data-testid="questions-batch-status">{status}</p>}

      {loading && !data && <p className="text-[11px] text-muted-foreground">Loading…</p>}
      {!loading && (!mine || mine.clusters.length === 0) && (
        <p className="text-[11px] text-muted-foreground" data-testid="questions-empty">
          No sampled questions for this node yet{mine?.pending ? ` (${mine.pending} pending embedding/clustering — run the batch)` : ''}.
        </p>
      )}

      {mine && mine.pending > 0 && mine.clusters.length > 0 && (
        <p className="text-[11px] text-muted-foreground">{mine.pending} newer row(s) pending — run the batch to cluster them.</p>
      )}

      {mine?.clusters.map((cluster) => (
        <div key={cluster.clusterId} className="rounded-md border border-border p-2 space-y-1" data-testid="question-cluster">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-foreground flex-1">{cluster.representative}</p>
            <Badge variant="outline" className="text-[10px] shrink-0" title="Times asked (near-duplicates grouped)">
              ×{cluster.count}
            </Badge>
          </div>
          {cluster.samples.length > 0 && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">{cluster.samples.length} other phrasing(s)</summary>
              <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                {cluster.samples.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => promoteToChip(cluster.representative)}
              data-testid="promote-chip"
            >
              <MessageSquarePlus className="h-3 w-3 mr-0.5" /> chip
            </Button>
            {intentEdges.length > 0 ? (
              <select
                className="h-6 rounded-md border border-input bg-background px-1 text-[11px] text-foreground"
                value=""
                onChange={(e) => {
                  if (e.target.value) promoteToExemplar(e.target.value, cluster.representative);
                }}
                title="Add as an intent exemplar on an outgoing edge (re-publish refreshes embeddings)"
                data-testid="promote-exemplar"
              >
                <option value="">+ exemplar on…</option>
                {intentEdges.map((e) => (
                  <option key={e.id} value={e.id}>
                    → {nodeNames[e.to] ?? e.to}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5" title="Draw an intent-condition edge from this node to enable exemplar promotion">
                <GitBranchPlus className="h-3 w-3" /> no intent edges from this node
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
