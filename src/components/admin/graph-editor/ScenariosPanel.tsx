"use client";

/**
 * Golden-scenarios panel (Block F2 — Req 10.2–10.4): list, run against the
 * CURRENT DRAFT (the pre-publish gate — "run scenarios before publish"),
 * per-scenario readable path diffs, one-action re-baseline for deliberate
 * graph changes, record-from-test-session, delete. All runs execute against
 * fakes server-side (P16) — zero spend, deterministic.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ScenarioBatchResult, ScenarioListItem } from '@/lib/services/ai/scenario-store';

export function ScenariosPanel({
  graphId,
  onDraftDirty,
}: {
  graphId: string;
  /** Flush the pending draft autosave before a run — the run targets the SAVED draft. */
  onDraftDirty?: () => Promise<void>;
}) {
  const [scenarios, setScenarios] = React.useState<ScenarioListItem[]>([]);
  const [batch, setBatch] = React.useState<ScenarioBatchResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [recordConversationId, setRecordConversationId] = React.useState('');
  const [recordName, setRecordName] = React.useState('');
  const [recording, setRecording] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ai/graphs/${graphId}/scenarios`);
      const json = await res.json();
      if (json.success) setScenarios(json.data.scenarios);
    } catch {
      /* panel stays empty; editing is unaffected */
    }
  }, [graphId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (opts: { scenarioIds?: string[]; rebaseline?: boolean } = {}) => {
    setRunning(true);
    setNote(null);
    try {
      await onDraftDirty?.();
      const res = await fetch(`/api/admin/ai/graphs/${graphId}/scenarios/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'draft', ...opts }),
      });
      const json = await res.json();
      if (!json.success) {
        setNote(json.error?.message ?? 'Run failed');
        return;
      }
      const result: ScenarioBatchResult = json.data;
      setBatch((prev) => {
        // A scoped run (single-scenario re-baseline) merges into the last full result.
        if (!opts.scenarioIds || !prev) return result;
        const byId = new Map(result.entries.map((e) => [e.scenarioId, e]));
        return { ...prev, entries: prev.entries.map((e) => byId.get(e.scenarioId) ?? e) };
      });
      if (opts.rebaseline) {
        setNote('Re-baselined to the new actual path — the run above shows the repinned expectation.');
        void load();
      }
    } catch {
      setNote('Run failed');
    } finally {
      setRunning(false);
    }
  };

  const rebaseline = async (scenarioId: string) => {
    setBusyId(scenarioId);
    try {
      // One action (Req 10.4): re-run this scenario with rebaseline, then re-run
      // it plain so the panel shows the now-green result against the new pin.
      await run({ scenarioIds: [scenarioId], rebaseline: true });
      await run({ scenarioIds: [scenarioId] });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (scenarioId: string) => {
    setBusyId(scenarioId);
    try {
      await fetch(`/api/admin/ai/graphs/${graphId}/scenarios/${scenarioId}`, { method: 'DELETE' });
      setBatch((prev) => (prev ? { ...prev, entries: prev.entries.filter((e) => e.scenarioId !== scenarioId) } : prev));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const record = async () => {
    if (!recordConversationId.trim() || !recordName.trim()) return;
    setRecording(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/ai/graphs/${graphId}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recordName.trim(), recordFromConversationId: recordConversationId.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setNote(`Recorded "${json.data.scenario.name}" from the conversation's actual traversal — edit expectations as needed.`);
        setRecordConversationId('');
        setRecordName('');
        await load();
      } else {
        setNote(json.error?.message ?? 'Record failed');
      }
    } catch {
      setNote('Record failed');
    } finally {
      setRecording(false);
    }
  };

  const entryById = new Map((batch?.entries ?? []).map((e) => [e.scenarioId, e]));

  return (
    <div className="space-y-3" data-testid="scenarios-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Golden scenarios</h3>
        <Button
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => void run()}
          disabled={running || scenarios.length === 0}
          data-testid="run-scenarios"
        >
          {running ? 'Running…' : 'Run all (draft)'}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Scripted turns replay through the real engine against fakes — deterministic, no spend. Run before publishing;
        re-baseline when a divergence is a deliberate graph change.
      </p>

      {note && <p className="text-[11px] text-foreground bg-muted/60 rounded px-2 py-1" data-testid="scenario-note">{note}</p>}

      {batch && (
        <p className="text-xs" data-testid="scenario-totals">
          <span className="font-medium">{batch.passed}/{batch.total} passing</span>
          {batch.failed > 0 && <span className="text-destructive"> · {batch.failed} failing</span>}
          {batch.errored > 0 && <span className="text-amber-600 dark:text-amber-400"> · {batch.errored} errored</span>}
          <span className="text-muted-foreground"> — against the {batch.target.source === 'draft' ? 'draft' : `v${batch.target.version}`}</span>
        </p>
      )}

      {scenarios.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No scenarios yet. Walk the flow in a test session (fake-mic toggle or test chat), then record it below.
        </p>
      )}

      <div className="space-y-2">
        {scenarios.map((s) => {
          const entry = entryById.get(s.id);
          const result = entry?.result;
          return (
            <div key={s.id} className="rounded border border-border p-2 space-y-1" data-testid={`scenario-${s.id}`}>
              <div className="flex items-center gap-2">
                {result && (
                  <Badge
                    variant={result.pass ? 'default' : 'destructive'}
                    className="text-[10px] shrink-0"
                    data-testid="scenario-verdict"
                  >
                    {result.error ? 'error' : result.pass ? 'pass' : 'fail'}
                  </Badge>
                )}
                <span className="text-xs font-medium truncate">{s.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                  {s.turnCount} turn{s.turnCount === 1 ? '' : 's'} · path {s.pathLength}
                </span>
              </div>
              {result?.error && <p className="text-[11px] text-amber-600 dark:text-amber-400">{result.error}</p>}
              {result && !result.pass && !result.error && (
                <pre className="text-[10px] leading-relaxed bg-muted/60 rounded p-1.5 overflow-x-auto whitespace-pre-wrap" data-testid="scenario-diff">
                  {result.diff}
                </pre>
              )}
              <div className="flex gap-2">
                {result && !result.pass && !result.error && result.actualPath.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => void rebaseline(s.id)}
                    disabled={busyId === s.id || running}
                    data-testid="rebaseline-scenario"
                  >
                    Re-baseline to actual
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground ml-auto"
                  onClick={() => void remove(s.id)}
                  disabled={busyId === s.id}
                  data-testid="delete-scenario"
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 border-t border-border pt-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Record from a session</p>
        <Input
          className="h-7 text-xs"
          placeholder="Conversation id (from the replay browser)"
          value={recordConversationId}
          onChange={(e) => setRecordConversationId(e.target.value)}
          data-testid="record-conversation-id"
        />
        <Input
          className="h-7 text-xs"
          placeholder="Scenario name"
          value={recordName}
          onChange={(e) => setRecordName(e.target.value)}
          data-testid="record-name"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => void record()}
          disabled={recording || !recordConversationId.trim() || !recordName.trim()}
          data-testid="record-scenario"
        >
          {recording ? 'Recording…' : 'Record scenario'}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Pins the conversation&apos;s actual traversal as the expected path; intent hops replay via scripted
          classifier scores (deterministic), then edit as needed.
        </p>
      </div>
    </div>
  );
}
