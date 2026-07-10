/**
 * D55 context buffer — the unified passive-context pipeline
 * (conversation-engine task A3; registry D55).
 *
 * Every passive-context source — F-I-D UI state (key `fid`), the D47 engine's
 * node context sets (key `engine`), later the visitor profile and agenda —
 * publishes keyed items into ONE per-conversation buffer: last-write-wins per
 * source key, optional TTL, token-budgeted merge. One injector (the base voice
 * adapter for client-direct sessions; server-side prompt assembly for
 * cascade/text) flushes the merged result into the model's context at turn
 * boundaries via the adapter's `updateSession` primitive (D47(d)).
 *
 * The merged output is the FLOATING BLOCK (Req 19.1 / notes P27): one block
 * living at the conversation tail, removed and re-appended every turn even
 * when bit-identical — never edited in place, never left to drift into
 * history. Per-provider fidelity of that invariant is the ADAPTER's concern
 * (OpenAI: exact delete+create; Gemini: versioned supersession; cascade/text:
 * assembly ordering); this module only owns the state and the merge.
 *
 * Pure module: no DB, no network, no adapter imports (D48). The clock is
 * injectable so TTL logic is deterministic under test (notes P16).
 */

import { estimateTokensFromChars } from '@/lib/ai/pricing';

export interface PublishOptions {
  /** Entry expires this many ms after publish; absent = lives until replaced/removed. */
  ttlMs?: number;
  /** Merge order (ascending) AND budget-drop order (highest dropped first). Default 50; `fid` publishes at 10. */
  priority?: number;
}

interface BufferEntry {
  key: string;
  text: string;
  priority: number;
  ttlMs?: number;
  publishedAt: number;
  seq: number; // publish order tiebreaker for equal priorities
}

export interface ContextBlock {
  /**
   * Monotonic CONTENT version: bumps only when the merged text actually
   * changes. Providers with exact floating-block semantics re-append every
   * turn regardless; providers on versioned supersession (Gemini) send only
   * when this changes. Flush history events are recorded on change only —
   * between change events the block content is constant, so replay fidelity
   * is preserved without a row per turn.
   */
  version: number;
  /** Merged block text; '' when no live entries. */
  text: string;
  /** Source keys included, in merge order. */
  keys: string[];
  /** Keys dropped whole by the token budget (never truncated inside — notes §6). */
  dropped: string[];
  /** Estimated tokens of the merged text. */
  tokens: number;
}

/**
 * Default block budget ≈ the proven NAV_CONTEXT transport bound
 * (12 000 chars ≈ 3 000 tokens): WebRTC data-channel messages must stay well
 * under SCTP limits, and the block is paid for ~twice per turn (P27 cost
 * model) — oversized publishers compact BEFORE publishing (as F-I-D does).
 */
const DEFAULT_BUDGET_TOKENS = 3000;

export class ContextBuffer {
  private entries = new Map<string, BufferEntry>();
  private seqCounter = 0;
  private lastMergedText = '';
  private _version = 0;
  private readonly budgetTokens: number;
  private readonly now: () => number;

  constructor(opts?: { budgetTokens?: number; now?: () => number }) {
    this.budgetTokens = opts?.budgetTokens ?? DEFAULT_BUDGET_TOKENS;
    this.now = opts?.now ?? Date.now;
  }

  /** Last-write-wins per source key (D55). */
  publish(key: string, text: string, opts?: PublishOptions): void {
    this.entries.set(key, {
      key,
      text,
      priority: opts?.priority ?? 50,
      ttlMs: opts?.ttlMs,
      publishedAt: this.now(),
      seq: this.seqCounter++,
    });
  }

  remove(key: string): void {
    this.entries.delete(key);
  }

  /** Live source keys after TTL eviction (diagnostics). */
  keys(): string[] {
    this.evictExpired();
    return Array.from(this.entries.keys());
  }

  /**
   * Merge the live entries into the floating block. TTL eviction happens
   * here (lazily — serverless has no resident timer, D43); the content
   * version bumps only when the merged text differs from the previous call.
   *
   * Merge format: a single `fid` entry renders VERBATIM (byte-compatible with
   * the pre-buffer NAV_CONTEXT payload, so migrating F-I-D onto the buffer
   * changes nothing the model sees today); multiple sources render as
   * labeled sections in priority order.
   */
  getBlock(): ContextBlock {
    this.evictExpired();

    const live = Array.from(this.entries.values()).sort(
      (a, b) => a.priority - b.priority || a.seq - b.seq
    );

    // Budget: keep whole items in priority order, drop whole items from the
    // tail once over budget (notes §6 — a half item misleads the model).
    const kept: BufferEntry[] = [];
    const dropped: string[] = [];
    let tokens = 0;
    for (const entry of live) {
      const entryTokens = estimateTokensFromChars(entry.text.length);
      if (kept.length > 0 && tokens + entryTokens > this.budgetTokens) {
        dropped.push(entry.key);
        continue;
      }
      kept.push(entry);
      tokens += entryTokens;
    }

    const text =
      kept.length === 0
        ? ''
        : kept.length === 1 && kept[0].key === 'fid'
          ? kept[0].text
          : kept.map((e) => `[${e.key}]\n${e.text}`).join('\n\n');

    if (text !== this.lastMergedText) {
      this._version++;
      this.lastMergedText = text;
    }

    return {
      version: this._version,
      text,
      keys: kept.map((e) => e.key),
      dropped,
      tokens,
    };
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.ttlMs !== undefined && now - entry.publishedAt >= entry.ttlMs) {
        this.entries.delete(key);
      }
    }
  }
}
