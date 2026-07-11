'use client';

/**
 * Conversation-memory layer panel (conversation-engine Block M2 — Req 19.7).
 * The memory layer (visitor profile flags, behavior summarizer, rolling
 * window) has its OWN switch, independent of graph presence: "no active
 * graph" stops the steering layer; this switch stops the memory layer; both
 * off = the app behaves exactly as pre-engine (the re-scoped Req 2.7 removal-
 * safety state). Also owns the graph-less default tool set — a narrow-only
 * allowlist applied when no graph node governs a conversation.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface MemoryConfig {
  memoryEnabled: boolean;
  graphlessToolAllowlist: string[] | null;
}

interface RegistryTool {
  name: string;
  description: string;
  executionContext: string;
}

export function MemoryLayerPanel() {
  const toast = useToast();
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [saved, setSaved] = useState<MemoryConfig | null>(null);
  const [tools, setTools] = useState<RegistryTool[]>([]);
  const [narrowing, setNarrowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [configRes, metaRes] = await Promise.all([
        fetch('/api/admin/ai/memory-config'),
        fetch('/api/admin/ai/graphs/meta'),
      ]);
      if (configRes.ok) {
        const row = (await configRes.json()) as MemoryConfig;
        setConfig(row);
        setSaved(row);
        setNarrowing(row.graphlessToolAllowlist !== null);
      }
      if (metaRes.ok) {
        const meta = await metaRes.json();
        // Registry enumeration (Req 4.2) — never a hardcoded tool list.
        setTools(meta.data?.tools ?? []);
      }
    } catch (error) {
      console.error('Failed to load memory-layer config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/memory-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoryEnabled: config.memoryEnabled,
          graphlessToolAllowlist: narrowing ? config.graphlessToolAllowlist ?? [] : null,
        }),
      });
      const row = await res.json();
      if (!res.ok) throw new Error(row.error || 'Save failed');
      setConfig(row);
      setSaved(row);
      setNarrowing(row.graphlessToolAllowlist !== null);
      toast.success(
        'Memory layer saved',
        row.memoryEnabled ? 'Profile, summarizer, and rolling window are ON for all conversations' : 'Memory layer is OFF'
      );
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!config &&
    !!saved &&
    (config.memoryEnabled !== saved.memoryEnabled ||
      JSON.stringify(narrowing ? config.graphlessToolAllowlist ?? [] : null) !==
        JSON.stringify(saved.graphlessToolAllowlist));

  const toggleTool = (name: string) => {
    if (!config) return;
    const current = config.graphlessToolAllowlist ?? [];
    const next = current.includes(name) ? current.filter((t) => t !== name) : [...current, name];
    setConfig({ ...config, graphlessToolAllowlist: next });
  };

  return (
    <Card data-testid="memory-layer-panel">
      <CardHeader>
        <CardTitle>Conversation memory layer</CardTitle>
        <CardDescription>
          Visitor profile, running summary, and rolling-window pruning — independent of any conversation
          graph. Off together with &quot;no active graph&quot; = pre-engine behavior exactly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !config ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={config.memoryEnabled}
                onCheckedChange={(v) => setConfig({ ...config, memoryEnabled: v })}
                data-testid="memory-enabled-switch"
              />
              <span className="text-sm">
                Memory layer {config.memoryEnabled ? 'on' : 'off'}
                <span className="text-muted-foreground"> — profile flags, behavior summarizer, rolling window</span>
              </span>
              {saved?.memoryEnabled === config.memoryEnabled && !dirty && (
                <Badge variant="outline" className="text-xs">{saved.memoryEnabled ? 'active' : 'disabled'}</Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch checked={narrowing} onCheckedChange={setNarrowing} data-testid="graphless-narrowing-switch" />
                <span className="text-sm">
                  Narrow tools for graph-less sessions
                  <span className="text-muted-foreground">
                    {' '}— when no graph steers, only the picked tools run (never grants beyond tier; retrieval
                    baseline always survives)
                  </span>
                </span>
              </div>
              {narrowing && (
                <div className="flex flex-wrap gap-1.5 pl-11" data-testid="graphless-tool-picker">
                  {tools.map((tool) => {
                    const selected = (config.graphlessToolAllowlist ?? []).includes(tool.name);
                    return (
                      <button
                        key={tool.name}
                        type="button"
                        title={tool.description}
                        onClick={() => toggleTool(tool.name)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {tool.name}
                      </button>
                    );
                  })}
                  {tools.length === 0 && (
                    <span className="text-xs text-muted-foreground">registry enumeration unavailable</span>
                  )}
                </div>
              )}
            </div>

            <Button size="sm" variant="outline" className="h-8" disabled={saving || !dirty} onClick={save} data-testid="memory-config-save">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              <span className="ml-1.5">Save</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
