/**
 * Block I1 — pure attribution join for the question-analytics batch
 * (Req 16.1): first N user turns after each node_transition, bounded by the
 * conversation's next transition. No Prisma/IO here — engine-batches.ts owns
 * the SQL around it; this module is unit-testable standalone (same convention
 * as graph-coverage.ts).
 *
 * Block M3 (Req 16 extension, design-ux-and-behavior §9.7) adds the
 * GRAPH-LESS arm: over organic conversations, UI events from the A4
 * `uiEvidence` turn metadata (project opened, section viewed, route change)
 * act as PROTO-NODE keys for the same first-N-user-turns sampling join — the
 * data the first real graph gets designed from.
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

// ---------------------------------------------------------------------------
// M3 — proto-node keys from organic (graph-less) conversations
// ---------------------------------------------------------------------------

/** Sentinel graph id for organic rows — NodeEntryQuestion has no real graph to reference. */
export const ORGANIC_GRAPH_ID = '__organic__';

const PROTO_KEY_VALUE_CAP = 60;

function protoValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9\-_/#.]+/g, '-').slice(0, PROTO_KEY_VALUE_CAP);
}

/**
 * Derive a proto-node key from ONE A4 uiEvidence event, or null when the
 * event is not visitor-locus evidence. v1 reads only the F-I-D ground-truth
 * events (`type: 'ui_state'`, published on every fid refresh — where the
 * visitor actually IS); agent-driven `navigation` tool events and preference
 * flips are deliberately excluded (they are the AGENT's moves, not the
 * visitor's interest signal).
 */
export function protoNodeKey(event: Record<string, unknown>): string | null {
  if (event.type !== 'ui_state') return null;
  const rawProject = event.project;
  const project =
    typeof rawProject === 'string'
      ? rawProject
      : rawProject && typeof rawProject === 'object' && typeof (rawProject as { slug?: unknown }).slug === 'string'
        ? ((rawProject as { slug: string }).slug)
        : null;
  if (project && protoValue(project)) return `proto:project_opened:${protoValue(project)}`;
  const route = typeof event.route === 'string' ? event.route : null;
  if (route && protoValue(route)) {
    return route.includes('#')
      ? `proto:section_viewed:${protoValue(route)}`
      : `proto:route_changed:${protoValue(route)}`;
  }
  return null;
}

export interface OrganicTurnRow extends UserTurnRow {
  /** metadata.uiEvidence of the turn — UI deltas since the PREVIOUS user turn. */
  uiEvents: Array<Record<string, unknown>>;
}

export interface OrganicEntryAttribution {
  protoKey: string;
  conversationId: string;
  messageId: string;
  text: string;
}

/**
 * The M3 sampling join: a turn carrying a derivable UI event is the FIRST
 * turn after that event (uiEvidence = deltas since the previous user turn),
 * so the carrier + following turns attribute to the event's proto-node —
 * bounded by the next carrier, capped at N (same shape as the transition
 * join above). Multiple derivable events on one carrier: the LAST one wins
 * (most recent before the turn). Turns are trimmed/capped; empty dropped.
 */
export function attributeOrganicEntryTurns(
  turns: OrganicTurnRow[],
  turnsPerEvent = ENTRY_TURNS_PER_TRANSITION
): OrganicEntryAttribution[] {
  const byConversation = new Map<string, OrganicTurnRow[]>();
  for (const turn of turns) {
    const list = byConversation.get(turn.conversationId) ?? [];
    list.push(turn);
    byConversation.set(turn.conversationId, list);
  }
  const out: OrganicEntryAttribution[] = [];
  for (const [conversationId, convTurns] of byConversation) {
    convTurns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let activeKey: string | null = null;
    let taken = 0;
    for (const turn of convTurns) {
      const keys = (turn.uiEvents ?? []).map(protoNodeKey).filter((k): k is string => k !== null);
      if (keys.length > 0) {
        activeKey = keys[keys.length - 1];
        taken = 0;
      }
      if (!activeKey || taken >= turnsPerEvent) continue;
      const text = turn.content.trim().slice(0, QUESTION_TEXT_CAP);
      if (text.length < 2) continue;
      out.push({ protoKey: activeKey, conversationId, messageId: turn.id, text });
      taken++;
    }
  }
  return out;
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
