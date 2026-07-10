"use client";

/**
 * Read-only traversal view (Block E1 — Req 9.1 "show on graph"): the graph
 * canvas pinned to the EXACT version a conversation ran under (P6 — later
 * edits never reinterpret old runs), with the run's path highlighted and a
 * Previous/Next step-through over its transitions. No editing surface at all —
 * the draft is not loaded and nothing autosaves; "Open editor" is the way out.
 */

import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GraphDocument } from '@/lib/ai/engine/types';
import { GraphCanvasNode, type CanvasNode } from './GraphCanvasNode';
import { summarizeCondition } from './graph-editor-utils';
import { extractTraversal, type TraversalHop } from './traversal-utils';
import type { ReplayData } from '../ConversationReplayViewer';
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';

const nodeTypes = { graphNode: GraphCanvasNode };

interface VersionDetail {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  document: GraphDocument;
}

export function TraversalViewer({
  graphId,
  versionId,
  conversationId,
}: {
  graphId: string;
  versionId: string;
  conversationId: string;
}) {
  const [version, setVersion] = React.useState<VersionDetail | null>(null);
  const [replay, setReplay] = React.useState<ReplayData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [hopIndex, setHopIndex] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [versionRes, replayRes] = await Promise.all([
          fetch(`/api/admin/ai/graphs/${graphId}/versions/${versionId}`),
          fetch(`/api/ai/conversation/replay?conversationId=${encodeURIComponent(conversationId)}`),
        ]);
        const versionJson = await versionRes.json();
        const replayJson = await replayRes.json();
        if (cancelled) return;
        if (!versionJson.success) {
          setLoadError(versionJson.error?.message ?? 'Failed to load graph version');
          return;
        }
        setVersion(versionJson.data);
        if (replayJson.success && replayJson.data) setReplay(replayJson.data);
        else setLoadError('Conversation not found');
      } catch {
        if (!cancelled) setLoadError('Failed to load traversal');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId, versionId, conversationId]);

  const hops: TraversalHop[] = React.useMemo(
    () => (replay ? extractTraversal(replay.timeline) : []),
    [replay]
  );
  const hop: TraversalHop | undefined = hops[hopIndex];

  // Nodes/edges reached at or before the current hop.
  const visited = React.useMemo(() => {
    const nodes = new Set<string>();
    const edges = new Set<string>();
    hops.slice(0, hopIndex + 1).forEach((h) => {
      if (h.fromNode) nodes.add(h.fromNode);
      nodes.add(h.toNode);
      if (h.edgeId) edges.add(h.edgeId);
    });
    return { nodes, edges };
  }, [hops, hopIndex]);

  const document = version?.document ?? null;
  const layout = (document?.layout ?? {}) as Record<string, { x: number; y: number }>;

  const rfNodes: CanvasNode[] = React.useMemo(() => {
    if (!document) return [];
    return document.nodes.map((node, i) => ({
      id: node.id,
      type: 'graphNode' as const,
      position: layout[node.id] ?? { x: 80 + (i % 4) * 260, y: 80 + Math.floor(i / 4) * 160 },
      selected: hop?.toNode === node.id,
      draggable: false,
      connectable: false,
      data: { node, errorCount: 0, warningCount: 0 },
      style: visited.nodes.has(node.id) ? undefined : { opacity: 0.35 },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, visited, hop]);

  const rfEdges: Edge[] = React.useMemo(() => {
    if (!document) return [];
    return document.edges.map((edge) => {
      const isCurrent = hop?.edgeId === edge.id;
      const isVisited = visited.edges.has(edge.id);
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: `${edge.priority} · ${summarizeCondition(edge.condition)}`,
        animated: isCurrent,
        labelStyle: { fontSize: 10, opacity: isVisited ? 1 : 0.4 },
        style: isCurrent
          ? { stroke: 'var(--primary, #6366f1)', strokeWidth: 3 }
          : isVisited
          ? { stroke: 'var(--primary, #6366f1)', strokeWidth: 1.5, opacity: 0.7 }
          : { opacity: 0.25 },
      };
    });
  }, [document, visited, hop]);

  const nodeName = React.useCallback(
    (id: string | null) => (id ? document?.nodes.find((n) => n.id === id)?.name ?? id : '∅'),
    [document]
  );

  if (loadError) {
    return <div className="p-6 text-sm text-destructive">{loadError}</div>;
  }
  if (!version || !replay) {
    return <div className="p-6 text-sm text-muted-foreground">Loading traversal…</div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col" data-testid="traversal-viewer">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link href="/admin/ai/conversations" className="text-muted-foreground hover:text-foreground" title="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium">Traversal</span>
        <Badge variant="outline" className="text-[10px]">read-only · v{version.version}</Badge>
        <code className="font-mono text-[11px] text-muted-foreground truncate max-w-56">{conversationId}</code>
        <span className="ml-auto" />
        <Link href={`/admin/ai/conversation-graphs/${graphId}`}>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
            <Pencil className="h-3.5 w-3.5 mr-1" /> Open editor
          </Button>
        </Link>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* canvas */}
        <div className="flex-1 min-w-0" data-testid="traversal-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        </div>

        {/* hop panel */}
        <div className="w-80 shrink-0 border-l border-border overflow-y-auto p-3 space-y-3">
          {hops.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This conversation recorded no node transitions under this graph version.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground" data-testid="hop-counter">
                  Transition {hopIndex + 1} of {hops.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1.5"
                    onClick={() => setHopIndex((i) => Math.max(0, i - 1))}
                    disabled={hopIndex === 0}
                    data-testid="hop-prev"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1.5"
                    onClick={() => setHopIndex((i) => Math.min(hops.length - 1, i + 1))}
                    disabled={hopIndex >= hops.length - 1}
                    data-testid="hop-next"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {hop && (
                <div className="space-y-1.5 rounded border border-border p-2 text-xs" data-testid="hop-detail">
                  <p className="font-medium text-sm">
                    {nodeName(hop.fromNode)} → {nodeName(hop.toNode)}
                  </p>
                  {hop.conditionType && (
                    <p>
                      <span className="text-muted-foreground">condition:</span> {hop.conditionType}
                    </p>
                  )}
                  {hop.evidence && (
                    <p className="text-muted-foreground break-words">evidence: {hop.evidence}</p>
                  )}
                  <p className="text-muted-foreground">{new Date(hop.timestamp).toLocaleString()}</p>
                </div>
              )}

              {/* full path overview — click to jump */}
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Path</p>
                {hops.map((h, i) => (
                  <button
                    key={h.messageId}
                    onClick={() => setHopIndex(i)}
                    className={`block w-full text-left text-xs rounded px-1.5 py-1 ${
                      i === hopIndex ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                    data-testid={`hop-item-${i}`}
                  >
                    {i + 1}. {nodeName(h.fromNode)} → {nodeName(h.toNode)}
                    {h.conditionType ? ` (${h.conditionType})` : ''}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
