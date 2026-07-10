"use client";

/**
 * Coverage summary panel (Block E3 — Req 9.3): the "where to invest the next
 * node" view over a selectable window of real (non-test) traffic. The canvas
 * renders the per-node hit badges and edge fire counts; this panel carries the
 * window selector, totals, dead-node list, and hot off-graph exits.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { CoverageReport } from '@/lib/services/ai/graph-coverage';

const WINDOWS = [7, 30, 90] as const;

export function CoveragePanel({
  coverage,
  days,
  onDaysChange,
  loading,
}: {
  coverage: CoverageReport | null;
  days: number;
  onDaysChange: (days: number) => void;
  loading: boolean;
}) {
  const deadNodes = coverage?.nodes.filter((n) => n.dead) ?? [];
  const hotNodes = [...(coverage?.nodes ?? [])].filter((n) => n.entries > 0).sort((a, b) => b.entries - a.entries);

  return (
    <div className="space-y-3" data-testid="coverage-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Coverage</h3>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => onDaysChange(w)}
              className={`text-[11px] rounded px-1.5 py-0.5 border ${
                days === w ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`coverage-window-${w}`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading coverage…</p>}
      {!loading && !coverage && <p className="text-xs text-muted-foreground">No coverage data.</p>}

      {!loading && coverage && (
        <>
          <div className="text-xs text-muted-foreground space-y-0.5" data-testid="coverage-totals">
            <p>
              <span className="font-medium text-foreground">{coverage.conversations}</span> conversation
              {coverage.conversations === 1 ? '' : 's'},{' '}
              <span className="font-medium text-foreground">{coverage.transitions}</span> transition
              {coverage.transitions === 1 ? '' : 's'} in the last {coverage.windowDays} days
            </p>
            {coverage.testConversationsExcluded > 0 && (
              <p>{coverage.testConversationsExcluded} test conversation(s) excluded</p>
            )}
          </div>

          {hotNodes.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Node entries</p>
              {hotNodes.map((n) => (
                <div key={n.nodeId} className="flex items-center justify-between text-xs">
                  <span className="truncate">{n.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {n.entries}× · {n.conversations} conv
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Dead nodes (never entered)
            </p>
            {deadNodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">None — every node saw traffic.</p>
            ) : (
              <div className="flex flex-wrap gap-1" data-testid="dead-nodes">
                {deadNodes.map((n) => (
                  <Badge key={n.nodeId} variant="outline" className="text-[10px] text-muted-foreground">
                    {n.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Hot off-graph exits
            </p>
            {coverage.offGraphExits.length === 0 ? (
              <p className="text-xs text-muted-foreground">No off-graph exits in the window.</p>
            ) : (
              coverage.offGraphExits.map((e) => (
                <div key={e.fromNode} className="flex items-center justify-between text-xs" data-testid="offgraph-exit">
                  <span className="truncate">{e.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{e.count}×</span>
                </div>
              ))
            )}
          </div>

          {coverage.removedNodeEntries.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Entries on removed nodes
              </p>
              {coverage.removedNodeEntries.map((r) => (
                <div key={r.nodeId} className="flex items-center justify-between text-xs">
                  <code className="font-mono text-[10px] truncate">{r.nodeId}</code>
                  <span className="text-muted-foreground shrink-0 ml-2">{r.entries}×</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
