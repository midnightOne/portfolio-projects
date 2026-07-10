"use client";

/**
 * Custom React Flow node (design §6): name, role badge, context/tool/model
 * chips, validation badge.
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { GraphNode } from '@/lib/ai/engine/types';

export type CanvasNodeData = {
  node: GraphNode;
  errorCount: number;
  warningCount: number;
};
export type CanvasNode = Node<CanvasNodeData, 'graphNode'>;

const ROLE_STYLES: Record<GraphNode['role'], string> = {
  start: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  state: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  offgraph: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
};

function GraphCanvasNodeInner({ data, selected }: NodeProps<CanvasNode>) {
  const { node, errorCount, warningCount } = data;
  return (
    <div
      className={`rounded-lg border-2 bg-card text-card-foreground shadow-sm px-3 py-2 min-w-40 max-w-56 ${
        selected ? 'border-primary' : 'border-border'
      }`}
      data-testid={`canvas-node-${node.id}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium truncate flex-1">{node.name}</span>
        {errorCount > 0 && (
          <span className="text-[10px] rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5 font-semibold" title={`${errorCount} validation error(s)`}>
            {errorCount}
          </span>
        )}
        {errorCount === 0 && warningCount > 0 && (
          <span className="text-[10px] rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 font-semibold" title={`${warningCount} warning(s)`}>
            {warningCount}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`text-[10px] rounded border px-1 py-px ${ROLE_STYLES[node.role]}`}>{node.role}</span>
        {node.contextSet.length > 0 && (
          <span className="text-[10px] rounded border border-border px-1 py-px text-muted-foreground" title="context items">
            ctx {node.contextSet.length}
          </span>
        )}
        {node.toolAllowlist && (
          <span className="text-[10px] rounded border border-border px-1 py-px text-muted-foreground" title="tool allowlist">
            tools {node.toolAllowlist.length}
          </span>
        )}
        {node.modelAlias && (
          <span className="text-[10px] rounded border border-purple-500/30 bg-purple-500/10 px-1 py-px text-purple-600 dark:text-purple-400" title="model alias (cascade/text per turn; native at mint only)">
            {node.modelAlias}
          </span>
        )}
        {node.ux?.chips?.length ? (
          <span className="text-[10px] rounded border border-border px-1 py-px text-muted-foreground" title="visitor chips">
            chips {node.ux.chips.length}
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

export const GraphCanvasNode = memo(GraphCanvasNodeInner);
