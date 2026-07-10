/**
 * Rolling context window (Req 20, task J4) — the POLICY half, pure and
 * provider-free: window config + the prune-candidate selection both the
 * OpenAI adapter (item deletes, P28) and tests share. The MECHANICS live per
 * provider: OpenAI = conversation.item.delete + a summary item; Gemini =
 * native compression configured at mint + summary text in the superseded
 * context block; cascade/text = assembly-time windowing in /api/ai/chat.
 * Re-mint is NEVER a pruning tool (P28 — the audible-silence lesson).
 */

export interface WindowConfig {
  /** Verbatim turns older than this are prunable (Req 20.1 "~5 minutes"). */
  maxVerbatimAgeMs: number;
  /** Keep at most this many verbatim user+assistant turns regardless of age. */
  maxVerbatimTurns: number;
}

export const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  maxVerbatimAgeMs: 5 * 60_000,
  maxVerbatimTurns: 16,
};

export interface WindowTurnRef {
  /** Provider/adapter item id (deletable on OpenAI). */
  id: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

/**
 * Select the turns that collapse into the summary this boundary. A turn is
 * prunable only when ALL hold:
 *  1. it is covered by the running summary (at or before `upToItemId` in the
 *     given order) — verbatim content is NEVER deleted before a summary holds
 *     it (information loss beats token cost);
 *  2. it is outside the verbatim window (older than `maxVerbatimAgeMs`, or
 *     beyond the newest `maxVerbatimTurns` items).
 *
 * `turns` must be oldest-first. Null `upToItemId` (or an id not present)
 * means the summary coverage is unknown → nothing is prunable; fail toward
 * keeping verbatim history.
 */
export function selectPrunableTurns(
  turns: WindowTurnRef[],
  upToItemId: string | null,
  config: WindowConfig,
  now: number
): WindowTurnRef[] {
  if (turns.length === 0 || !upToItemId) return [];
  const coverageEnd = turns.findIndex((t) => t.id === upToItemId);
  if (coverageEnd === -1) return [];

  const keepFromIndex = Math.max(0, turns.length - config.maxVerbatimTurns);
  return turns.filter((turn, index) => {
    if (index > coverageEnd) return false; // not summarized yet
    const outsideByAge = now - turn.timestamp > config.maxVerbatimAgeMs;
    const outsideByCount = index < keepFromIndex;
    return outsideByAge || outsideByCount;
  });
}

/** The summary item's model-visible framing (OpenAI insert; Gemini block entry). */
export function renderSummaryText(summaryText: string, summaryVersion: number): string {
  return [
    `CONVERSATION SO FAR (running summary v${summaryVersion} — earlier turns were condensed into this; treat it as shared memory of THIS conversation, not new information from the visitor):`,
    summaryText,
  ].join('\n');
}
