'use client';

/**
 * Admin Conversation Browser (owner, 2026-07-07)
 *
 * Browse every stored conversation and open its full transcript — turns, tool
 * calls + results, navigation/error events, reasoning, and D49 resume markers —
 * via the interactive replay stepper. Look a conversation up by exact
 * conversationId (the id surfaced in the debug panels) or sessionId, or filter
 * by provider, reflink, time range, and message content. Reads the lightweight
 * /api/admin/ai/conversations/browse summary; the detail view fetches the full
 * timeline on demand.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';
import { ConversationTranscriptPanel } from './ConversationTranscriptPanel';

interface ConversationRow {
  id: string;
  sessionId: string;
  reflinkId: string | null;
  reflinkCode: string | null;
  recipientName: string | null;
  startedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  totalCost: number;
  provider: string;
  model: string | null;
  legCount: number;
  open: boolean;
}

const PROVIDER_STYLES: Record<string, string> = {
  openai: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  google: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  elevenlabs: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
};

const PAGE_SIZE = 25;

export function ConversationBrowser() {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [idQuery, setIdQuery] = useState('');
  const [provider, setProvider] = useState<string>('all');
  const [contentQuery, setContentQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(nextOffset));
      // An id query may be either a conversationId (cuid) or a sessionId — try
      // conversationId first; if that yields nothing, the caller can switch.
      const trimmed = idQuery.trim();
      if (trimmed) {
        if (trimmed.startsWith('session_')) params.set('sessionId', trimmed);
        else params.set('conversationId', trimmed);
      }
      if (provider !== 'all') params.set('provider', provider);
      if (contentQuery.trim()) params.set('q', contentQuery.trim());
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());

      const res = await fetch(`/api/admin/ai/conversations/browse?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load conversations');
      setRows(json.data.conversations);
      setTotal(json.data.total);
      setOffset(nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [idQuery, provider, contentQuery, startDate, endDate]);

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => load(0);
  const clearFilters = () => {
    setIdQuery('');
    setProvider('all');
    setContentQuery('');
    setStartDate('');
    setEndDate('');
    // Reload with cleared filters on the next tick (state batches).
    setTimeout(() => load(0), 0);
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-start">
      {/* Middle column: filters + conversation list */}
      <Card className="w-full xl:flex-1 xl:min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          Stored Conversations
          <Badge variant="outline" className="text-xs">{total} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input
            placeholder="Conversation ID or session ID…"
            value={idQuery}
            onChange={(e) => setIdQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="font-mono text-xs lg:col-span-2"
            data-testid="conv-browse-id"
          />
          <Input
            placeholder="Search message content…"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger data-testid="conv-browse-provider">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground shrink-0">From</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground shrink-0">To</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs" />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters} size="sm" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">Search</span>
            </Button>
            <Button onClick={clearFilters} size="sm" variant="outline" disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
            <Button onClick={() => load(offset)} size="sm" variant="outline" disabled={loading} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded p-2">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Conversation ID</TableHead>
                <TableHead>Provider / Model</TableHead>
                <TableHead>Reflink</TableHead>
                <TableHead className="text-right">Msgs</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No conversations match these filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer ${row.id === selectedId ? 'bg-muted' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                  data-testid="conv-browse-row"
                >
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(row.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs">{row.id}</code>
                    {row.legCount > 1 && (
                      <Badge variant="outline" className="ml-2 text-[10px]">{row.legCount} legs</Badge>
                    )}
                    {row.open && <Badge variant="outline" className="ml-1 text-[10px] text-green-600">open</Badge>}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${PROVIDER_STYLES[row.provider] ?? 'bg-muted text-muted-foreground'}`}>
                      {row.provider}
                    </span>
                    {row.model && <span className="ml-2 text-xs text-muted-foreground">{row.model}</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.reflinkCode ? (
                      <span title={row.recipientName ?? undefined}>{row.reflinkCode}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">{row.messageCount}</TableCell>
                  <TableCell className="text-right text-xs">${row.totalCost.toFixed(4)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setSelectedId(row.id); }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => load(offset - PAGE_SIZE)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => load(offset + PAGE_SIZE)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      </Card>

      {/* Right column: full transcript of the selected conversation (read as a
          chat, not stepped). Sticky so it stays in view while the list scrolls. */}
      <Card className="w-full xl:w-[460px] xl:shrink-0 xl:sticky xl:top-4">
        <CardContent className="p-4 h-[70vh] xl:h-[calc(100vh-7rem)]">
          <ConversationTranscriptPanel
            conversationId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
