/**
 * Traversal extraction over a replay timeline (Block E1 — Req 9.1).
 *
 * Pure and client-safe: walks the timeline in persistence order, tracking the
 * active node from node_transition markers. Attribution is honest to the
 * runtime's own semantics (design §1 race contract): the model answers turn N
 * under node state decided at turn N−1, and markers land in the stream at the
 * moment the transition fired — so an in-order walk attributes each message to
 * the node that actually governed it.
 */

/** Minimal structural slice of a ReplayStep this walk needs. */
export interface TimelineStepLike {
  message: {
    id: string;
    metadata?: {
      markerType?: string;
      fromNode?: string | null;
      toNode?: string;
      edgeId?: string | null;
      conditionType?: string | null;
      evidence?: string;
      graphVersionId?: string;
    } | null;
  };
  timestamp: string;
}

export interface TraversalHop {
  /** Index into the timeline array (the marker step). */
  stepIndex: number;
  messageId: string;
  timestamp: string;
  fromNode: string | null;
  toNode: string;
  edgeId: string | null;
  conditionType: string | null;
  evidence?: string;
}

/** Ordered node_transition hops (incl. the turn-zero ∅ → start entry). */
export function extractTraversal(timeline: TimelineStepLike[]): TraversalHop[] {
  const hops: TraversalHop[] = [];
  timeline.forEach((step, i) => {
    const meta = step.message.metadata;
    if (meta?.markerType !== 'node_transition' || typeof meta.toNode !== 'string') return;
    hops.push({
      stepIndex: i,
      messageId: step.message.id,
      timestamp: step.timestamp,
      fromNode: typeof meta.fromNode === 'string' ? meta.fromNode : null,
      toNode: meta.toNode,
      edgeId: typeof meta.edgeId === 'string' ? meta.edgeId : null,
      conditionType: typeof meta.conditionType === 'string' ? meta.conditionType : null,
      evidence: typeof meta.evidence === 'string' ? meta.evidence : undefined,
    });
  });
  return hops;
}

/**
 * Per-step active node id: null until graph entry, then the latest
 * transition's target. The transition marker step itself is attributed to the
 * node it ENTERS (the arrow is the entry moment).
 */
export function nodeAtEachStep(timeline: TimelineStepLike[]): (string | null)[] {
  let current: string | null = null;
  return timeline.map((step) => {
    const meta = step.message.metadata;
    if (meta?.markerType === 'node_transition' && typeof meta.toNode === 'string') {
      current = meta.toNode;
    }
    return current;
  });
}
