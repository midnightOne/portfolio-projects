/**
 * Edge evaluator (notes §2.2 steps 5–7): strict ascending-priority walk, at
 * most ONE transition per turn, and the engine NEVER transitions on its own
 * heuristics — only an authored edge moves state (§2.2.7).
 *
 * Cheap-first is a per-edge internal concern: the walk is strictly priority
 * order, but all classifier-needing edges are scored in ONE batched
 * `default-cheap` call prepared BEFORE the walk (P10/P26). Classifier
 * failure/timeout → those conditions evaluate false this turn (fail-safe: no
 * transition beats a wrong one). Pure given deps (D46 testability).
 */

import type { GraphDocument, GraphEdge, GraphNode, TurnEvidence, EngineState } from './types';
import {
  CheapCallInput,
  CheapCallResult,
  CheapCallEdgeDescriptor,
  cheapCallNeeded,
} from './cheap-call';
import {
  ConditionContext,
  evaluateCondition,
  conditionNeedsClassifier,
  heuristicLowEffort,
  INTENT_DEFAULT_THRESHOLD,
  INTENT_TIEBREAK_BAND,
} from './conditions';

export interface EvaluatorDeps {
  /** Embed the utterance with the RECORDED model id (P11). Null on failure — intent degrades to classifier-only. */
  embedUtterance(text: string, modelId: string): Promise<number[] | null>;
  /** The ONE batched cheap call (P26). Host owns metering (D33) and the ~2s timeout (P10). Null on failure/timeout. */
  runCheapCall(input: CheapCallInput): Promise<CheapCallResult | null>;
  /** Probe pattern list — host-supplied config (D48), empty = classifier-only probes. */
  probePatterns?: RegExp[];
  log?: (message: string, data?: unknown) => void;
}

export interface EvaluatedEdge {
  edgeId: string;
  fired: boolean;
  reason: string;
}

export interface EvaluationOutcome {
  fired: GraphEdge | null;
  firedReason: string | null;
  /** Edges actually evaluated this turn, in walk order (Req 7.3 debug telemetry). */
  evaluated: EvaluatedEdge[];
  cheap: CheapCallResult | null;
  /** Merged consecutive low-effort counter AFTER this turn (persist into state). */
  lowEffortCount: number;
  /** Working slot state AFTER this turn's extraction merge (persist into state). */
  slots: Record<string, string>;
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function evaluateEdges(args: {
  node: GraphNode;
  document: GraphDocument;
  evidence: TurnEvidence;
  state: EngineState;
  deps: EvaluatorDeps;
}): Promise<EvaluationOutcome> {
  const { node, document, evidence, state, deps } = args;
  const log = deps.log ?? (() => undefined);
  const probePatterns = deps.probePatterns ?? [];

  const edges = document.edges
    .filter((e) => e.from === node.id)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  // ---- Pre-walk: exemplar similarities for intent edges (P11 pinned model) ----
  const similarities = new Map<string, number>();
  const utteranceVecByModel = new Map<string, number[] | null>();
  for (const edge of edges) {
    if (edge.condition.type !== 'intent') continue;
    const pinned = document.embeddings?.[edge.id];
    if (!pinned || pinned.vectors.length === 0) continue; // no embeddings → classifier-only degrade (P11)
    let utteranceVec = utteranceVecByModel.get(pinned.model);
    if (utteranceVec === undefined) {
      try {
        utteranceVec = await deps.embedUtterance(evidence.utterance, pinned.model);
      } catch (err) {
        log('engine: utterance embedding failed — intent edges degrade to classifier-only', err);
        utteranceVec = null;
      }
      utteranceVecByModel.set(pinned.model, utteranceVec);
    }
    if (!utteranceVec) continue;
    let best = 0;
    for (const exemplarVec of pinned.vectors) best = Math.max(best, cosine(utteranceVec, exemplarVec));
    similarities.set(edge.id, best);
  }

  // ---- Pre-walk: assemble the ONE batched cheap call (P26) ----
  const classifierDescriptors: CheapCallEdgeDescriptor[] = [];
  for (const edge of edges) {
    if (!conditionNeedsClassifier(edge)) continue;
    if (edge.condition.type === 'intent') {
      const sim = similarities.get(edge.id);
      const threshold = edge.condition.threshold ?? INTENT_DEFAULT_THRESHOLD;
      // Classifier only for the tiebreaker band or the no-embeddings degrade —
      // similarity clearing the threshold (or clearly below band) skips it (P10).
      const needsClassifier =
        sim === undefined || (sim < threshold && sim >= threshold - INTENT_TIEBREAK_BAND);
      if (needsClassifier) {
        classifierDescriptors.push({
          edgeId: edge.id,
          meaning: `the user's intent matches: ${edge.condition.exemplars.slice(0, 3).join(' / ')}`,
        });
      }
    } else if (edge.condition.type === 'pivot') {
      classifierDescriptors.push({
        edgeId: edge.id,
        meaning: 'the user explicitly pivots to a different topic than the current one',
      });
    }
  }
  const probeEdges = edges.some((e) => e.condition.type === 'probe');
  const probeByPattern = probeEdges && probePatterns.some((p) => p.test(evidence.utterance));
  const turnQualityEdges = edges.some((e) => e.condition.type === 'turn_quality');
  const heuristicLow = heuristicLowEffort(evidence.utterance);

  const input: CheapCallInput = {
    utterance: evidence.utterance,
    edges: classifierDescriptors,
    slots: node.slots?.capture ?? [],
    wantProbe: probeEdges && !probeByPattern,
    wantTurnQuality: turnQualityEdges && !heuristicLow,
  };

  let cheap: CheapCallResult | null = null;
  if (cheapCallNeeded(input)) {
    try {
      cheap = await deps.runCheapCall(input);
    } catch (err) {
      log('engine: cheap call failed — classifier conditions evaluate false this turn (P10)', err);
      cheap = null;
    }
  }

  // ---- Working state for this turn ----
  const lowEffort = heuristicLow || cheap?.lowEffort === true;
  const lowEffortCount = lowEffort ? state.consecutiveLowEffort + 1 : 0;
  const slots = { ...state.slots, ...(cheap?.slots ?? {}) };

  const ctxBase: Omit<ConditionContext, 'similarity'> = {
    evidence,
    state: { ...state, slots },
    cheap,
    lowEffortCount,
    probePatterns,
  };

  // ---- The walk: strict priority order, first match fires ----
  const evaluated: EvaluatedEdge[] = [];
  let fired: GraphEdge | null = null;
  let firedReason: string | null = null;
  for (const edge of edges) {
    const result = evaluateCondition(edge, { ...ctxBase, similarity: similarities.get(edge.id) });
    evaluated.push({ edgeId: edge.id, fired: result.fired, reason: result.reason });
    if (result.fired) {
      fired = edge;
      firedReason = result.reason;
      break; // at most one transition per turn (Req 2.2)
    }
  }

  return { fired, firedReason, evaluated, cheap, lowEffortCount, slots };
}
