"use client";

/**
 * Graph editor (Block D2 — Req 8): React Flow canvas over the draft document,
 * right-hand inspectors, debounced autosave (a canvas crash loses seconds,
 * not sessions — P15), validate-on-save badges, publish + version history.
 *
 * The document (nodes/edges/layout) is the single client-side source of
 * truth; React Flow state is derived. Node/edge ids are minted once at
 * creation and NEVER regenerated (P15 — telemetry joins depend on it).
 */

import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Link from 'next/link';
import type { GraphDocument, GraphEdge, GraphNode } from '@/lib/ai/engine/types';
import type { ValidationIssue } from '@/lib/ai/engine/validation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GraphCanvasNode, type CanvasNode } from './GraphCanvasNode';
import { NodeInspector } from './NodeInspector';
import { EdgeInspector } from './EdgeInspector';
import { PublishDialog } from './PublishDialog';
import { VersionHistoryPanel, type VersionRow } from './VersionHistoryPanel';
import { AnnotationsDrawer } from './AnnotationsDrawer';
import { CoveragePanel } from './CoveragePanel';
import { makeEdge, makeNode, summarizeCondition, type EditorMeta } from './graph-editor-utils';
import { ArrowLeft, Plus, Upload, History, AlertTriangle, Flag, BarChart3 } from 'lucide-react';
import type { AnnotationRow } from '@/lib/services/ai/graph-store';
import type { CoverageReport } from '@/lib/services/ai/graph-coverage';

const nodeTypes = { graphNode: GraphCanvasNode };

type LayoutMap = Record<string, { x: number; y: number }>;

interface GraphDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  activeVersion: number | null;
  draftDocument: GraphDocument;
  issues: ValidationIssue[];
}

function issueCounts(issues: ValidationIssue[], nodeId: string) {
  const mine = issues.filter((i) => i.nodeId === nodeId);
  return {
    errorCount: mine.filter((i) => i.severity === 'error').length,
    warningCount: mine.filter((i) => i.severity === 'warning').length,
  };
}

export function GraphEditor({ graphId }: { graphId: string }) {
  const [detail, setDetail] = React.useState<GraphDetail | null>(null);
  const [meta, setMeta] = React.useState<EditorMeta | null>(null);
  const [document, setDocument] = React.useState<GraphDocument | null>(null);
  const [name, setName] = React.useState('');
  const [issues, setIssues] = React.useState<ValidationIssue[]>([]);
  const [selection, setSelection] = React.useState<{ kind: 'node' | 'edge'; id: string } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [publishResult, setPublishResult] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [activating, setActivating] = React.useState(false);
  // Block E2 — review TODO drawer
  const [annotationsOpen, setAnnotationsOpen] = React.useState(false);
  const [annotations, setAnnotations] = React.useState<AnnotationRow[]>([]);
  const [showResolved, setShowResolved] = React.useState(false);
  const [annotationBusyId, setAnnotationBusyId] = React.useState<string | null>(null);
  // Block E3 — coverage overlay
  const [coverageOn, setCoverageOn] = React.useState(false);
  const [coverage, setCoverage] = React.useState<CoverageReport | null>(null);
  const [coverageDays, setCoverageDays] = React.useState(30);
  const [coverageLoading, setCoverageLoading] = React.useState(false);

  const loadAnnotations = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ai/graph-annotations?graphId=${encodeURIComponent(graphId)}`);
      const json = await res.json();
      if (json.success) setAnnotations(json.data);
    } catch {
      /* drawer stays empty; editing is unaffected */
    }
  }, [graphId]);

  React.useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  const patchAnnotation = async (id: string, status: 'open' | 'resolved') => {
    setAnnotationBusyId(id);
    try {
      await fetch('/api/admin/ai/graph-annotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await loadAnnotations();
    } finally {
      setAnnotationBusyId(null);
    }
  };

  React.useEffect(() => {
    if (!coverageOn) return;
    let cancelled = false;
    setCoverageLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/ai/graphs/${graphId}/coverage?days=${coverageDays}`);
        const json = await res.json();
        if (!cancelled) setCoverage(json.success ? json.data : null);
      } catch {
        if (!cancelled) setCoverage(null);
      } finally {
        if (!cancelled) setCoverageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coverageOn, coverageDays, graphId]);

  // Positions live in document.layout; keep a ref for drag updates without re-rendering per pixel.
  const layoutRef = React.useRef<LayoutMap>({});

  const loadVersions = React.useCallback(async () => {
    const res = await fetch(`/api/admin/ai/graphs/${graphId}/versions`);
    const json = await res.json();
    if (json.success) setVersions(json.data);
  }, [graphId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [detailRes, metaRes] = await Promise.all([
          fetch(`/api/admin/ai/graphs/${graphId}`),
          fetch(`/api/admin/ai/graphs/meta`),
        ]);
        const detailJson = await detailRes.json();
        const metaJson = await metaRes.json();
        if (cancelled) return;
        if (!detailJson.success) {
          setLoadError(detailJson.error?.message ?? 'Failed to load graph');
          return;
        }
        const d: GraphDetail = detailJson.data;
        setDetail(d);
        setName(d.name);
        setDocument(d.draftDocument);
        setIssues(d.issues);
        layoutRef.current = ((d.draftDocument.layout ?? {}) as LayoutMap) || {};
        if (metaJson.success) setMeta(metaJson.data);
        void loadVersions();
      } catch {
        if (!cancelled) setLoadError('Failed to load graph');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId, loadVersions]);

  // ---- autosave (debounced PUT; invalid drafts save deliberately) ----
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = React.useRef(true); // initial load isn't dirty
  React.useEffect(() => {
    if (!document) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await fetch(`/api/admin/ai/graphs/${graphId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: { ...document, layout: layoutRef.current }, name }),
        });
        const json = await res.json();
        if (json.success) {
          setIssues(json.data.issues);
          setSaveState('saved');
        } else {
          setSaveState('error');
        }
      } catch {
        setSaveState('error');
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [document, name, graphId]);

  // ---- React Flow derived state ----
  const coverageByNode = React.useMemo(() => {
    if (!coverageOn || !coverage) return null;
    return new Map(coverage.nodes.map((n) => [n.nodeId, n.entries]));
  }, [coverageOn, coverage]);

  const [rfNodes, setRfNodes] = React.useState<CanvasNode[]>([]);
  React.useEffect(() => {
    if (!document) return;
    setRfNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return document.nodes.map((node, i) => {
        const existing = prevById.get(node.id);
        const position = existing?.position ?? layoutRef.current[node.id] ?? { x: 80 + (i % 4) * 260, y: 80 + Math.floor(i / 4) * 160 };
        return {
          id: node.id,
          type: 'graphNode' as const,
          position,
          selected: existing?.selected ?? false,
          data: {
            node,
            ...issueCounts(issues, node.id),
            // E3 overlay: entries in the window; a draft node the report doesn't
            // know yet honestly shows "no traffic"
            coverage: coverageByNode ? { entries: coverageByNode.get(node.id) ?? 0 } : null,
          },
        };
      });
    });
  }, [document, issues, coverageByNode]);

  const rfEdges: Edge[] = React.useMemo(() => {
    if (!document) return [];
    return document.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label:
        `${edge.priority} · ${summarizeCondition(edge.condition)}${edge.purge === 'keep' ? ' · keep ctx' : ''}` +
        (coverageOn && coverage ? ` · ${coverage.edgeFires[edge.id] ?? 0}×` : ''),
      selected: selection?.kind === 'edge' && selection.id === edge.id,
      animated: edge.condition.type === 'always',
      labelStyle: { fontSize: 10 },
      style: issues.some((i) => i.edgeId === edge.id && i.severity === 'error')
        ? { stroke: 'var(--destructive, #dc2626)', strokeWidth: 2 }
        : undefined,
    }));
  }, [document, selection, issues, coverageOn, coverage]);

  const onNodesChange = React.useCallback((changes: NodeChange<CanvasNode>[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds));
    let layoutTouched = false;
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        layoutRef.current[change.id] = { x: Math.round(change.position.x), y: Math.round(change.position.y) };
        layoutTouched = true;
      }
    }
    // Persist layout when a drag finishes (position changes stop arriving with dragging=true)
    if (layoutTouched && changes.every((c) => c.type !== 'position' || !c.dragging)) {
      setDocument((doc) => (doc ? { ...doc, layout: { ...layoutRef.current } } : doc));
    }
  }, []);

  const onEdgesChange = React.useCallback((_changes: EdgeChange[]) => {
    // Edge removal goes through the inspector's Delete; selection via onEdgeClick.
  }, []);

  const onConnect = React.useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const edge = makeEdge(connection.source, connection.target);
    setDocument((doc) => (doc ? { ...doc, edges: [...doc.edges, edge] } : doc));
    setSelection({ kind: 'edge', id: edge.id });
  }, []);

  const addNode = () => {
    const node = makeNode();
    // Place near the viewport origin-ish; owner drags it where it belongs.
    layoutRef.current[node.id] = { x: 120 + Math.random() * 120, y: 120 + Math.random() * 120 };
    setDocument((doc) => (doc ? { ...doc, nodes: [...doc.nodes, node], layout: { ...layoutRef.current } } : doc));
    setSelection({ kind: 'node', id: node.id });
  };

  // Drag-connect on the canvas also works; this explicit path is kinder to
  // touchpads and lets the inspector's From/To selects finish the wiring.
  const addEdgeFromSelection = () => {
    if (!document || selection?.kind !== 'node') return;
    const target = document.nodes.find((n) => n.id !== selection.id);
    if (!target) return;
    const edge = makeEdge(selection.id, target.id);
    setDocument((doc) => (doc ? { ...doc, edges: [...doc.edges, edge] } : doc));
    setSelection({ kind: 'edge', id: edge.id });
  };

  const updateNode = (updated: GraphNode) => {
    setDocument((doc) =>
      doc ? { ...doc, nodes: doc.nodes.map((n) => (n.id === updated.id ? updated : n)) } : doc
    );
  };

  const deleteNode = (id: string) => {
    setDocument((doc) =>
      doc
        ? {
            ...doc,
            nodes: doc.nodes.filter((n) => n.id !== id),
            edges: doc.edges.filter((e) => e.from !== id && e.to !== id),
          }
        : doc
    );
    delete layoutRef.current[id];
    setSelection(null);
  };

  const updateEdge = (updated: GraphEdge) => {
    setDocument((doc) => (doc ? { ...doc, edges: doc.edges.map((e) => (e.id === updated.id ? updated : e)) } : doc));
  };

  const deleteEdge = (id: string) => {
    setDocument((doc) => (doc ? { ...doc, edges: doc.edges.filter((e) => e.id !== id) } : doc));
    setSelection(null);
  };

  const publish = async (note: string) => {
    setPublishing(true);
    setPublishResult(null);
    try {
      // Flush any pending draft changes first so publish sees the latest document.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await fetch(`/api/admin/ai/graphs/${graphId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: { ...document, layout: layoutRef.current }, name }),
      });
      const res = await fetch(`/api/admin/ai/graphs/${graphId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setPublishOpen(false);
        setPublishResult(`Published v${json.data.version} — now active for new conversations`);
        setDetail((d) => (d ? { ...d, status: 'active', activeVersion: json.data.version } : d));
        void loadVersions();
      } else {
        if (json.error?.details?.issues) setIssues(json.error.details.issues);
        setPublishResult(json.error?.message ?? 'Publish failed');
      }
    } catch {
      setPublishResult('Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const activateVersion = async (versionId: string) => {
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/ai/graphs/${graphId}/versions/${versionId}/activate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setPublishResult(`Re-activated v${json.data.version}`);
        setDetail((d) => (d ? { ...d, status: 'active', activeVersion: json.data.version } : d));
        void loadVersions();
      }
    } finally {
      setActivating(false);
    }
  };

  if (loadError) {
    return <div className="p-6 text-sm text-destructive">{loadError}</div>;
  }
  if (!detail || !document) {
    return <div className="p-6 text-sm text-muted-foreground">Loading graph…</div>;
  }

  const selectedNode = selection?.kind === 'node' ? document.nodes.find((n) => n.id === selection.id) : null;
  const selectedEdge = selection?.kind === 'edge' ? document.edges.find((e) => e.id === selection.id) : null;
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col" data-testid="graph-editor">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link href="/admin/ai/conversation-graphs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Input
          className="h-8 w-64 text-sm font-medium"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="graph-name"
        />
        <Badge variant={detail.status === 'active' ? 'default' : 'outline'} className="text-[10px]">
          {detail.status}
          {detail.activeVersion ? ` · v${detail.activeVersion}` : ''}
        </Badge>
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-destructive" data-testid="issue-count">
            <AlertTriangle className="h-3 w-3" /> {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {errorCount === 0 && warningCount > 0 && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400" data-testid="issue-count">
            {warningCount} warning{warningCount > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground" data-testid="save-state">
          {saveState === 'saved' ? 'draft saved' : saveState === 'saving' ? 'saving…' : saveState === 'dirty' ? 'unsaved changes' : 'save failed — retrying on next edit'}
        </span>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addNode} data-testid="add-node">
          <Plus className="h-3.5 w-3.5 mr-1" /> Node
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={addEdgeFromSelection}
          disabled={selection?.kind !== 'node'}
          title="Add an outgoing edge from the selected node (or drag between node handles)"
          data-testid="add-edge"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Edge
        </Button>
        <Button
          variant={coverageOn ? 'default' : 'outline'}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setCoverageOn((v) => !v)}
          title="Node hit rates, dead nodes, off-graph exits, edge fires over real (non-test) traffic"
          data-testid="toggle-coverage"
        >
          <BarChart3 className="h-3.5 w-3.5 mr-1" /> Coverage
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setAnnotationsOpen((v) => !v);
            setHistoryOpen(false);
            void loadAnnotations();
          }}
          data-testid="toggle-annotations"
        >
          <Flag className="h-3.5 w-3.5 mr-1" /> TODOs
          {annotations.filter((a) => a.status === 'open').length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 text-[10px] font-semibold" data-testid="todo-count">
              {annotations.filter((a) => a.status === 'open').length}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setHistoryOpen((v) => !v);
            setAnnotationsOpen(false);
            void loadVersions();
          }}
          data-testid="toggle-history"
        >
          <History className="h-3.5 w-3.5 mr-1" /> Versions
        </Button>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setPublishOpen(true)} data-testid="open-publish">
          <Upload className="h-3.5 w-3.5 mr-1" /> Publish
        </Button>
      </div>

      {publishResult && (
        <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs" data-testid="publish-result">
          {publishResult}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* canvas */}
        <div className="flex-1 min-w-0" data-testid="graph-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelection({ kind: 'node', id: node.id })}
            onEdgeClick={(_, edge) => setSelection({ kind: 'edge', id: edge.id })}
            onPaneClick={() => setSelection(null)}
            deleteKeyCode={null} // deletion is an explicit inspector action, never an accidental keypress
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        </div>

        {/* right panel */}
        <div className="w-96 shrink-0 border-l border-border overflow-y-auto p-3">
          {historyOpen ? (
            <VersionHistoryPanel graphId={graphId} versions={versions} onActivate={activateVersion} activating={activating} />
          ) : annotationsOpen ? (
            <AnnotationsDrawer
              annotations={annotations}
              showResolved={showResolved}
              onToggleResolved={setShowResolved}
              onResolve={(id) => void patchAnnotation(id, 'resolved')}
              onReopen={(id) => void patchAnnotation(id, 'open')}
              busyId={annotationBusyId}
            />
          ) : selectedNode ? (
            <NodeInspector
              node={selectedNode}
              meta={meta}
              issues={issues}
              onChange={updateNode}
              onDelete={() => deleteNode(selectedNode.id)}
            />
          ) : selectedEdge ? (
            <EdgeInspector
              edge={selectedEdge}
              document={document}
              meta={meta}
              issues={issues}
              onChange={updateEdge}
              onDelete={() => deleteEdge(selectedEdge.id)}
            />
          ) : coverageOn ? (
            <CoveragePanel coverage={coverage} days={coverageDays} onDaysChange={setCoverageDays} loading={coverageLoading} />
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground p-2">
              <p>Select a node or edge to edit it. Drag between node handles to create an edge.</p>
              <p>
                Publishing snapshots the draft as an immutable version; changes apply to <strong>new</strong>{' '}
                conversations only.
              </p>
              <p>
                Guidance that must never transit a visitor&apos;s browser belongs on cascade/text runtimes — native
                voice applies directives client-side (same exposure class as existing context injection).
              </p>
              {issues.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border">
                  <p className="font-semibold text-foreground">All validation results</p>
                  {issues.map((iss, i) => (
                    <p key={i} className={iss.severity === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                      {iss.severity === 'error' ? '✕' : '⚠'} {iss.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        issues={issues}
        publishing={publishing}
        onPublish={publish}
      />
    </div>
  );
}
