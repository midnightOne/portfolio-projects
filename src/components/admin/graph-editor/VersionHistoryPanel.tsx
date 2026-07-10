"use client";

/**
 * Version history (Req 8.4 / D3): list versions, structural diff between any
 * two (stable-id joins), re-activate a prior version. Re-activation moves the
 * live pointer only — the draft keeps in-progress edits; live conversations
 * keep their pinned version (P6).
 */

import React from 'react';
import type { GraphDiff } from '@/lib/services/ai/graph-diff';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface VersionRow {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  isActive: boolean;
  nodeCount: number;
  edgeCount: number;
}

interface VersionHistoryPanelProps {
  graphId: string;
  versions: VersionRow[];
  onActivate: (versionId: string) => void;
  activating: boolean;
}

export function VersionHistoryPanel({ graphId, versions, onActivate, activating }: VersionHistoryPanelProps) {
  const [diffPair, setDiffPair] = React.useState<[string | null, string | null]>([null, null]);
  const [diff, setDiff] = React.useState<GraphDiff | null>(null);
  const [diffError, setDiffError] = React.useState<string | null>(null);

  const toggleDiffPick = (versionId: string) => {
    setDiff(null);
    setDiffError(null);
    setDiffPair(([a, b]) => {
      if (a === versionId) return [b, null];
      if (b === versionId) return [a, null];
      if (!a) return [versionId, null];
      if (!b) return [a, versionId];
      return [b, versionId];
    });
  };

  React.useEffect(() => {
    const [a, b] = diffPair;
    if (!a || !b) return;
    let cancelled = false;
    (async () => {
      try {
        // Older side first so added/removed reads naturally
        const older = versions.find((v) => v.id === a)!.version < versions.find((v) => v.id === b)!.version ? a : b;
        const newer = older === a ? b : a;
        const res = await fetch(`/api/admin/ai/graphs/${graphId}/versions?diff=${older},${newer}`);
        const json = await res.json();
        if (!cancelled) {
          if (json.success) setDiff(json.data);
          else setDiffError(json.error?.message ?? 'diff failed');
        }
      } catch {
        if (!cancelled) setDiffError('diff failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diffPair, graphId, versions]);

  if (versions.length === 0) {
    return <p className="text-xs text-muted-foreground p-3">No published versions yet.</p>;
  }

  return (
    <div className="space-y-2 p-1" data-testid="version-history">
      <p className="text-[11px] text-muted-foreground">
        Pick two versions to diff. Re-activating moves the live pointer only — the draft keeps your edits; live
        conversations keep their pinned version.
      </p>
      {versions.map((v) => (
        <div key={v.id} className="rounded-md border border-border p-2 space-y-1" data-testid={`version-${v.version}`}>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={diffPair.includes(v.id)} onChange={() => toggleDiffPick(v.id)} />
              <span className="font-semibold">v{v.version}</span>
            </label>
            {v.isActive && <Badge className="text-[10px]">active</Badge>}
            <span className="text-[11px] text-muted-foreground ml-auto">{new Date(v.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {v.nodeCount} nodes · {v.edgeCount} edges{v.note ? ` — ${v.note}` : ''}
          </p>
          {!v.isActive && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={activating}
              onClick={() => onActivate(v.id)}
              data-testid={`activate-version-${v.version}`}
            >
              Re-activate
            </Button>
          )}
        </div>
      ))}

      {diffError && <p className="text-[11px] text-destructive">{diffError}</p>}
      {diff && (
        <div className="rounded-md border border-border p-2 space-y-1" data-testid="version-diff">
          <p className="text-xs font-semibold">Structural diff</p>
          {diff.identical ? (
            <p className="text-[11px] text-muted-foreground">No structural changes (layout/embedding-only).</p>
          ) : (
            <>
              {diff.nodes.map((d) => (
                <p key={`n-${d.id}-${d.change}`} className="text-[11px]">
                  <span className={d.change === 'added' ? 'text-emerald-600' : d.change === 'removed' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                    {d.change}
                  </span>{' '}
                  node: {d.label}
                </p>
              ))}
              {diff.edges.map((d) => (
                <p key={`e-${d.id}-${d.change}`} className="text-[11px]">
                  <span className={d.change === 'added' ? 'text-emerald-600' : d.change === 'removed' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                    {d.change}
                  </span>{' '}
                  edge: {d.label}
                </p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
