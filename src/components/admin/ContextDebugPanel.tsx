'use client';

/**
 * Live context-debug panel (ai-assistant task 7.0) — the owner's evidence
 * surface for the 7.1/7.2 context-diet judgments.
 *
 * Floating, draggable, collapsible; mounted on the PUBLIC pill pages (`/`,
 * `/about/ai`) behind the server-side admin gate (see ai-interface-wrapper:
 * admin-gated, NOT dev-only — must work in a production build). Shows, live:
 *
 *  - Block: the D55 floating block — per-source buffer entries with chars +
 *    ~tokens, last flush result, rolling-window state (7.0a(1)/(5)).
 *  - FID: the raw fid payload vs the text the buffer actually holds —
 *    side-by-side, the before/after view once 7.1a lands (7.0a(2)).
 *  - Mint: this session's stashed mint material with per-section and
 *    per-tool-schema sizes, via /api/admin/ai/debug/context-mint (7.0a(3)).
 *  - Chat: the /api/ai/chat `_debug` envelopes (systemPrompt, contextString,
 *    engine window/profile/summary state) for text/cascade turns (7.0a(4)).
 *  - Ledger: every floating-block flush this session — trigger, size, delta
 *    vs previous, cumulative re-pushed tokens — interleaved with navigation
 *    events (7.0b). Export to clipboard/JSON.
 *
 * Observer only (7.0c): read-only taps — the buffer inspector, debug-bus
 * subscriptions, admin fetches. Adds NOTHING model-visible, triggers NO
 * pushes. Supersedes the Gen-1 ContextMonitor (7.0d — see 7.2e cleanup list).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  GripVertical,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConversationalAgent } from '@/components/providers/conversational-agent-provider';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';
import { estimateTokensFromChars } from '@/lib/ai/pricing';
import type { ContextDebugSnapshot } from '@/lib/voice/IConversationalAgentAdapter';
import type { MintDebugEntry } from '@/lib/ai/mint-debug-stash';

type FlushRow = {
  kind: 'flush';
  at: number;
  version: number;
  keys: string[];
  dropped: string[];
  tokens: number;
  chars: number;
  reason: string;
  result: string;
  changed: boolean;
  deltaChars: number;
  deltaTokens: number;
  cumTokens: number;
  blockText?: string;
};

type NavRow = { kind: 'nav'; at: number; label: string };

type LedgerRow = FlushRow | NavRow;

interface FidCapture {
  at: number;
  provider: string;
  route?: string;
  project?: unknown;
  raw: unknown;
}

interface ChatEnvelope {
  at: number;
  source: string;
  debug: Record<string, unknown>;
}

const DELIVERED_RESULTS = new Set(['applied', 'superseded', 'degraded']);
const MAX_LEDGER_ROWS = 500;
const MAX_CHAT_ENVELOPES = 20;

function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString('en-US', { hour12: false });
}

function ExpandableText({ label, text }: { label: string; text: string }) {
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px]">
        {text}
      </pre>
    </details>
  );
}

export function ContextDebugPanel() {
  const { isConnected, activeProvider, getContextDebugSnapshot, getMintSessionId, conversationId } =
    useConversationalAgent();

  const [collapsed, setCollapsed] = useState(true);
  const [tab, setTab] = useState<'block' | 'fid' | 'mint' | 'chat' | 'ledger'>('block');
  const [snapshot, setSnapshot] = useState<ContextDebugSnapshot | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [lastFid, setLastFid] = useState<FidCapture | null>(null);
  const [fidCount, setFidCount] = useState(0);
  const [chatEnvelopes, setChatEnvelopes] = useState<ChatEnvelope[]>([]);
  const [mint, setMint] = useState<MintDebugEntry | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const ledgerEndRef = useRef<HTMLDivElement>(null);
  const prevFlushRef = useRef<{ chars: number; tokens: number } | null>(null);
  const cumTokensRef = useRef(0);

  // Observer taps: the emitter is a no-op while disabled (dev auto-enables,
  // production does not) — enabling it only turns on the local ring buffer,
  // nothing model-visible.
  useEffect(() => {
    debugEventEmitter.enable();

    const onFlush = (e: { data: Record<string, unknown>; timestamp: Date }) => {
      const d = e.data as {
        version: number;
        keys: string[];
        dropped: string[];
        tokens: number;
        chars: number;
        reason: string;
        result: string;
        changed: boolean;
        blockText?: string;
      };
      const prev = prevFlushRef.current;
      const delivered = DELIVERED_RESULTS.has(d.result);
      if (delivered) cumTokensRef.current += d.tokens;
      const row: FlushRow = {
        kind: 'flush',
        at: e.timestamp.getTime(),
        version: d.version,
        keys: d.keys,
        dropped: d.dropped,
        tokens: d.tokens,
        chars: d.chars,
        reason: d.reason,
        result: d.result,
        changed: d.changed,
        deltaChars: prev ? d.chars - prev.chars : d.chars,
        deltaTokens: prev ? d.tokens - prev.tokens : d.tokens,
        cumTokens: cumTokensRef.current,
        blockText: d.blockText,
      };
      prevFlushRef.current = { chars: d.chars, tokens: d.tokens };
      setLedger((rows) => [...rows.slice(-(MAX_LEDGER_ROWS - 1)), row]);
    };

    const onNav = (e: { data: Record<string, unknown>; timestamp: Date }) => {
      const d = e.data as { type?: string; route?: string; project?: unknown; provider?: string };
      if (d.type !== 'immediate_passive_context_pushed' && d.type !== 'passive_context_enabled') return;
      const project =
        typeof d.project === 'object' && d.project !== null
          ? ((d.project as { id?: string }).id ?? JSON.stringify(d.project))
          : d.project;
      const label =
        d.type === 'passive_context_enabled'
          ? `passive context enabled (${d.provider ?? '?'})`
          : `navigation → ${d.route ?? '?'}${project ? ` / ${project}` : ''}`;
      setLedger((rows) => [
        ...rows.slice(-(MAX_LEDGER_ROWS - 1)),
        { kind: 'nav', at: e.timestamp.getTime(), label },
      ]);
    };

    const onFid = (e: { data: Record<string, unknown>; timestamp: Date }) => {
      const d = e.data as { provider: string; route?: string; project?: unknown; raw: unknown };
      setLastFid({ at: e.timestamp.getTime(), ...d });
      setFidCount((n) => n + 1);
    };

    const onChat = (e: { data: Record<string, unknown>; timestamp: Date }) => {
      const d = e.data as { source: string; debug: Record<string, unknown> };
      setChatEnvelopes((envs) =>
        [{ at: e.timestamp.getTime(), source: d.source, debug: d.debug }, ...envs].slice(0, MAX_CHAT_ENVELOPES)
      );
    };

    debugEventEmitter.on('context_flush', onFlush);
    debugEventEmitter.on('navigation_event', onNav);
    debugEventEmitter.on('fid-context-published', onFid);
    debugEventEmitter.on('chat-debug-envelope', onChat);
    return () => {
      debugEventEmitter.off('context_flush', onFlush);
      debugEventEmitter.off('navigation_event', onNav);
      debugEventEmitter.off('fid-context-published', onFid);
      debugEventEmitter.off('chat-debug-envelope', onChat);
    };
  }, []);

  // Poll the read-only buffer snapshot while expanded (side-effect-free read).
  useEffect(() => {
    if (collapsed) return;
    const tick = () => setSnapshot(getContextDebugSnapshot());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [collapsed, getContextDebugSnapshot, isConnected]);

  const fetchMint = useCallback(async () => {
    setMintError(null);
    const mintSessionId = getMintSessionId() ?? 'latest';
    try {
      const res = await fetch(
        `/api/admin/ai/debug/context-mint?sessionId=${encodeURIComponent(mintSessionId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setMint(null);
        setMintError(data?.error ?? `fetch failed (${res.status})`);
        return;
      }
      setMint(data.entry as MintDebugEntry);
    } catch (error) {
      setMint(null);
      setMintError(error instanceof Error ? error.message : 'fetch failed');
    }
  }, [getMintSessionId]);

  // Auto-load the mint breakdown once a session is up.
  useEffect(() => {
    if (isConnected && !collapsed) void fetchMint();
  }, [isConnected, collapsed, fetchMint]);

  // Keep the ledger scrolled to the latest row.
  useEffect(() => {
    if (tab === 'ledger') ledgerEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ledger, tab]);

  const flushRows = ledger.filter((r): r is FlushRow => r.kind === 'flush');
  const blockTokens = snapshot?.entries.reduce((sum, e) => sum + e.tokens, 0) ?? 0;
  const mintTokens = mint ? mint.instructions.totalTokens + mint.tools.totalTokens : null;

  const buildExport = useCallback(
    () =>
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          provider: activeProvider,
          conversationId,
          mintSessionId: getMintSessionId(),
          totals: {
            flushes: flushRows.length,
            cumulativeRePushedTokens: cumTokensRef.current,
            currentBlockTokens: blockTokens,
            mintTokens,
          },
          snapshot,
          mint,
          lastFid,
          chatEnvelopes,
          ledger,
        },
        null,
        2
      ),
    [activeProvider, conversationId, getMintSessionId, flushRows.length, blockTokens, mintTokens, snapshot, mint, lastFid, chatEnvelopes, ledger]
  );

  const copyExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildExport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn('context-debug export copy failed:', error);
    }
  }, [buildExport]);

  const downloadExport = useCallback(() => {
    const blob = new Blob([buildExport()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExport]);

  const tabs = ['block', 'fid', 'mint', 'chat', 'ledger'] as const;

  return (
    // Full-viewport, pointer-events-none constraints layer: the panel drags
    // anywhere on screen but the layer never intercepts page interaction.
    // z-[9999] matches the HomepageDevVoicePanel precedent (above the pill's
    // Z_LAYERS scale by design — ui-system §5.5 keeps owner debug on top).
    <div ref={constraintsRef} className="pointer-events-none fixed inset-0 z-[9999]">
      <motion.div
        drag
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragMomentum={false}
        dragElastic={0}
        className="pointer-events-auto absolute right-4 top-4 w-[460px] max-w-[95vw]"
        data-testid="context-debug-panel"
        data-ai-surface="true"
      >
        <div className="rounded-lg border bg-background shadow-lg">
          <div
            className="flex cursor-move items-center gap-2 p-2 text-xs font-medium text-muted-foreground"
            onPointerDown={(e) => dragControls.start(e)}
            data-testid="context-debug-drag-handle"
          >
            <GripVertical className="h-3 w-3 shrink-0" />
            <span className="shrink-0">Context Debug</span>
            <Badge variant="outline" className="text-[10px]">
              {activeProvider ?? '—'}
            </Badge>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
              title={isConnected ? 'session connected' : 'no session'}
            />
            <span className="min-w-0 flex-1 truncate text-[10px]" data-testid="context-debug-totals">
              {flushRows.length} flushes · re-pushed ~{fmtTok(cumTokensRef.current)} tok
              {mintTokens !== null ? ` · mint ~${fmtTok(mintTokens)} tok` : ''}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setCollapsed((c) => !c)}
              data-testid="context-debug-collapse"
            >
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          </div>

          {!collapsed && (
            <div className="space-y-2 p-2 pt-0 text-xs">
              <div className="flex items-center gap-1">
                {tabs.map((t) => (
                  <button
                    key={t}
                    className={`rounded px-2 py-1 text-[11px] capitalize ${
                      tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                    onClick={() => setTab(t)}
                    data-testid={`context-debug-tab-${t}`}
                  >
                    {t}
                  </button>
                ))}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={copyExport}>
                  <Copy className="mr-1 h-3 w-3" /> {copied ? 'copied' : 'copy'}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={downloadExport}>
                  <Download className="mr-1 h-3 w-3" /> json
                </Button>
              </div>

              <div className="max-h-[60vh] overflow-auto" data-testid="context-debug-body">
                {tab === 'block' && (
                  <div className="space-y-2" data-testid="context-debug-block">
                    {!snapshot || snapshot.entries.length === 0 ? (
                      <p className="text-muted-foreground">
                        {isConnected
                          ? 'Buffer is empty — navigate or wait for a publish.'
                          : 'No live session. Connect the pill to watch the floating block.'}
                      </p>
                    ) : (
                      <>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pr-2 font-medium">source</th>
                              <th className="pr-2 font-medium">chars</th>
                              <th className="pr-2 font-medium">~tok</th>
                              <th className="pr-2 font-medium">prio</th>
                              <th className="font-medium">age</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.entries.map((e) => (
                              <tr key={e.key} className={e.expired ? 'opacity-50' : ''}>
                                <td className="pr-2 font-mono">
                                  {e.key}
                                  {e.expired ? ' (expired)' : ''}
                                </td>
                                <td className="pr-2">{e.chars.toLocaleString()}</td>
                                <td className="pr-2">{fmtTok(e.tokens)}</td>
                                <td className="pr-2">{e.priority}</td>
                                <td>{Math.round((Date.now() - e.publishedAt) / 1000)}s</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-muted-foreground">
                          block total ~{fmtTok(blockTokens)} tok
                          {snapshot.lastFlush && (
                            <>
                              {' '}
                              · last flush v{snapshot.lastFlush.version} {snapshot.lastFlush.result} (
                              {snapshot.lastFlush.reason}){' '}
                              {Math.round((Date.now() - snapshot.lastFlush.at) / 1000)}s ago
                              {snapshot.lastFlush.dropped.length > 0 &&
                                ` · dropped: ${snapshot.lastFlush.dropped.join(', ')}`}
                            </>
                          )}
                        </p>
                        {snapshot.entries.map((e) => (
                          <ExpandableText key={e.key} label={`[${e.key}] text (${e.chars} ch)`} text={e.text} />
                        ))}
                        {snapshot.windowState && (
                          <ExpandableText
                            label="rolling-window state"
                            text={JSON.stringify(snapshot.windowState, null, 2)}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}

                {tab === 'fid' && (
                  <div className="space-y-2" data-testid="context-debug-fid">
                    {!lastFid ? (
                      <p className="text-muted-foreground">
                        No fid publish observed yet — navigate (open a project modal) with a live session to
                        trigger one.
                      </p>
                    ) : (
                      <>
                        <p className="text-muted-foreground">
                          {fidCount} publishes · latest {fmtTime(lastFid.at)} · route {lastFid.route ?? '?'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="min-w-0">
                            <p className="mb-1 font-medium">
                              raw payload ({JSON.stringify(lastFid.raw).length.toLocaleString()} ch · ~
                              {fmtTok(estimateTokensFromChars(JSON.stringify(lastFid.raw).length))} tok)
                            </p>
                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px]">
                              {JSON.stringify(lastFid.raw, null, 2)}
                            </pre>
                          </div>
                          <div className="min-w-0">
                            {(() => {
                              const fidEntry = snapshot?.entries.find((e) => e.key === 'fid');
                              return fidEntry ? (
                                <>
                                  <p className="mb-1 font-medium">
                                    published block text ({fidEntry.chars.toLocaleString()} ch · ~
                                    {fmtTok(fidEntry.tokens)} tok)
                                  </p>
                                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px]">
                                    {fidEntry.text}
                                  </pre>
                                </>
                              ) : (
                                <p className="text-muted-foreground">no fid entry in the buffer right now</p>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab === 'mint' && (
                  <div className="space-y-2" data-testid="context-debug-mint">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={fetchMint}>
                        <RefreshCw className="mr-1 h-3 w-3" /> reload
                      </Button>
                      <span className="text-muted-foreground">
                        {getMintSessionId() ?? 'no mint id (cascade / not connected) — falls back to latest'}
                      </span>
                    </div>
                    {mintError && <p className="text-destructive">{mintError}</p>}
                    {mint && (
                      <>
                        <p className="text-muted-foreground">
                          {mint.provider} {mint.handler} · {mint.model} · minted {mint.mintedAt}
                          {mint.resumeSessionId ? ' · resume' : ''}
                        </p>
                        <p className="font-medium">
                          instructions {mint.instructions.totalChars.toLocaleString()} ch · ~
                          {fmtTok(mint.instructions.totalTokens)} tok — tools {mint.tools.count} schemas ·{' '}
                          {mint.tools.totalChars.toLocaleString()} ch · ~{fmtTok(mint.tools.totalTokens)} tok —
                          standing total ~{fmtTok(mint.instructions.totalTokens + mint.tools.totalTokens)} tok
                        </p>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pr-2 font-medium">section</th>
                              <th className="pr-2 font-medium">chars</th>
                              <th className="font-medium">~tok</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mint.instructions.sections.map((s) => (
                              <tr key={s.label}>
                                <td className="pr-2">{s.label}</td>
                                <td className="pr-2">{s.chars.toLocaleString()}</td>
                                <td>{fmtTok(s.tokens)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {mint.instructions.sections.map((s) => (
                          <ExpandableText key={s.label} label={`${s.label} text`} text={s.text} />
                        ))}
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pr-2 font-medium">tool schema</th>
                              <th className="pr-2 font-medium">chars</th>
                              <th className="font-medium">~tok</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...mint.tools.perTool]
                              .sort((a, b) => b.chars - a.chars)
                              .map((t) => (
                                <tr key={t.name}>
                                  <td className="pr-2 font-mono">{t.name}</td>
                                  <td className="pr-2">{t.chars.toLocaleString()}</td>
                                  <td>{fmtTok(t.tokens)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}

                {tab === 'chat' && (
                  <div className="space-y-2" data-testid="context-debug-chat">
                    {chatEnvelopes.length === 0 ? (
                      <p className="text-muted-foreground">
                        No _debug envelopes yet — send a text turn (or a cascade voice turn) as admin.
                      </p>
                    ) : (
                      chatEnvelopes.map((env) => {
                        const d = env.debug as {
                          tier?: string;
                          model?: { alias?: string; resolved?: string };
                          usage?: { totalTokens?: number; costUsd?: number };
                          timings?: { totalMs?: number; modelMs?: number };
                          systemPrompt?: string;
                          contextString?: string;
                          engine?: unknown;
                        };
                        return (
                          <div key={env.at} className="rounded border p-2">
                            <p className="text-muted-foreground">
                              {fmtTime(env.at)} · {env.source} · tier {d.tier ?? '?'} ·{' '}
                              {d.model?.alias ?? d.model?.resolved ?? '?'} ·{' '}
                              {d.usage?.totalTokens != null ? `${d.usage.totalTokens} tok` : '? tok'} ·{' '}
                              {d.timings?.totalMs != null ? `${d.timings.totalMs}ms` : ''}
                            </p>
                            {typeof d.systemPrompt === 'string' && (
                              <ExpandableText
                                label={`systemPrompt (${d.systemPrompt.length.toLocaleString()} ch · ~${fmtTok(estimateTokensFromChars(d.systemPrompt.length))} tok)`}
                                text={d.systemPrompt}
                              />
                            )}
                            {typeof d.contextString === 'string' && (
                              <ExpandableText
                                label={`contextString (${d.contextString.length.toLocaleString()} ch · ~${fmtTok(estimateTokensFromChars(d.contextString.length))} tok)`}
                                text={d.contextString}
                              />
                            )}
                            {d.engine != null && (
                              <ExpandableText
                                label="engine (window / profile / summary state)"
                                text={JSON.stringify(d.engine, null, 2)}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {tab === 'ledger' && (
                  <div className="space-y-1" data-testid="context-debug-ledger">
                    {ledger.length === 0 ? (
                      <p className="text-muted-foreground">
                        No flushes yet — connect a session and navigate; every floating-block push lands here
                        with its size, delta, and the cumulative re-pushed cost.
                      </p>
                    ) : (
                      ledger.map((row, i) =>
                        row.kind === 'nav' ? (
                          <p key={`${row.at}-${i}`} className="text-[11px] text-blue-500">
                            {fmtTime(row.at)} — {row.label}
                          </p>
                        ) : (
                          <div
                            key={`${row.at}-${i}`}
                            className={`text-[11px] ${row.result === 'failed' ? 'text-destructive' : row.changed ? '' : 'text-muted-foreground'}`}
                            data-testid="context-debug-flush-row"
                          >
                            <span className="font-mono">
                              {fmtTime(row.at)} — flush v{row.version} {row.result} ({row.reason}
                              {row.changed ? '' : ', unchanged re-append'}) · {row.chars.toLocaleString()} ch ~
                              {fmtTok(row.tokens)} tok · Δ{row.deltaChars >= 0 ? '+' : ''}
                              {row.deltaChars} ch · cum ~{fmtTok(row.cumTokens)} tok
                              {row.dropped.length > 0 ? ` · dropped ${row.dropped.join(',')}` : ''}
                            </span>
                            {row.blockText && <ExpandableText label="block text" text={row.blockText} />}
                          </div>
                        )
                      )
                    )}
                    <div ref={ledgerEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
