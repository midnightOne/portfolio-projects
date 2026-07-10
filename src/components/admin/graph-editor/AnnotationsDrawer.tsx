"use client";

/**
 * Graph-edit TODO drawer (Block E2 — Req 9.2): open annotations queued from
 * conversation review, each linking back into the conversation it came from.
 * Resolving links the annotation to the graph version that addressed it —
 * the server defaults to the graph's CURRENT version (publish your fix first,
 * then resolve; the drawer copy says so).
 */

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink } from 'lucide-react';
import { ANNOTATION_KIND_LABELS } from '../ConversationReplayViewer';
import type { AnnotationRow } from '@/lib/services/ai/graph-store';

export function AnnotationsDrawer({
  annotations,
  showResolved,
  onToggleResolved,
  onResolve,
  onReopen,
  busyId,
}: {
  annotations: AnnotationRow[];
  showResolved: boolean;
  onToggleResolved: (show: boolean) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  busyId: string | null;
}) {
  const visible = annotations.filter((a) => (showResolved ? true : a.status === 'open'));

  return (
    <div className="space-y-3" data-testid="annotations-drawer">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Review TODOs</h3>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => onToggleResolved(e.target.checked)}
            data-testid="show-resolved"
          />
          show resolved
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Marks from conversation review. Publish the fix first, then resolve — resolving links the annotation to the
        graph&apos;s current version.
      </p>

      {visible.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center" data-testid="annotations-empty">
          {showResolved ? 'No annotations yet.' : 'No open annotations — review conversations to add marks.'}
        </p>
      )}

      {visible.map((a) => (
        <div key={a.id} className="rounded border border-border p-2 space-y-1.5 text-xs" data-testid="annotation-item">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] ${a.status === 'open' ? 'border-amber-500/60 text-amber-700 dark:text-amber-400' : 'opacity-60'}`}
            >
              {ANNOTATION_KIND_LABELS[a.kind] ?? a.kind}
            </Badge>
            <span className="font-medium">{a.nodeName ?? a.nodeId}</span>
            {a.version !== null && <span className="text-muted-foreground">v{a.version}</span>}
            <span className="ml-auto text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
          </div>
          {a.note && <p className="text-muted-foreground whitespace-pre-wrap">{a.note}</p>}
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href={`/admin/ai/conversations?conversationId=${encodeURIComponent(a.conversationId)}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              title="Open the conversation this mark came from"
            >
              <ExternalLink className="h-3 w-3" /> conversation
            </Link>
            <span className="ml-auto" />
            {a.status === 'open' ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => onResolve(a.id)}
                disabled={busyId === a.id}
                data-testid="annotation-resolve"
              >
                {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resolve'}
              </Button>
            ) : (
              <span className="text-muted-foreground">
                resolved{a.resolvedByVersion !== null ? ` by v${a.resolvedByVersion}` : ''}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 ml-1 text-[11px]"
                  onClick={() => onReopen(a.id)}
                  disabled={busyId === a.id}
                >
                  reopen
                </Button>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
