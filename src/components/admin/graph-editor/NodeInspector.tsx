"use client";

/**
 * Node inspector (Req 8.2): guidance blocks, typed context set with live
 * token meter (SAME estimator as runtime — notes §6), registry-enumerated
 * tool picker (Req 4.2), alias dropdown (Req 5.1/5.4 labeling), voice-clip
 * categories (D50), UX surfaces (chips/topic/staging — Req 13), slot capture
 * specs (Req 14), and the "What visitors actually asked" analytics panel
 * (Req 16.3 / task D4 — backed by the Block I1 batch).
 */

import React from 'react';
import type { ContextItemSpec, GraphEdge, GraphNode } from '@/lib/ai/engine/types';
import type { ValidationIssue } from '@/lib/ai/engine/validation';
import { estimateTokensFromChars } from '@/lib/ai/token-estimate';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus } from 'lucide-react';
import { arrayToLines, linesToArray, newChipId, type EditorMeta } from './graph-editor-utils';
import { QuestionsPanel } from './QuestionsPanel';

const DEFAULT_BUDGET = 1200; // notes §6 default

interface NodeInspectorProps {
  node: GraphNode;
  meta: EditorMeta | null;
  issues: ValidationIssue[];
  /** D4 questions panel inputs: the graph + draft edges for exemplar promotion.
   *  Optional so the inspector renders (panel hidden) if a host omits them. */
  graphId?: string;
  edges?: GraphEdge[];
  nodeNames?: Record<string, string>;
  onChange: (node: GraphNode) => void;
  onEdgeChange?: (edge: GraphEdge) => void;
  onDelete: () => void;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs font-medium">{children}</Label>
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** One-per-line string-list editor. */
function LinesEditor({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  rows?: number;
}) {
  // Local text state so typing mid-line (including blank lines) isn't eaten by the round-trip.
  const [text, setText] = React.useState(arrayToLines(value));
  const external = arrayToLines(value);
  React.useEffect(() => {
    setText((prev) => (arrayToLines(linesToArray(prev)) === external ? prev : external));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);
  return (
    <div className="space-y-1">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <Textarea
        rows={rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(linesToArray(e.target.value));
        }}
        className="text-xs font-mono"
        data-testid={`node-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
      />
    </div>
  );
}

const selectClass =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground';

function ContextSetEditor({
  node,
  meta,
  onChange,
}: {
  node: GraphNode;
  meta: EditorMeta | null;
  onChange: (items: ContextItemSpec[]) => void;
}) {
  const items = node.contextSet;
  const budget = node.contextBudgetTokens ?? DEFAULT_BUDGET;
  const staticTokens = items
    .filter((i): i is Extract<ContextItemSpec, { type: 'static' }> => i.type === 'static')
    .reduce((sum, i) => sum + estimateTokensFromChars(i.text.length), 0);
  const overBudget = staticTokens > budget;

  const update = (idx: number, item: ContextItemSpec) => onChange(items.map((it, i) => (i === idx ? item : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = (type: ContextItemSpec['type']) => {
    const fresh: ContextItemSpec =
      type === 'entity'
        ? { type, entityId: meta?.entities[0]?.id ?? '' }
        : type === 'chunk'
          ? { type, chunkId: '' }
          : type === 'search'
            ? { type, query: '', limit: 3 }
            : type === 'static'
              ? { type, text: '' }
              : { type: 'fid-scope', projectId: '' };
    onChange([...items, fresh]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FieldLabel hint="Resolved in authored order at node entry; whole items drop once over budget (never truncated).">
          Context set
        </FieldLabel>
        <span
          className={`text-[11px] tabular-nums ${overBudget ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
          data-testid="token-meter"
        >
          static ~{staticTokens} / {budget} tok
        </span>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="rounded-md border border-border p-2 space-y-1.5" data-testid={`context-item-${idx}`}>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
            <div className="flex items-center gap-1">
              {item.type === 'static' && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  ~{estimateTokensFromChars(item.text.length)} tok
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => remove(idx)} title="Remove item">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {item.type === 'entity' && (
            <select
              className={selectClass}
              value={item.entityId}
              onChange={(e) => update(idx, { ...item, entityId: e.target.value })}
            >
              <option value="">— pick an entity —</option>
              {meta?.entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.entityType.toLowerCase()}: {e.title ?? e.slug}
                </option>
              ))}
            </select>
          )}
          {item.type === 'chunk' && (
            <Input
              className="text-xs"
              placeholder="chunk id (DB id or semantic chunkId)"
              value={item.chunkId}
              onChange={(e) => update(idx, { ...item, chunkId: e.target.value })}
            />
          )}
          {item.type === 'search' && (
            <div className="flex gap-1.5">
              <Input
                className="text-xs flex-1"
                placeholder="stored query, runs on node entry"
                value={item.query}
                onChange={(e) => update(idx, { ...item, query: e.target.value })}
              />
              <Input
                className="text-xs w-14"
                type="number"
                min={1}
                max={10}
                value={item.limit ?? 3}
                onChange={(e) => update(idx, { ...item, limit: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })}
                title="result limit"
              />
            </div>
          )}
          {item.type === 'static' && (
            <Textarea
              rows={3}
              className="text-xs font-mono"
              placeholder="owner-authored snippet ({{slots.x}} templating allowed)"
              value={item.text}
              onChange={(e) => update(idx, { ...item, text: e.target.value })}
            />
          )}
          {item.type === 'fid-scope' && (
            <div className="flex gap-1.5">
              <Input
                className="text-xs flex-1"
                placeholder="project id/slug"
                value={item.projectId}
                onChange={(e) => update(idx, { ...item, projectId: e.target.value })}
              />
              <Input
                className="text-xs flex-1"
                placeholder="section anchor (optional)"
                value={item.sectionAnchor ?? ''}
                onChange={(e) => update(idx, { ...item, sectionAnchor: e.target.value || undefined })}
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-1">
        {(['entity', 'chunk', 'search', 'static', 'fid-scope'] as const).map((t) => (
          <Button key={t} variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => add(t)} data-testid={`add-context-${t}`}>
            <Plus className="h-3 w-3 mr-0.5" />
            {t}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function NodeInspector({ node, meta, issues, graphId, edges, nodeNames, onChange, onEdgeChange, onDelete }: NodeInspectorProps) {
  const nodeIssues = issues.filter((i) => i.nodeId === node.id);
  const patch = (p: Partial<GraphNode>) => onChange({ ...node, ...p });
  const patchGuidance = (p: Partial<GraphNode['guidance']>) => onChange({ ...node, guidance: { ...node.guidance, ...p } });
  const ux = node.ux ?? {};
  const patchUx = (p: Partial<NonNullable<GraphNode['ux']>>) => {
    const next = { ...ux, ...p };
    const empty = !next.chips?.length && !next.topicLabel && !next.onEnterStaging;
    patch({ ux: empty ? undefined : next });
  };

  return (
    <div className="space-y-4" data-testid="node-inspector">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Node</h3>
        <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={onDelete} data-testid="delete-node">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
      </div>

      {nodeIssues.length > 0 && (
        <div className="space-y-1">
          {nodeIssues.map((iss, i) => (
            <p key={i} className={`text-[11px] leading-snug ${iss.severity === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
              {iss.severity === 'error' ? '✕' : '⚠'} {iss.message}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <FieldLabel>Name</FieldLabel>
        <Input className="text-sm" value={node.name} onChange={(e) => patch({ name: e.target.value })} data-testid="node-name" />
      </div>

      <div className="space-y-1">
        <FieldLabel hint="Exactly one start and one offgraph node per graph. Off-graph is normal operation (the lattice, not a cage).">
          Role
        </FieldLabel>
        <select className={selectClass} value={node.role} onChange={(e) => patch({ role: e.target.value as GraphNode['role'] })} data-testid="node-role">
          <option value="start">start</option>
          <option value="state">state</option>
          <option value="offgraph">offgraph</option>
        </select>
      </div>

      <Separator />
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Guidance (framing, never canned replies)</h4>

      <LinesEditor
        label="Prompt fragments"
        hint="Appended AFTER base instructions. One per line. {{slots.x}} templating allowed."
        value={node.guidance.promptFragments}
        onChange={(v) => patchGuidance({ promptFragments: v })}
        rows={4}
      />
      <LinesEditor label="Talking points" value={node.guidance.talkingPoints} onChange={(v) => patchGuidance({ talkingPoints: v.length ? v : undefined })} />
      <LinesEditor
        label="Negative guidance"
        hint={'"Never claim X" lines.'}
        value={node.guidance.negative}
        onChange={(v) => patchGuidance({ negative: v.length ? v : undefined })}
      />
      <LinesEditor
        label="Agenda"
        hint="Node's working goals — rendered into the floating block on entry (Req 19.6)."
        value={node.guidance.agenda}
        onChange={(v) => patchGuidance({ agenda: v.length ? v : undefined })}
      />

      <div className="space-y-1">
        <FieldLabel hint="Model-mediated suggestion on entry — never a forced UI action (Req 6.4).">On-enter suggestion</FieldLabel>
        <Input
          className="text-xs"
          value={node.guidance.onEnterSuggestion ?? ''}
          onChange={(e) => patchGuidance({ onEnterSuggestion: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1">
        <FieldLabel hint="D59 anchors the model can navigate to — label + navTarget, one per line as label :: navTarget.">Nav refs</FieldLabel>
        <Textarea
          rows={2}
          className="text-xs font-mono"
          value={(node.guidance.navRefs ?? []).map((r) => `${r.label} :: ${r.navTarget}`).join('\n')}
          onChange={(e) => {
            const navRefs = linesToArray(e.target.value)
              .map((line) => {
                const [label, navTarget] = line.split('::').map((s) => s.trim());
                return label && navTarget ? { label, navTarget } : null;
              })
              .filter((r): r is { label: string; navTarget: string } => !!r);
            patchGuidance({ navRefs: navRefs.length ? navRefs : undefined });
          }}
        />
      </div>

      <Separator />
      <ContextSetEditor node={node} meta={meta} onChange={(contextSet) => patch({ contextSet })} />
      <div className="space-y-1">
        <FieldLabel>Context budget (tokens)</FieldLabel>
        <Input
          className="text-xs w-28"
          type="number"
          placeholder={String(DEFAULT_BUDGET)}
          value={node.contextBudgetTokens ?? ''}
          onChange={(e) => patch({ contextBudgetTokens: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
          data-testid="node-budget"
        />
      </div>

      <Separator />
      <div className="space-y-1.5">
        <FieldLabel hint="Empty = session default set. One more filter (tier ∩ session ∩ node) — a node can never grant beyond the tier (Req 4.1). Live registry enumeration (Req 4.2).">
          Tool allowlist
        </FieldLabel>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1" data-testid="tool-allowlist">
          {(meta?.tools ?? []).map((tool) => {
            const checked = node.toolAllowlist?.includes(tool.name) ?? false;
            return (
              <label key={tool.name} className="flex items-start gap-2 text-xs cursor-pointer" title={tool.description}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={(e) => {
                    const current = node.toolAllowlist ?? [];
                    const next = e.target.checked ? [...current, tool.name] : current.filter((t) => t !== tool.name);
                    patch({ toolAllowlist: next.length ? next : undefined });
                  }}
                />
                <span>
                  <span className="font-mono">{tool.name}</span>{' '}
                  <span className="text-muted-foreground">({tool.executionContext})</span>
                </span>
              </label>
            );
          })}
        </div>
        {node.toolAllowlist && (
          <p className="text-[11px] text-muted-foreground">{node.toolAllowlist.length} allowed; unlisted tools 403 at execution.</p>
        )}
      </div>

      <Separator />
      <div className="space-y-1">
        <FieldLabel hint="D4 registry alias — applies per turn on cascade/text; on native voice it participates at session MINT only and is ignored mid-session (Req 5.4).">
          Model alias
        </FieldLabel>
        <select
          className={selectClass}
          value={node.modelAlias ?? ''}
          onChange={(e) => patch({ modelAlias: e.target.value || undefined })}
          data-testid="node-model-alias"
        >
          <option value="">— keep session model —</option>
          {(meta?.aliases ?? []).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <FieldLabel hint="D50 voice-clip categories active in this node.">Voice-clip categories</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {(meta?.voiceClipCategories ?? []).map((cat) => {
            const checked = node.voiceClipCategories?.includes(cat) ?? false;
            return (
              <label key={cat} className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const current = node.voiceClipCategories ?? [];
                    const next = e.target.checked ? [...current, cat] : current.filter((c) => c !== cat);
                    patch({ voiceClipCategories: next.length ? next : undefined });
                  }}
                />
                {cat}
              </label>
            );
          })}
        </div>
      </div>

      <Separator />
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visitor UX (Req 13)</h4>

      <div className="space-y-1.5">
        <FieldLabel hint="Rendered on node entry, replaced on transition. A tap sends the text as a user turn AND fires chip edges deterministically — the 100%-reliable rail (P22). Ids are stable; edit labels freely.">
          Chips
        </FieldLabel>
        {(ux.chips ?? []).map((chip, idx) => (
          <div key={chip.id} className="flex gap-1.5 items-center">
            <span className="text-[10px] font-mono text-muted-foreground w-20 truncate" title={chip.id}>{chip.id}</span>
            <Input
              className="text-xs flex-1"
              placeholder="label"
              value={chip.label}
              onChange={(e) => patchUx({ chips: ux.chips!.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c)) })}
            />
            <Input
              className="text-xs flex-1"
              placeholder="send text (optional — defaults to label)"
              value={chip.sendText ?? ''}
              onChange={(e) => patchUx({ chips: ux.chips!.map((c, i) => (i === idx ? { ...c, sendText: e.target.value || undefined } : c)) })}
            />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => patchUx({ chips: ux.chips!.filter((_, i) => i !== idx) })}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => patchUx({ chips: [...(ux.chips ?? []), { id: newChipId(), label: '' }] })}
          data-testid="add-chip"
        >
          <Plus className="h-3 w-3 mr-0.5" /> chip
        </Button>
      </div>

      {graphId && onEdgeChange && (
        <>
          <Separator />
          <QuestionsPanel
            graphId={graphId}
            node={node}
            edges={edges ?? []}
            nodeNames={nodeNames ?? {}}
            onNodeChange={onChange}
            onEdgeChange={onEdgeChange}
          />
        </>
      )}

      <div className="space-y-1">
        <FieldLabel hint='Subtle pill indicator ("Topic: Kiln project"). Empty = hidden.'>Topic label</FieldLabel>
        <Input className="text-xs" value={ux.topicLabel ?? ''} onChange={(e) => patchUx({ topicLabel: e.target.value || undefined })} />
      </div>

      <div className="space-y-1">
        <FieldLabel hint="Executed ONCE per entry via ui_intent/D59 — preview-level (scroll/highlight), never a route load during voice (Req 13.2/13.6).">
          On-enter staging
        </FieldLabel>
        <div className="flex gap-1.5">
          <Input
            className="text-xs flex-1"
            placeholder="navTarget"
            value={ux.onEnterStaging?.navTarget ?? ''}
            onChange={(e) =>
              patchUx({
                onEnterStaging: e.target.value
                  ? { navTarget: e.target.value, highlightText: ux.onEnterStaging?.highlightText }
                  : undefined,
              })
            }
          />
          <Input
            className="text-xs flex-1"
            placeholder="highlight text (optional)"
            value={ux.onEnterStaging?.highlightText ?? ''}
            disabled={!ux.onEnterStaging?.navTarget}
            onChange={(e) =>
              patchUx({
                onEnterStaging: ux.onEnterStaging
                  ? { ...ux.onEnterStaging, highlightText: e.target.value || undefined }
                  : undefined,
              })
            }
          />
        </div>
      </div>

      <Separator />
      <div className="space-y-1.5">
        <FieldLabel hint="Extracted from user turns inside the shared per-turn cheap call (Req 14/P26). Values are conversation-scoped and templatable as {{slots.name}}.">
          Slot capture specs
        </FieldLabel>
        {(node.slots?.capture ?? []).map((spec, idx) => (
          <div key={idx} className="flex gap-1.5 items-center">
            <Input
              className="text-xs w-24"
              placeholder="name"
              value={spec.name}
              onChange={(e) => {
                const capture = node.slots!.capture.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c));
                patch({ slots: { capture } });
              }}
            />
            <select
              className={`${selectClass} w-24`}
              value={spec.type}
              onChange={(e) => {
                const capture = node.slots!.capture.map((c, i) => (i === idx ? { ...c, type: e.target.value as typeof spec.type } : c));
                patch({ slots: { capture } });
              }}
            >
              {(['string', 'enum', 'email', 'company', 'freeform'] as const).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <Input
              className="text-xs flex-1"
              placeholder="hint for the extractor"
              value={spec.hint}
              onChange={(e) => {
                const capture = node.slots!.capture.map((c, i) => (i === idx ? { ...c, hint: e.target.value } : c));
                patch({ slots: { capture } });
              }}
            />
            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={spec.required ?? false}
                onChange={(e) => {
                  const capture = node.slots!.capture.map((c, i) => (i === idx ? { ...c, required: e.target.checked || undefined } : c));
                  patch({ slots: { capture } });
                }}
              />
              req
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                const capture = node.slots!.capture.filter((_, i) => i !== idx);
                patch({ slots: capture.length ? { capture } : undefined });
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => patch({ slots: { capture: [...(node.slots?.capture ?? []), { name: '', type: 'string', hint: '' }] } })}
          data-testid="add-slot"
        >
          <Plus className="h-3 w-3 mr-0.5" /> slot
        </Button>
      </div>
    </div>
  );
}
