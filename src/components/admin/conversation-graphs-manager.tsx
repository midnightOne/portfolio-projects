"use client";

/**
 * Conversation-graph list (Req 8.1): list + create/duplicate/archive; opening
 * a graph goes to the canvas editor. Also hosts the admin triggers for the
 * Block I engine batches (P23: batches run from admin or cron, never inside
 * conversations) — question analytics (Req 16.2, also triggerable per-node in
 * the editor) and summary backfill (Req 17.2).
 */

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Copy, Archive, Workflow, MessagesSquare, FileClock, Compass } from "lucide-react";

interface GraphListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  activeVersion: number | null;
  versionCount: number;
  nodeCount: number;
  updatedAt: string;
}

export function ConversationGraphsManager() {
  const router = useRouter();
  const [graphs, setGraphs] = React.useState<GraphListItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/graphs");
      const json = await res.json();
      if (json.success) setGraphs(json.data);
      else setError(json.error?.message ?? "Failed to load graphs");
    } catch {
      setError("Failed to load graphs");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (json.success) router.push(`/admin/ai/conversation-graphs/${json.data.id}`);
      else setError(json.error?.message ?? "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateFrom: id }),
      });
      const json = await res.json();
      if (json.success) await load();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this graph? It stops serving traffic; versions and telemetry are kept.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/ai/graphs/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  // Block I batch triggers (admin path of "admin AND/OR cron" — P23).
  const [batchBusy, setBatchBusy] = React.useState<null | "questions" | "summaries">(null);
  const [batchStatus, setBatchStatus] = React.useState<string | null>(null);

  const runBatch = async (kind: "questions" | "summaries") => {
    setBatchBusy(kind);
    setBatchStatus(null);
    try {
      const res = await fetch(`/api/admin/ai/engine/batch/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        const r = json.data;
        setBatchStatus(
          kind === "questions"
            ? `Question analytics: ${r.transitionsScanned} transitions scanned → +${r.rowsInserted} rows (+${r.organicRowsInserted ?? 0} organic), ${r.rowsEmbedded} embedded, ${r.rowsClustered} clustered${r.notes?.length ? ` — ${r.notes.join("; ")}` : ""}`
            : `Summaries: ${r.candidates} candidate conversation(s), ${r.claimed} summarized${r.failed ? `, ${r.failed} failed` : ""}${r.notes?.length ? ` — ${r.notes.join("; ")}` : ""}`
        );
      } else {
        setBatchStatus(json.error?.message ?? "Batch failed");
      }
    } catch {
      setBatchStatus("Batch failed");
    } finally {
      setBatchBusy(null);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!graphs) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4" data-testid="graphs-manager">
      <div className="flex gap-2">
        <Input
          className="w-72"
          placeholder="New graph name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
          data-testid="new-graph-name"
        />
        <Button onClick={() => void create()} disabled={busy || !newName.trim()} data-testid="create-graph">
          <Plus className="h-4 w-4 mr-1" /> Create
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            disabled={batchBusy !== null}
            onClick={() => void runBatch("questions")}
            title="Scan node entries → embed → cluster visitor questions (Req 16.2; budget-gated)"
            data-testid="run-batch-questions"
          >
            <MessagesSquare className="h-3.5 w-3.5 mr-1" />
            {batchBusy === "questions" ? "Running…" : "Question analytics"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            disabled={batchBusy !== null}
            onClick={() => void runBatch("summaries")}
            title="Backfill running summaries for engine conversations with new activity (Req 17.2)"
            data-testid="run-batch-summaries"
          >
            <FileClock className="h-3.5 w-3.5 mr-1" />
            {batchBusy === "summaries" ? "Running…" : "Summary backfill"}
          </Button>
        </div>
      </div>

      {batchStatus && (
        <p className="text-xs text-muted-foreground" data-testid="batch-status">
          {batchStatus}
        </p>
      )}

      {graphs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No graphs yet. Create one — it seeds a start node (with the current start frame as context) and the required
          off-graph node.
        </p>
      )}

      <OrganicQuestionsPanel />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {graphs.map((g) => (
          <Card key={g.id} data-testid={`graph-card-${g.id}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-muted-foreground shrink-0" />
                <Link
                  href={`/admin/ai/conversation-graphs/${g.id}`}
                  className="font-medium text-sm truncate hover:underline flex-1"
                >
                  {g.name}
                </Link>
                <Badge variant={g.status === "active" ? "default" : "outline"} className="text-[10px]">
                  {g.status}
                  {g.activeVersion ? ` · v${g.activeVersion}` : ""}
                </Badge>
              </div>
              {g.description && <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>}
              <p className="text-[11px] text-muted-foreground">
                {g.nodeCount} nodes · {g.versionCount} version{g.versionCount === 1 ? "" : "s"} · updated{" "}
                {new Date(g.updatedAt).toLocaleString()}
              </p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => router.push(`/admin/ai/conversation-graphs/${g.id}`)}>
                  Open
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void duplicate(g.id)} title="Duplicate (new ids — a fresh lineage)">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                {g.status !== "archived" && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" disabled={busy} onClick={() => void archive(g.id)} title="Archive">
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// M3 (Req 16 extension, §9.7): organic entry questions, queryable by condition
// — what visitors asked around UI events in GRAPH-LESS conversations. The
// first real graph's shape is derived from this instead of intuition.
// ---------------------------------------------------------------------------

interface OrganicProtoNode {
  key: string;
  event: string;
  match: string;
  clusters: Array<{ clusterId: string; count: number; representative: string; samples: string[]; lastAskedAt: string }>;
  pending: number;
  total: number;
}

const ORGANIC_EVENTS = [
  { id: "", label: "All events" },
  { id: "project_opened", label: "Project opened" },
  { id: "section_viewed", label: "Section viewed" },
  { id: "route_changed", label: "Route changed" },
];

function OrganicQuestionsPanel() {
  const [nodes, setNodes] = React.useState<OrganicProtoNode[] | null>(null);
  const [event, setEvent] = React.useState("");
  const [match, setMatch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (event) params.set("event", event);
      if (match.trim()) params.set("match", match.trim());
      const res = await fetch(`/api/admin/ai/engine/organic-questions?${params}`);
      const json = await res.json();
      if (json.success) setNodes(json.data.protoNodes);
    } catch {
      setNodes([]);
    }
  }, [event, match]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Card data-testid="organic-questions-panel">
      <CardContent className="p-4 space-y-3">
        <button type="button" className="flex items-center gap-2 text-sm font-medium w-full text-left" onClick={() => setOpen((v) => !v)} data-testid="organic-questions-toggle">
          <Compass className="h-4 w-4 text-muted-foreground" />
          Organic questions (graph-less conversations)
          <span className="text-xs text-muted-foreground font-normal">
            — what visitors asked around UI events; design the first graph from this
          </span>
        </button>
        {open && (
          <>
            <div className="flex gap-2 items-center">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                data-testid="organic-event-filter"
              >
                {ORGANIC_EVENTS.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
              <Input
                className="w-56 h-8 text-xs"
                placeholder="Filter by value (e.g. project slug)"
                value={match}
                onChange={(e) => setMatch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
                data-testid="organic-match-filter"
              />
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void load()}>
                Query
              </Button>
            </div>
            {nodes === null && <p className="text-xs text-muted-foreground">Loading…</p>}
            {nodes !== null && nodes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No organic samples yet — they appear after voice conversations with UI activity, once the
                question-analytics batch has run.
              </p>
            )}
            {nodes !== null && nodes.length > 0 && (
              <div className="space-y-2" data-testid="organic-proto-nodes">
                {nodes.map((n) => (
                  <div key={n.key} className="rounded-md border border-border p-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{n.event.replace("_", " ")}</Badge>
                      <span className="font-medium truncate">{n.match}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">
                        {n.total} sample{n.total === 1 ? "" : "s"}
                        {n.pending > 0 ? ` (${n.pending} unclustered)` : ""}
                      </span>
                    </div>
                    {n.clusters.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {n.clusters.map((c) => (
                          <li key={c.clusterId} className="text-xs text-muted-foreground">
                            <span className="text-foreground">×{c.count}</span> “{c.representative}”
                            {c.samples.length > 0 && (
                              <span className="italic"> — also: {c.samples.join(" · ")}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
