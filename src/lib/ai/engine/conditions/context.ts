/**
 * Shared evaluation context handed to every condition module (notes §1).
 * The batched cheap call (P26) is precomputed ONCE by the evaluator before
 * the priority walk; conditions only read it.
 */

import type { TurnEvidence, EngineState } from '../types';
import type { CheapCallResult } from '../cheap-call';

export interface ConditionContext {
  evidence: TurnEvidence;
  state: EngineState;
  /** Precomputed batched cheap-call result; null = failed/timed out/not needed → classifier conditions evaluate false (P10 fail-safe). */
  cheap: CheapCallResult | null;
  /** Max cosine similarity of utterance vs this edge's pinned exemplars; undefined = embeddings unavailable (P11 degrade). */
  similarity?: number;
  /** This turn's merged consecutive low-effort counter (heuristic + cheap call). */
  lowEffortCount: number;
  /** Injected probe patterns (D48: content comes from the host, not core). */
  probePatterns: RegExp[];
}

export interface ConditionResult {
  fired: boolean;
  reason: string;
}

/** Classifier confidence needed to fire a classifier-backed condition. */
export const CLASSIFIER_FIRE_SCORE = 0.6;
/** Default cosine threshold for intent exemplar similarity (P10). */
export const INTENT_DEFAULT_THRESHOLD = 0.82;
/** Similarity band below threshold where the classifier is the tiebreaker (P10). */
export const INTENT_TIEBREAK_BAND = 0.1;
