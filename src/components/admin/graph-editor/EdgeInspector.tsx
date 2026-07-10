"use client";

/**
 * Edge inspector (Req 8.3): condition type + parameters, priority, purge
 * policy, target node. Chip conditions pick from the SOURCE node's declared
 * chips (P22 — deterministic by id, never label text); slot conditions pick
 * from slots declared anywhere in the graph (Req 14.4).
 */

import React from 'react';
import type { EdgeCondition, GraphDocument, GraphEdge } from '@/lib/ai/engine/types';
import type { ValidationIssue } from '@/lib/ai/engine/validation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2 } from 'lucide-react';
import { arrayToLines, linesToArray, CONDITION_TYPES, conditionDefaults, declaredSlotNames, type EditorMeta } from './graph-editor-utils';

const selectClass =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground';

interface EdgeInspectorProps {
  edge: GraphEdge;
  document: GraphDocument;
  meta: EditorMeta | null;
  issues: ValidationIssue[];
  onChange: (edge: GraphEdge) => void;
  onDelete: () => void;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>;
}

const CONDITION_HINTS: Record<EdgeCondition['type'], string> = {
  intent: 'Exemplar-embedding similarity (embedded at publish, model id pinned — P11); default-cheap classifier as the tiebreaker band (P10).',
  pattern: 'Keyword/regex on the user turn — free, evaluated first.',
  tool_result: 'Predicate over a tool result this turn — free.',
  ui_state: 'Navigation/F-I-D event evidence; never fires on UI-less runtimes (Req 6.2).',
  chip: 'Chip tap by id — deterministic, no classifier, the 100%-reliable rail (P22).',
  slot: 'Slot state as evidence ("job_description captured → offer analysis", Req 14.4).',
  turn_quality: 'Consecutive low-effort counter — vague-browser escalation (Req 18.2).',
  probe: 'Injection/off-topic probing (pattern + classifier v1).',
  pivot: 'Explicit topic change — classifier-only.',
  always: 'Unconditional. Followed ONLY during session start (start chain, max 3 hops) — never fires at runtime.',
};

export function EdgeInspector({ edge, document, meta, issues, onChange, onDelete }: EdgeInspectorProps) {
  const edgeIssues = issues.filter((i) => i.edgeId === edge.id);
  const cond = edge.condition;
  const patch = (p: Partial<GraphEdge>) => onChange({ ...edge, ...p });
  const patchCond = (c: EdgeCondition) => onChange({ ...edge, condition: c });

  const sourceNode = document.nodes.find((n) => n.id === edge.from);
  const sourceChips = sourceNode?.ux?.chips ?? [];
  const slotNames = declaredSlotNames(document);
  const targetNode = document.nodes.find((n) => n.id === edge.to);
  const modelChanging = !!targetNode?.modelAlias && targetNode.modelAlias !== sourceNode?.modelAlias;

  return (
    <div className="space-y-4" data-testid="edge-inspector">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Edge</h3>
        <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={onDelete} data-testid="delete-edge">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
      </div>

      {edgeIssues.map((iss, i) => (
        <p key={i} className={`text-[11px] leading-snug ${iss.severity === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
          {iss.severity === 'error' ? '✕' : '⚠'} {iss.message}
        </p>
      ))}
      {modelChanging && (
        <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">
          ⚠ Model-changing edge (→ {targetNode?.modelAlias}): applies on cascade/text; ignored mid-session on native voice (Req 5.4).
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <select className={selectClass} value={edge.from} onChange={(e) => patch({ from: e.target.value })}>
            {document.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <select className={selectClass} value={edge.to} onChange={(e) => patch({ to: e.target.value })} data-testid="edge-target">
            {document.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Input
            className="text-xs"
            type="number"
            value={edge.priority}
            onChange={(e) => patch({ priority: Number(e.target.value) || 0 })}
            data-testid="edge-priority"
          />
          <Hint>Ascending — lowest wins; at most one edge fires per turn.</Hint>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Purge policy</Label>
          <select className={selectClass} value={edge.purge} onChange={(e) => patch({ purge: e.target.value as GraphEdge['purge'] })}>
            <option value="replace">replace (drop previous node&apos;s context)</option>
            <option value="keep">keep (merge with previous)</option>
          </select>
          <Hint>Only engine-injected context is ever purged — F-I-D and history never (Req 3.6).</Hint>
        </div>
      </div>

      <Separator />
      <div className="space-y-1">
        <Label className="text-xs">Condition</Label>
        <select
          className={selectClass}
          value={cond.type}
          onChange={(e) => patchCond(conditionDefaults(e.target.value as EdgeCondition['type']))}
          data-testid="edge-condition-type"
        >
          {CONDITION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Hint>{CONDITION_HINTS[cond.type]}</Hint>
      </div>

      {cond.type === 'intent' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Exemplars (one per line)</Label>
            <Textarea
              rows={4}
              className="text-xs"
              value={arrayToLines(cond.exemplars)}
              onChange={(e) => patchCond({ ...cond, exemplars: linesToArray(e.target.value) })}
              data-testid="intent-exemplars"
            />
            <Hint>Embedded at publish through default-embedding; re-publish refreshes vectors.</Hint>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Similarity threshold</Label>
            <Input
              className="text-xs w-24"
              type="number"
              step="0.01"
              min={0}
              max={1}
              placeholder="0.82"
              value={cond.threshold ?? ''}
              onChange={(e) => patchCond({ ...cond, threshold: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>
      )}

      {cond.type === 'pattern' && (
        <div className="space-y-1">
          <Label className="text-xs">Patterns (one per line, regex allowed)</Label>
          <Textarea
            rows={3}
            className="text-xs font-mono"
            value={arrayToLines(cond.anyOf)}
            onChange={(e) => patchCond({ ...cond, anyOf: linesToArray(e.target.value) })}
            data-testid="pattern-lines"
          />
        </div>
      )}

      {cond.type === 'tool_result' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Tool</Label>
            <select className={selectClass} value={cond.tool} onChange={(e) => patchCond({ ...cond, tool: e.target.value })}>
              <option value="">— pick —</option>
              {(meta?.tools ?? []).map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Input
              className="text-xs col-span-1"
              placeholder="result path"
              value={cond.predicate.path}
              onChange={(e) => patchCond({ ...cond, predicate: { ...cond.predicate, path: e.target.value } })}
            />
            <select
              className={selectClass}
              value={cond.predicate.op}
              onChange={(e) => patchCond({ ...cond, predicate: { ...cond.predicate, op: e.target.value as typeof cond.predicate.op } })}
            >
              <option value="exists">exists</option>
              <option value="contains">contains</option>
              <option value="eq">eq</option>
            </select>
            <Input
              className="text-xs"
              placeholder="value"
              disabled={cond.predicate.op === 'exists'}
              value={cond.predicate.value === undefined ? '' : String(cond.predicate.value)}
              onChange={(e) => patchCond({ ...cond, predicate: { ...cond.predicate, value: e.target.value || undefined } })}
            />
          </div>
        </div>
      )}

      {cond.type === 'ui_state' && (
        <div className="grid grid-cols-2 gap-1.5">
          <select
            className={selectClass}
            value={cond.event}
            onChange={(e) => patchCond({ ...cond, event: e.target.value as typeof cond.event })}
          >
            <option value="project_opened">project_opened</option>
            <option value="section_viewed">section_viewed</option>
            <option value="route_changed">route_changed</option>
          </select>
          <Input
            className="text-xs"
            placeholder="match (optional)"
            value={cond.match ?? ''}
            onChange={(e) => patchCond({ ...cond, match: e.target.value || undefined })}
          />
        </div>
      )}

      {cond.type === 'chip' && (
        <div className="space-y-1">
          <Label className="text-xs">Chip (from source node)</Label>
          {sourceChips.length > 0 ? (
            <select className={selectClass} value={cond.chipId} onChange={(e) => patchCond({ ...cond, chipId: e.target.value })} data-testid="chip-picker">
              <option value="">— pick —</option>
              {sourceChips.map((c) => (
                <option key={c.id} value={c.id}>{c.label || c.id}</option>
              ))}
            </select>
          ) : (
            <Hint>The source node declares no chips yet — add them in its inspector first.</Hint>
          )}
          <Hint>Matches on the stable chip id, never the label — relabeling never breaks the edge (P22).</Hint>
        </div>
      )}

      {cond.type === 'slot' && (
        <div className="grid grid-cols-3 gap-1.5">
          <select className={selectClass} value={cond.name} onChange={(e) => patchCond({ ...cond, name: e.target.value })}>
            <option value="">— slot —</option>
            {slotNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className={selectClass} value={cond.op} onChange={(e) => patchCond({ ...cond, op: e.target.value as typeof cond.op })}>
            <option value="filled">filled</option>
            <option value="missing">missing</option>
            <option value="eq">eq</option>
          </select>
          <Input
            className="text-xs"
            placeholder="value"
            disabled={cond.op !== 'eq'}
            value={cond.value ?? ''}
            onChange={(e) => patchCond({ ...cond, value: e.target.value || undefined })}
          />
        </div>
      )}

      {cond.type === 'turn_quality' && (
        <div className="space-y-1">
          <Label className="text-xs">Consecutive low-effort turns</Label>
          <Input
            className="text-xs w-24"
            type="number"
            min={1}
            value={cond.consecutiveLowEffort}
            onChange={(e) => patchCond({ ...cond, consecutiveLowEffort: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      )}
    </div>
  );
}
