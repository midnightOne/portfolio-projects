'use client';

/**
 * Conversation admin tools bar (owner, 2026-07-08) — sits at the top of
 * /admin/ai/conversations above the three-column browser.
 *
 * - Analytics is COLLAPSIBLE: the collapsed header still shows the at-a-glance
 *   totals (conversations / messages / tokens / cost) inline, so a glance needs
 *   no expand; expanding reveals the full breakdown + cleanup.
 * - Export is a PERSISTENT button that opens a modal to choose format, date
 *   range, and whether to include debug data.
 * - Cleanup (destructive, age-based) lives inside the expanded section.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  ChevronDown,
  DollarSign,
  Download,
  Loader2,
  MessageSquare,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';

interface ConversationAnalytics {
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalCost: number;
  averageMessagesPerConversation: number;
  averageResponseTime: number;
  errorRate: number;
  modeBreakdown: { text: number; voice: number; hybrid: number };
  timeRangeStats: { last24Hours: number; last7Days: number; last30Days: number };
}

export function ConversationAdminTools({ onDataChanged }: { onDataChanged?: () => void }) {
  const [analytics, setAnalytics] = useState<ConversationAnalytics | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exFormat, setExFormat] = useState<'json' | 'csv'>('json');
  const [exStart, setExStart] = useState('');
  const [exEnd, setExEnd] = useState('');
  const [exDebug, setExDebug] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start && end) {
        params.set('startDate', start);
        params.set('endDate', end);
      }
      const res = await fetch(`/api/ai/conversation/analytics?${params.toString()}`);
      const json = await res.json();
      if (json.success) setAnalytics(json.data);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const runExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', exFormat);
      if (exStart && exEnd) {
        params.set('startDate', exStart);
        params.set('endDate', exEnd);
      }
      if (exDebug) params.set('includeDebugData', 'true');
      const res = await fetch(`/api/ai/conversation/export?${params.toString()}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversations-${new Date().toISOString().split('T')[0]}.${exFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportOpen(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const cleanup = async (days: number) => {
    if (!confirm(`Delete all conversations older than ${days} days? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/ai/conversation/cleanup?action=cleanup&olderThanDays=${days}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert(`Deleted ${json.data.deletedCount} conversations.`);
        loadAnalytics();
        onDataChanged?.();
      } else {
        alert(json.error || 'Cleanup failed');
      }
    } catch (e) {
      console.error(e);
      alert('Cleanup failed');
    }
  };

  const glance = analytics
    ? `${analytics.totalConversations} conversations · ${analytics.totalMessages} msgs · ${analytics.totalTokensUsed.toLocaleString()} tok · $${analytics.totalCost.toFixed(2)}`
    : loading
      ? 'loading…'
      : '';

  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="flex items-center justify-between gap-3 p-3 flex-wrap">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-left group min-w-0" data-testid="conv-analytics-toggle">
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium shrink-0">Analytics</span>
              {glance && (
                <span className="text-xs text-muted-foreground truncate ml-1">{glance}</span>
              )}
            </button>
          </CollapsibleTrigger>
          <Button size="sm" onClick={() => setExportOpen(true)} data-testid="conv-export-open">
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Date range for the analytics figures */}
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">From</span>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="text-xs w-auto" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">To</span>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="text-xs w-auto" />
              </div>
              {(start || end) && (
                <Button size="sm" variant="outline" onClick={() => { setStart(''); setEnd(''); }}>Clear</Button>
              )}
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {analytics && (
              <>
                {/* At-a-glance tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatTile icon={<MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />} label="Conversations" value={analytics.totalConversations.toLocaleString()} />
                  <StatTile icon={<Users className="h-5 w-5 text-green-600 dark:text-green-400" />} label="Messages" value={analytics.totalMessages.toLocaleString()} />
                  <StatTile icon={<Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />} label="Tokens" value={analytics.totalTokensUsed.toLocaleString()} />
                  <StatTile icon={<DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />} label="Cost" value={`$${analytics.totalCost.toFixed(2)}`} />
                </div>

                {/* Breakdowns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded border p-3 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Mode</div>
                    <Row label="Text" value={analytics.modeBreakdown.text} />
                    <Row label="Voice" value={analytics.modeBreakdown.voice} />
                    <Row label="Hybrid" value={analytics.modeBreakdown.hybrid} />
                  </div>
                  <div className="rounded border p-3 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Performance</div>
                    <Row label="Avg msgs/convo" value={analytics.averageMessagesPerConversation.toFixed(1)} />
                    <Row label="Avg response" value={`${analytics.averageResponseTime.toFixed(0)}ms`} />
                    <Row label="Error rate" value={`${analytics.errorRate.toFixed(1)}%`} danger={analytics.errorRate > 5} />
                  </div>
                  <div className="rounded border p-3 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Recent activity</div>
                    <Row label="Last 24h" value={analytics.timeRangeStats.last24Hours} />
                    <Row label="Last 7d" value={analytics.timeRangeStats.last7Days} />
                    <Row label="Last 30d" value={analytics.timeRangeStats.last30Days} />
                  </div>
                </div>
              </>
            )}

            {/* Cleanup (destructive) */}
            <div className="rounded border border-red-200 dark:border-red-900/50 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Cleanup old conversations (permanent)
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400" onClick={() => cleanup(30)}>Delete 30+ days</Button>
                <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400" onClick={() => cleanup(90)}>Delete 90+ days</Button>
                <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400" onClick={() => cleanup(365)}>Delete 1+ year</Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Export options modal */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export conversations</DialogTitle>
            <DialogDescription>Download stored conversations for analysis or backup.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select value={exFormat} onValueChange={(v) => setExFormat(v as 'json' | 'csv')}>
                <SelectTrigger data-testid="conv-export-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">From (optional)</Label>
                <Input type="date" value={exStart} onChange={(e) => setExStart(e.target.value)} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To (optional)</Label>
                <Input type="date" value={exEnd} onChange={(e) => setExEnd(e.target.value)} className="text-xs" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={exDebug} onCheckedChange={(c) => setExDebug(c === true)} data-testid="conv-export-debug" />
              Include debug data (system prompts, tool traces)
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>Cancel</Button>
            <Button onClick={runExport} disabled={exporting} data-testid="conv-export-run">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border p-3 flex items-center gap-3">
      {icon}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={danger ? 'destructive' : 'outline'} className="text-xs">{value}</Badge>
    </div>
  );
}
