/**
 * Block I1 — pure attribution join for the question-analytics batch
 * (Req 16.1): first N user turns after each node_transition, bounded by the
 * conversation's next transition. No Prisma/IO here — engine-batches.ts owns
 * the SQL around it; this module is unit-testable standalone (same convention
 * as graph-coverage.ts).
 */

/** First N user turns after each node_transition are sampled (Req 16.1, default 2). */
export const ENTRY_TURNS_PER_TRANSITION = 2;
/** Stored question text cap — analytics rows, not transcripts. */
export const QUESTION_TEXT_CAP = 500;

export interface TransitionMarkerRow {
  conversationId: string;
  timestamp: Date;
  toNode: string;
  graphVersionId: string;
}

export interface UserTurnRow {
  id: string;
  conversationId: string;
  timestamp: Date;
  content: string;
}

export interface EntryTurnAttribution {
  nodeId: string;
  graphVersionId: string;
  conversationId: string;
  messageId: string;
  text: string;
}

/**
 * For each node_transition, the first N user turns AFTER it and BEFORE the
 * conversation's next transition — a turn is entry evidence for exactly one
 * node. Turns are trimmed/capped; empty ones dropped. Input order is not
 * assumed (markers and turns sort internally per conversation).
 */
export function attributeEntryTurns(
  markers: TransitionMarkerRow[],
  userTurns: UserTurnRow[],
  turnsPerTransition = ENTRY_TURNS_PER_TRANSITION
): EntryTurnAttribution[] {
  const byConversation = new Map<string, TransitionMarkerRow[]>();
  for (const marker of markers) {
    const list = byConversation.get(marker.conversationId) ?? [];
    list.push(marker);
    byConversation.set(marker.conversationId, list);
  }
  const out: EntryTurnAttribution[] = [];
  for (const [conversationId, convMarkers] of byConversation) {
    convMarkers.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const turns = userTurns
      .filter((t) => t.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (let i = 0; i < convMarkers.length; i++) {
      const marker = convMarkers[i];
      const nextAt = convMarkers[i + 1]?.timestamp.getTime() ?? Number.POSITIVE_INFINITY;
      let taken = 0;
      for (const turn of turns) {
        const at = turn.timestamp.getTime();
        if (at <= marker.timestamp.getTime()) continue;
        if (at >= nextAt) break;
        const text = turn.content.trim().slice(0, QUESTION_TEXT_CAP);
        if (text.length < 2) continue;
        out.push({
          nodeId: marker.toNode,
          graphVersionId: marker.graphVersionId,
          conversationId,
          messageId: turn.id,
          text,
        });
        if (++taken >= turnsPerTransition) break;
      }
    }
  }
  return out;
}
